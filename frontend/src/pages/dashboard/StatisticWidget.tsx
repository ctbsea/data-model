import React, { useEffect, useState } from 'react'
import { Spin, Button, Drawer, Form, Input, Select, Radio, message } from 'antd'
import { SettingOutlined, DeleteOutlined } from '@ant-design/icons'
import { Widget, StatisticConfig } from './types'
import { Model, Field } from '../../api/model'
import { dataApi } from '../../api/data'

const { Option } = Select

interface StatisticWidgetProps {
  widget: Widget
  models: Model[]
  onUpdate: (widget: Widget) => void
  onDelete: () => void
  onConfigDrawerChange?: (open: boolean) => void
}

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444']

export const StatisticWidget: React.FC<StatisticWidgetProps> = ({
  widget,
  models,
  onUpdate,
  onDelete,
  onConfigDrawerChange,
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
  }, [config.modelName, config.aggregation, config.field])

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
      const result = await dataApi.aggregate(config.modelName, { metrics })
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
      onUpdate({
        ...widget,
        title: values.title,
        config: {
          ...config,
          modelId: values.modelId,
          modelName: model?.name || '',
          aggregation: values.aggregation,
          field: values.field,
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
    return config.aggregation === 'avg' ? v.toFixed(2) : String(Math.round(v))
  }

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
        <span
          className={configDrawerVisible ? '' : 'drag-handle'}
          style={{ fontWeight: 500, cursor: configDrawerVisible ? 'default' : 'move', userSelect: 'none' }}
        >
          {widget.title || '统计数字'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => {
            form.setFieldsValue({
              title: widget.title,
              modelId: config.modelId,
              aggregation: config.aggregation || 'count',
              field: config.field,
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
              {config.aggregation === 'sum' && `${config.field || ''} 求和`}
              {config.aggregation === 'avg' && `${config.field || ''} 平均值`}
            </div>
          </>
        )}
      </div>

      {/* 配置抽屉 */}
      <Drawer
        title="统计卡片配置"
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
              <Radio value="count">统计记录总数</Radio>
              <Radio value="sum">求和</Radio>
              <Radio value="avg">平均值</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.aggregation !== curr.aggregation}>
            {({ getFieldValue }) => {
              const agg = getFieldValue('aggregation')
              if (agg === 'sum' || agg === 'avg') {
                return (
                  <Form.Item label="数值字段" name="field" rules={[{ required: true }]}>
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
