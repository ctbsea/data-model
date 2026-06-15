import React, { useState, useEffect } from 'react'
import { 
  Drawer, 
  Form, 
  Input, 
  InputNumber,
  Select, 
  DatePicker, 
  Button, 
  message, 
  Avatar, 
  Divider,
  Upload,
  Mentions,
  Radio
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
import { dictionaryApi, DictionaryItem } from '../api/dictionary'
import { getDictionaryItemsForField, getDictionaryItemLabel, parseFieldOptions } from '../utils/dictionaryField'
import HistoryDrawer from './HistoryDrawer'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input
const REQUIRED_TEXT = '\u5fc5\u586b'
const UI_TEXT = {
  editRecord: '\u7f16\u8f91\u8bb0\u5f55',
  addRecord: '\u6dfb\u52a0\u8bb0\u5f55',
  save: '\u4fdd\u5b58',
  add: '\u6dfb\u52a0',
  saveSuccess: '\u4fdd\u5b58\u6210\u529f',
  addSuccess: '\u6dfb\u52a0\u6210\u529f',
  saveFailed: '\u4fdd\u5b58\u5931\u8d25',
  commentAddSuccess: '\u8bc4\u8bba\u6dfb\u52a0\u6210\u529f',
  commentAddFailed: '\u6dfb\u52a0\u8bc4\u8bba\u5931\u8d25',
  inputPrefix: '\u8bf7\u8f93\u5165',
  selectPrefix: '\u8bf7\u9009\u62e9',
  selectDate: '\u9009\u62e9\u65e5\u671f',
  selectDatetime: '\u9009\u62e9\u65e5\u671f\u65f6\u95f4',
  selectCountry: '\u8bf7\u9009\u62e9\u56fd\u5bb6',
  uploadFile: '\u4e0a\u4f20\u6587\u4ef6',
  uploadImage: '\u4e0a\u4f20\u56fe\u7247',
  noUsers: '\u6682\u65e0\u7528\u6237\u6570\u636e',
  selectRecord: '+ \u9009\u62e9\u8bb0\u5f55',
  comments: '\u8bc4\u8bba',
  addComment: '\u6dfb\u52a0\u8bc4\u8bba...',
  send: '\u53d1\u9001',
}

const getFileUrl = (url: string) => {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  const apiBase = (import.meta as any).env?.VITE_API_URL || ''
  return apiBase ? `${apiBase}${url}` : url
}

interface RecordDetailProps {
  visible: boolean
  record: any
  model: Model | null
  fields: Field[]
  initialUsers?: any[]
  initialValues?: Record<string, any>
  onClose: () => void
  onUpdate: () => void
}

const RecordDetail: React.FC<RecordDetailProps> = ({
  visible,
  record,
  model,
  fields,
  initialUsers = [],
  initialValues,
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
  const [currencies, setCurrencies] = useState<DictionaryItem[]>([])
  const [countries, setCountries] = useState<DictionaryItem[]>([])
  const [dictionaryItems, setDictionaryItems] = useState<DictionaryItem[]>([])
  const [historyVisible, setHistoryVisible] = useState(false)

  const normalizeBooleanValue = (value: any) => {
    if (value === true || value === 'true' || value === 1 || value === '1') return true
    if (value === false || value === 'false' || value === 0 || value === '0') return false
    return value
  }

  // Load comments
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
      // Fill form values for edit mode
      const formValues: any = {}
      fields.forEach(field => {
        if ((field.type === 'date' || field.type === 'datetime') && record[field.name]) {
          const d = dayjs(record[field.name])
          formValues[field.name] = d.isValid() ? d : null
        } else if (field.type === 'boolean') {
          formValues[field.name] = normalizeBooleanValue(record[field.name])
        } else {
          formValues[field.name] = record[field.name]
        }
      })
      form.setFieldsValue(formValues)
      
      // Load comments
      loadComments()

      dictionaryApi.list(undefined, true).then(res => {
        const items = res.items || []
        setDictionaryItems(items)
        setCurrencies(items.filter(item => item.type === 'currency' && item.enabled !== false))
        setCountries(items.filter(item => item.type === 'country' && item.enabled !== false))
      }).catch(console.error)
    } else if (visible && !record && model) {
      form.resetFields()
      if (initialValues) {
        form.setFieldsValue(initialValues)
      }
    }
  }, [visible, record, fields, model, initialValues, form])
  useEffect(() => {
    if (!visible || !model) return
    if (initialUsers.length > 0) {
      setUsers(initialUsers)
    }

    const loadUsers = async () => {
      try {
        const userRes = await userApi.list(1, 1000)
        let nextUsers = userRes.users || initialUsers
        const currentUserIds = fields
          .filter(field => field.type === 'user')
          .map(field => record?.[field.name])
          .filter(Boolean)

        for (const userId of currentUserIds) {
          if (!nextUsers.some((user: any) => user.id === userId)) {
            try {
              const user = await userApi.get(userId)
              nextUsers = [...nextUsers, user]
            } catch {
              // ignore missing user
            }
          }
        }
        setUsers(nextUsers)
      } catch (error) {
        console.error('Failed to load users:', error)
      }
    }

    loadUsers()
  }, [visible, model, fields, record, initialUsers])

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
    
    if (visible && fields.length > 0) {
      loadData()
    }
  }, [visible, fields])

  const handleSave = async () => {
    if (!model) return
    
    try {
      setSaving(true)
      const values = await form.validateFields()
      
      // 澶勭悊瀛楁绫诲瀷杞崲
      const submitData: any = {}
      Object.keys(values).forEach(key => {
        const field = fields.find(f => f.name === key)
        const value = values[key]
        
        if (dayjs.isDayjs(value)) {
          // 鏃ユ湡瀛楁
          submitData[key] = value.format('YYYY-MM-DD')
        } else if ((field?.type === 'number' || field?.type === 'currency') && value !== undefined && value !== null && value !== '') {
          // 鏁板瓧瀛楁锛氳浆鎹负鏁板瓧绫诲瀷
          submitData[key] = Number(value)
        } else {
          submitData[key] = value
        }
      })
      
      if (record) {
        await dataApi.update(model.name, record.id, submitData)
        message.success(UI_TEXT.saveSuccess)
      } else {
        await dataApi.create(model.name, submitData)
        message.success(UI_TEXT.addSuccess)
      }
      onUpdate()
      if (!record) {
        onClose()
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || UI_TEXT.saveFailed)
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
      message.success(UI_TEXT.commentAddSuccess)
    } catch (error) {
      message.error(UI_TEXT.commentAddFailed)
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
          <span style={{ fontWeight: 500 }}>
            {field.required && <span style={{ color: '#ff4d4f', marginRight: 4 }}>*</span>}
            {field.display_name}
            {field.required && <span style={{ marginLeft: 8, padding: '1px 6px', color: '#ff4d4f', background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 4, fontSize: 12 }}>{REQUIRED_TEXT}</span>}
          </span>
        </div>
        <Form.Item
          name={field.name}
          noStyle
          rules={field.required ? [{ required: true, message: `${field.display_name}${REQUIRED_TEXT}` }] : undefined}
        >
          {renderFieldInput(field)}
        </Form.Item>
      </div>
    )
  }

  const getFieldIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      text: 'A',
      number: '#',
      select: 'S',
      multi_select: 'M',
      date: 'D',
      boolean: 'B',
      email: '@',
      url: 'U',
      user: 'P',
      relation: 'R',
      attachment: 'F',
    }
    return iconMap[type] || 'A'
  }

  const renderFieldInput = (field: Field) => {
    if (field.type === 'select' || field.type === 'multi_select') {
      const dictionaryOptions = getDictionaryItemsForField(field, dictionaryItems)
      const options = dictionaryOptions.length ? dictionaryOptions : parseFieldOptions(field.options)
      const hasColorConfig = Array.isArray(options) && options.length > 0 && options[0]?.label
      
      return (
        <Select
          mode={field.type === 'multi_select' ? 'multiple' : undefined}
          placeholder={`${UI_TEXT.selectPrefix}${field.display_name}`}
          style={{ width: '100%' }}
        >
          {dictionaryOptions.length ? (
            dictionaryOptions.map(item => (
              <Option key={item.code} value={item.code}>{getDictionaryItemLabel(item)}</Option>
            ))
          ) : hasColorConfig ? (
            options.map((opt: any) => (
              <Option key={opt.label} value={opt.label}>{opt.label}</Option>
            ))
          ) : (
            options.map((opt: string) => (
              <Option key={opt} value={opt}>{opt}</Option>
            ))
          )}
        </Select>
      )
    }
    
    if (field.type === 'date') {
      return <DatePicker style={{ width: '100%' }} placeholder={UI_TEXT.selectDate} />
    }
    
    if (field.type === 'datetime') {
      return <DatePicker showTime style={{ width: '100%' }} placeholder={UI_TEXT.selectDatetime} />
    }
    
    if (field.type === 'boolean') {
      return (
        <Radio.Group optionType="button" buttonStyle="solid" style={{ width: '100%' }}>
          <Radio.Button value={true} style={{ width: '50%', textAlign: 'center' }}>是</Radio.Button>
          <Radio.Button value={false} style={{ width: '50%', textAlign: 'center' }}>否</Radio.Button>
        </Radio.Group>
      )
    }
    
    if (field.type === 'number') {
      return <Input type="number" placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} />
    }

    if (field.type === 'currency') {
      let code = 'CNY'
      try {
        const config = field.options ? JSON.parse(field.options) : {}
        code = config.currency || code
      } catch {
        // ignore invalid config
      }
      const currency = currencies.find(item => item.code === code)
      return <InputNumber style={{ width: '100%' }} min={0} addonBefore={currency?.symbol || code} placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} />
    }

    if (field.type === 'country') {
      return (
        <Select
          showSearch
          placeholder={UI_TEXT.selectCountry}
          style={{ width: '100%' }}
          filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        >
          {countries.map(country => (
            <Option key={country.code} value={country.code} label={`${country.name_zh || country.name} ${country.name_en || ''}`}>
              {country.icon} {country.name_zh || country.name} / {country.name_en}
            </Option>
          ))}
        </Select>
      )
    }
    
    if (field.type === 'file' || field.type === 'image') {
      return (
        <Upload
          action="/api/upload"
          headers={{ Authorization: `Bearer ${localStorage.getItem('token') || ''}` }}
          name="file"
          showUploadList={false}
          onChange={({ file }: any) => { if (file.status !== 'done') return; const response = file.response
            form.setFieldsValue({ [field.name]: response.url })
          }}
        >
          <Button icon={<PaperClipOutlined />}>{field.type === 'image' ? UI_TEXT.uploadImage : UI_TEXT.uploadFile}</Button>
        </Upload>
      )
    }
    
    if (field.type === 'user') {
      return (
        <Select
          placeholder={`${UI_TEXT.selectPrefix}${field.display_name}`}
          style={{ width: '100%' }}
          showSearch
          allowClear
          optionFilterProp="label"
          notFoundContent={users.length === 0 ? UI_TEXT.noUsers : undefined}
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
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
          placeholder={UI_TEXT.selectRecord}
          style={{ width: '100%' }}
          showSearch
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
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
    
    return <Input placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} />
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
        {/* Main content */}
        <div style={{ 
          flex: 1, 
          padding: 24, 
          overflow: 'auto',
          borderRight: '1px solid #f0f0f0'
        }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 24
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button type="text" icon={<LeftOutlined />} onClick={onClose} />
              <span style={{ fontSize: 16, fontWeight: 500 }}>
                {record ? UI_TEXT.editRecord : UI_TEXT.addRecord}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {record && (
                <>
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
                </>
              )}
              <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
            </div>
          </div>

          {/* Form fields */}
          <Form form={form} layout="vertical">
            {fields.map(field => renderFormField(field))}
          </Form>

          {/* Save action */}
          <div style={{ marginTop: 24 }}>
            <Button type="primary" onClick={handleSave} loading={saving}>
              {record ? UI_TEXT.save : UI_TEXT.add}
            </Button>
          </div>
        </div>

        {/* Comments panel */}
        <div style={{ 
          width: commentCollapsed ? 0 : 300, 
          overflow: 'hidden',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: '#fff',
        }}>
          {/* Comment toggle */}
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
              {/* Comment title */}
              <div style={{ 
                padding: '16px 24px', 
                borderBottom: '1px solid #f0f0f0',
              }}>
                <span style={{ fontWeight: 500, fontSize: 16 }}>{UI_TEXT.comments}</span>
              </div>

              {/* Comment list */}
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {comments.map(comment => {
                  const isMyComment = comment.user_id === '1'
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

              {/* Comment input */}
              <div style={{ 
                padding: 16, 
                borderTop: '1px solid #f0f0f0',
                background: '#fafafa'
              }}>
                <TextArea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={UI_TEXT.addComment}
                  autoSize={{ minRows: 2, maxRows: 4 }}
                />
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <Button type="primary" size="small" onClick={handleAddComment}>
                    {UI_TEXT.send}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* History drawer */}
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
