import React from 'react'
import { Tag, Button, Dropdown } from 'antd'
import { MoreOutlined, LockOutlined, EyeInvisibleOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { Field, Model } from '../../api/model'
import { getFieldIcon, getFieldColor, TAG_COLORS } from './utils'
import type { MenuProps } from 'antd'

const { Option } = Dropdown

// 字段表头组件
interface FieldHeaderProps {
  field: Field
  index: number
  frozenColumns: number
  columnWidth: number
  resizing: string | null
  onMenuClick: (field: Field, action: string) => void
  onResizeStart: (e: React.MouseEvent, fieldId: string) => void
}

export const FieldHeader: React.FC<FieldHeaderProps> = ({
  field,
  index,
  frozenColumns,
  columnWidth,
  resizing,
  onMenuClick,
  onResizeStart,
}) => {
  const menu: MenuProps = {
    items: [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: '编辑字段',
        disabled: field.is_lock,
        onClick: () => onMenuClick(field, 'edit'),
      },
      { type: 'divider' },
      {
        key: 'freeze',
        icon: <LockOutlined />,
        label: frozenColumns > index ? '取消冻结' : `冻结到此列`,
        onClick: () => onMenuClick(field, 'freeze'),
      },
      {
        key: 'hide',
        icon: <EyeInvisibleOutlined />,
        label: '隐藏字段',
        onClick: () => onMenuClick(field, 'hide'),
      },
      { type: 'divider' },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除字段',
        danger: true,
        disabled: field.is_lock,
        onClick: () => onMenuClick(field, 'delete'),
      },
    ],
  }

  return (
    <div
      style={{
        width: columnWidth || 200,
        padding: '12px',
        borderRight: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#fafafa',
        position: 'relative',
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${getFieldColor(field.type)}20`,
          color: getFieldColor(field.type),
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        {getFieldIcon(field.type)}
      </span>
      <span style={{ flex: 1 }}>{field.display_name}</span>
      <Dropdown menu={menu} trigger={['click']}>
        <Button type="text" size="small" icon={<MoreOutlined />} />
      </Dropdown>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 5,
          cursor: 'col-resize',
          zIndex: 1,
          background: resizing === field.id ? '#1890ff' : 'transparent',
        }}
        onMouseDown={(e) => onResizeStart(e, field.id!)}
      />
    </div>
  )
}

// 单元格显示组件
interface CellDisplayProps {
  field: Field
  value: any
  users: any[]
  isEditing: boolean
}

export const CellDisplay: React.FC<CellDisplayProps> = ({ field, value, users, isEditing }) => {
  if (isEditing) return null

  const displayValue = value || '点击编辑'
  const isEmpty = !value

  // 选择类型字段
  if (field.type === 'select' || field.type === 'multi_select') {
    try {
      const options = JSON.parse(field.options || '[]')
      if (field.type === 'multi_select' && value) {
        const values = Array.isArray(value) ? value : String(value).split(',')
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {values.map((v: string, i: number) => {
              const colorIndex = options.indexOf(v.trim())
              return (
                <Tag key={i} color={TAG_COLORS[colorIndex !== -1 ? colorIndex : i % TAG_COLORS.length]} style={{ margin: 0 }}>
                  {v.trim()}
                </Tag>
              )
            })}
          </div>
        )
      }
      if (value) {
        const colorIndex = options.indexOf(value)
        return <Tag color={TAG_COLORS[colorIndex !== -1 ? colorIndex : 0]}>{value}</Tag>
      }
    } catch {}
  }

  // 用户类型字段
  if (field.type === 'user' && value) {
    const user = users.find((u: any) => u.id === value)
    if (user) {
      return <Tag color="blue">{user.nickname || user.username}</Tag>
    }
  }

  return (
    <span style={{ color: isEmpty ? '#bfbfbf' : 'inherit', fontStyle: isEmpty ? 'italic' : 'normal' }}>
      {displayValue}
    </span>
  )
}
