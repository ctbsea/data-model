import React, { useEffect, useState, useCallback } from 'react'
import { Spin, Empty, Select, Button, Drawer, Form, Input, Radio, Switch, DatePicker, Divider, message } from 'antd'
import { SettingOutlined, DeleteOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import {
  PieChart, Pie, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import dayjs from 'dayjs'
import { Widget, ChartConfig, MetricItem, TimeRange, GlobalFilter } from './types'
import { Model, Field } from '../../api/model'
import { dataApi, AggregateResult, MetricOption } from '../../api/data'

const { Option } = Select
const { RangePicker } = DatePicker

interface ChartWidgetProps {
  widget: Widget
  models: Model[]
  onUpdate: (widget: Widget) => void
  onDelete: () => void
  onConfigDrawerChange?: (open: boolean) => void
  globalFilters?: GlobalFilter[]
}

const COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

const GRANULARITY_OPTIONS = [
  { label: '按日', value: 'day' },
  { label: '按周', value: 'week' },
  { label: '按月', value: 'month' },
]

const AGG_OPTIONS = [
  { label: '计数', value: 'count' },
  { label: '求和', value: 'sum' },
  { label: '平均值', value: 'avg' },
  { label: '最小值', value: 'min' },
  { label: '最大值', value: 'max' },
  { label: '去重计数', value: 'distinct' },
]

const FIELD_NAME_PATTERN = /^field_\d+$/

const getFieldLabel = (fields: Field[], fieldName?: string) => {
  if (!fieldName) return ''
  const field = fields.find(item => item.name === fieldName || item.id === fieldName)
  return field?.display_name || fieldName
}

const getMetricLabel = (metric: MetricItem, fields: Field[]) => {
  if (!metric.alias || metric.alias === metric.field || FIELD_NAME_PATTERN.test(metric.alias)) {
    const fieldLabel = getFieldLabel(fields, metric.field)
    return fieldLabel || metric.alias || '数值'
  }
  return metric.alias
}

const normalizeMetricLabels = (metrics: MetricItem[], fields: Field[]) => (
  metrics.map(metric => ({
    ...metric,
    alias: getMetricLabel(metric, fields),
  }))
)

const TIME_PRESETS = [
  { label: '最近7天', value: '7d' },
  { label: '最近30天', value: '30d' },
  { label: '本月', value: 'thisMonth' },
  { label: '本年', value: 'thisYear' },
  { label: '自定义', value: 'custom' },
]

// 将 TimeRange 转为 filter 条件
function buildTimeRangeFilter(timeRange?: TimeRange): Record<string, any> {
  if (!timeRange?.preset && !timeRange?.start) return {}
  const field = timeRange.field || 'created_at'
  const now = dayjs()
  let start: string
  let end: string = now.toISOString()

  switch (timeRange.preset) {
    case '7d':
      start = now.subtract(7, 'day').startOf('day').toISOString()
      break
    case '30d':
      start = now.subtract(30, 'day').startOf('day').toISOString()
      break
    case 'thisMonth':
      start = now.startOf('month').toISOString()
      break
    case 'thisYear':
      start = now.startOf('year').toISOString()
      break
    case 'custom':
      if (!timeRange.start) return {}
      start = timeRange.start
      end = timeRange.end || end
      break
    default:
      return {}
  }
  return { [field]: { condition: 'date_range', start, end } }
}

// 将全局过滤器转为 filter 条件（只取字段名匹配的）
function buildGlobalFilters(globalFilters?: GlobalFilter[]): Record<string, any> {
  if (!globalFilters?.length) return {}
  const result: Record<string, any> = {}
  for (const gf of globalFilters) {
    if (gf.value == null || gf.value === '' || (Array.isArray(gf.value) && gf.value.length === 0)) continue
    if (gf.type === 'date_range' && Array.isArray(gf.value) && gf.value.length === 2) {
      result[gf.field] = { condition: 'date_range', start: gf.value[0], end: gf.value[1] }
    } else {
      result[gf.field] = { condition: 'equals', value: gf.value }
    }
  }
  return result
}

// 从 ChartConfig 提取 metrics 数组（兼容旧单指标格式）
function resolveMetrics(config: ChartConfig): MetricItem[] {
  if (config.metrics && config.metrics.length > 0) return config.metrics
  return [{
    aggregation: config.valueAggregation || 'count',
    field: config.valueField || undefined,
    alias: '数值',
  }]
}

export const ChartWidget: React.FC<ChartWidgetProps> = ({
  widget, models, onUpdate, onDelete, onConfigDrawerChange, globalFilters,
}) => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AggregateResult[] | null>(null)
  const [configDrawerVisible, setConfigDrawerVisible] = useState(false)
  const [form] = Form.useForm()
  const [modelFields, setModelFields] = useState<Field[]>([])

  const config = widget.config as ChartConfig

  useEffect(() => {
    onConfigDrawerChange?.(configDrawerVisible)
  }, [configDrawerVisible, onConfigDrawerChange])

  const loadChartData = useCallback(async () => {
    if (!config.modelName) return
    setLoading(true)
    try {
      const metrics = resolveMetrics(config)
      const apiMetrics: MetricOption[] = metrics.map(m => ({
        func: m.aggregation,
        field: m.aggregation !== 'count' ? m.field : undefined,
        alias: getMetricLabel(m, modelFields),
      }))

      const timeFilter = buildTimeRangeFilter(config.timeRange)
      const globalFilter = buildGlobalFilters(globalFilters)
      const mergedFilter = { ...timeFilter, ...globalFilter }

      const isTimeLine = config.chartType === 'line' && !!config.timeField && !!config.granularity

      let result: AggregateResult[] | null
      if (isTimeLine) {
        result = await dataApi.aggregate(config.modelName, {
          time_field: config.timeField,
          granularity: config.granularity,
          metrics: apiMetrics,
          filter: Object.keys(mergedFilter).length > 0 ? mergedFilter : undefined,
        })
        result = (result ?? []).map(item => ({
          ...item,
          name: formatTimeBucket(item.name, config.granularity),
        }))
      } else if (config.dimensionField) {
        result = await dataApi.aggregate(config.modelName, {
          group_by: config.dimensionField,
          metrics: apiMetrics,
          filter: Object.keys(mergedFilter).length > 0 ? mergedFilter : undefined,
        })
      } else {
        result = await dataApi.aggregate(config.modelName, {
          metrics: apiMetrics,
          filter: Object.keys(mergedFilter).length > 0 ? mergedFilter : undefined,
        })
        result = (result ?? []).map(item => ({ ...item, name: widget.title || '统计' }))
      }

      setData(result ?? [])
    } catch (error) {
      console.error('Failed to load chart data:', error)
    } finally {
      setLoading(false)
    }
  }, [
    config.modelName, config.dimensionField, config.chartType,
    config.valueAggregation, config.timeField, config.granularity,
    config.metrics, config.timeRange, globalFilters, modelFields,
  ])

  useEffect(() => {
    if (config.modelName) loadChartData()
  }, [loadChartData])

  useEffect(() => {
    if (config.modelId) {
      const model = models.find(m => m.id === config.modelId)
      if (model) setModelFields(model.fields ?? [])
    }
  }, [config.modelId, models])

  const formatTimeBucket = (raw: string | undefined, granularity?: string) => {
    if (!raw) return ''
    try {
      const d = new Date(raw)
      if (granularity === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (granularity === 'week') return `${d.getMonth() + 1}/${d.getDate()}`
      return `${d.getMonth() + 1}/${d.getDate()}`
    } catch { return raw || '' }
  }

  const handleConfigSave = async () => {
    try {
      const values = await form.validateFields()
      const model = models.find(m => m.id === values.modelId)

      // 处理时间范围
      let timeRange: TimeRange | undefined
      if (values.timePreset) {
        timeRange = {
          preset: values.timePreset,
          field: values.timeRangeField || 'created_at',
          ...(values.timePreset === 'custom' && values.customRange
            ? { start: values.customRange[0].toISOString(), end: values.customRange[1].toISOString() }
            : {}),
        }
      }

      const nextMetrics = normalizeMetricLabels(values.metrics || [], model?.fields || modelFields)

      onUpdate({
        ...widget,
        title: values.title,
        config: {
          ...config,
          modelId: values.modelId,
          modelName: model?.name || '',
          chartType: values.chartType,
          dimensionField: values.dimensionField || '',
          valueField: '',
          valueAggregation: 'count',
          metrics: nextMetrics,
          stacked: values.stacked || false,
          timeField: values.timeField,
          granularity: values.granularity,
          timeRange,
        },
      })
      setConfigDrawerVisible(false)
      message.success('配置已保存')
    } catch (error) {
      console.error('Validation failed:', error)
    }
  }

  const activeMetrics = normalizeMetricLabels(resolveMetrics(config), modelFields)

  const renderChart = () => {
    if (loading) return <Spin style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }} />
    if (!data || !data.length) return <Empty description="暂无数据" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }} />

    if (config.chartType === 'pie' || config.chartType === 'donut') {
      const firstMetric = activeMetrics[0]
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={config.chartType === 'donut' ? 60 : 0}
              outerRadius={80}
              paddingAngle={2}
              dataKey={firstMetric?.alias || 'value'}
              label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(1)}%`}
              labelLine={{ stroke: '#666' }}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 8 }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (config.chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
            <XAxis dataKey="name" stroke="#666" tickLine={false} axisLine={{ stroke: '#e8e8e8' }} />
            <YAxis stroke="#666" tickLine={false} axisLine={{ stroke: '#e8e8e8' }} />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 8 }} />
            <Legend />
            {activeMetrics.map((m, i) => (
              <Bar
                key={m.alias}
                dataKey={m.alias}
                name={m.alias}
                fill={m.color || COLORS[i % COLORS.length]}
                radius={config.stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                stackId={config.stacked ? 'stack' : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )
    }

    if (config.chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
            <XAxis dataKey="name" stroke="#666" tickLine={false} axisLine={{ stroke: '#e8e8e8' }} />
            <YAxis stroke="#666" tickLine={false} axisLine={{ stroke: '#e8e8e8' }} />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 8 }} />
            <Legend />
            {activeMetrics.map((m, i) => (
              <Line
                key={m.alias}
                type="monotone"
                dataKey={m.alias}
                name={m.alias}
                stroke={m.color || COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ fill: m.color || COLORS[i % COLORS.length], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )
    }

    if (config.chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              {activeMetrics.map((m, i) => (
                <linearGradient key={m.alias} id={`grad-${m.alias}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={m.color || COLORS[i % COLORS.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={m.color || COLORS[i % COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" vertical={false} />
            <XAxis dataKey="name" stroke="#666" tickLine={false} axisLine={{ stroke: '#e8e8e8' }} />
            <YAxis stroke="#666" tickLine={false} axisLine={{ stroke: '#e8e8e8' }} />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 8 }} />
            <Legend />
            {activeMetrics.map((m, i) => (
              <Area
                key={m.alias}
                type="monotone"
                dataKey={m.alias}
                name={m.alias}
                stroke={m.color || COLORS[i % COLORS.length]}
                strokeWidth={2}
                fill={`url(#grad-${m.alias})`}
                stackId={config.stacked ? 'stack' : undefined}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    return null
  }

  const openConfig = () => {
    const metrics = config.metrics && config.metrics.length > 0
      ? config.metrics
      : [{ aggregation: config.valueAggregation || 'count', field: config.valueField || undefined, alias: '数值' }]

    form.setFieldsValue({
      title: widget.title,
      modelId: config.modelId,
      chartType: config.chartType || 'bar',
      dimensionField: config.dimensionField,
      metrics: normalizeMetricLabels(metrics, modelFields),
      stacked: config.stacked || false,
      timeField: config.timeField,
      granularity: config.granularity,
      timePreset: config.timeRange?.preset,
      timeRangeField: config.timeRange?.field || 'created_at',
      customRange: config.timeRange?.preset === 'custom' && config.timeRange.start
        ? [dayjs(config.timeRange.start), dayjs(config.timeRange.end)]
        : undefined,
    })
    setConfigDrawerVisible(true)
  }

  const needsField = (agg: string) => agg !== 'count'
  const numberFields = modelFields.filter(f => !f.deleted && (f.type === 'number' || f.type === 'currency'))
  const allFields = modelFields.filter(f => !f.deleted && f.name !== 'id')
  const dateFields = modelFields.filter(f => !f.deleted && f.type === 'date')
  const dimFields = modelFields.filter(f => !f.deleted && f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at')

  const timeRangeLabel = config.timeRange
    ? TIME_PRESETS.find(p => p.value === config.timeRange?.preset)?.label || '已设置'
    : null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
      {/* 标题栏 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={configDrawerVisible ? '' : 'drag-handle'} style={{ fontWeight: 500, cursor: configDrawerVisible ? 'default' : 'move', userSelect: 'none' }}>
            {widget.title || '统计图表'}
          </span>
          {timeRangeLabel && (
            <span style={{ fontSize: 11, color: '#6366f1', background: '#ede9fe', padding: '1px 6px', borderRadius: 4 }}>
              {timeRangeLabel}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<SettingOutlined />} onClick={openConfig} />
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onDelete} />
        </div>
      </div>

      {/* 图表区域 */}
      <div style={{ flex: 1, padding: 16, minHeight: 0 }}>
        {renderChart()}
      </div>

      {/* 配置抽屉 */}
      <Drawer
        title="图表配置"
        placement="right"
        width={440}
        open={configDrawerVisible}
        onClose={() => setConfigDrawerVisible(false)}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button style={{ marginRight: 8 }} onClick={() => setConfigDrawerVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleConfigSave}>保存</Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item label="标题" name="title" rules={[{ required: true }]}>
            <Input placeholder="请输入标题" />
          </Form.Item>

          <Form.Item label="数据源模型" name="modelId" rules={[{ required: true }]}>
            <Select placeholder="选择模型" onChange={(value) => {
              form.setFieldsValue({ dimensionField: undefined, timeField: undefined, metrics: [{ aggregation: 'count', alias: '数值' }] })
              const m = models.find(m => m.id === value)
              if (m) setModelFields(m.fields || [])
            }}>
              {models.map(m => <Option key={m.id} value={m.id}>{m.display_name}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item label="图表类型" name="chartType" rules={[{ required: true }]}>
            <Select placeholder="选择图表类型">
              <Option value="bar">柱状图</Option>
              <Option value="pie">饼图</Option>
              <Option value="donut">环形图</Option>
              <Option value="line">折线图</Option>
              <Option value="area">面积图</Option>
            </Select>
          </Form.Item>

          {/* 堆叠开关（bar/area） */}
          <Form.Item noStyle shouldUpdate={(p, c) => p.chartType !== c.chartType}>
            {({ getFieldValue }) => {
              const ct = getFieldValue('chartType')
              if (ct !== 'bar' && ct !== 'area') return null
              return (
                <Form.Item label="堆叠模式" name="stacked" valuePropName="checked">
                  <Switch checkedChildren="堆叠" unCheckedChildren="并列" />
                </Form.Item>
              )
            }}
          </Form.Item>

          {/* 折线图时间维度 */}
          <Form.Item noStyle shouldUpdate={(p, c) => p.chartType !== c.chartType}>
            {({ getFieldValue }) => {
              if (getFieldValue('chartType') !== 'line') return null
              return (
                <>
                  <Form.Item label="时间字段（时序模式）" name="timeField">
                    <Select placeholder="选择时间字段（可选）" allowClear>
                      <Option value="created_at">创建时间</Option>
                      <Option value="updated_at">更新时间</Option>
                      {dateFields.map(f => <Option key={f.id} value={f.name}>{f.display_name}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate={(p, c) => p.timeField !== c.timeField}>
                    {({ getFieldValue: gfv }) => gfv('timeField') ? (
                      <Form.Item label="时间粒度" name="granularity" rules={[{ required: true }]}>
                        <Radio.Group>
                          {GRANULARITY_OPTIONS.map(o => <Radio key={o.value} value={o.value}>{o.label}</Radio>)}
                        </Radio.Group>
                      </Form.Item>
                    ) : null}
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>

          {/* 维度字段（非时序折线图 / 其他图表） */}
          <Form.Item noStyle shouldUpdate={(p, c) => p.chartType !== c.chartType || p.timeField !== c.timeField}>
            {({ getFieldValue }) => {
              if (getFieldValue('chartType') === 'line' && getFieldValue('timeField')) return null
              return (
                <Form.Item label="维度字段（X轴/分组）" name="dimensionField" rules={[{ required: true }]}>
                  <Select placeholder="选择维度字段">
                    {dimFields.map(f => <Option key={f.id} value={f.name}>{f.display_name}</Option>)}
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13 }}>指标配置</Divider>

          {/* 多指标 Form.List */}
          <Form.List name="metrics" initialValue={[{ aggregation: 'count', alias: '数值' }]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} style={{ background: '#f9fafb', borderRadius: 6, padding: '12px 12px 4px', marginBottom: 8, position: 'relative' }}>
                    <Form.Item {...restField} name={[name, 'alias']} label="指标名称" rules={[{ required: true, message: '请输入指标名称' }]}>
                      <Input placeholder="如：销售额、数量" />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'aggregation']} label="聚合方式" rules={[{ required: true }]}>
                      <Select>
                        {AGG_OPTIONS.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                      </Select>
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate>
                      {({ getFieldValue }) => {
                        const agg = getFieldValue(['metrics', name, 'aggregation'])
                        if (!needsField(agg)) return null
                        const opts = (agg === 'sum' || agg === 'avg') ? numberFields : allFields
                        return (
                          <Form.Item {...restField} name={[name, 'field']} label="字段" rules={[{ required: true }]}>
                            <Select placeholder="选择字段">
                              {opts.map(f => <Option key={f.id} value={f.name}>{f.display_name}</Option>)}
                            </Select>
                          </Form.Item>
                        )
                      }}
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'color']} label="颜色（可选）">
                      <Input type="color" style={{ width: 60, padding: 2, height: 32 }} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button
                        type="text" danger size="small" icon={<MinusCircleOutlined />}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                        onClick={() => remove(name)}
                      />
                    )}
                  </div>
                ))}
                <Button type="dashed" onClick={() => add({ aggregation: 'count', alias: `指标${fields.length + 1}` })} block icon={<PlusOutlined />}>
                  添加指标
                </Button>
              </>
            )}
          </Form.List>

          <Divider orientation="left" style={{ fontSize: 13, marginTop: 16 }}>时间范围过滤</Divider>

          <Form.Item label="时间过滤字段" name="timeRangeField">
            <Select defaultValue="created_at">
              <Option value="created_at">创建时间</Option>
              <Option value="updated_at">更新时间</Option>
              {dateFields.map(f => <Option key={f.id} value={f.name}>{f.display_name}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item label="时间范围" name="timePreset">
            <Select placeholder="不限制时间范围" allowClear>
              {TIME_PRESETS.map(p => <Option key={p.value} value={p.value}>{p.label}</Option>)}
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(p, c) => p.timePreset !== c.timePreset}>
            {({ getFieldValue }) => getFieldValue('timePreset') === 'custom' ? (
              <Form.Item label="自定义时间范围" name="customRange" rules={[{ required: true }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            ) : null}
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
