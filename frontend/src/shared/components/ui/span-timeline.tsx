import { useMemo } from 'react'
import type { ObservabilityTrace } from '@/features/observability/types'
import { Badge } from './badge'
import { Card, CardContent } from './card'

interface SpanTimelineProps {
  traces: ObservabilityTrace[]
  selectedTraceId?: string | null
  onSpanClick?: (span: ObservabilityTrace) => void
}

const SPAN_KIND_COLORS = {
  INTERNAL: 'bg-gray-400',
  SERVER: 'bg-blue-500',
  CLIENT: 'bg-green-500',
  PRODUCER: 'bg-purple-500',
  CONSUMER: 'bg-orange-500',
} as const

const STATUS_COLORS = {
  UNSET: 'bg-gray-300',
  OK: 'bg-green-400',
  ERROR: 'bg-red-500',
} as const

export function SpanTimeline({ traces, selectedTraceId, onSpanClick }: SpanTimelineProps) {
  const selectedTraceSpans = useMemo(() => {
    return traces.filter((span) => span.trace_id_hex === selectedTraceId)
  }, [traces, selectedTraceId])

  const spanBars = useMemo(() => {
    if (selectedTraceSpans.length === 0) return []

    // Find the earliest start time and latest end time
    const startTimes = selectedTraceSpans.map((span) => new Date(span.start_time).getTime())
    const endTimes = selectedTraceSpans.map((span) => new Date(span.end_time).getTime())
    const traceStart = Math.min(...startTimes)
    const traceEnd = Math.max(...endTimes)
    const traceDuration = traceEnd - traceStart || 1

    // Build parent-child relationships
    const spanMap = new Map<string, ObservabilityTrace>()
    const childrenMap = new Map<string, ObservabilityTrace[]>()

    selectedTraceSpans.forEach((span) => {
      spanMap.set(span.span_id_hex, span)
      if (!childrenMap.has(span.span_id_hex)) {
        childrenMap.set(span.span_id_hex, [])
      }
    })

    selectedTraceSpans.forEach((span) => {
      if (span.parent_span_id_hex && spanMap.has(span.parent_span_id_hex)) {
        if (!childrenMap.has(span.parent_span_id_hex)) {
          childrenMap.set(span.parent_span_id_hex, [])
        }
        childrenMap.get(span.parent_span_id_hex)?.push(span)
      }
    })

    // Assign depths to spans
    const depthMap = new Map<string, number>()

    const assignDepth = (span: ObservabilityTrace, depth = 0) => {
      depthMap.set(span.span_id_hex, depth)
      const children = childrenMap.get(span.span_id_hex) || []
      children.forEach((child) => assignDepth(child, depth + 1))
    }

    // Find root spans and assign depths
    const rootSpans = selectedTraceSpans.filter(
      (span) => !span.parent_span_id_hex || !spanMap.has(span.parent_span_id_hex),
    )
    rootSpans.forEach((span) => assignDepth(span))

    // Calculate bar positions
    return selectedTraceSpans
      .map((span) => {
        const spanStart = new Date(span.start_time).getTime()
        const spanEnd = new Date(span.end_time).getTime()
        const left = ((spanStart - traceStart) / traceDuration) * 100
        const width = Math.max(((spanEnd - spanStart) / traceDuration) * 100, 0.5) // Minimum width for visibility

        return {
          span,
          left,
          width,
          depth: depthMap.get(span.span_id_hex) || 0,
        }
      })
      .sort((a, b) => {
        // Sort by depth first, then by start time
        if (a.depth !== b.depth) return a.depth - b.depth
        return new Date(a.span.start_time).getTime() - new Date(b.span.start_time).getTime()
      })
  }, [selectedTraceSpans])

  const formatDuration = (durationMs: number) => {
    if (durationMs < 1) {
      return `${(durationMs * 1000).toFixed(0)}μs`
    }
    if (durationMs < 1000) {
      return `${durationMs.toFixed(1)}ms`
    }
    return `${(durationMs / 1000).toFixed(2)}s`
  }

  if (!selectedTraceId) {
    return (
      <Card className="h-full">
        <CardContent className="p-6 flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <div className="text-lg mb-2">Select a trace to view timeline</div>
            <div className="text-sm">Click on a trace from the left panel to see its span timeline</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (spanBars.length === 0) {
    return (
      <Card className="h-full">
        <CardContent className="p-6 flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <div className="text-lg mb-2">No spans found</div>
            <div className="text-sm">The selected trace has no spans to display</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalTraceDuration = Math.max(...selectedTraceSpans.map((s) => s.duration_ms))

  return (
    <Card className="h-full">
      <CardContent className="p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Span Timeline</h3>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div>Trace: {selectedTraceId.substring(0, 8)}...</div>
            <div>{selectedTraceSpans.length} spans</div>
            <div className="font-medium">{formatDuration(totalTraceDuration)}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-1">
            {spanBars.map(({ span, left, width, depth }) => (
              <div
                key={span.span_id_hex}
                className="relative group cursor-pointer"
                onClick={() => onSpanClick?.(span)}
                style={{ marginLeft: `${depth * 16}px` }}>
                {/* Span name and metadata */}
                <div className="flex items-center justify-between text-xs mb-1 pr-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-medium truncate max-w-[200px]" title={span.name}>
                      {span.name}
                    </span>
                    <Badge
                      className={`text-xs px-1 py-0 ${
                        SPAN_KIND_COLORS[span.kind as keyof typeof SPAN_KIND_COLORS] || SPAN_KIND_COLORS.INTERNAL
                      } text-white`}>
                      {span.kind}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>{formatDuration(span.duration_ms)}</span>
                    <Badge
                      className={`text-xs px-1 py-0 ${
                        STATUS_COLORS[span.status_code as keyof typeof STATUS_COLORS] || STATUS_COLORS.UNSET
                      } text-white`}>
                      {span.status_code}
                    </Badge>
                  </div>
                </div>

                {/* Timeline bar */}
                <div className="h-6 bg-gray-100 rounded relative overflow-hidden hover:bg-gray-200 transition-colors">
                  <div
                    className={`h-full rounded transition-all duration-200 group-hover:opacity-80 ${
                      SPAN_KIND_COLORS[span.kind as keyof typeof SPAN_KIND_COLORS] || SPAN_KIND_COLORS.INTERNAL
                    } ${
                      span.status_code === 'ERROR'
                        ? 'bg-red-500'
                        : STATUS_COLORS[span.status_code as keyof typeof STATUS_COLORS] || 'bg-gray-400'
                    }`}
                    style={{
                      marginLeft: `${left}%`,
                      width: `${width}%`,
                      minWidth: '2px',
                    }}
                  />

                  {/* Hover tooltip */}
                  <div className="absolute inset-0 flex items-center px-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-75 text-white text-xs rounded">
                    <div className="truncate">
                      {span.name} - {formatDuration(span.duration_ms)}
                      {span.status_message && ` (${span.status_message})`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline legend */}
        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>0ms</div>
            <div className="text-center">Timeline (relative to trace start)</div>
            <div>{formatDuration(totalTraceDuration)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
