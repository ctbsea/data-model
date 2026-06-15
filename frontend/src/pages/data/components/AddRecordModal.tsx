import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, DatePicker, Button, Tag, Upload, Image, Radio } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { Field } from '../../../api/model'
import { dictionaryApi, DictionaryItem } from '../../../api/dictionary'

const { Option } = Select
const REQUIRED_TEXT = '\u5fc5\u586b'
const UI_TEXT = {
  addRecord: '\u6dfb\u52a0\u8bb0\u5f55',
  add: '\u6dfb\u52a0',
  inputPrefix: '\u8bf7\u8f93\u5165',
  selectPrefix: '\u8bf7\u9009\u62e9',
  selectCountry: '\u8bf7\u9009\u62e9\u56fd\u5bb6',
  selectDate: '\u8bf7\u9009\u62e9\u65e5\u671f',
  selectDatetime: '\u8bf7\u9009\u62e9\u65e5\u671f\u65f6\u95f4',
  uploadFile: '\u4e0a\u4f20\u6587\u4ef6',
  uploadImage: '\u4e0a\u4f20\u56fe\u7247',
}
const requiredLabel = (label: string, required?: boolean) => required ? <span>{label}<span style={{ marginLeft: 8, padding: '1px 6px', color: '#ff4d4f', background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 4, fontSize: 12 }}>{REQUIRED_TEXT}</span></span> : label

// Preset tag colors
const TAG_COLORS = [
  'magenta', 'red', 'volcano', 'orange', 'gold',
  'lime', 'green', 'cyan', 'blue', 'geekblue',
  'purple'
]

interface AddRecordModalProps {
  visible: boolean
  fields: Field[]
  users: any[]
  relationData: Record<string, any[]>
  form: any
  onSubmit: (values: any) => void
  onCancel: () => void
}

