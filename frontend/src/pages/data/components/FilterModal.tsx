import React from 'react'
import { Modal, Form, Select, Input, Button, Tag, message } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { Field } from '../../../api/model'

const { Option } = Select

interface FilterModalProps {
  visible: boolean
  fields: Field[]
  filters: Record<string, any>
  currentField: Field | null
  currentCondition: string
  currentValue: string
  onFiltersChange: (filters: Record<string, any>) => void
  onCurrentFieldChange: (field: Field | null) => void
  onCurrentConditionChange: (condition: string) => void
  onCurrentValueChange: (value: string) => void
  onClose: () => void
}

export const FilterModalComponent: React.FC<FilterModalProps> = ({
  visible,
  fields,
  filters,
  currentField,
  currentCondition,
  currentValue,
  onFiltersChange,
  onCurrentFieldChange,
  onCurrentConditionChange,
  onCurrentValueChange,
  onClose
}) => {
  const handleAddFilter = () => {
    if (currentField && currentValue) {
      onFiltersChange({
        ...filters,
        [currentField.name]: {
          condition: currentCondition,
          value: currentValue
        }
      })
      onCurrentValueChange('')
      onCurrentFieldChange(null)
    }
  }

  return (
    <Modal
      title="筛选"
      open={visible}
      onCancel={onClose}
      onOk={() => {
        onClose()
        message.success('筛选已应用')
      }}
      width={600}
    >
      <div style={{ marginBottom: 16 }}>
        {Object.entries(filters).map(([fieldName, filter]: [string, any]) => {
          const field = fields.find(f => f.name === fieldName)
          return (
            <div key={fieldName} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
              <span style={{ fontWeight: 500, minWidth: 80 }}>{field?.display_name || fieldName}</span>
              <span style={{ color: '#666' }}>
                {filter.condition === 'equals' ? '等于' :
                 filter.condition === 'not_equals' ? '不等于' :
                 filter.condition === 'contains' ? '包含' : '不包含'}
              </span>
              <Tag color="blue">{filter.value}</Tag>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => {
                const newFilters = { ...filters }
                delete newFilters[fieldName]
                onFiltersChange(newFilters)
              }} />
            </div>
          )
        })}
      </div>
      <Form layout="vertical">
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item style={{ flex: 1 }}>
            <Select 
              placeholder="选择字段"
              value={currentField?.name}
              onChange={(value) => onCurrentFieldChange(fields.find(f => f.name === value) || null)}
            >
              {fields.filter(f => f.type !== 'relation').map(field => (
                <Option key={field.id} value={field.name}>{field.display_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item style={{ width: 100 }}>
            <Select 
              placeholder="条件"
              value={currentCondition}
              onChange={(value) => onCurrentConditionChange(value)}
            >
              <Option value="equals">等于</Option>
              <Option value="not_equals">不等于</Option>
              <Option value="contains">包含</Option>
              <Option value="not_contains">不包含</Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ flex: 1 }}>
            <Input 
              placeholder="值" 
              value={currentValue}
              onChange={(e) => onCurrentValueChange(e.target.value)}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleAddFilter}>
              添加
            </Button>
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}
