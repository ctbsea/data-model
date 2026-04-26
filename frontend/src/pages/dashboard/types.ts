// 面板类型定义
export interface Panel {
  id: string
  name: string
  widgets: Widget[]
  layout: WidgetLayout[]
  globalFilters?: GlobalFilter[]
}

// 统计组件类型定义
export interface Widget {
  id: string
  type: 'chart' | 'statistic'
  title: string
  config: ChartConfig | StatisticConfig
  x: number
  y: number
  w: number
  h: number
}

// 组件布局
export interface WidgetLayout {
  i: string
  x: number
  y: number
  w: number
  h: number
}

// 多指标配置项
export interface MetricItem {
  field?: string
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct'
  alias: string
  color?: string
}

// 时间范围配置
export interface TimeRange {
  preset?: '7d' | '30d' | 'thisMonth' | 'thisYear' | 'custom'
  start?: string
  end?: string
  field?: string  // 过滤字段，默认 created_at
}

// 全局过滤器
export interface GlobalFilter {
  id: string
  field: string
  label: string
  type: 'select' | 'date_range' | 'text'
  modelId?: string
  value?: any
}

// 图表配置
export interface ChartConfig {
  modelId: string
  modelName: string
  chartType: 'pie' | 'bar' | 'line' | 'donut' | 'area'
  // 多指标模式（优先）
  metrics?: MetricItem[]
  stacked?: boolean
  // 单指标兼容字段（向后兼容）
  dimensionField: string
  valueField: string
  valueAggregation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct'
  // 时间维度
  timeField?: string
  granularity?: 'day' | 'week' | 'month'
  // 时间范围过滤
  timeRange?: TimeRange
  filters?: any
}

// 统计数字配置
export interface StatisticConfig {
  modelId: string
  modelName: string
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct'
  field?: string
  timeRange?: TimeRange
  filters?: any
}

// 仪表盘配置
export interface DashboardConfig {
  id: string
  name: string
  panels: Panel[]
}
