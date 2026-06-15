import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, DatePicker, Button, Tag, Upload, Radio } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { Field, Model, modelApi } from '../../../api/model'
import { userApi } from '../../../api/user'
import { dataApi } from '../../../api/data'
import { dictionaryApi, DictionaryItem } from '../../../api/dictionary'
import { getDictionaryItemsForField, getDictionaryItemLabel, parseFieldOptions } from '../../../utils/dictionaryField'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input
const REQUIRED_TEXT = '\u5fc5\u586b'
const UI_TEXT = {
  editRecord: '\u7f16\u8f91\u8bb0\u5f55',
  addRecord: '\u6dfb\u52a0\u8bb0\u5f55',
  save: '\u4fdd\u5b58',
  add: '\u6dfb\u52a0',
  inputPrefix: '\u8bf7\u8f93\u5165',
  selectPrefix: '\u8bf7\u9009\u62e9',
  selectCountry: '\u8bf7\u9009\u62e9\u56fd\u5bb6',
  uploadFile: '\u4e0a\u4f20\u6587\u4ef6',
  uploadImage: '\u4e0a\u4f20\u56fe\u7247',
}
const requiredLabel = (label: string, required?: boolean) => required ? <span>{label}<span style={{ marginLeft: 8, padding: '1px 6px', color: '#ff4d4f', background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 4, fontSize: 12 }}>{REQUIRED_TEXT}</span></span> : label

const TAG_COLORS = [
  'magenta', 'red', 'volcano', 'orange', 'gold',
  'lime', 'green', 'cyan', 'blue', 'geekblue',
  'purple'
]

interface RecordFormModalProps {
  visible: boolean
  record?: any
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
  const [dictionaryItems, setDictionaryItems] = useState<DictionaryItem[]>([])

  useEffect(() => {
    if (visible && model) {
      // Load users
      userApi.list(1, 1000).then(res => setUsers(res.users || [])).catch(console.error)
      dictionaryApi.list(undefined, true).then(res => {
        const items = res.items || []
        setDictionaryItems(items)
        setCurrencies(items.filter(item => item.type === 'currency' && item.enabled !== false))
        setCountries(items.filter(item => item.type === 'country' && item.enabled !== false))
      }).catch(console.error)
      // Load models
      modelApi.list(1, 1000).then(res => setAllModels(res.models || [])).catch(console.error)
    }
  }, [visible, model])

  useEffect(() => {
    if (visible && model) {
      // Load relation data
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
      // Fill form values for edit mode
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
      // Reset form for add mode
      form.resetFields()
    }
  }, [visible, record, model, fields, form])

  const renderField = (field: Field) => {
    if (field.type === 'text' || field.type === 'email' || field.type === 'url' || field.type === 'textarea') {
      return field.type === 'textarea' ? 
        <TextArea rows={3} placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} /> :
        <Input placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} />
    }
    
    if (field.type === 'number') {
      return <InputNumber style={{ width: '100%' }} placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} />
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
      const dictionaryOptions = getDictionaryItemsForField(field, dictionaryItems)
      const options = dictionaryOptions.length ? dictionaryOptions : parseFieldOptions(field.options)
      const hasColorConfig = Array.isArray(options) && options.length > 0 && options[0]?.label
      
      return (
        <Select 
          mode={field.type === 'multi_select' ? 'multiple' : undefined}
          placeholder={`${UI_TEXT.selectPrefix}${field.display_name}`}
        >
          {dictionaryOptions.length ? (
            dictionaryOptions.map(item => (
              <Option key={item.code} value={item.code}>
                <Tag color="blue" style={{ margin: 0 }}>{getDictionaryItemLabel(item)}</Tag>
              </Option>
            ))
          ) : hasColorConfig ? (
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
        <Radio.Group optionType="button" buttonStyle="solid" style={{ width: '100%' }}>
          <Radio.Button value={true} style={{ width: '50%', textAlign: 'center' }}>是</Radio.Button>
          <Radio.Button value={false} style={{ width: '50%', textAlign: 'center' }}>否</Radio.Button>
        </Radio.Group>
      )
    }
    
    if (field.type === 'user') {
      return (
        <Select placeholder={`${UI_TEXT.selectPrefix}${field.display_name}`}>
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
          <Button icon={<UploadOutlined />}>{field.type === 'image' ? UI_TEXT.uploadImage : UI_TEXT.uploadFile}</Button>
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
            placeholder={`${UI_TEXT.selectPrefix}${field.display_name}`}
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
        return <Input placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} />
      }
    }
    
    return <Input placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} />
  }

  return (
    <Modal
      title={record ? UI_TEXT.editRecord : UI_TEXT.addRecord}
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
            label={requiredLabel(field.display_name, field.required)}
            name={field.name}
            rules={field.required ? [{ required: true, message: `${field.display_name}${REQUIRED_TEXT}` }] : undefined}
          >
            {renderField(field)}
          </Form.Item>
        ))}
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            {record ? UI_TEXT.save : UI_TEXT.add}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
