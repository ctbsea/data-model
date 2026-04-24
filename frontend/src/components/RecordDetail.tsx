import React, { useState, useEffect } from 'react'
import { 
  Drawer, 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  Button, 
  message, 
  Avatar, 
  Divider,
  Upload,
  Mentions
} from 'antd'
import { 
  CloseOutlined, 
  BellOutlined,
  PaperClipOutlined,
  PictureOutlined,
  UserOutlined,
  LeftOutlined,
  RightOutlined,
  MessageOutlined,
  HistoryOutlined
} from '@ant-design/icons'
import { Field, Model, modelApi } from '../api/model'
import { userApi } from '../api/user'
import { dataApi } from '../api/data'
import { commentApi, Comment as CommentType } from '../api/comment'
import HistoryDrawer from './HistoryDrawer'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

interface RecordDetailProps {
  visible: boolean
  record: any
  model: Model | null
  fields: Field[]
  onClose: () => void
  onUpdate: () => void
}

const RecordDetail: React.FC<RecordDetailProps> = ({
  visible,
  record,
  model,
  fields,
  onClose,
  onUpdate
}) => {
  const [form] = Form.useForm()
  const [comments, setComments] = useState<CommentType[]>([])
  const [newComment, setNewComment] = useState('')
  const [commentCollapsed, setCommentCollapsed] = useState(true)
  const [saving, setSaving] = useState(false)
  const [relationData, setRelationData] = useState<Record<string, any[]>>({})
  const [allModels, setAllModels] = useState<Model[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [historyVisible, setHistoryVisible] = useState(false)

  // 加载评论
  const loadComments = async () => {
    if (!model || !record) return
    try {
      const data = await commentApi.list(model.name, record.id)
      setComments(data)
    } catch (error) {
      console.error('Failed to load comments:', error)
    }
  }

  useEffect(() => {
    if (visible && record && model) {
      // 填充表单数据
      const formValues: any = {}
      fields.forEach(field => {
        if (field.type === 'date' && record[field.name]) {
          formValues[field.name] = dayjs(record[field.name])
        } else {
          formValues[field.name] = record[field.name]
        }
      })
      form.setFieldsValue(formValues)
      
      // 加载评论
      loadComments()
      
      // 加载用户数据
      const loadUsers = async () => {
        try {
          const userRes = await userApi.list(1, 100)
          setUsers(userRes.users || [])
        } catch (error) {
          console.error('Failed to load users:', error)
        }
      }
      loadUsers()
    }
  }, [visible, record, fields, model])

  useEffect(() => {
    const loadData = async () => {
      const modelRes = await modelApi.list(1, 100)
      setAllModels(modelRes.models || [])
      
      for (const field of fields) {
        if (field.type === 'relation' && field.relation_config) {
          try {
            const config = JSON.parse(field.relation_config)
            const targetModel = modelRes.models?.find((m: Model) => m.id === config.target_model_id)
            if (targetModel) {
              const dataRes = await dataApi.list(targetModel.name, 1, 100)
              setRelationData(prev => ({
                ...prev,
                [field.name]: dataRes.data || []
              }))
            }
          } catch (e) {
            console.error('Failed to load relation data:', e)
          }
        }
      }
    }
    
    // 只在弹窗可见时才加载
    if (visible && fields.length > 0) {
      loadData()
    }
  }, [visible, fields])

  const handleSave = async () => {
    if (!model || !record) return
    
    try {
      setSaving(true)
      const values = await form.validateFields()
      
      // 处理字段类型转换
      const submitData: any = {}
      Object.keys(values).forEach(key => {
        const field = fields.find(f => f.name === key)
        const value = values[key]
        
        if (dayjs.isDayjs(value)) {
          // 日期字段
          submitData[key] = value.format('YYYY-MM-DD')
        } else if (field?.type === 'number' && value !== undefined && value !== null && value !== '') {
          // 数字字段：转换为数字类型
          submitData[key] = Number(value)
        } else {
          submitData[key] = value
        }
      })
      
      await dataApi.update(model.name, record.id, submitData)
      message.success('保存成功')
      onUpdate()
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !model || !record) return
    
    try {
      await commentApi.create({
        model_name: model.name,
        record_id: record.id,
        content: newComment
      })
      setNewComment('')
      loadComments()
      message.success('评论已添加')
    } catch (error) {
      message.error('添加评论失败')
    }
  }

  const renderFormField = (field: Field) => {
    if (['id', 'created_at', 'updated_at'].includes(field.name)) return null
    
    const fieldIcon = getFieldIcon(field.type)
    
    return (
      <div key={field.id} style={{ marginBottom: 16 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: 8,
          gap: 8
        }}>
          <span style={{ 
            width: 20, 
            height: 20, 
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f0f0f0',
            borderRadius: 4,
            fontSize: 12,
          }}>
            {fieldIcon}
          </span>
          <span style={{ fontWeight: 500 }}>{field.display_name}</span>
        </div>
        <Form.Item name={field.name} noStyle>
          {renderFieldInput(field)}
        </Form.Item>
      </div>
    )
  }

  const getFieldIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      text: 'A',
      number: '#',
      select: '○',
      multi_select: '◉',
      date: '📅',
      boolean: '✓',
      email: '@',
      url: '🔗',
      user: '👤',
      relation: '🔗',
      attachment: '📎',
    }
    return iconMap[type] || 'A'
  }

  const renderFieldInput = (field: Field) => {
    if (field.type === 'select' || field.type === 'multi_select') {
      const options = JSON.parse(field.options || '[]')
      return (
        <Select
          mode={field.type === 'multi_select' ? 'multiple' : undefined}
          placeholder={`请选择${field.display_name}`}
          style={{ width: '100%' }}
        >
          {options.map((opt: string) => (
            <Option key={opt} value={opt}>{opt}</Option>
          ))}
        </Select>
      )
    }
    
    if (field.type === 'date') {
      return <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
    }
    
    if (field.type === 'boolean') {
      return (
        <Select style={{ width: '100%' }}>
          <Option value={true}>是</Option>
          <Option value={false}>否</Option>
        </Select>
      )
    }
    
    if (field.type === 'number') {
      return <Input type="number" placeholder={`请输入${field.display_name}`} />
    }
    
    if (field.type === 'user') {
      return (
        <Select
          placeholder={`请选择${field.display_name}`}
          style={{ width: '100%' }}
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        >
          {users.map(user => (
            <Option key={user.id} value={user.id} label={user.nickname || user.username}>
              {user.nickname || user.username}
            </Option>
          ))}
        </Select>
      )
    }
    
    if (field.type === 'relation') {
      const records = relationData[field.name] || []
      const config = JSON.parse(field.relation_config || '{}')
      const allowMultiple = config.allow_multiple
      const displayFields = config.display_fields || []
      
      return (
        <Select
          mode={allowMultiple ? 'multiple' : undefined}
          placeholder="+ 选择记录"
          style={{ width: '100%' }}
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        >
          {records.map((rec: any) => {
            const label = displayFields.length > 0
              ? displayFields.map((f: string) => rec[f]).filter(Boolean).join(' - ')
              : rec.name || rec.id
            
            return (
              <Option key={rec.id} value={rec.id} label={label}>
                {label}
              </Option>
            )
          })}
        </Select>
      )
    }
    
    if (field.type === 'attachment') {
      return (
        <Upload>
          <Button icon={<PaperClipOutlined />}>+ 上传文件</Button>
        </Upload>
      )
    }
    
    return <Input placeholder={`请输入${field.display_name}`} />
  }

  return (
    <Drawer
      open={visible}
      onClose={onClose}
      width={commentCollapsed ? 600 : 900}
      closable={false}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ display: 'flex', height: '100%' }}>
        {/* 左侧表单区域 */}
        <div style={{ 
          flex: 1, 
          padding: 24, 
          overflow: 'auto',
          borderRight: '1px solid #f0f0f0'
        }}>
          {/* 顶部标题栏 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 24
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button type="text" icon={<LeftOutlined />} onClick={onClose} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button 
                type="text" 
                icon={<HistoryOutlined />} 
                onClick={() => setHistoryVisible(true)}
              />
              <div style={{ position: 'relative' }}>
                <Button 
                  type="text" 
                  icon={<MessageOutlined />} 
                  onClick={() => setCommentCollapsed(!commentCollapsed)}
                />
                {comments.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: '#ff4d4f',
                    color: '#fff',
                    fontSize: 10,
                    padding: '0 4px',
                    borderRadius: 10,
                    minWidth: 16,
                    textAlign: 'center',
                    transform: 'translate(25%, -25%)',
                  }}>
                    {comments.length}
                  </span>
                )}
              </div>
              <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
            </div>
          </div>

          {/* 表单内容 */}
          <Form form={form} layout="vertical">
            {fields.map(field => renderFormField(field))}
          </Form>

          {/* 保存按钮 */}
          <div style={{ marginTop: 24 }}>
            <Button type="primary" onClick={handleSave} loading={saving}>
              保存
            </Button>
          </div>
        </div>

        {/* 右侧评论区 */}
        <div style={{ 
          width: commentCollapsed ? 0 : 300, 
          overflow: 'hidden',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: '#fff',
        }}>
          {/* 评论收起/展开按钮 */}
          <div 
            style={{ 
              position: 'absolute',
              left: -20,
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#fff',
              border: '1px solid #e8e8e8',
              borderRadius: '4px 0 0 4px',
              cursor: 'pointer',
              padding: '8px 4px',
              zIndex: 10,
            }}
            onClick={() => setCommentCollapsed(!commentCollapsed)}
          >
            {commentCollapsed ? <LeftOutlined /> : <RightOutlined />}
          </div>

          {!commentCollapsed && (
            <>
              {/* 评论标题 */}
              <div style={{ 
                padding: '16px 24px', 
                borderBottom: '1px solid #f0f0f0',
              }}>
                <span style={{ fontWeight: 500, fontSize: 16 }}>评论</span>
              </div>

              {/* 评论列表 */}
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {comments.map(comment => {
                  const isMyComment = comment.user_id === '1' // 假设当前用户ID为1
                  return (
                    <div key={comment.id} style={{ 
                      marginBottom: 16,
                      display: 'flex',
                      justifyContent: isMyComment ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: 8,
                        flexDirection: isMyComment ? 'row-reverse' : 'row',
                        maxWidth: '80%',
                      }}>
                        <Avatar size={32} icon={<UserOutlined />} />
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 8,
                            flexDirection: isMyComment ? 'row-reverse' : 'row',
                          }}>
                            <span style={{ fontWeight: 500 }}>{comment.user_name}</span>
                            <span style={{ fontSize: 12, color: '#999' }}>
                              {dayjs(comment.created_at).format('MM-DD HH:mm')}
                            </span>
                          </div>
                          <div style={{ 
                            marginTop: 4,
                            background: isMyComment ? '#e6f7ff' : '#f5f5f5',
                            padding: '8px 12px',
                            borderRadius: 8,
                          }}>
                            {comment.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 评论输入 */}
              <div style={{ 
                padding: 16, 
                borderTop: '1px solid #f0f0f0',
                background: '#fafafa'
              }}>
                <TextArea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="添加评论..."
                  autoSize={{ minRows: 2, maxRows: 4 }}
                />
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <Button type="primary" size="small" onClick={handleAddComment}>
                    发送
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* 历史记录抽屉 */}
      <HistoryDrawer
        visible={historyVisible}
        modelName={model?.name || ''}
        recordId={record?.id || ''}
        onClose={() => setHistoryVisible(false)}
      />
    </Drawer>
  )
}

export default RecordDetail
