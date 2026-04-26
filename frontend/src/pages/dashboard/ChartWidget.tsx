import React, { useEffect, useState } from 'react'
import { Spin, Empty, Select, Button, Drawer, Form, Input, Radio, message } from 'antd'
import { SettingOutlined, DeleteOutlined } from '@ant-design/icons'
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { Widget, ChartConfig } from './types'
import { modelApi, Model, Field } from '../../api/model'
import { dataApi, AggregateResult } from '../../api/data'

const { Option } = Select

interface ChartWidgetProps {
  widget: Widget
  models: Model[]
  onUpdate: (widget: Widget) => void
  onDelete: () => void
  onConfigDrawerChange?: (open: boolean) => void
}

const COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

const GRANULARITY_OPTIONS = [
  { label: '按日', value: 'day' },
  { label: '按周', value: 'week' },
  { label: '按月', value: 'month' },
]

export const ChartWidget: React.FC<ChartWidgetProps> = ({ widget, models, onUpdate, onDelete, onConfigDrawerChange }) => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AggregateResult[]>([])
  const [configDrawerVisible, setConfigDrawerVisible] = useState(false)
  const [form] = Form.useForm()
  const [modelFields, setModelFields] = useState<Field[]>([])

  const config = widget.config as ChartConfig

  useEffect(() => {
    onConfigDrawerChange?.(configDrawerVisible)
  }, [configDrawerVisible, onConfigDrawerChange])

  useEffect(() => {
    if (config.modelName) {
      loadChartData()
    }
  }, [
    config.modelName,
    config.dimensionField,
    config.valueField,
    config.chartType,
    config.valueAggregation,
    config.timeField,
    config.granularity,
  ])

  useEffect(() => {
    if (config.modelId) {
      const model = models.find(m => m.id === config.modelId)
      if (model) {
        setModelFields(model.fields || [])
      }
    }
  }, [config.modelId, models])

  const isTimeLine = config.chartType === 'line' && !!config.timeField && !!config.granularity

  const loadChartData = async () => {
    if (!config.modelName) return

    setLoading(true)
    try {
      let result: AggregateResult[]

      if (isTimeLine) {
        // 时间维度折线图：后端时间分桶聚合
        result = await dataApi.aggregate(config.modelName, {
          time_field: config.timeField,
          granularity: config.granularity,
          metrics: [{
            func: config.valueAggregation,
            field: config.valueAggregation !== 'count' ? config.valueField : undefined,
            alias: 'value',
          }],
        })
        // 格式化时间标签
        result = result.map(item => ({
          ...item,
          name: formatTimeBucket(item.name, config.granularity),
        }))
      } else if (config.dimensionField) {
        // 普通分组聚合：后端 GROUP BY
        result = await dataApi.aggregate(config.modelName, {
          group_by: config.dimensionField,
          metrics: [{
            func: config.valueAggregation,
            field: config.valueAggregation !== 'count' ? config.valueField : undefined,
            alias: 'value',
          }],
        })
      } else {
        return
      }

      setData(result)
    } catch (error) {
      console.error('Failed to load chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeBucket = (raw: string | undefined, granularity?: string) => {
    if (!raw) return ''
    try {
      const d = new Date(raw)
      if (granularity === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (granularity === 'week') {
        const weekStart = new Date(d)
        return `${weekStart.getMonth() + 1}/${weekStart.getDate()}`
      }
      return `${d.getMonth() + 1}/${d.getDate()}`
    } catch {
      return raw || ''
    }
  }

  const handleConfigSave = async () => {
    try {
      const values = await form.validateFields()
      const model = models.find(m => m.id === values.modelId)

      onUpdate({
        ...widget,
        title: values.title,
        config: {
          ...config,
          modelId: values.modelId,
          modelName: model?.name || '',
          chartType: values.chartType,
          dimensionField: values.dimensionField,
          valueField: values.valueField,
          valueAggregation: values.valueAggregation,
          timeField: values.timeField,
          granularity: values.granularity,
        },
      })
      setConfigDrawerVisible(false)
      message.success('配置已保存')
    } catch (error) {
      console.error('Validation failed:', error)
    }
  }

  const renderChart = () => {
    if (loading) {
      return <Spin style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }} />
    }

    if (!data.length) {
      return <Empty description="暂无数据" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }} />
    }

    if (config.chartType === 'pie' || config.chartType === 'donut') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={config.chartType === 'donut' ? 60 : 0}
              outerRadius={80}
              fill="#8884d8"
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
              labelLine={{ stroke: '#666' }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
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
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
            <Legend />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
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
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    return null
  }

  const dateFields = modelFields.filter(f => !f.deleted && (f.type === 'date' || f.name === 'created_at' || f.name === 'updated_at'))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
      {/* 标题栏 */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fafafa',
      }}>
        <span
          className={configDrawerVisible ? '' : 'drag-handle'}
          style={{ fontWeight: 500, cursor: configDrawerVisible ? 'default' : 'move', userSelect: 'none' }}
        >
          {widget.title || '统计图表'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => {
            form.setFieldsValue({
              title: widget.title,
              modelId: config.modelId,
              chartType: config.chartType || 'bar',
              dimensionField: config.dimensionField,
              valueField: config.valueField,
              valueAggregation: config.valueAggregation || 'count',
              timeField: config.timeField,
              granularity: config.granularity,
            })
            setConfigDrawerVisible(true)
          }} />
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
        width={400}
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
              form.setFieldsValue({ dimensionField: undefined, valueField: undefined, timeField: undefined })
              const selectedModel = models.find(m => m.id === value)
              if (selectedModel) setModelFields(selectedModel.fields || [])
            }}>
              {models.map(m => (
                <Option key={m.id} value={m.id}>{m.display_name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="图表类型" name="chartType" rules={[{ required: true }]}>
            <Select placeholder="选择图表类型">
              <Option value="bar">柱状图</Option>
              <Option value="pie">饼图</Option>
              <Option value="donut">环形图</Option>
              <Option value="line">折线图</Option>
            </Select>
          </Form.Item>

          {/* 折线图：时间维度配置 */}
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.chartType !== curr.chartType}>
            {({ getFieldValue }) => {
              if (getFieldValue('chartType') !== 'line') return null
              return (
                <>
                  <Form.Item label="时间字段（折线图时序模式）" name="timeField">
                    <Select placeholder="选择时间字段（可选）" allowClear>
                      <Option value="created_at">创建时间</Option>
                      <Option value="updated_at">更新时间</Option>
                      {modelFields.filter(f => !f.deleted && f.type === 'date').map(f => (
                        <Option key={f.id} value={f.name}>{f.display_name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.timeField !== curr.timeField}>
                    {({ getFieldValue: gfv }) => {
                      if (!gfv('timeField')) return null
                      return (
                        <Form.Item label="时间粒度" name="granularity" rules={[{ required: true, message: '请选择时间粒度' }]}>
                          <Radio.Group>
                            {GRANULARITY_OPTIONS.map(o => (
                              <Radio key={o.value} value={o.value}>{o.label}</Radio>
                            ))}
                          </Radio.Group>
                        </Form.Item>
                      )
                    }}
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>

          {/* 非时间维度折线图 / 其他图表：维度字段 */}
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.chartType !== curr.chartType || prev.timeField !== curr.timeField}>
            {({ getFieldValue }) => {
              const isLineWithTime = getFieldValue('chartType') === 'line' && !!getFieldValue('timeField')
              if (isLineWithTime) return null
              return (
                <Form.Item label="维度字段" name="dimensionField" rules={[{ required: true }]}>
                  <Select placeholder="选择维度字段">
                    {modelFields.filter(f => !f.deleted && f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at').map(f => (
                      <Option key={f.id} value={f.name}>{f.display_name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>

          <Form.Item label="数值聚合方式" name="valueAggregation" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="count">统计记录总数</Radio>
              <Radio value="sum">求和</Radio>
              <Radio value="avg">平均值</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.valueAggregation !== curr.valueAggregation}>
            {({ getFieldValue }) => {
              const agg = getFieldValue('valueAggregation')
              if (agg === 'sum' || agg === 'avg') {
                return (
                  <Form.Item label="数值字段" name="valueField" rules={[{ required: true }]}>
                    <Select placeholder="选择数值字段">
                      {modelFields.filter(f => !f.deleted && f.type === 'number').map(f => (
                        <Option key={f.id} value={f.name}>{f.display_name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                )
              }
              return null
            }}
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
