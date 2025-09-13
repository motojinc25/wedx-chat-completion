import { BarChart3, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from './badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'

export interface HistogramData {
  buckets?: Array<{
    le: string // less than or equal to boundary
    count: number
  }>
  bucketCounts?: number[]
  explicitBounds?: number[]
  sum?: number
  count?: number
}

export interface HistogramChartProps {
  data: HistogramData | null
  metricName: string
  timestamp?: string
  unit?: string
  className?: string
}

export function HistogramChart({ data, metricName, timestamp, unit, className }: HistogramChartProps) {
  if (!data) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-sm">No histogram data available</p>
        </CardContent>
      </Card>
    )
  }

  // Parse data from either format
  let chartData: Array<{ bucket: string; count: number; cumulative: number; boundary: string }> = []

  if (data.buckets && data.buckets.length > 0) {
    // Legacy format with buckets array
    chartData = data.buckets.map((bucket, index) => {
      const prevCount = index > 0 ? data.buckets?.[index - 1]?.count ?? 0 : 0
      const bucketCount = bucket.count - prevCount

      return {
        bucket: bucket.le === '+Inf' ? '∞' : bucket.le,
        count: bucketCount,
        cumulative: bucket.count,
        boundary: bucket.le,
      }
    })
  } else if (data.bucketCounts && data.explicitBounds) {
    // New format with bucketCounts and explicitBounds
    chartData = data.bucketCounts.map((count, index) => {
      const boundary = index < (data.explicitBounds?.length ?? 0) ? data.explicitBounds?.[index]?.toString() ?? '∞' : '∞'
      const cumulative = data.bucketCounts?.slice(0, index + 1).reduce((sum, c) => sum + c, 0) ?? 0

      return {
        bucket: boundary === 'Infinity' ? '∞' : boundary,
        count,
        cumulative,
        boundary,
      }
    })
  }

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-sm">No histogram data available</p>
        </CardContent>
      </Card>
    )
  }

  const formatValue = (value: number): string => {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`
    return value.toString()
  }

  interface TooltipProps {
    active?: boolean
    payload?: Array<{
      value: number
      dataKey: string
    }>
    label?: string
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{`Bucket: ≤ ${label}${unit ? ` ${unit}` : ''}`}</p>
          <p className="text-blue-600">{`Count: ${payload[0].value}`}</p>
          <p className="text-purple-600">{`Cumulative: ${payload[1]?.value || 0}`}</p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{metricName}</CardTitle>
          </div>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            Histogram
          </Badge>
        </div>
        <CardDescription>
          Distribution showing {formatValue(data.count || 0)} total observations
          {data.sum && ` with sum of ${formatValue(data.sum)}${unit ? ` ${unit}` : ''}`}
          {timestamp && (
            <span className="block text-xs text-gray-500 mt-1">Updated: {new Date(timestamp).toLocaleString()}</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="bucket" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="count" fill="#3B82F6" name="Count in Bucket" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary statistics */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Total Observations:</span> {formatValue(data.count || 0)}
          </div>
          {data.sum !== undefined && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Sum:</span> {formatValue(data.sum)}
              {unit ? ` ${unit}` : ''}
            </div>
          )}
          {data.sum !== undefined && data.count && data.count > 0 && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Average:</span> {formatValue(data.sum / data.count)}
              {unit ? ` ${unit}` : ''}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
