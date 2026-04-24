import React from 'react'
import { Drawer, Button, Checkbox } from 'antd'
import { Field } from '../../../api/model'
import { getFieldIcon, getFieldColor } from '../utils'

interface FieldConfigDrawerProps {
  visible: boolean
  onClose: () => void
  fields: Field[]
  visibleFields: string[]
  onVisibleFieldsChange: (fields: string[]) => void
  onMoveField: (index: number, direction: number) => void
}

export const FieldConfigDrawer: React.FC<FieldConfigDrawerProps> = ({
  visible,
  onClose,
  fields,
  visibleFields,
  onVisibleFieldsChange,
  onMoveField
}) => {
  return (
    <Drawer
      title="字段配置"
      placement="right"
      width={300}
      onClose={onClose}
      open={visible}
    >
      <div style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          block
          onClick={() => onVisibleFieldsChange(fields.map(f => f.id!))}
        >
          显示全部
        </Button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Button 
          block
          onClick={() => onVisibleFieldsChange([])}
        >
          隐藏全部
        </Button>
      </div>
      <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: 16 }}>
        {fields.map((field, index) => (
          <div 
            key={field.id}
            style={{
              padding: '8px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'move',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
              <Button
                type="text"
                size="small"
                disabled={index === 0}
                onClick={() => onMoveField(index, -1)}
                style={{ 
                  padding: 0, 
                  minWidth: 24, 
                  height: 20, 
                  lineHeight: '20px', 
                  fontSize: 16,
                  color: index === 0 ? '#d9d9d9' : '#666',
                }}
              >
                ↑
              </Button>
              <Button
                type="text"
                size="small"
                disabled={index === fields.length - 1}
                onClick={() => onMoveField(index, 1)}
                style={{ 
                  padding: 0, 
                  minWidth: 24, 
                  height: 20, 
                  lineHeight: '20px', 
                  fontSize: 16,
                  color: index === fields.length - 1 ? '#d9d9d9' : '#666',
                }}
              >
                ↓
              </Button>
            </div>
            <Checkbox
              checked={visibleFields.includes(field.id!)}
              onChange={(e) => {
                if (e.target.checked) {
                  onVisibleFieldsChange([...visibleFields, field.id!])
                } else {
                  onVisibleFieldsChange(visibleFields.filter(id => id !== field.id))
                }
              }}
            />
            <span style={{ 
              width: 24, 
              height: 24, 
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${getFieldColor(field.type)}20`,
              color: getFieldColor(field.type),
              borderRadius: 4,
              fontSize: 12,
            }}>
              {getFieldIcon(field.type)}
            </span>
            <span>{field.display_name}</span>
          </div>
        ))}
      </div>
    </Drawer>
  )
}
