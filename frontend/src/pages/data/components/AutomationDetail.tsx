import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, Select, Button, Switch, Space, Card, Tag, Divider, message, Popconfirm, List, Typography } from 'antd'
import { PlusOutlined, DeleteOutlined, PlayCircleOutlined, HistoryOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { automationApi, Automation, AutomationRun } from '../../../api/automation'
import dayjs from 'dayjs'

const { Option } = Select
const { Text, Paragraph } = Typography

// 条件操作符映射
const TEXT_OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'not_equals', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'not_contains', label: '不包含' },
  { value: 'is_empty', label: '为空' },
  { value: 'is_not_empty', label: '不为空' },
]

const NUMBER_OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'not_equals', label: '不等于' },
  { value: 'greater_than', label: '大于' },
  { value: 'less_than', label: '小于' },
  { value: 'greater_or_equal', label: '大于等于' },
  { value: 'less_or_equal', label: '小于等于' },
  { value: 'is_empty', label: '为空' },
  { value: 'is_not_empty', label: '不为空' },
]

const DATE_OPERATORS = [
  { value: 'is_empty', label: '为空' },
  { value: 'is_not_empty', label: '不为空' },
  { value: 'before', label: '早于' },
  { value: 'after', label: '晚于' },
]

const SELECT_OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'not_equals', label: '不等于' },
  { value: 'is_empty', label: '为空' },
  { value: 'is_not_empty', label: '不为空' },
]

interface AutomationDetailProps {
  visible: boolean
  automation: Automation | null
  modelId: string
  fields: any[]
  onClose: () => void
}

interface TriggerCondition {
  type: string
  field?: string
  operator?: string
  value?: string
  // 定时任务配置
  scheduleInterval?: string
  scheduleValue?: number
  scheduleCron?: string
}

interface ActionItem {
  type: string
  config: Record<string, any>
}

