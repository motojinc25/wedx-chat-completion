import { ApiClient } from '@/shared/utils/api'
import type {
  LogsFilters,
  MetricsFilters,
  ObservabilityLog,
  ObservabilityMetric,
  ObservabilityOverview,
  ObservabilityTrace,
  TracesFilters,
} from '../types'

// Response interfaces for API
export interface ObservabilityLogsResponse {
  logs: ObservabilityLog[]
  count: number
}

export interface ObservabilityTracesResponse {
  traces: ObservabilityTrace[]
  count: number
}

export interface ObservabilityMetricsResponse {
  metrics: ObservabilityMetric[]
  count: number
}

export interface ObservabilityOverviewResponse {
  overview: ObservabilityOverview
}

class ObservabilityAPI {
  private apiClient: ApiClient

  constructor() {
    this.apiClient = new ApiClient()
  }

  // Logs endpoints
  async getLogs(filters: LogsFilters = {}): Promise<ObservabilityLogsResponse> {
    const params = new URLSearchParams()

    if (filters.severity) params.append('severity', filters.severity)
    if (filters.severity_min) params.append('severity_min', filters.severity_min.toString())
    if (filters.search) params.append('search', filters.search)
    if (filters.trace_id) params.append('trace_id', filters.trace_id)
    if (filters.time_from) params.append('time_from', filters.time_from)
    if (filters.time_to) params.append('time_to', filters.time_to)
    if (filters.resource_service_name) params.append('resource_service_name', filters.resource_service_name)
    if (filters.scope_name) params.append('scope_name', filters.scope_name)
    if (filters.limit) params.append('limit', filters.limit.toString())

    const queryString = params.toString()
    const url = `/observability/logs${queryString ? `?${queryString}` : ''}`

    return this.apiClient.get(url)
  }

  // Get logs for a specific trace
  async getLogsForTrace(traceId: string): Promise<ObservabilityLogsResponse> {
    return this.getLogs({ trace_id: traceId })
  }

  // Traces endpoints
  async getTraces(filters: TracesFilters = {}): Promise<ObservabilityTracesResponse> {
    const params = new URLSearchParams()

    if (filters.service_name) params.append('service_name', filters.service_name)
    if (filters.operation_name) params.append('operation_name', filters.operation_name)
    if (filters.min_duration) params.append('min_duration', filters.min_duration.toString())
    if (filters.min_duration_ms) params.append('min_duration_ms', filters.min_duration_ms.toString())
    if (filters.max_duration) params.append('max_duration', filters.max_duration.toString())
    if (filters.status_code) params.append('status_code', filters.status_code)
    if (filters.time_from) params.append('time_from', filters.time_from)
    if (filters.time_to) params.append('time_to', filters.time_to)
    if (filters.trace_id) params.append('trace_id', filters.trace_id)
    if (filters.limit) params.append('limit', filters.limit.toString())

    const queryString = params.toString()
    const url = `/observability/traces${queryString ? `?${queryString}` : ''}`

    return this.apiClient.get(url)
  }

  async getTraceById(traceId: string): Promise<{ trace: ObservabilityTrace[] }> {
    return this.apiClient.get(`/observability/traces/${traceId}`)
  }

  // Metrics endpoints
  async getMetrics(filters: MetricsFilters = {}): Promise<ObservabilityMetricsResponse> {
    const params = new URLSearchParams()

    if (filters.metric_name) params.append('metric_name', filters.metric_name)
    if (filters.metric_type) params.append('metric_type', filters.metric_type)
    if (filters.resource_service_name) params.append('resource_service_name', filters.resource_service_name)
    if (filters.time_from) params.append('time_from', filters.time_from)
    if (filters.time_to) params.append('time_to', filters.time_to)
    if (filters.limit) params.append('limit', filters.limit.toString())

    const queryString = params.toString()
    const url = `/observability/metrics${queryString ? `?${queryString}` : ''}`

    return this.apiClient.get(url)
  }

  // Overview endpoint
  async getOverview(): Promise<ObservabilityOverviewResponse> {
    return this.apiClient.get('/observability/overview')
  }
}

export const observabilityApi = new ObservabilityAPI()
