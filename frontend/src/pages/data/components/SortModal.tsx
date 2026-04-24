import React from 'react'
import { Modal, Form, Select, Button, Tag, message } from 'antd'
import { DeleteOutlined, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons'
import { Field } from '../../../api/model'

const { Option } = Select

interface SortModalProps {
  visible: boolean
  fields: Field[]
  sorts: Array<{ field: string; order: string }>
  currentField: Field | null
  currentOrder: string
  onSortsChange: (sorts: Array<{ field: string; order: string }>) => void
  onCurrentFieldChange: (field: Field | null) => void
  onCurrentOrderChange: (order: string) => void
  onClose: () => void
}

export const SortModalComponent: React.FC<SortModalProps> = ({
  visible,
  fields,
  sorts,
  currentField,
  currentOrder,
  onSortsChange,
  onCurrentFieldChange,
  onCurrentOrderChange,
  onClose
}) => {
  const handleAddSort = () => {
    if (currentField) {
      const existingSortIndex = sorts.findIndex(s => s.field === currentField.name)
      const newSorts = [...sorts]
      if (existingSortIndex >= 0) {
        newSorts[existingSortIndex] = { field: currentField.name, order: currentOrder }
      } else {
        newSorts.push({ field: currentField.name, order: currentOrder })
      }
      onSortsChange(newSorts)
      onCurrentFieldChange(null)
    }
  }

  return (
    <Modal
      title="排序"
      open={visible}
      onCancel={onClose}
      onOk={() => {
        onClose()
        message.success('排序已应用')
      }}
      width={500}
    >
      <div style={{ marginBottom: 16 }}>
        {sorts.map((sort, index) => {
          const field = fields.find(f => f.name === sort.field)
          return (
            <div key={sort.field} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
              <span style={{ color: '#999' }}>{index + 1}.</span>
              <span style={{ fontWeight: 500, flex: 1 }}>{field?.display_name || sort.field}</span>
              <Tag color={sort.order === 'asc' ? 'green' : 'orange'}>
                {sort.order === 'asc' ? '升序' : '降序'}
              </Tag>
              <Button type="text" size="small" onClick={() => {
                const newSorts = [...sorts]
                newSorts[index] = { ...newSorts[index], order: newSorts[index].order === 'asc' ? 'desc' : 'asc' }
                onSortsChange(newSorts)
              }}>
                {sort.order === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
              </Button>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => {
                onSortsChange(sorts.filter((_, i) => i !== index))
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
              {fields.map(field => (
                <Option key={field.id} value={field.name}>{field.display_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item style={{ width: 100 }}>
            <Select 
              placeholder="排序"
              value={currentOrder}
              onChange={(value) => onCurrentOrderChange(value)}
            >
              <Option value="asc">升序</Option>
              <Option value="desc">降序</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleAddSort}>
              添加
            </Button>
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}
