import React from 'react'
import { Tag, Popover } from 'antd'
import { Field } from '../../../api/model'
import dayjs from 'dayjs'

interface FieldDisplayProps {
  field: Field
  value: any
  relationData?: any[]
  style?: React.CSSProperties
}

// 字段显示组件
const FieldDisplay: React.FC<FieldDisplayProps> = ({
  field,
  value,
  relationData,
  style
}) => {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: '#999', ...style }}>-</span>
  }

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone':
    case 'url':
      const text = String(value)
      if (text.length > 50) {
        return (
          <Popover content={text} title={field.display_name}>
            <span style={style}>{text.substring(0, 50)}...</span>
          </Popover>
        )
      }
      return <span style={style}>{text}</span>

    case 'number':
      return <span style={style}>{Number(value).toLocaleString()}</span>

    case 'select':
      return <Tag color="blue" style={style}>{value}</Tag>

    case 'multi_select':
      const values = Array.isArray(value) ? value : []
      return (
        <span style={style}>
          {values.map((v: string) => (
            <Tag key={v} color="blue" style={{ margin: '2px' }}>{v}</Tag>
          ))}
        </span>
      )

    case 'boolean':
      return (
        <Tag color={value ? 'green' : 'default'} style={style}>
          {value ? '是' : '否'}
        </Tag>
      )

    case 'date':
      return <span style={style}>{dayjs(value).format('YYYY-MM-DD')}</span>

    case 'datetime':
      return <span style={style}>{dayjs(value).format('YYYY-MM-DD HH:mm')}</span>

    case 'json':
      const jsonStr = JSON.stringify(value)
      if (jsonStr.length > 30) {
        return (
          <Popover content={<pre>{JSON.stringify(value, null, 2)}</pre>} title={field.display_name}>
            <Tag color="purple" style={style}>JSON</Tag>
          </Popover>
        )
      }
      return <Tag color="purple" style={style}>{jsonStr}</Tag>

    case 'password':
      return <span style={style}>••••••••</span>

    case 'color':
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', ...style }}>
          <div style={{
            width: 20,
            height: 20,
            backgroundColor: value,
            border: '1px solid #d9d9d9',
            borderRadius: 2,
            marginRight: 8
          }} />
          <span>{value}</span>
        </div>
      )

    case 'rating':
      return (
        <span style={style}>
          {'⭐'.repeat(Number(value) || 0)}
        </span>
      )

    case 'relation':
      if (!relationData || relationData.length === 0) {
        return <span style={{ color: '#999', ...style }}>-</span>
      }
      
      const config = field.relation_config ? JSON.parse(field.relation_config) : {}
      const displayField = config.display_fields?.[0] || 'name'
      
      if (config.allow_multiple && Array.isArray(value)) {
        const items = relationData.filter((item: any) => value.includes(item.id))
        return (
          <span style={style}>
            {items.map((item: any) => (
              <Tag key={item.id} color="cyan" style={{ margin: '2px' }}>
                {item[displayField] || item.id}
              </Tag>
            ))}
          </span>
        )
      } else {
        const item = relationData.find((item: any) => item.id === value)
        return (
          <Tag color="cyan" style={style}>
            {item ? (item[displayField] || item.id) : value}
          </Tag>
        )
      }

    case 'file':
      return <Tag color="orange" style={style}>📎 文件</Tag>

    case 'image':
      return <Tag color="orange" style={style}>🖼 图片</Tag>

    default:
      return <span style={style}>{String(value)}</span>
  }
}

export default FieldDisplay
