// Observability feature types

export interface ObservabilityLog {
  id: string // UUID in backend
  time: string
  severity_number?: number
  severity_text?: string
  body: string | object | null
  attributes: Record<string, unknown>
  trace_id_hex?: string
  span_id_hex?: string
  resource_attributes: Record<string, unknown>
  scope_name?: string
  event_name?: string
  trace_flags?: number
  observed_time?: string
  body_text?: string
  body_json?: Record<string, unknown>
  dropped_attributes?: number
}

export interface ObservabilityTrace {
  id: string // UUID in backend
  trace_id_hex: string
  span_id_hex: string
  parent_span_id_hex?: string
  name: string
  kind: string
  start_time: string
  end_time: string
  duration_ms: number
  status_code: string
  status_message?: string
  attributes: Record<string, unknown>
  resource_attributes: Record<string, unknown>
  scope_name?: string
}

export interface ObservabilityMetric {
  id: string // UUID in backend
  name: string
  type: string
  unit?: string
  description?: string
  latest_value: number
  latest_time: string
  attributes: Record<string, unknown>
  resource_attributes: Record<string, unknown>
  scope_name?: string
  data?: {
    value: number
    time: string
    exemplar?: {
      trace_id_hex?: string
      span_id_hex?: string
    }
  }[]
  raw_data?: {
    value: number
    time: string
    exemplar?: {
      trace_id_hex?: string
      span_id_hex?: string
    }
  }[]
}

export interface ObservabilityOverview {
  total_logs: number
  total_traces: number
  total_spans: number
  total_metrics: number
  error_rate: number
  avg_response_time: number
  active_spans: number
  recent_errors: Array<{
    message: string
    count: number
    last_seen: string
  }>
  recent_errors_24h: Array<{
    message: string
    count: number
    last_seen: string
  }>
  slow_spans_24h: Array<{
    message: string
    count: number
    last_seen: string
  }>
}

export interface LogsFilters {
  severity?: string
  severity_min?: number
  search?: string
  trace_id?: string
  time_from?: string
  time_to?: string
  resource_service_name?: string
  scope_name?: string
  limit?: number
}

export interface TracesFilters {
  service_name?: string
  operation_name?: string
  min_duration?: number
  min_duration_ms?: number
  max_duration?: number
  status_code?: string
  time_from?: string
  time_to?: string
  trace_id?: string
  limit?: number
}

export interface MetricsFilters {
  metric_name?: string
  metric_type?: string
  resource_service_name?: string
  time_from?: string
  time_to?: string
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}
