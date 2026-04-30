import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, DatePicker, Button, Tag, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { Field, Model, modelApi } from '../../../api/model'
import { userApi } from '../../../api/user'
import { dataApi } from '../../../api/data'
import { dictionaryApi, DictionaryItem } from '../../../api/dictionary'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

const TAG_COLORS = [
  'magenta', 'red', 'volcano', 'orange', 'gold',
  'lime', 'green', 'cyan', 'blue', 'geekblue',
  'purple'
]

interface RecordFormModalProps {
  visible: boolean
  record?: any // 编辑时有值，添加时为 undefined
  model: Model | null
  fields: Field[]
  form: any
  onSubmit: (values: any) => void
  onCancel: () => void
}

export const RecordFormModal: React.FC<RecordFormModalProps> = ({
  visible,
  record,
  model,
  fields,
  form,
  onSubmit,
  onCancel
}) => {
  const [relationData, setRelationData] = useState<Record<string, any[]>>({})
  const [allModels, setAllModels] = useState<Model[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [currencies, setCurrencies] = useState<DictionaryItem[]>([])
  const [countries, setCountries] = useState<DictionaryItem[]>([])

  useEffect(() => {
    if (visible && model) {
      // 加载用户列表
      userApi.list(1, 1000).then(res => setUsers(res.users || [])).catch(console.error)
      dictionaryApi.list('currency').then(res => setCurrencies(res.items || [])).catch(console.error)
      dictionaryApi.list('country').then(res => setCountries(res.items || [])).catch(console.error)
      // 加载所有模型
      modelApi.list(1, 1000).then(res => setAllModels(res.models || [])).catch(console.error)
    }
  }, [visible, model])

  useEffect(() => {
    if (visible && model) {
      // 加载关联数据
      const loadRelationData = async () => {
        const data: Record<string, any[]> = {}
        for (const field of fields) {
          if (field.type === 'relation' && field.relation_config) {
            try {
              const config = JSON.parse(field.relation_config)
              const targetModel = allModels.find(m => m.id === config.target_model_id)
              if (targetModel) {
                const res = await dataApi.list(targetModel.name, 1, 100)
                data[field.name] = res.data || []
              }
            } catch (e) {
              console.error('Failed to load relation data:', e)
            }
          }
        }
        setRelationData(data)
      }
      loadRelationData()
    }
  }, [visible, model, fields, allModels])

  useEffect(() => {
    if (visible && record && model) {
      // 编辑模式：填充表单数据
      const formValues: any = {}
      fields.forEach(field => {
        if (field.type === 'date' && record[field.name]) {
          formValues[field.name] = dayjs(record[field.name])
        } else if (field.type === 'datetime' && record[field.name]) {
          formValues[field.name] = dayjs(record[field.name])
        } else if (field.type === 'multi_select' && record[field.name]) {
          const val = record[field.name]
          formValues[field.name] = typeof val === 'string' ? val.split(',').filter(Boolean) : val
        } else {
          formValues[field.name] = record[field.name]
        }
      })
      form.setFieldsValue(formValues)
    } else if (visible && !record) {
      // 添加模式：重置表单
      form.resetFields()
    }
  }, [visible, record, model, fields, form])

  const renderField = (field: Field) => {
    if (field.type === 'text' || field.type === 'email' || field.type === 'url' || field.type === 'textarea') {
      return field.type === 'textarea' ? 
        <TextArea rows={3} placeholder={`请输入${field.display_name}`} /> :
        <Input placeholder={`请输入${field.display_name}`} />
    }
    
    if (field.type === 'number') {
      return <InputNumber style={{ width: '100%' }} placeholder={`请输入${field.display_name}`} />
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
      return <InputNumber style={{ width: '100%' }} min={0} addonBefore={currency?.symbol || code} placeholder={`请输入${field.display_name}`} />
    }

    if (field.type === 'country') {
      return (
        <Select
          showSearch
          placeholder="请选择国家"
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
    
    if (field.type === 'select' || field.type === 'multi_select') {
      let options: any[] = []
      try {
        let parsed = JSON.parse(field.options || '[]')
        if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === 'string') {
          parsed = JSON.parse(parsed[0])
        }
        options = parsed
      } catch (e) {
        console.error('Failed to parse options:', field.options)
      }
      const hasColorConfig = Array.isArray(options) && options.length > 0 && options[0]?.label
      
      return (
        <Select 
          mode={field.type === 'multi_select' ? 'multiple' : undefined}
          placeholder={`请选择${field.display_name}`}
        >
          {hasColorConfig ? (
            options.map((opt: any) => (
              <Option key={opt.label} value={opt.label}>
                <Tag color={opt.color} style={{ margin: 0 }}>{opt.label}</Tag>
              </Option>
            ))
          ) : (
            options.map((opt: string, index: number) => (
              <Option key={opt} value={opt}>
                <Tag color={TAG_COLORS[index % TAG_COLORS.length]} style={{ margin: 0 }}>{opt}</Tag>
              </Option>
            ))
          )}
        </Select>
      )
    }
    
    if (field.type === 'date') {
      return <DatePicker style={{ width: '100%' }} />
    }
    
    if (field.type === 'datetime') {
      return <DatePicker showTime style={{ width: '100%' }} />
    }
    
    if (field.type === 'boolean') {
      return (
        <Select>
          <Option value={true}>是</Option>
          <Option value={false}>否</Option>
        </Select>
      )
    }
    
    if (field.type === 'user') {
      return (
        <Select placeholder={`请选择${field.display_name}`}>
          {users.map(user => (
            <Option key={user.id} value={user.id}>{user.nickname || user.username}</Option>
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
          <Button icon={<UploadOutlined />}>上传{field.type === 'image' ? '图片' : '文件'}</Button>
        </Upload>
      )
    }
    
    if (field.type === 'relation') {
      try {
        const config = JSON.parse(field.relation_config || '{}')
        const records = relationData[field.name] || []
        const displayFields = config.display_fields || []
        
        return (
          <Select
            mode={config.allow_multiple ? 'multiple' as const : undefined}
            placeholder={`请选择${field.display_name}`}
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
      } catch {
        return <Input placeholder={`请输入${field.display_name}`} />
      }
    }
    
    return <Input placeholder={`请输入${field.display_name}`} />
  }

  return (
    <Modal
      title={record ? '编辑记录' : '添加记录'}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
      >
        {fields.filter(f => !f.deleted).map(field => (
          <Form.Item
            key={field.id}
            label={field.display_name}
            name={field.name}
          >
            {renderField(field)}
          </Form.Item>
        ))}
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            {record ? '保存' : '添加'}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}


