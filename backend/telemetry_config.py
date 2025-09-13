import asyncio
from datetime import datetime
import json
import logging
from pathlib import Path
import tomllib
import typing

from opentelemetry._logs import set_logger_provider
from opentelemetry.metrics import set_meter_provider
from opentelemetry.sdk._logs import LogData, LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs._internal.export import LogExporter
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics._internal.point import MetricsData
from opentelemetry.sdk.metrics.export import MetricExporter, PeriodicExportingMetricReader
from opentelemetry.sdk.metrics.view import DropAggregation, View
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.trace import set_tracer_provider

from shared.database import db_manager
from shared.models import OtelLogsV4, OtelMetricsV4, OtelSpansV4

logger = logging.getLogger(__name__)

# Global queues for telemetry data
_spans_queue: asyncio.Queue = None
_logs_queue: asyncio.Queue = None
_metrics_queue: asyncio.Queue = None
_background_tasks: set = set()


def get_project_info_from_pyproject():
    """
    Get project name and version from pyproject.toml file.
    Reuses the same logic as get_version_from_pyproject from main.py.

    Returns:
        tuple: (name, version) from pyproject.toml
    """
    try:
        pyproject_path = Path(__file__).parent / "pyproject.toml"
        with pyproject_path.open("rb") as f:
            pyproject_data = tomllib.load(f)

        name = pyproject_data["project"]["name"]
        version = pyproject_data["project"]["version"]

        return name, version
    except Exception as e:
        logger.error("Error reading project info from pyproject.toml: %s", e)
        return "wedx-chat-completion", "unknown"


async def _process_spans_queue():
    """Background task to process spans from queue."""
    global _spans_queue

    while True:
        try:
            spans = await _spans_queue.get()
            if spans is None:  # Shutdown signal
                break

            await _save_spans_to_db(spans)
            _spans_queue.task_done()
        except Exception as e:
            logger.error("Error processing spans queue: %s", e)


async def _process_logs_queue():
    """Background task to process logs from queue."""
    global _logs_queue

    while True:
        try:
            logs = await _logs_queue.get()
            if logs is None:  # Shutdown signal
                break

            await _save_logs_to_db(logs)
            _logs_queue.task_done()
        except Exception as e:
            logger.error("Error processing logs queue: %s", e)


async def _process_metrics_queue():
    """Background task to process metrics from queue."""
    global _metrics_queue

    while True:
        try:
            metrics_data = await _metrics_queue.get()
            if metrics_data is None:  # Shutdown signal
                break

            await _save_metrics_to_db(metrics_data)
            _metrics_queue.task_done()
        except Exception as e:
            logger.error("Error processing metrics queue: %s", e)


async def _save_spans_to_db(spans: typing.Sequence[ReadableSpan]):
    """Save spans data to PostgreSQL using shared session manager."""
    if not db_manager.async_session_maker:
        logger.warning("Database session maker not initialized, skipping trace export")
        return

    try:
        async with db_manager.async_session_maker() as db:
            try:
                for span in spans:
                    span_data = json.loads(span.to_json())
                    ctx = span_data.get("context", {}) or {}
                    res = span_data.get("resource", {}) or {}
                    res_attr = res.get("attributes", {}) or {}
                    trace_id = _strip_0x(ctx.get("trace_id"))
                    span_id = _strip_0x(ctx.get("span_id"))
                    parent_id = _strip_0x(span_data.get("parent_id"))
                    start_time = _parse_time(span_data["start_time"])
                    end_time = _parse_time(span_data["end_time"])
                    span = OtelSpansV4(
                        trace_id=trace_id,
                        span_id=span_id,
                        parent_id=parent_id,
                        name=span_data.get("name", ""),
                        kind=span_data.get("kind"),
                        start_time=start_time,
                        end_time=end_time,
                        status_code=(span_data.get("status") or {}).get("status_code"),
                        service_name=res_attr.get("service.name"),
                        service_version=res_attr.get("service.version"),
                        resource_attr=res_attr,
                        attributes=span_data.get("attributes") or {},
                        events=span_data.get("events") or [],
                        links=span_data.get("links") or [],
                        raw=span_data,
                    )
                    db.add(span)
                await db.commit()
            except Exception as e:
                logger.error("Invalid OTEL spans payload structure: %s", e)
                await db.rollback()
                raise
    except Exception as e:
        logger.error("Failed to save spans using shared session: %s", e)


