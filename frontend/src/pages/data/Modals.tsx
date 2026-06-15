import React from 'react'
import { Modal, Form, Input, InputNumber, Select, DatePicker, Radio } from 'antd'
import dayjs from 'dayjs'
import { Field, Model } from '../../api/model'

const { Option } = Select

interface AddRecordModalProps {
  visible: boolean
  model: Model | null
  fields: Field[]
  users: any[]
  allModels: Model[]
  relationData: Record<string, any[]>
  form: any
  onCancel: () => void
  onSubmit: (values: any) => void
}

export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  visible,
  model,
  fields,
  users,
  allModels,
  relationData,
  form,
  onCancel,
  onSubmit,
}) => {
  const renderFieldInput = (field: Field) => {
    if (field.type === 'text' || field.type === 'email' || field.type === 'url') {
      return <Input placeholder={`请输入${field.display_name}`} />
    }
    if (field.type === 'number') {
      return <InputNumber style={{ width: '100%' }} placeholder={`请输入${field.display_name}`} />
    }
    if (field.type === 'select') {
      const options = JSON.parse(field.options || '[]')
      return (
        <Select placeholder={`请选择${field.display_name}`}>
          {options.map((opt: string) => <Option key={opt} value={opt}>{opt}</Option>)}
        </Select>
      )
    }
    if (field.type === 'multi_select') {
      const options = JSON.parse(field.options || '[]')
      return (
        <Select mode="multiple" placeholder={`请选择${field.display_name}`}>
          {options.map((opt: string) => <Option key={opt} value={opt}>{opt}</Option>)}
        </Select>
      )
    }
    if (field.type === 'date') {
      return <DatePicker style={{ width: '100%' }} />
    }
    if (field.type === 'boolean') {
      return (
        <Radio.Group optionType="button" buttonStyle="solid" style={{ width: '100%' }}>
          <Radio.Button value={true} style={{ width: '50%', textAlign: 'center' }}>{'是'}</Radio.Button>
          <Radio.Button value={false} style={{ width: '50%', textAlign: 'center' }}>{'否'}</Radio.Button>
        </Radio.Group>
      )
    }
    if (field.type === 'user') {
      return (
        <Select placeholder={`请选择${field.display_name}`}>
          {users.map(user => <Option key={user.id} value={user.id}>{user.nickname || user.username}</Option>)}
        </Select>
      )
    }
    return <Input placeholder={`请输入${field.display_name}`} />
  }

  return (
    <Modal title="添加记录" open={visible} onCancel={onCancel} footer={null} width={600}>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        {fields.filter(f => !f.deleted).map(field => (
          <Form.Item key={field.id} label={field.display_name} name={field.name}>
            {renderFieldInput(field)}
          </Form.Item>
        ))}
        <Form.Item>
          <button type="submit" style={{ display: 'none' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

interface FilterModalProps {
  visible: boolean
  fields: Field[]
  filters: any
  currentField: Field | null
  currentFilterValue: string
  currentFilterCondition: string
  onFieldChange: (field: Field | null) => void
  onValueChange: (value: string) => void
  onConditionChange: (condition: string) => void
  onAddFilter: () => void
  onRemoveFilter: (fieldName: string) => void
  onCancel: () => void
  onOk: () => void
}

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  fields,
  filters,
  currentField,
  currentFilterValue,
  currentFilterCondition,
  onFieldChange,
  onValueChange,
  onConditionChange,
  onAddFilter,
  onRemoveFilter,
  onCancel,
  onOk,
}) => {
  return (
    <Modal title="筛选" open={visible} onCancel={onCancel} onOk={onOk} width={600}>
      <div style={{ marginBottom: 16 }}>
        {Object.entries(filters).map(([fieldName, filter]: [string, any]) => {
          const field = fields.find(f => f.name === fieldName)
          return (
            <div key={fieldName} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
              <span style={{ fontWeight: 500, minWidth: 80 }}>{field?.display_name || fieldName}</span>
              <span style={{ color: '#666' }}>{filter.condition === 'equals' ? '等于' : filter.condition === 'contains' ? '包含' : '不等于'}</span>
              <span style={{ color: '#1890ff' }}>{filter.value}</span>
              <button onClick={() => onRemoveFilter(fieldName)} style={{ marginLeft: 'auto', color: '#ff4d4f', border: 'none', background: 'transparent', cursor: 'pointer' }}>删除</button>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Select style={{ flex: 1 }} placeholder="选择字段" value={currentField?.name} onChange={(value) => onFieldChange(fields.find(f => f.name === value) || null)}>
          {fields.filter(f => f.type !== 'relation').map(field => <Option key={field.id} value={field.name}>{field.display_name}</Option>)}
        </Select>
        <Select style={{ width: 100 }} value={currentFilterCondition} onChange={onConditionChange}>
          <Option value="equals">等于</Option>
          <Option value="not_equals">不等于</Option>
          <Option value="contains">包含</Option>
        </Select>
        <Input style={{ flex: 1 }} placeholder="值" value={currentFilterValue} onChange={(e) => onValueChange(e.target.value)} />
        <button onClick={onAddFilter}>添加</button>
      </div>
    </Modal>
  )
}
