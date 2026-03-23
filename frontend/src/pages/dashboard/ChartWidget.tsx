import React, { useEffect, useState } from 'react'
import { Spin, Empty, Select, Button, Drawer, Form, Input, Radio, message, Popconfirm } from 'antd'
import { SettingOutlined, DeleteOutlined } from '@ant-design/icons'
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { Widget, ChartConfig } from './types'
import { modelApi, Model, Field } from '../../api/model'
import { dataApi } from '../../api/data'
import { userApi, User } from '../../api/user'

const { Option } = Select

interface ChartWidgetProps {
  widget: Widget
  models: Model[]
  onUpdate: (widget: Widget) => void
  onDelete: () => void
  onConfigDrawerChange?: (open: boolean) => void
}

const COLORS = ['#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

export const ChartWidget: React.FC<ChartWidgetProps> = ({ widget, models, onUpdate, onDelete, onConfigDrawerChange }) => {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any[]>([])
  const [configDrawerVisible, setConfigDrawerVisible] = useState(false)
  const [form] = Form.useForm()
  const [modelFields, setModelFields] = useState<Field[]>([])

  const config = widget.config as ChartConfig

  // 通知父组件配置抽屉状态变化
  useEffect(() => {
    onConfigDrawerChange?.(configDrawerVisible)
  }, [configDrawerVisible, onConfigDrawerChange])

  // 加载图表数据
  useEffect(() => {
    if (config.modelName && config.dimensionField) {
      loadChartData()
    }
  }, [config.modelName, config.dimensionField, config.valueField, config.chartType, config.valueAggregation])

  // 加载模型字段
  useEffect(() => {
    if (config.modelId) {
      const model = models.find(m => m.id === config.modelId)
      if (model) {
        setModelFields(model.fields || [])
      }
    }
  }, [config.modelId, models])

  const loadChartData = async () => {
    if (!config.modelName || !config.dimensionField) return
    
    setLoading(true)
    try {
      // 获取所有数据
      const res = await dataApi.list(config.modelName, 1, 1000)
      const rawData = res.data || []
      
      // 获取维度字段信息 - 优先从 models 获取，如果没有则从 API 获取
      let currentModel = models.find(m => m.id === config.modelId)
      if (!currentModel || !currentModel.fields || currentModel.fields.length === 0) {
        try {
          currentModel = await modelApi.get(config.modelId!)
        } catch (e) {
          console.error('Failed to get model:', e)
        }
      }
      const dimensionFieldInfo = currentModel?.fields?.find(f => f.name === config.dimensionField)
      const isUserField = dimensionFieldInfo?.type === 'user'
      const isRelationField = dimensionFieldInfo?.type === 'relation'
      
      // 如果是用户字段，获取用户信息
      let userMap: Record<string, User> = {}
      if (isUserField) {
        const userIds = [...new Set(rawData.map((item: any) => item[config.dimensionField]).filter(Boolean))]
        if (userIds.length > 0) {
          const userPromises = userIds.map(id => userApi.get(id).catch(() => null))
          const users = await Promise.all(userPromises)
          users.forEach(user => {
            if (user) {
              userMap[user.id] = user
            }
          })
        }
      }
      
      // 如果是关联字段，获取关联数据
      let relationDataMap: Record<string, any> = {}
      if (isRelationField && dimensionFieldInfo?.relation_model) {
        const relationIds = [...new Set(rawData.map((item: any) => item[config.dimensionField]).filter(Boolean))]
        if (relationIds.length > 0) {
          // 获取关联模型的所有数据，然后筛选需要的
          const relationRes = await dataApi.list(dimensionFieldInfo.relation_model, 1, 1000)
          const allRelationData = relationRes.data || []
          relationIds.forEach(id => {
            const found = allRelationData.find((d: any) => d.id === id)
            if (found) {
              relationDataMap[id] = found
            }
          })
        }
      }
      
      // 获取关联字段的显示字段
      const displayFields = dimensionFieldInfo?.display_fields || ['name', 'title', 'id']
      
      // 按维度分组统计
      const grouped: Record<string, number> = {}
      rawData.forEach((item: any) => {
        let key = item[config.dimensionField] || '未分类'
        const originalKey = key
        
        // 如果是用户字段，显示用户名
        if (isUserField && key !== '未分类') {
          const user = userMap[key]
          key = user?.nickname || user?.username || key
        }
        
        // 如果是关联字段，显示关联数据的显示字段
        if (isRelationField && key !== '未分类') {
          const relationData = relationDataMap[originalKey]
          if (relationData) {
            // 按display_fields顺序查找第一个有值的字段
            for (const field of displayFields) {
              if (relationData[field]) {
                key = relationData[field]
                break
              }
            }
          }
        }
        
        if (config.valueAggregation === 'count') {
          grouped[key] = (grouped[key] || 0) + 1
        } else if (config.valueAggregation === 'sum' && config.valueField) {
          grouped[key] = (grouped[key] || 0) + (Number(item[config.valueField]) || 0)
        } else if (config.valueAggregation === 'avg' && config.valueField) {
          if (!grouped[key]) grouped[key] = 0
          grouped[key] = grouped[key] / (rawData.filter((i: any) => i[config.dimensionField] === originalKey).length || 1)
        }
      })
      
      // 转换为图表数据
      const chartData = Object.entries(grouped).map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2))
      }))
      
      setData(chartData)
    } catch (error) {
      console.error('Failed to load chart data:', error)
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
          chartType: values.chartType,
          dimensionField: values.dimensionField,
          valueField: values.valueField,
          valueAggregation: values.valueAggregation,
        }
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

    const total = data.reduce((sum, item) => sum + item.value, 0)

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
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
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
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
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
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    return null
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
      {/* 标题栏 */}
      <div 
        style={{ 
          padding: '12px 16px', 
          borderBottom: '1px solid #e8e8e8', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: '#fafafa',
        }}
      >
        {/* 拖动手柄 - 只在标题文字区域，配置打开时禁用 */}
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
              form.setFieldsValue({ dimensionField: undefined, valueField: undefined })
              // 更新模型字段
              const selectedModel = models.find(m => m.id === value)
              if (selectedModel) {
                setModelFields(selectedModel.fields || [])
              }
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
          
          <Form.Item label="维度字段" name="dimensionField" rules={[{ required: true }]}>
            <Select placeholder="选择维度字段">
              {modelFields.filter(f => !f.deleted && f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at').map(f => (
                <Option key={f.id} value={f.name}>{f.display_name}</Option>
              ))}
            </Select>
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