async def _save_logs_to_db(batch: typing.Sequence[LogData]):
    """Save logs data to PostgreSQL using shared session manager."""
    if not db_manager.async_session_maker:
        logger.warning("Database session maker not initialized, skipping log export")
        return

    try:
        async with db_manager.async_session_maker() as db:
            try:
                for log in batch:
                    log_data = json.loads(log.log_record.to_json())
                    body_text, body_json = _parse_body(log_data.get("body"))
                    log = OtelLogsV4(
                        event_name=log_data.get("event_name"),
                        trace_id=log_data.get("trace_id"),
                        span_id=log_data.get("span_id"),
                        trace_flags=log_data.get("trace_flags"),
                        time=_parse_time(log_data.get("timestamp")),
                        observed_time=_parse_time(log_data.get("observed_timestamp")),
                        severity_number=log_data.get("severity_number"),
                        severity_text=log_data.get("severity_text"),
                        body_text=body_text,
                        body_json=body_json,
                        attributes=log_data.get("attributes") or {},
                        resource=log_data.get("resource") or {},
                        dropped_attributes=log_data.get("dropped_attributes"),
                        raw=log_data,
                    )
                    db.add(log)
                await db.commit()
            except Exception as e:
                logger.error("Failed to save logs in shared session: %s", e)
                await db.rollback()
                raise
    except Exception as e:
        logger.error("Failed to save logs using shared session: %s", e)


async def _save_metrics_to_db(metrics_data: MetricsData):
    """Save metrics data to PostgreSQL using shared session manager."""
    if not db_manager.async_session_maker:
        logger.warning("Database session maker not initialized, skipping metrics export")
        return

    try:
        metrics_json_data = json.loads(metrics_data.to_json())
        logger.debug("Processing metrics data: %s", json.dumps(metrics_json_data, indent=2))
    except Exception as e:
        logger.error("Failed to parse metrics data to JSON: %s", e)
        return

    try:
        async with db_manager.async_session_maker() as db:
            try:
                # Handle multiple resource metrics
                for resource_metric in metrics_json_data.get("resource_metrics", []):
                    resource_attrs = resource_metric.get("resource", {}).get("attributes", {})

                    # Handle multiple scope metrics
                    for scope_metric in resource_metric.get("scope_metrics", []):
                        scope = scope_metric.get("scope", {})

                        # Handle multiple metrics
                        for metric in scope_metric.get("metrics", []):
                            metric_name = metric.get("name", "unknown_metric")
                            metric_data = metric.get("data", {})
                            data_points = metric_data.get("data_points", [])

                            # Handle multiple data points
                            for dp in data_points:
                                # Handle timestamp safely
                                ts_nano = dp.get("time_unix_nano")
                                if ts_nano is None:
                                    logger.warning("Missing time_unix_nano in data point, using current time")
                                    ts_datetime = datetime.now()
                                else:
                                    try:
                                        ts_seconds = ts_nano / 1e9  # nanoseconds → seconds
                                        ts_datetime = datetime.fromtimestamp(ts_seconds)
                                    except (ValueError, OSError) as e:
                                        logger.warning("Invalid timestamp %s, using current time: %s", ts_nano, e)
                                        ts_datetime = datetime.now()

                                data_json = {
                                    "count": dp.get("count"),
                                    "sum": dp.get("sum"),
                                    "min": dp.get("min"),
                                    "max": dp.get("max"),
                                    "bucketCounts": dp.get("bucket_counts", []),
                                    "explicitBounds": dp.get("explicit_bounds", []),
                                    "exemplars": dp.get("exemplars", []),
                                    "aggregationTemporality": metric_data.get("aggregation_temporality"),
                                    "attributes": dp.get("attributes", {}),
                                }

                                metric_record = OtelMetricsV4(
                                    metric_name=metric_name,
                                    ts=ts_datetime,
                                    resource_attrs=resource_attrs,
                                    scope_attrs=scope,
                                    data=data_json,
                                )
                                db.add(metric_record)
                                logger.debug("Added metric record: %s at %s", metric_name, ts_datetime)

                await db.commit()
            except Exception as e:
                logger.error("Error processing metrics data: %s", e)
                logger.debug("Metrics data structure: %s", json.dumps(metrics_json_data, indent=2))
                await db.rollback()
                raise
    except Exception as e:
        logger.error("Failed to save metrics using shared session: %s", e)


