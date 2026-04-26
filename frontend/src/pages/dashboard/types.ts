// 面板类型定义
export interface Panel {
  id: string
  name: string
  widgets: Widget[]
  layout: WidgetLayout[]
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

// 图表配置
export interface ChartConfig {
  modelId: string
  modelName: string
  chartType: 'pie' | 'bar' | 'line' | 'donut'
  dimensionField: string
  valueField: string
  valueAggregation: 'count' | 'sum' | 'avg'
  timeField?: string
  granularity?: 'day' | 'week' | 'month'
  filters?: any
}

// 统计数字配置
export interface StatisticConfig {
  modelId: string
  modelName: string
  aggregation: 'count' | 'sum' | 'avg'
  field?: string
  filters?: any
}

// 仪表盘配置
export interface DashboardConfig {
  id: string
  name: string
  panels: Panel[]
}
