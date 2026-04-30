import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Select, DatePicker, Button, Tag, Upload, Image } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { Field } from '../../../api/model'
import { dictionaryApi, DictionaryItem } from '../../../api/dictionary'

const { Option } = Select

// 预设颜色
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
      title="添加记录"
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
            {field.type === 'text' || field.type === 'email' || field.type === 'url' ? (
              <Input placeholder={`请输入${field.display_name}`} />
            ) : field.type === 'number' ? (
              <InputNumber style={{ width: '100%' }} placeholder={`请输入${field.display_name}`} />
            ) : field.type === 'select' ? (
              <Select placeholder={`请选择${field.display_name}`}>
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
              <Select mode="multiple" placeholder={`请选择${field.display_name}`}>
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
              })()} placeholder={`请输入${field.display_name}`} />
            ) : field.type === 'country' ? (
              <Select showSearch placeholder="请选择国家" filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}>
                {countries.map(country => (
                  <Option key={country.code} value={country.code} label={`${country.name_zh || country.name} ${country.name_en || ''}`}>
                    {country.icon} {country.name_zh || country.name} / {country.name_en}
                  </Option>
                ))}
              </Select>
            ) : field.type === 'date' ? (
              <DatePicker style={{ width: '100%' }} placeholder="请选择日期" />
            ) : field.type === 'datetime' ? (
              <DatePicker showTime style={{ width: '100%' }} placeholder="请选择日期时间" />
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
                <Button icon={<UploadOutlined />}>上传文件</Button>
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
                <Button icon={<UploadOutlined />}>上传图片</Button>
              </Upload>
            ) : field.type === 'boolean' ? (
              <Select>
                <Option value={true}>是</Option>
                <Option value={false}>否</Option>
              </Select>
            ) : field.type === 'user' ? (
              <Select placeholder={`请选择${field.display_name}`}>
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
                placeholder={`请选择${field.display_name}`}
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
              <Input placeholder={`请输入${field.display_name}`} />
            )}
          </Form.Item>
        ))}
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            添加
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}


