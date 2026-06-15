import React, { useEffect, useState } from 'react'
import { Spin, Button, Drawer, Form, Input, Select, Radio, DatePicker, Tag, message } from 'antd'
import { SettingOutlined, DeleteOutlined, ClockCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { Widget, StatisticConfig, GlobalFilter, TimeRange } from './types'
import { Model, Field } from '../../api/model'
import { dataApi } from '../../api/data'

const { Option } = Select
const { RangePicker } = DatePicker

interface StatisticWidgetProps {
  widget: Widget
  models: Model[]
  onUpdate: (widget: Widget) => void
  onDelete: () => void
  onConfigDrawerChange?: (open: boolean) => void
  globalFilters?: GlobalFilter[]
}

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']

const getFieldLabel = (fields: Field[], fieldName?: string) => {
  if (!fieldName) return ''
  const field = fields.find(item => item.name === fieldName || item.id === fieldName)
  return field?.display_name || fieldName
}

const TIME_PRESETS = [
  { label: '最近7天', value: '7d' },
  { label: '最近30天', value: '30d' },
  { label: '本月', value: 'thisMonth' },
  { label: '本年', value: 'thisYear' },
  { label: '自定义', value: 'custom' },
]

function buildTimeRangeFilter(timeRange?: TimeRange): Record<string, any> {
  if (!timeRange || !timeRange.preset) return {}
  const field = timeRange.field || 'created_at'
  const now = dayjs()
  let start: string
  let end: string = now.format('YYYY-MM-DD')

  switch (timeRange.preset) {
    case '7d':
      start = now.subtract(7, 'day').format('YYYY-MM-DD')
      break
    case '30d':
      start = now.subtract(30, 'day').format('YYYY-MM-DD')
      break
    case 'thisMonth':
      start = now.startOf('month').format('YYYY-MM-DD')
      break
    case 'thisYear':
      start = now.startOf('year').format('YYYY-MM-DD')
      break
    case 'custom':
      if (!timeRange.start || !timeRange.end) return {}
      return { [field]: { condition: 'date_range', start: timeRange.start, end: timeRange.end } }
    default:
      return {}
  }
  return { [field]: { condition: 'date_range', start, end } }
}

function buildGlobalFilters(globalFilters?: GlobalFilter[]): Record<string, any> {
  if (!globalFilters || globalFilters.length === 0) return {}
  const result: Record<string, any> = {}
  for (const gf of globalFilters) {
    if (gf.value == null || gf.value === '' || (Array.isArray(gf.value) && gf.value.length === 0)) continue
    if (gf.type === 'date_range' && Array.isArray(gf.value) && gf.value.length === 2) {
      result[gf.field] = { condition: 'date_range', start: gf.value[0], end: gf.value[1] }
    } else if (gf.type === 'text') {
      result[gf.field] = { condition: 'contains', value: gf.value }
    } else {
      result[gf.field] = { condition: 'equals', value: gf.value }
    }
  }
  return result
}

function getTimeRangeLabel(timeRange?: TimeRange): string | null {
  if (!timeRange?.preset) return null
  const preset = TIME_PRESETS.find(p => p.value === timeRange.preset)
  if (timeRange.preset === 'custom' && timeRange.start && timeRange.end) {
    return `${timeRange.start} ~ ${timeRange.end}`
  }
  return preset?.label || null
}

export const StatisticWidget: React.FC<StatisticWidgetProps> = ({
  widget,
  models,
  onUpdate,
  onDelete,
  onConfigDrawerChange,
  globalFilters,
}) => {
  const [loading, setLoading] = useState(false)
  const [value, setValue] = useState<number | null>(null)
  const [configDrawerVisible, setConfigDrawerVisible] = useState(false)
  const [form] = Form.useForm()
  const [modelFields, setModelFields] = useState<Field[]>([])

  const config = widget.config as StatisticConfig

  useEffect(() => {
    onConfigDrawerChange?.(configDrawerVisible)
  }, [configDrawerVisible, onConfigDrawerChange])

  useEffect(() => {
    if (config.modelName) {
      loadValue()
    }
  }, [config.modelName, config.aggregation, config.field, config.timeRange, globalFilters])

  useEffect(() => {
    if (config.modelId) {
      const model = models.find(m => m.id === config.modelId)
      if (model) setModelFields(model.fields || [])
    }
  }, [config.modelId, models])

  const loadValue = async () => {
    if (!config.modelName) return
    setLoading(true)
    try {
      const metrics = [{
        func: config.aggregation,
        field: config.aggregation !== 'count' ? config.field : undefined,
        alias: 'value',
      }]

      const timeFilter = buildTimeRangeFilter(config.timeRange)
      const globalFilter = buildGlobalFilters(globalFilters)
      const mergedFilter = { ...timeFilter, ...globalFilter }

      const result = await dataApi.aggregate(config.modelName, {
        metrics,
        filter: Object.keys(mergedFilter).length > 0 ? mergedFilter : undefined,
      })
      if (result && result.length > 0) {
        const raw = result[0].value
        setValue(raw != null ? Number(raw) : null)
      } else {
        setValue(0)
      }
    } catch (error) {
      console.error('Failed to load statistic:', error)
      setValue(null)
    } finally {
      setLoading(false)
    }
  }

  const handleConfigSave = async () => {
    try {
      const values = await form.validateFields()
      const model = models.find(m => m.id === values.modelId)

      let timeRange: TimeRange | undefined
      if (values.timePreset) {
        timeRange = { preset: values.timePreset, field: values.timeField || 'created_at' }
        if (values.timePreset === 'custom' && values.customRange?.length === 2) {
          timeRange.start = values.customRange[0].format('YYYY-MM-DD')
          timeRange.end = values.customRange[1].format('YYYY-MM-DD')
        }
      }

      onUpdate({
        ...widget,
        title: values.title,
        config: {
          ...config,
          modelId: values.modelId,
          modelName: model?.name || '',
          aggregation: values.aggregation,
          field: values.field,
          timeRange,
        },
      })
      setConfigDrawerVisible(false)
      message.success('配置已保存')
    } catch {}
  }

  const colorIndex = models.findIndex(m => m.id === config.modelId) % COLORS.length
  const accentColor = COLORS[colorIndex >= 0 ? colorIndex : 0]

  const formatValue = (v: number | null) => {
    if (v === null) return '--'
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
              {config.aggregation === 'avg' && `${fieldLabel} ???`}
  }

  const timeRangeLabel = getTimeRangeLabel(config.timeRange)
  const fieldLabel = config.aggregation !== 'count' ? getFieldLabel(modelFields, config.field) : ''

  const dateFields = modelFields.filter(f => !f.deleted && f.type === 'date')

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid #e8e8e8',
    }}>
      {/* 标题栏 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fafafa',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className={configDrawerVisible ? '' : 'drag-handle'}
            style={{ fontWeight: 500, cursor: configDrawerVisible ? 'default' : 'move', userSelect: 'none' }}
          >
            {widget.title || '统计数字'}
          </span>
          {timeRangeLabel && (
            <Tag icon={<ClockCircleOutlined />} color="blue" style={{ fontSize: 11 }}>
              {timeRangeLabel}
            </Tag>
          )}
          {fieldLabel && (
            <Tag color="geekblue" style={{ fontSize: 11 }}>
              {fieldLabel}
            </Tag>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => {
            form.setFieldsValue({
              title: widget.title,
              modelId: config.modelId,
              aggregation: config.aggregation || 'count',
              field: config.field,
              timePreset: config.timeRange?.preset,
              timeField: config.timeRange?.field || 'created_at',
              customRange: config.timeRange?.preset === 'custom' && config.timeRange.start && config.timeRange.end
                ? [dayjs(config.timeRange.start), dayjs(config.timeRange.end)]
                : undefined,
            })
            setConfigDrawerVisible(true)
          }} />
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onDelete} />
        </div>
      </div>

      {/* 数字展示区 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
      }}>
        {loading ? (
          <Spin />
        ) : (
          <>
            <div style={{
              fontSize: 48,
              fontWeight: 700,
              color: accentColor,
              lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {formatValue(value)}
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>
              {config.aggregation === 'count' && '记录总数'}
              {config.aggregation === 'sum' && `${fieldLabel} ??`}
              {config.aggregation === 'avg' && `${fieldLabel} ???`}
              {config.aggregation === 'min' && `${fieldLabel} ???`}
              {config.aggregation === 'max' && `${fieldLabel} ???`}
              {config.aggregation === 'distinct' && `${fieldLabel} ????`}
            </div>
          </>
        )}
      </div>

      {/* 配置抽屉 */}
      <Drawer
        title="统计卡片配置"
        placement="right"
        width={420}
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
              form.setFieldsValue({ field: undefined })
              const selectedModel = models.find(m => m.id === value)
              if (selectedModel) setModelFields(selectedModel.fields || [])
            }}>
              {models.map(m => (
                <Option key={m.id} value={m.id}>{m.display_name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="聚合方式" name="aggregation" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="count">计数</Radio>
              <Radio value="sum">求和</Radio>
              <Radio value="avg">平均值</Radio>
              <Radio value="min">最小值</Radio>
              <Radio value="max">最大值</Radio>
              <Radio value="distinct">去重计数</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.aggregation !== curr.aggregation}>
            {({ getFieldValue }) => {
              const agg = getFieldValue('aggregation')
              if (agg && agg !== 'count') {
                const isNumericOnly = agg === 'sum' || agg === 'avg'
                  const fields = isNumericOnly
                    ? modelFields.filter(f => !f.deleted && (f.type === 'number' || f.type === 'currency'))
                  : modelFields.filter(f => !f.deleted)
                return (
                  <Form.Item label="字段" name="field" rules={[{ required: true }]}>
                    <Select placeholder="选择字段">
                      {fields.map(f => (
                        <Option key={f.id} value={f.name}>{f.display_name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              }
              return null
            }}
          </Form.Item>

          {/* 时间范围 */}
          <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 16 }}>
            <div style={{ fontWeight: 500, marginBottom: 12, color: '#374151' }}>时间范围过滤</div>

            <Form.Item label="时间范围" name="timePreset">
              <Select placeholder="不限时间" allowClear>
                {TIME_PRESETS.map(p => (
                  <Option key={p.value} value={p.value}>{p.label}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.timePreset !== curr.timePreset}>
              {({ getFieldValue }) => {
                const preset = getFieldValue('timePreset')
                if (preset === 'custom') {
                  return (
                    <Form.Item label="自定义日期范围" name="customRange" rules={[{ required: true }]}>
                      <RangePicker style={{ width: '100%' }} />
                    </Form.Item>
                  )
                }
                return null
              }}
            </Form.Item>

            {(dateFields.length > 0) && (
              <Form.Item label="时间字段" name="timeField">
                <Select placeholder="created_at（默认）" allowClear>
                  <Option value="created_at">创建时间 (created_at)</Option>
                  <Option value="updated_at">更新时间 (updated_at)</Option>
                  {dateFields.map(f => (
                    <Option key={f.id} value={f.name}>{f.display_name}</Option>
                  ))}
                </Select>
              </Form.Item>
            )}
          </div>
        </Form>
      </Drawer>
    </div>
  )
}