export const AddRecordModalComponent: React.FC<AddRecordModalProps> = ({
  visible,
  fields,
  users,
  relationData,
  form,
  onSubmit,
  onCancel
}) => {
  const [currencies, setCurrencies] = useState<DictionaryItem[]>([])
  const [countries, setCountries] = useState<DictionaryItem[]>([])

  useEffect(() => {
    if (!visible) return
    dictionaryApi.list('currency').then(res => setCurrencies(res.items || [])).catch(console.error)
    dictionaryApi.list('country').then(res => setCountries(res.items || [])).catch(console.error)
  }, [visible])

  return (
    <Modal
      title={UI_TEXT.addRecord}
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
            {field.type === 'text' || field.type === 'email' || field.type === 'url' ? (
              <Input placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} />
            ) : field.type === 'number' ? (
              <InputNumber style={{ width: '100%' }} placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} />
            ) : field.type === 'select' ? (
              <Select placeholder={`${UI_TEXT.selectPrefix}${field.display_name}`}>
                {(() => {
                  const options = JSON.parse(field.options || '[]')
                  const hasColorConfig = Array.isArray(options) && options[0]?.label
                  if (hasColorConfig) {
                    return options.map((opt: any) => (
                      <Option key={opt.label} value={opt.label}>
                        <Tag color={opt.color} style={{ margin: 0 }}>{opt.label}</Tag>
                      </Option>
                    ))
                  }
                  return options.map((opt: string, index: number) => (
                    <Option key={opt} value={opt}>
                      <Tag color={TAG_COLORS[index % TAG_COLORS.length]} style={{ margin: 0 }}>{opt}</Tag>
                    </Option>
                  ))
                })()}
              </Select>
            ) : field.type === 'multi_select' ? (
              <Select mode="multiple" placeholder={`${UI_TEXT.selectPrefix}${field.display_name}`}>
                {(() => {
                  const options = JSON.parse(field.options || '[]')
                  const hasColorConfig = Array.isArray(options) && options[0]?.label
                  if (hasColorConfig) {
                    return options.map((opt: any) => (
                      <Option key={opt.label} value={opt.label}>
                        <Tag color={opt.color} style={{ margin: 0 }}>{opt.label}</Tag>
                      </Option>
                    ))
                  }
                  return options.map((opt: string, index: number) => (
                    <Option key={opt} value={opt}>
                      <Tag color={TAG_COLORS[index % TAG_COLORS.length]} style={{ margin: 0 }}>{opt}</Tag>
                    </Option>
                  ))
                })()}
              </Select>
            ) : field.type === 'currency' ? (
              <InputNumber style={{ width: '100%' }} min={0} addonBefore={(() => {
                const config = field.options ? JSON.parse(field.options) : {}
                const code = config.currency || 'CNY'
                const currency = currencies.find(item => item.code === code)
                return currency?.symbol || code
              })()} placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} />
            ) : field.type === 'country' ? (
              <Select showSearch placeholder={UI_TEXT.selectCountry} filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}>
                {countries.map(country => (
                  <Option key={country.code} value={country.code} label={`${country.name_zh || country.name} ${country.name_en || ''}`}>
                    {country.icon} {country.name_zh || country.name} / {country.name_en}
                  </Option>
                ))}
              </Select>
            ) : field.type === 'date' ? (
              <DatePicker style={{ width: '100%' }} placeholder={UI_TEXT.selectDate} />
            ) : field.type === 'datetime' ? (
              <DatePicker showTime style={{ width: '100%' }} placeholder={UI_TEXT.selectDatetime} />
            ) : field.type === 'file' ? (
              <Upload
                action="/api/upload"
                headers={{ Authorization: `Bearer ${localStorage.getItem('token') || ''}` }}
                name="file"
                showUploadList={false}
                onChange={({ file }: any) => { if (file.status !== 'done') return; const response = file.response
                  form.setFieldsValue({ [field.name]: response.url })
                }}
              >
                <Button icon={<UploadOutlined />}>{UI_TEXT.uploadFile}</Button>
              </Upload>
            ) : field.type === 'image' ? (
              <Upload
                action="/api/upload"
                headers={{ Authorization: `Bearer ${localStorage.getItem('token') || ''}` }}
                name="file"
                showUploadList={false}
                onChange={({ file }: any) => { if (file.status !== 'done') return; const response = file.response
                  form.setFieldsValue({ [field.name]: response.url })
                }}
              >
                <Button icon={<UploadOutlined />}>{UI_TEXT.uploadImage}</Button>
              </Upload>
            ) : field.type === 'boolean' ? (
              <Radio.Group optionType="button" buttonStyle="solid" style={{ width: '100%' }}>
          <Radio.Button value={true} style={{ width: '50%', textAlign: 'center' }}>是</Radio.Button>
          <Radio.Button value={false} style={{ width: '50%', textAlign: 'center' }}>否</Radio.Button>
        </Radio.Group>
            ) : field.type === 'user' ? (
              <Select placeholder={`${UI_TEXT.selectPrefix}${field.display_name}`}>
                {users.map(user => (
                  <Option key={user.id} value={user.id}>{user.nickname || user.username}</Option>
                ))}
              </Select>
            ) : field.type === 'relation' ? (
              <Select
                mode={(() => {
                  try {
                    const config = JSON.parse(field.relation_config || '{}')
                    return config.allow_multiple ? 'multiple' as const : undefined
                  } catch {
                    return undefined
                  }
                })()}
                placeholder={`${UI_TEXT.selectPrefix}${field.display_name}`}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              >
                {(() => {
                  const records = relationData[field.name] || []
                  const config = JSON.parse(field.relation_config || '{}')
                  const displayFields = config.display_fields || []
                  
                  return records.map((rec: any) => {
                    const label = displayFields.length > 0
                      ? displayFields.map((f: string) => rec[f]).filter(Boolean).join(' - ')
                      : rec.name || rec.id
                    
                    return (
                      <Option key={rec.id} value={rec.id} label={label}>
                        {label}
                      </Option>
                    )
                  })
                })()}
              </Select>
            ) : (
              <Input placeholder={`${UI_TEXT.inputPrefix}${field.display_name}`} />
            )}
          </Form.Item>
        ))}
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            {UI_TEXT.add}
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}


