import React from 'react'
import { Form, Input, InputNumber, Select, DatePicker, Checkbox, Upload, Button, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { Field } from '../../../api/model'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

interface FieldEditorProps {
  field: Field
  value: any
  onChange: (value: any) => void
  relationData?: any[]
  users?: any[]
  allModels?: any[]
  style?: React.CSSProperties
}

// 字段编辑器组件
const FieldEditor: React.FC<FieldEditorProps> = ({
  field,
  value,
  onChange,
  relationData,
  users,
  allModels,
  style
}) => {
  // 根据字段类型渲染不同的编辑器
  switch (field.type) {
    case 'text':
      return (
        <Input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={style}
          placeholder={`输入${field.display_name}`}
        />
      )

    case 'textarea':
      return (
        <TextArea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          rows={3}
          style={style}
          placeholder={`输入${field.display_name}`}
        />
      )

    case 'number':
      return (
        <InputNumber
          value={value}
          onChange={onChange}
          style={{ width: '100%', ...style }}
          placeholder={`输入${field.display_name}`}
        />
      )

    case 'currency':
      let currencyCode = 'CNY'
      try {
        const config = field.options ? JSON.parse(field.options) : {}
        currencyCode = config.currency || currencyCode
      } catch {
        // ignore invalid config
      }
      return (
        <InputNumber
          min={0}
          value={value}
          onChange={onChange}
          addonBefore={currencyCode}
          style={{ width: '100%', ...style }}
          placeholder={`杈撳叆${field.display_name}`}
        />
      )

    case 'country':
      return (
        <Input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={style}
          placeholder={`杈撳叆${field.display_name}`}
        />
      )

    case 'select':
      const options = field.options ? JSON.parse(field.options) : []
      return (
        <Select
          value={value}
          onChange={onChange}
          style={{ width: '100%', ...style }}
          placeholder={`选择${field.display_name}`}
          allowClear
        >
          {options.map((opt: string) => (
            <Option key={opt} value={opt}>{opt}</Option>
          ))}
        </Select>
      )

    case 'multi_select':
      const multiOptions = field.options ? JSON.parse(field.options) : []
      return (
        <Select
          mode="multiple"
          value={value || []}
          onChange={onChange}
          style={{ width: '100%', ...style }}
          placeholder={`选择${field.display_name}`}
        >
          {multiOptions.map((opt: string) => (
            <Option key={opt} value={opt}>{opt}</Option>
          ))}
        </Select>
      )

    case 'boolean':
      return (
        <Checkbox
          checked={value === true || value === 'true'}
          onChange={e => onChange(e.target.checked)}
          style={style}
        >
          {field.display_name}
        </Checkbox>
      )

    case 'date':
      return (
        <DatePicker
          value={value ? dayjs(value) : null}
          onChange={(date) => onChange(date ? date.format('YYYY-MM-DD') : null)}
          style={{ width: '100%', ...style }}
          placeholder={`选择${field.display_name}`}
        />
      )

    case 'datetime':
      return (
        <DatePicker
          showTime
          value={value ? dayjs(value) : null}
          onChange={(date) => onChange(date ? date.format('YYYY-MM-DD HH:mm:ss') : null)}
          style={{ width: '100%', ...style }}
          placeholder={`选择${field.display_name}`}
        />
      )

    case 'email':
      return (
        <Input
          type="email"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={style}
          placeholder={`输入${field.display_name}`}
        />
      )

    case 'phone':
      return (
        <Input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={style}
          placeholder={`输入${field.display_name}`}
        />
      )

    case 'url':
      return (
        <Input
          type="url"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={style}
          placeholder={`输入${field.display_name}`}
        />
      )

    case 'file':
      return (
        <Upload
          beforeUpload={(file) => {
            // 这里应该上传文件到服务器
            message.info('文件上传功能待实现')
            return false
          }}
        >
          <Button icon={<PlusOutlined />}>上传文件</Button>
        </Upload>
      )

    case 'image':
      return (
        <Upload
          listType="picture-card"
          beforeUpload={(file) => {
            message.info('图片上传功能待实现')
            return false
          }}
        >
          <PlusOutlined />
        </Upload>
      )

    case 'json':
      return (
        <TextArea
          value={value ? JSON.stringify(value, null, 2) : ''}
          onChange={e => {
            try {
              const json = JSON.parse(e.target.value)
              onChange(json)
            } catch {
              // 无效 JSON,不更新
            }
          }}
          rows={4}
          style={style}
          placeholder={`输入 JSON 格式的${field.display_name}`}
        />
      )

    case 'password':
      return (
        <Input.Password
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={style}
          placeholder={`输入${field.display_name}`}
        />
      )

    case 'color':
      return (
        <Input
          type="color"
          value={value || '#000000'}
          onChange={e => onChange(e.target.value)}
          style={{ width: 60, ...style }}
        />
      )

    case 'rating':
      return (
        <InputNumber
          min={1}
          max={5}
          value={value}
          onChange={onChange}
          style={{ width: 100, ...style }}
        />
      )

    case 'relation':
      // 关联字段
      if (!relationData || relationData.length === 0) {
        return <div style={style}>加载中...</div>
      }
      
      const config = field.relation_config ? JSON.parse(field.relation_config) : {}
      const displayField = config.display_fields?.[0] || 'name'
      
      return (
        <Select
          mode={config.allow_multiple ? 'multiple' as const : undefined}
          value={value}
          onChange={onChange}
          style={{ width: '100%', ...style }}
          placeholder={`选择${field.display_name}`}
          allowClear
          showSearch
          filterOption={(input, option) => 
            String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
          }
        >
          {relationData.map((item: any) => (
            <Option key={item.id} value={item.id}>
              {item[displayField] || item.id}
            </Option>
          ))}
        </Select>
      )

    default:
      return (
        <Input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={style}
          placeholder={`输入${field.display_name}`}
        />
      )
  }
}

export default FieldEditor