def _strip_0x(hex_str: str | None) -> str | None:
    """Strip 0x prefix from hex string."""
    if hex_str is None:
        return None
    s = hex_str.lower()
    s = s.removeprefix("0x")
    return s


def _parse_time(ts: str | None) -> datetime | None:
    """Parse timestamp string to datetime."""
    if ts is None:
        return None
    if ts.endswith("Z"):
        return datetime.fromisoformat(ts)
    return datetime.fromisoformat(ts)


def _parse_body(body: typing.Any):
    """Parse log body to text and JSON."""
    if body is None:
        return None, None
    if isinstance(body, dict | list):
        try:
            return json.dumps(body, ensure_ascii=False), body
        except Exception:
            return str(body), None
    if isinstance(body, str):
        s = body.strip()
        if s.startswith("{") or s.startswith("["):
            try:
                return body, json.loads(body)
            except Exception:
                return body, None
        return body, None
    return str(body), None


class PostgreSQLSpanExporter(SpanExporter):
    """Custom span exporter that saves traces to PostgreSQL using queue-based processing."""

    def __init__(self):
        super().__init__()

    def export(self, spans: typing.Sequence[ReadableSpan]):
        """Export spans to PostgreSQL via queue."""
        global _spans_queue

        if _spans_queue is None:
            logger.warning("Spans queue not initialized, skipping trace export")
            return False

        try:
            # Add spans to queue for background processing
            _spans_queue.put_nowait(spans)
            return True
        except asyncio.QueueFull:
            logger.error("Spans queue is full, dropping trace data")
            return False
        except Exception as e:
            logger.error("Failed to export spans to queue: %s", e)
            return False


class PostgreSQLLogExporter(LogExporter):
    """Custom log exporter that saves logs to PostgreSQL using queue-based processing."""

    def __init__(self):
        super().__init__()

    def export(self, batch: typing.Sequence[LogData]):
        """Export logs to PostgreSQL via queue."""
        global _logs_queue

        if _logs_queue is None:
            logger.warning("Logs queue not initialized, skipping log export")
            return False

        try:
            # Add logs to queue for background processing
            _logs_queue.put_nowait(batch)
            return True
        except asyncio.QueueFull:
            logger.error("Logs queue is full, dropping log data")
            return False
        except Exception as e:
            logger.error("Failed to export logs to queue: %s", e)
            return False

    def shutdown(self):
        """Shutdown the exporter."""
        pass


class PostgreSQLMetricExporter(MetricExporter):
    """Custom metric exporter that saves metrics to PostgreSQL using queue-based processing."""

    def __init__(self):
        super().__init__()

    def export(self, metrics_data: MetricsData, timeout_millis: int = 10000):
        """Export metrics to PostgreSQL via queue."""
        global _metrics_queue

        if _metrics_queue is None:
            logger.warning("Metrics queue not initialized, skipping metrics export")
            return False

        try:
            # Add metrics to queue for background processing
            _metrics_queue.put_nowait(metrics_data)
            return True
        except asyncio.QueueFull:
            logger.error("Metrics queue is full, dropping metrics data")
            return False
        except Exception as e:
            logger.error("Failed to export metrics to queue: %s", e)
            return False

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        """Force flush any remaining data."""
        # No buffering in this implementation
        return True

    def shutdown(self, timeout_millis: float = 30000, **kwargs):
        """Shutdown the exporter."""
        pass


