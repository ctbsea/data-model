import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Collapse, Descriptions, Drawer, Input, List, message, Modal, Select, Space, Switch, Tag, Typography } from 'antd'
import { CopyOutlined, DeleteOutlined, HistoryOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { automationApi, Automation, AutomationRun, AutomationWebhookLog, StepLog } from '../../../api/automation'
import { modelApi, Model } from '../../../api/model'
import dayjs from 'dayjs'

const { Option } = Select
const { Text, Paragraph } = Typography

type FailurePolicy = 'stop' | 'continue'

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
  scheduleInterval?: string
  scheduleValue?: number
}

interface ActionItem {
  type: string
  config: Record<string, any>
  on_failure?: FailurePolicy
}

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

const actionLabel = (type: string) => ({
  api_call: '调用接口',
  send_email: '发送邮件',
  create_record: '创建记录',
  update_record: '更新记录',
  delete_record: '删除记录',
}[type] || type)

const safeJsonParse = <T,>(value: string | undefined, fallback: T): T => {
  try {
    if (!value) return fallback
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const prettyJson = (value: string) => {
  try {
    return JSON.stringify(JSON.parse(value || '{}'), null, 2)
  } catch {
    return value || '{}'
  }
}

const getActionPolicy = (action: ActionItem): FailurePolicy => {
  const policy = action.on_failure || action.config?.on_failure
  return policy === 'continue' ? 'continue' : 'stop'
}

export const AutomationDetail: React.FC<AutomationDetailProps> = ({ visible, automation, modelId, fields, onClose }) => {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [triggers, setTriggers] = useState<TriggerCondition[]>([])
  const [actions, setActions] = useState<ActionItem[]>([])
  const [historyVisible, setHistoryVisible] = useState(false)
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [webhookToken, setWebhookToken] = useState('')
  const [webhookLogs, setWebhookLogs] = useState<AutomationWebhookLog[]>([])
  const [triggerPicker, setTriggerPicker] = useState<string>()
  const [actionPicker, setActionPicker] = useState<string>()

  const webhookUrl = useMemo(() => webhookToken ? `${window.location.origin}/api/v1/webhooks/automation/${webhookToken}` : '', [webhookToken])

  useEffect(() => {
    if (!visible) return
    modelApi.list(1, 200).then(res => setModels(res.models || [])).catch(() => setModels([]))

    if (automation) {
      setName(automation.name)
      setDescription(automation.description || '')
      setEnabled(automation.enabled)
      setWebhookToken(automation.webhook_token || '')
      setWebhookLogs([])
      const parsedTriggers = safeJsonParse<any>(automation.triggers, [])
      setTriggers(Array.isArray(parsedTriggers) ? parsedTriggers : [parsedTriggers])
      setActions(safeJsonParse<ActionItem[]>(automation.actions, []).map(action => ({
        ...action,
        on_failure: getActionPolicy(action),
        config: { ...(action.config || {}), on_failure: getActionPolicy(action) },
      })))
    } else {
      setName('未命名自动化')
      setDescription('')
      setEnabled(false)
      setWebhookToken('')
      setWebhookLogs([])
      setTriggers([])
      setActions([])
    }
  }, [visible, automation])

  const resolveModelValue = (value?: string) => {
    if (!value) return undefined
    const match = models.find(item => item.name === value || item.id === value)
    return match?.name || value
  }

  const normalizeActionForSave = (action: ActionItem) => {
    const policy = getActionPolicy(action)
    const config: Record<string, any> = { ...(action.config || {}), on_failure: policy }
    if (['create_record', 'update_record', 'delete_record'].includes(action.type)) {
      const selectedModel = models.find(item => item.name === config.model || item.id === config.model)
      if (selectedModel) config.model = selectedModel.name
    }
    return { ...action, on_failure: policy, config }
  }

  const getFieldOperators = (fieldType: string) => {
    switch (fieldType) {
      case 'number':
      case 'currency':
        return NUMBER_OPERATORS
      case 'date':
      case 'datetime':
        return DATE_OPERATORS
      case 'select':
      case 'multi_select':
      case 'country':
      case 'relation':
        return SELECT_OPERATORS
      default:
        return TEXT_OPERATORS
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
        name: name.trim(),
        description,
        enabled,
        triggers: JSON.stringify(triggers),
        actions: JSON.stringify(actions.map(normalizeActionForSave)),
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
    const trigger: TriggerCondition = { type }
    if (type === 'record_match') trigger.operator = 'equals'
    if (type === 'scheduled') {
      trigger.scheduleInterval = 'minutes'
      trigger.scheduleValue = 30
    }
    setTriggers([...triggers, trigger])
  }

  const updateTrigger = (index: number, updates: Partial<TriggerCondition>) => {
    const next = [...triggers]
    next[index] = { ...next[index], ...updates }
    setTriggers(next)
  }

  const addAction = (type: string) => {
    const config: Record<string, any> = { on_failure: 'stop' }
    if (type === 'api_call') Object.assign(config, { url: '', method: 'POST', headers: '{}', body: '{}' })
    if (type === 'send_email') Object.assign(config, { to: '', subject: '', body: '' })
    if (['create_record', 'update_record', 'delete_record'].includes(type)) Object.assign(config, { model: '', record_id: '', fields: {} })
    setActions([...actions, { type, config, on_failure: 'stop' }])
  }

  const updateActionConfig = (index: number, config: Record<string, any>) => {
    const next = [...actions]
    next[index] = { ...next[index], config: { ...next[index].config, ...config } }
    setActions(next)
  }

  const updateActionFailurePolicy = (index: number, policy: FailurePolicy) => {
    const next = [...actions]
    next[index] = { ...next[index], on_failure: policy, config: { ...next[index].config, on_failure: policy } }
    setActions(next)
  }

  const loadRuns = async () => {
    if (!automation) return
    try {
      const res = await automationApi.listRuns(automation.id)
      setRuns(res.runs || [])
      setHistoryVisible(true)
    } catch {
      message.error('加载运行记录失败')
    }
  }

  const loadWebhookLogs = async () => {
    if (!automation) return
    try {
      const res = await automationApi.listWebhookLogs(automation.id)
      setWebhookLogs(res.logs || [])
    } catch {
      message.error('加载 Webhook 日志失败')
    }
  }

  const regenerateWebhookToken = async () => {
    if (!automation) return
    try {
      const res = await automationApi.regenerateWebhookToken(automation.id)
      setWebhookToken(res.webhook_token)
      setWebhookLogs([])
      message.success('Webhook 地址已更新')
    } catch (error: any) {
      message.error(error.response?.data?.error || '更新失败')
    }
  }

  const copyWebhookUrl = async () => {
    if (!webhookUrl) return
    await navigator.clipboard.writeText(webhookUrl)
    message.success('已复制 Webhook 地址')
  }

  const renderTrigger = (trigger: TriggerCondition, index: number) => {
    const remove = <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setTriggers(triggers.filter((_, i) => i !== index))} />
    if (['record_create', 'record_update', 'record_delete'].includes(trigger.type)) {
      const meta: Record<string, { label: string; desc: string; color: string }> = {
        record_create: { label: '记录创建时', desc: '当前模型创建新记录时触发', color: 'blue' },
        record_update: { label: '记录更新时', desc: '当前模型记录被修改时触发', color: 'green' },
        record_delete: { label: '记录删除时', desc: '当前模型记录被删除时触发', color: 'red' },
      }
      return <Card key={index} size="small" style={{ marginBottom: 8 }} extra={remove}><Tag color={meta[trigger.type].color}>{meta[trigger.type].label}</Tag><Text type="secondary">{meta[trigger.type].desc}</Text></Card>
    }

    if (trigger.type === 'record_match') {
      const selectedField = fields.find(field => field.name === trigger.field || field.id === trigger.field)
      const operators = selectedField ? getFieldOperators(selectedField.type) : TEXT_OPERATORS
      const needsValue = trigger.operator !== 'is_empty' && trigger.operator !== 'is_not_empty'
      return (
        <Card key={index} size="small" style={{ marginBottom: 8 }} extra={remove}>
          <Tag color="cyan">条件匹配时</Tag>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Select value={selectedField?.name || trigger.field} onChange={(value) => updateTrigger(index, { field: value, operator: 'equals', value: '' })} style={{ width: 180 }} placeholder="选择字段">
              {fields.map(field => <Option key={field.name} value={field.name}>{field.display_name || field.name}</Option>)}
            </Select>
            <Select value={trigger.operator || 'equals'} onChange={(value) => updateTrigger(index, { operator: value })} style={{ width: 130 }}>
              {operators.map(operator => <Option key={operator.value} value={operator.value}>{operator.label}</Option>)}
            </Select>
            {needsValue && <Input value={trigger.value} onChange={(event) => updateTrigger(index, { value: event.target.value })} style={{ width: 180 }} placeholder="值，支持 {{字段名}}" />}
          </div>
        </Card>
      )
    }

    if (trigger.type === 'scheduled') {
      return <Card key={index} size="small" style={{ marginBottom: 8 }} extra={remove}><Tag color="orange">定时任务</Tag><Space style={{ marginTop: 8 }}><Text>每</Text><Input type="number" value={trigger.scheduleValue} onChange={(event) => updateTrigger(index, { scheduleValue: Number(event.target.value) })} style={{ width: 80 }} min={1} /><Select value={trigger.scheduleInterval || 'minutes'} onChange={(value) => updateTrigger(index, { scheduleInterval: value })} style={{ width: 100 }}><Option value="minutes">分钟</Option><Option value="hours">小时</Option><Option value="days">天</Option></Select><Text>执行一次</Text></Space></Card>
    }
    return null
  }

  const renderFailurePolicy = (action: ActionItem, index: number) => (
    <Space>
      <Text type="secondary">失败后</Text>
      <Select value={getActionPolicy(action)} onChange={(value) => updateActionFailurePolicy(index, value)} style={{ width: 140 }}>
        <Option value="stop">终止后续动作</Option>
        <Option value="continue">继续执行</Option>
      </Select>
    </Space>
  )

  const renderFieldMapper = (action: ActionItem, index: number) => {
    const selectedModel = models.find(model => model.name === action.config.model || model.id === action.config.model)
    const targetFields = selectedModel?.fields || []
    const entries = Object.entries(action.config.fields || {})
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {entries.map(([fieldName, value]) => {
          const selectedField = targetFields.find(field => field.name === fieldName || field.id === fieldName)
          return (
            <Space key={fieldName} style={{ width: '100%' }}>
              <Select value={selectedField?.name || fieldName} style={{ width: 180 }} onChange={(nextField) => {
                const next = { ...(action.config.fields || {}) }
                delete next[fieldName]
                const nextSelectedField = targetFields.find(field => field.name === nextField)
                next[nextField] = nextSelectedField?.type === 'relation' ? '' : value
                updateActionConfig(index, { fields: next })
              }}>
                {targetFields.map(field => <Option key={field.name} value={field.name}>{field.display_name || field.name}</Option>)}
              </Select>
              {selectedField?.type === 'relation'
                ? <Input value="自动关联当前触发记录" disabled style={{ width: 260 }} />
                : <Input value={String(value ?? '')} onChange={(event) => updateActionConfig(index, { fields: { ...(action.config.fields || {}), [selectedField?.name || fieldName]: event.target.value } })} placeholder="值，支持 {{字段名}}" style={{ width: 260 }} />}
              <Button danger type="text" icon={<DeleteOutlined />} onClick={() => {
                const next = { ...(action.config.fields || {}) }
                delete next[fieldName]
                updateActionConfig(index, { fields: next })
              }} />
            </Space>
          )
        })}
        <Button size="small" type="dashed" onClick={() => {
          const firstField = targetFields.find(field => !(action.config.fields || {})[field.name])
          if (!firstField) return message.warning('请先选择目标模型，或目标模型没有可选字段')
          updateActionConfig(index, { fields: { ...(action.config.fields || {}), [firstField.name]: '' } })
        }}>添加赋值字段</Button>
      </Space>
    )
  }
  const renderAction = (action: ActionItem, index: number) => {
    const remove = <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setActions(actions.filter((_, itemIndex) => itemIndex !== index))} />
    if (action.type === 'api_call') {
      return (
        <Card key={index} size="small" style={{ marginBottom: 8 }} extra={remove} title={<Tag color="purple">调用接口</Tag>}>
          <Alert type="info" showIcon style={{ marginBottom: 8 }} message="接口地址支持 {{字段名}} 变量。为安全起见，后端会拦截内网/本机地址，除非显式开启。" />
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {renderFailurePolicy(action, index)}
            <Space.Compact style={{ width: '100%' }}>
              <Select value={action.config.method || 'POST'} onChange={(value) => updateActionConfig(index, { method: value })} style={{ width: 100 }}>
                <Option value="GET">GET</Option><Option value="POST">POST</Option><Option value="PUT">PUT</Option><Option value="DELETE">DELETE</Option>
              </Select>
              <Input value={action.config.url} onChange={(event) => updateActionConfig(index, { url: event.target.value })} placeholder="https://example.com/api" />
            </Space.Compact>
            <Input.TextArea value={action.config.headers} onChange={(event) => updateActionConfig(index, { headers: event.target.value })} placeholder='请求头 JSON，例如 {"Authorization":"Bearer xxx"}' rows={2} />
            <Input.TextArea value={action.config.body} onChange={(event) => updateActionConfig(index, { body: event.target.value })} placeholder="请求体 JSON" rows={3} />
          </Space>
        </Card>
      )
    }

    if (action.type === 'send_email') {
      return <Card key={index} size="small" style={{ marginBottom: 8 }} extra={remove} title={<Tag color="cyan">发送邮件</Tag>}><Space direction="vertical" style={{ width: '100%' }} size={8}>{renderFailurePolicy(action, index)}<Input value={action.config.to} onChange={(event) => updateActionConfig(index, { to: event.target.value })} placeholder="收件人邮箱，支持 {{字段名}}" /><Input value={action.config.subject} onChange={(event) => updateActionConfig(index, { subject: event.target.value })} placeholder="邮件主题" /><Input.TextArea value={action.config.body} onChange={(event) => updateActionConfig(index, { body: event.target.value })} placeholder="邮件内容" rows={3} /></Space></Card>
    }

    if (['create_record', 'update_record', 'delete_record'].includes(action.type)) {
      const tagColor = action.type === 'create_record' ? 'green' : action.type === 'update_record' ? 'gold' : 'red'
      return (
        <Card key={index} size="small" style={{ marginBottom: 8 }} extra={remove} title={<Tag color={tagColor}>{actionLabel(action.type)}</Tag>}>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {renderFailurePolicy(action, index)}
            <Select value={resolveModelValue(action.config.model)} onChange={(value) => updateActionConfig(index, { model: value, fields: {} })} placeholder="选择目标模型" style={{ width: '100%' }}>
              {models.map(model => <Option key={model.id} value={model.name}>{model.display_name || model.name}</Option>)}
            </Select>
            {action.type !== 'create_record' && <Input value={action.config.record_id} onChange={(event) => updateActionConfig(index, { record_id: event.target.value })} placeholder="记录 ID，留空默认使用当前触发记录；支持 {{字段名}}" />}
            {action.type !== 'delete_record' && renderFieldMapper(action, index)}
          </Space>
        </Card>
      )
    }
    return null
  }

  const renderRunDetail = (run: AutomationRun) => {
    const steps = safeJsonParse<StepLog[]>(run.steps, [])
    return <Space direction="vertical" style={{ width: '100%' }} size={8}><Descriptions size="small" column={2}><Descriptions.Item label="重试次数">{run.retry_count}</Descriptions.Item><Descriptions.Item label="完成时间">{run.completed_at ? dayjs(run.completed_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item></Descriptions>{steps.length > 0 && <List size="small" dataSource={steps} renderItem={(step) => <List.Item><Space><Tag color={step.status === 'success' ? 'green' : 'red'}>{actionLabel(step.type)}</Tag><Text>{step.status === 'success' ? step.result : step.error}</Text><Text type="secondary">{step.duration_ms}ms</Text></Space></List.Item>} />}<Paragraph copyable={{ text: prettyJson(run.trigger_data) }} style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 8, borderRadius: 6 }}>{prettyJson(run.trigger_data)}</Paragraph></Space>
  }

  return (
    <>
      <Drawer
        title={automation ? '编辑自动化' : '新建自动化'}
        open={visible}
        onClose={onClose}
        width={900}
        destroyOnClose
        extra={<Space><Button onClick={onClose}>取消</Button><Button type="primary" onClick={handleSave} loading={saving}>保存</Button></Space>}
        footer={automation && <Space><Button icon={<HistoryOutlined />} onClick={loadRuns}>运行历史</Button><Button icon={<ReloadOutlined />} onClick={regenerateWebhookToken}>重置 Webhook</Button><Button onClick={loadWebhookLogs}>Webhook 日志</Button></Space>}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div style={{ display: 'flex', gap: 16 }}>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="自动化名称" style={{ flex: 1 }} />
            <Space><Text>启用</Text><Switch checked={enabled} onChange={setEnabled} /></Space>
          </div>
          <Input.TextArea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="描述（可选）" rows={2} />
          {automation && <Card size="small" title="Webhook 触发地址" extra={<Button size="small" icon={<CopyOutlined />} onClick={copyWebhookUrl}>复制</Button>}><Text copyable>{webhookUrl}</Text><Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>幂等请求头：Idempotency-Key，同一个自动化内重复 key 只会执行一次。</Paragraph>{webhookLogs.length > 0 && <List size="small" style={{ marginTop: 8 }} dataSource={webhookLogs} renderItem={(log) => <List.Item><Space><Tag color={log.status === 'accepted' ? 'green' : log.status === 'duplicate' ? 'gold' : 'red'}>{log.status}</Tag><Text>{log.idempotency_key || '-'}</Text><Text type="secondary">{dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text><Text type="secondary">{log.remote_ip}</Text></Space></List.Item>} />}</Card>}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>当 ({triggers.length})</Text>
              <Select placeholder="添加触发条件" style={{ width: 180 }} onSelect={(value) => { setTriggerPicker(value); addTrigger(value) }} value={triggerPicker}>
                <Option value="record_create">记录创建时</Option>
                <Option value="record_update">记录更新时</Option>
                <Option value="record_delete">记录删除时</Option>
                <Option value="record_match">条件匹配时</Option>
                <Option value="scheduled">定时任务</Option>
              </Select>
            </div>
            {triggers.length === 0 ? <div style={{ textAlign: 'center', padding: 16, background: '#fafafa', borderRadius: 8 }}><Text type="secondary">添加触发条件来启动自动化</Text></div> : triggers.map(renderTrigger)}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong>然后 ({actions.length})</Text>
              <Select placeholder="添加动作" style={{ width: 180 }} onSelect={(value) => { setActionPicker(value); addAction(value) }} value={actionPicker}>
                <Option value="api_call">调用接口</Option>
                <Option value="send_email">发送邮件</Option>
                <Option value="create_record">创建记录</Option>
                <Option value="update_record">更新记录</Option>
                <Option value="delete_record">删除记录</Option>
              </Select>
            </div>
            {actions.length === 0 ? <div style={{ textAlign: 'center', padding: 16, background: '#fafafa', borderRadius: 8 }}><Text type="secondary">添加执行动作</Text></div> : actions.map(renderAction)}
          </div>
        </Space>
      </Drawer>

      <Modal title="运行历史" open={historyVisible} onCancel={() => setHistoryVisible(false)} footer={null} width={760}>
        <List dataSource={runs} locale={{ emptyText: '暂无运行记录' }} renderItem={(run) => <List.Item><Collapse style={{ width: '100%' }} items={[{ key: run.id, label: <Space><ThunderboltOutlined style={{ color: run.status === 'success' ? '#52c41a' : '#ff4d4f' }} /><Tag color={run.status === 'success' ? 'green' : run.status === 'running' ? 'blue' : 'red'}>{run.status}</Tag><Text>{dayjs(run.started_at).format('YYYY-MM-DD HH:mm:ss')}</Text>{run.error && <Text type="danger">{run.error}</Text>}</Space>, children: renderRunDetail(run) }]} /></List.Item>} />
      </Modal>
    </>
  )
}
