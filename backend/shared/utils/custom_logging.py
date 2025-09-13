import io
import json
import logging
import sys


class UTF8StreamHandler(logging.StreamHandler):
    def __init__(self, stream=None):
        if stream is None:
            stream = sys.stderr

        utf8_stream = io.TextIOWrapper(stream.buffer, encoding="utf-8", line_buffering=True)
        super().__init__(utf8_stream)


class UnescapeUnicodeFilter(logging.Filter):
    def filter(self, record):
        try:
            msg = json.loads(record.getMessage())
            record.msg = json.dumps(msg, ensure_ascii=False)
        except Exception:
            pass
        return True


logger = logging.getLogger("semantic_kernel.utils.telemetry.model_diagnostics.decorators")
logger.addFilter(UnescapeUnicodeFilter())