def setup_telemetry(service_name: str | None = None, service_version: str | None = None):
    """
    Set up OpenTelemetry instrumentation following official Semantic Kernel guidelines.
    If service_name or service_version are not provided, they will be read from pyproject.toml.

    Args:
        service_name: Name of the service (optional, defaults to pyproject.toml name)
        service_version: Version of the service (optional, defaults to pyproject.toml version)
    """
    global _spans_queue, _logs_queue, _metrics_queue, _background_tasks

    # Get project info from pyproject.toml if not provided
    if service_name is None or service_version is None:
        project_name, project_version = get_project_info_from_pyproject()
        service_name = service_name or project_name
        service_version = service_version or project_version

    logger.info("Setting up telemetry for %s v%s", service_name, service_version)

    # Initialize queues for background processing
    _spans_queue = asyncio.Queue(maxsize=1000)
    _logs_queue = asyncio.Queue(maxsize=1000)
    _metrics_queue = asyncio.Queue(maxsize=1000)

    # Start background processing tasks
    spans_task = asyncio.create_task(_process_spans_queue())
    logs_task = asyncio.create_task(_process_logs_queue())
    metrics_task = asyncio.create_task(_process_metrics_queue())

    # Keep references to tasks to prevent garbage collection
    _background_tasks.update({spans_task, logs_task, metrics_task})

    # Create resource
    resource = Resource.create(
        {
            ResourceAttributes.SERVICE_NAME: service_name,
            ResourceAttributes.SERVICE_VERSION: service_version,
        }
    )

    # Logging using PostgreSQL exporter
    log_exporter = PostgreSQLLogExporter()
    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
    set_logger_provider(logger_provider)

    handler = LoggingHandler()
    handler.addFilter(logging.Filter("semantic_kernel"))
    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)

    # Tracing using PostgreSQL exporter
    trace_exporter = PostgreSQLSpanExporter()
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(BatchSpanProcessor(trace_exporter))
    set_tracer_provider(tracer_provider)

    # Metrics using PostgreSQL exporter
    metric_exporter = PostgreSQLMetricExporter()
    meter_provider = MeterProvider(
        metric_readers=[PeriodicExportingMetricReader(metric_exporter, export_interval_millis=10_000)],
        resource=resource,
        views=[
            # Dropping all instrument names except for those starting with "semantic_kernel"
            View(instrument_name="*", aggregation=DropAggregation()),
            View(instrument_name="semantic_kernel*"),
        ],
    )
    set_meter_provider(meter_provider)


async def shutdown_telemetry():
    """Shutdown telemetry background tasks and queues."""
    global _spans_queue, _logs_queue, _metrics_queue, _background_tasks

    logger.info("Shutting down telemetry background tasks...")

    # Send shutdown signals to queues
    if _spans_queue:
        await _spans_queue.put(None)
    if _logs_queue:
        await _logs_queue.put(None)
    if _metrics_queue:
        await _metrics_queue.put(None)

    # Cancel background tasks
    for task in _background_tasks:
        if not task.done():
            task.cancel()

    # Wait for tasks to complete or timeout
    if _background_tasks:
        try:
            await asyncio.wait_for(asyncio.gather(*_background_tasks, return_exceptions=True), timeout=5.0)
        except TimeoutError:
            logger.warning("Telemetry background tasks did not shutdown gracefully within timeout")

    # Clear references
    _background_tasks.clear()
    _spans_queue = None
    _logs_queue = None
    _metrics_queue = None

    logger.info("Telemetry shutdown completed")