export const AutomationDetail: React.FC<AutomationDetailProps> = ({
  visible,
  automation,
  modelId,
  fields,
  onClose
}) => {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [triggers, setTriggers] = useState<TriggerCondition[]>([])
  const [actions, setActions] = useState<ActionItem[]>([])
  const [historyVisible, setHistoryVisible] = useState(false)
  const [runs, setRuns] = useState<AutomationRun[]>([])

  useEffect(() => {
    if (visible) {
      if (automation) {
        setName(automation.name)
        setDescription(automation.description || '')
        setEnabled(automation.enabled)
        try {
          const triggerData = JSON.parse(automation.triggers || '[]')
          setTriggers(Array.isArray(triggerData) ? triggerData : [triggerData])
        } catch { setTriggers([]) }
        try {
          setActions(JSON.parse(automation.actions || '[]'))
        } catch { setActions([]) }
      } else {
        setName('未命名的自动化')
        setDescription('')
        setEnabled(false)
        setTriggers([])
        setActions([])
      }
    }
  }, [visible, automation])

  const getFieldOperators = (fieldType: string) => {
    switch (fieldType) {
      case 'number': return NUMBER_OPERATORS
      case 'date': case 'datetime': return DATE_OPERATORS
      case 'select': case 'multi_select': return SELECT_OPERATORS
      default: return TEXT_OPERATORS
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      message.error('请输入名称')
      return
    }
    setSaving(true)
    try {
      const data = {
        model_id: modelId,
        name,
        description,
        enabled,
        triggers: JSON.stringify(triggers),
        actions: JSON.stringify(actions),
      }

      if (automation) {
        await automationApi.update(automation.id, data)
        message.success('保存成功')
      } else {
        await automationApi.create(data)
        message.success('创建成功')
      }
      onClose()
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const addTrigger = (type: string) => {
    const newTrigger: TriggerCondition = { type }
    if (type === 'record_match') {
      newTrigger.field = ''
      newTrigger.operator = 'equals'
      newTrigger.value = ''
    } else if (type === 'scheduled') {
      newTrigger.scheduleInterval = 'minutes'
      newTrigger.scheduleValue = 30
    }
    setTriggers([...triggers, newTrigger])
  }

  const removeTrigger = (index: number) => {
    setTriggers(triggers.filter((_, i) => i !== index))
  }

  const updateTrigger = (index: number, updates: Partial<TriggerCondition>) => {
    const newTriggers = [...triggers]
    newTriggers[index] = { ...newTriggers[index], ...updates }
    setTriggers(newTriggers)
  }

  const addAction = (type: string) => {
    const newAction: ActionItem = { type, config: {} }
    if (type === 'api_call') {
      newAction.config = { url: '', method: 'POST', headers: '{}', body: '{}' }
    } else if (type === 'send_email') {
      newAction.config = { to: '', subject: '', body: '' }
    }
    setActions([...actions, newAction])
  }

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const updateAction = (index: number, config: Record<string, any>) => {
    const newActions = [...actions]
    newActions[index] = { ...newActions[index], config: { ...newActions[index].config, ...config } }
    setActions(newActions)
  }

  const loadRuns = async () => {
    if (!automation) return
    try {
      const res = await automationApi.listRuns(automation.id)
      setRuns(res.runs || [])
      setHistoryVisible(true)
    } catch (error) {
      message.error('加载运行记录失败')
    }
  }

  const renderTrigger = (trigger: TriggerCondition, index: number) => {
    if (trigger.type === 'record_create') {
      return (
        <Card key={index} size="small" style={{ marginBottom: 8 }}
          extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeTrigger(index)} />}
        >
          <Tag color="blue">记录创建时</Tag>
          <Text type="secondary">当有新记录创建时触发</Text>
        </Card>
      )
    }

    if (trigger.type === 'record_match') {
      const selectedField = fields.find(f => f.name === trigger.field)
      const operators = selectedField ? getFieldOperators(selectedField.type) : TEXT_OPERATORS
      const needsValue = trigger.operator !== 'is_empty' && trigger.operator !== 'is_not_empty'

      return (
        <Card key={index} size="small" style={{ marginBottom: 8 }}
          extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeTrigger(index)} />}
        >
          <Tag color="green">条件匹配</Tag>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Select
              value={trigger.field}
              onChange={(v) => updateTrigger(index, { field: v, operator: 'equals', value: '' })}
              style={{ width: 150 }}
              placeholder="选择字段"
            >
              {fields.map(f => (
                <Option key={f.name} value={f.name}>{f.display_name}</Option>
              ))}
            </Select>
            <Select
              value={trigger.operator}
              onChange={(v) => updateTrigger(index, { operator: v })}
              style={{ width: 120 }}
            >
              {operators.map(op => (
                <Option key={op.value} value={op.value}>{op.label}</Option>
              ))}
            </Select>
            {needsValue && (
              <Input
                value={trigger.value}
                onChange={(e) => updateTrigger(index, { value: e.target.value })}
                style={{ width: 150 }}
                placeholder="值"
              />
            )}
          </div>
        </Card>
      )
    }

    if (trigger.type === 'scheduled') {
      return (
        <Card key={index} size="small" style={{ marginBottom: 8 }}
          extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeTrigger(index)} />}
        >
          <Tag color="orange">定时任务</Tag>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <Text>每</Text>
            <Input
              type="number"
              value={trigger.scheduleValue}
              onChange={(e) => updateTrigger(index, { scheduleValue: Number(e.target.value) })}
              style={{ width: 80 }}
              min={1}
            />
            <Select
              value={trigger.scheduleInterval}
              onChange={(v) => updateTrigger(index, { scheduleInterval: v })}
              style={{ width: 100 }}
            >
              <Option value="minutes">分钟</Option>
              <Option value="hours">小时</Option>
              <Option value="days">天</Option>
            </Select>
            <Text>执行一次</Text>
          </div>
        </Card>
      )
    }

    return null
  }

  const renderAction = (action: ActionItem, index: number) => {
    if (action.type === 'api_call') {
      return (
        <Card key={index} size="small" style={{ marginBottom: 8 }}
          extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeAction(index)} />}
          title={<Tag color="purple">执行接口</Tag>}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Select value={action.config.method} onChange={(v) => updateAction(index, { method: v })} style={{ width: 90 }}>
                <Option value="GET">GET</Option>
                <Option value="POST">POST</Option>
                <Option value="PUT">PUT</Option>
                <Option value="DELETE">DELETE</Option>
              </Select>
              <Input value={action.config.url} onChange={(e) => updateAction(index, { url: e.target.value })} placeholder="接口地址" style={{ flex: 1 }} />
            </div>
            <Input.TextArea value={action.config.body} onChange={(e) => updateAction(index, { body: e.target.value })} placeholder="请求体 JSON" rows={2} />
          </Space>
        </Card>
      )
    }

    if (action.type === 'send_email') {
      return (
        <Card key={index} size="small" style={{ marginBottom: 8 }}
          extra={<Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeAction(index)} />}
          title={<Tag color="cyan">发送邮件</Tag>}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Input value={action.config.to} onChange={(e) => updateAction(index, { to: e.target.value })} placeholder="收件人邮箱" />
            <Input value={action.config.subject} onChange={(e) => updateAction(index, { subject: e.target.value })} placeholder="邮件主题" />
            <Input.TextArea value={action.config.body} onChange={(e) => updateAction(index, { body: e.target.value })} placeholder="邮件内容" rows={3} />
          </Space>
        </Card>
      )
    }

    return null
  }

  return (
    <>
      <Modal
        title={automation ? '编辑自动化' : '新建自动化'}
        open={visible}
        onCancel={onClose}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {automation && (
                <Button icon={<HistoryOutlined />} onClick={loadRuns}>运行历史</Button>
              )}
            </div>
            <Space>
              <Button onClick={onClose}>取消</Button>
              <Button type="primary" onClick={handleSave} loading={saving}>保存</Button>
            </Space>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="自动化名称"
            style={{ flex: 1 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text>启用</Text>
            <Switch checked={enabled} onChange={setEnabled} />
          </div>
        </div>

        <Input.TextArea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="描述（可选）"
          rows={2}
          style={{ marginBottom: 16 }}
        />

        {/* 触发条件 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>当 ({triggers.length})</Text>
            <Select
              placeholder="添加触发条件"
              style={{ width: 160 }}
              onChange={addTrigger}
              value={undefined}
            >
              <Option value="record_create">记录创建时</Option>
              <Option value="record_match">条件匹配时</Option>
              <Option value="scheduled">定时任务</Option>
            </Select>
          </div>
          {triggers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, background: '#fafafa', borderRadius: 8 }}>
              <Text type="secondary">添加触发条件来启动自动化</Text>
            </div>
          ) : (
            triggers.map((trigger, index) => renderTrigger(trigger, index))
          )}
        </div>

        {/* 执行动作 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>然后 ({actions.length})</Text>
            <Select
              placeholder="添加动作"
              style={{ width: 160 }}
              onChange={addAction}
              value={undefined}
            >
              <Option value="api_call">执行接口</Option>
              <Option value="send_email">发送邮件</Option>
            </Select>
          </div>
          {actions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, background: '#fafafa', borderRadius: 8 }}>
              <Text type="secondary">添加执行动作</Text>
            </div>
          ) : (
            actions.map((action, index) => renderAction(action, index))
          )}
        </div>
      </Modal>

      {/* 运行历史 */}
      <Modal
        title="运行历史"
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        footer={null}
        width={600}
      >
        <List
          dataSource={runs}
          locale={{ emptyText: '暂无运行记录' }}
          renderItem={(run) => (
            <List.Item>
              <List.Item.Meta
                avatar={<ThunderboltOutlined style={{ color: run.status === 'success' ? '#52c41a' : '#ff4d4f' }} />}
                title={
                  <Space>
                    <Tag color={run.status === 'success' ? 'green' : 'red'}>{run.status}</Tag>
                    <Text>{dayjs(run.started_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
                  </Space>
                }
                description={run.error ? <Text type="danger" style={{ fontSize: 12 }}>{run.error}</Text> : null}
              />
            </List.Item>
          )}
        />
      </Modal>
    </>
  )
}
