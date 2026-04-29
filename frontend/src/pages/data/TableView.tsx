import React, { useEffect, useRef, useState } from 'react'
import { Spin, Button, Tag, Dropdown, Select, Input, DatePicker, Badge, Modal, Upload, Image } from 'antd'
import { DeleteOutlined, MoreOutlined, MailOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { Field, Model } from '../../api/model'
import { dictionaryApi, DictionaryItem } from '../../api/dictionary'
import { getFieldIcon, getFieldColor, TAG_COLORS } from './utils'
import type { MenuProps } from 'antd'

const { Option } = Select

const getFileUrl = (url: string) => {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  const apiBase = (import.meta as any).env?.VITE_API_URL || ''
  return apiBase ? `${apiBase}${url}` : url
}

interface TableViewProps {
  model: Model | null
  fields: Field[]
  data: any[]
  users: any[]
  visibleFields: string[]
  frozenColumns: number
  columnWidths: Record<string, number>
  resizing: string | null
  editingCell: string | null
  editValue: any
  commentCounts: Record<string, number>
  hoveredRow: string | null
  loadingMore: boolean
  filters: any
  sorts: any[]
  relationData: Record<string, any[]>
  allModels: Model[]
  onColumnResize: (e: React.MouseEvent, fieldId: string) => void
  onCellClick: (row: any, field: Field) => void
  onEditChange: (value: any) => void
  onEditBlur: (rowId: string, fieldName: string, value: any) => void
  onDeleteRow: (rowId: string) => void
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
  onFieldMenuClick: (field: Field, action: string) => void
  onAddRow: () => void
  onRowHover: (rowId: string | null) => void
  onRecordClick: (row: any) => void
  onEmailClick?: (email: string) => void
  headerScrollRef: React.RefObject<HTMLDivElement>
  bodyScrollRef: React.RefObject<HTMLDivElement>
}

export const TableView: React.FC<TableViewProps> = ({
  model,
  fields,
  data,
  users,
  visibleFields,
  frozenColumns,
  columnWidths,
  resizing,
  editingCell,
  editValue,
  commentCounts,
  hoveredRow,
  loadingMore,
  onColumnResize,
  onCellClick,
  onEditChange,
  onEditBlur,
  onDeleteRow,
  onScroll,
  onFieldMenuClick,
  onAddRow,
  onRowHover,
  onRecordClick,
  onEmailClick,
  headerScrollRef,
  bodyScrollRef,
}) => {
  const [currencies, setCurrencies] = useState<DictionaryItem[]>([])
  const [countries, setCountries] = useState<DictionaryItem[]>([])

  useEffect(() => {
    dictionaryApi.list('currency').then(res => setCurrencies(res.items || [])).catch(console.error)
    dictionaryApi.list('country').then(res => setCountries(res.items || [])).catch(console.error)
  }, [])

  const handleHeaderScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
    onScroll(e)
  }

  const fieldMenu = (field: Field, fieldIndex: number): MenuProps => ({
    items: [
      { key: 'edit', label: '编辑字段', disabled: field.is_lock, onClick: () => onFieldMenuClick(field, 'edit') },
      { type: 'divider' },
      { key: 'freeze', label: frozenColumns > fieldIndex ? '取消冻结' : '冻结到此列', onClick: () => onFieldMenuClick(field, 'freeze') },
      { key: 'hide', label: '隐藏字段', onClick: () => onFieldMenuClick(field, 'hide') },
      { type: 'divider' },
      { key: 'delete', label: '删除字段', danger: true, disabled: field.is_lock, onClick: () => onFieldMenuClick(field, 'delete') },
    ],
  })

  const renderCell = (row: any, field: Field) => {
    const isEditing = editingCell === `${row.id}-${field.name}`
    const value = row[field.name]

    if (isEditing) {
      if (field.type === 'select' || field.type === 'multi_select') {
        let options: any[] = []
        try {
          let parsed = JSON.parse(field.options || '[]')
          // 处理双重编码: ["[{...}]"] -> [{...}]
          if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === 'string') {
            parsed = JSON.parse(parsed[0])
          }
          options = parsed
        } catch (e) {
          console.error('Failed to parse options:', field.options)
          options = []
        }
        // 新格式: [{label, color}]
        const hasColorConfig = Array.isArray(options) && options.length > 0 && options[0]?.label
        
        // 处理当前值
        let currentValue = editValue
        if (field.type === 'multi_select') {
          if (typeof editValue === 'string' && editValue) {
            currentValue = editValue.split(',').filter((v: string) => v.trim())
          } else if (Array.isArray(editValue)) {
            currentValue = editValue
          } else {
            currentValue = []
          }
        }
        
        return (
          <Select
            autoFocus
            defaultOpen
            mode={field.type === 'multi_select' ? 'multiple' : undefined}
            value={currentValue}
            onChange={(value) => {
              if (field.type === 'multi_select') {
                const newValue = Array.isArray(value) ? value : [value]
                onEditChange(newValue.join(','))
                // 多选每次变化都保存
                onEditBlur(row.id, field.name, newValue.join(','))
              } else {
                onEditChange(value)
                onEditBlur(row.id, field.name, value)
              }
            }}
            onBlur={() => {
              if (field.type === 'multi_select') {
                // 多选失焦时保存
                const saveValue = Array.isArray(editValue) ? editValue.join(',') : String(editValue || '')
                onEditBlur(row.id, field.name, saveValue)
              }
            }}
            size="small"
            style={{ width: '100%' }}
          >
            {hasColorConfig ? (
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
      if (field.type === 'user') {
        return (
          <Select
            autoFocus
            open
            showSearch
            value={editValue}
            onChange={(value) => {
              onEditChange(value)
              onEditBlur(row.id, field.name, value)
            }}
            onBlur={() => onEditBlur(row.id, field.name, editValue)}
            size="small"
            style={{ width: '100%' }}
            filterOption={(input, option) => 
              String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {users.map((u: any) => (
              <Option key={u.id} value={u.id}>{u.nickname || u.username}</Option>
            ))}
          </Select>
        )
      }
      if (field.type === 'currency') {
        return (
          <Input
            autoFocus
            type="number"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={() => onEditBlur(row.id, field.name, editValue)}
            onPressEnter={() => onEditBlur(row.id, field.name, editValue)}
            size="small"
            style={{ width: '100%' }}
          />
        )
      }
      if (field.type === 'country') {
        return (
          <Select
            autoFocus
            showSearch
            value={editValue}
            onChange={(value) => { onEditChange(value); onEditBlur(row.id, field.name, value) }}
            size="small"
            style={{ width: '100%' }}
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
      if (field.type === 'date') {
        return (
          <DatePicker
            autoFocus
            open
            value={editValue ? dayjs(editValue) : null}
            onChange={(date) => {
              const value = date ? date.format('YYYY-MM-DD') : ''
              onEditChange(value)
              onEditBlur(row.id, field.name, value)
            }}
            size="small"
            style={{ width: '100%' }}
          />
        )
      }
      if (field.type === 'datetime') {
        return (
          <DatePicker
            autoFocus
            open
            showTime
            value={editValue ? dayjs(editValue) : null}
            onChange={(date) => {
              const value = date ? date.format('YYYY-MM-DD HH:mm:ss') : ''
              onEditChange(value)
              onEditBlur(row.id, field.name, value)
            }}
            size="small"
            style={{ width: '100%' }}
          />
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
              onEditChange(response.url)
              onEditBlur(row.id, field.name, response.url)
            }}
          >
            <Button size="small" icon={<UploadOutlined />}>上传</Button>
          </Upload>
        )
      }
      return (
        <Input
          autoFocus
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={() => onEditBlur(row.id, field.name, editValue)}
          onPressEnter={() => onEditBlur(row.id, field.name, editValue)}
          size="small"
          style={{ width: '100%' }}
        />
      )
    }

    // 显示值
    if (field.type === 'select' || field.type === 'multi_select') {
      try {
        let parsed = JSON.parse(field.options || '[]')
        // 处理双重编码: ["[{...}]"] -> [{...}]
        if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === 'string') {
          parsed = JSON.parse(parsed[0])
        }
        const options = parsed
        // 新格式: [{label, color}]
        const hasColorConfig = Array.isArray(options) && options.length > 0 && options[0]?.label
        
        if (field.type === 'multi_select' && value) {
          const values = Array.isArray(value) ? value : String(value).split(',')
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {values.map((v: string, i: number) => {
                const trimmed = v.trim()
                if (hasColorConfig) {
                  const opt = options.find((o: any) => o.label === trimmed)
                  return (
                    <Tag key={i} color={opt?.color || TAG_COLORS[i % TAG_COLORS.length]} style={{ margin: 0 }}>
                      {trimmed}
                    </Tag>
                  )
                }
                return (
                  <Tag key={i} color={TAG_COLORS[i % TAG_COLORS.length]} style={{ margin: 0 }}>
                    {trimmed}
                  </Tag>
                )
              })}
            </div>
          )
        }
        if (value) {
          if (hasColorConfig) {
            const opt = options.find((o: any) => o.label === value)
            return <Tag color={opt?.color || TAG_COLORS[0]}>{value}</Tag>
          }
          return <Tag color={TAG_COLORS[0]}>{value}</Tag>
        }
      } catch (e) {
        console.error('Failed to parse options:', field.options)
      }
    }

    if (field.type === 'user' && value) {
      const user = users.find((u: any) => u.id === value)
      if (user) return <Tag color="blue">{user.nickname || user.username}</Tag>
    }

    // 日期字段显示
    if (field.type === 'date' && value) {
      return <span>{dayjs(value).format('YYYY-MM-DD')}</span>
    }
    if (field.type === 'datetime' && value) {
      return <span>{dayjs(value).format('YYYY-MM-DD HH:mm:ss')}</span>
    }

    if (field.type === 'currency' && value !== undefined && value !== null && value !== '') {
      const config = field.options ? (() => { try { return JSON.parse(field.options) } catch { return {} } })() : {}
      const code = config.currency || 'CNY'
      const currency = currencies.find(item => item.code === code)
      return <span>{currency?.symbol || ''}{Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ color: '#999' }}>{code}</span></span>
    }

    if (field.type === 'country' && value) {
      const country = countries.find(item => item.code === value)
      return <Tag color="blue">{country?.icon} {country?.name_zh || value}{country?.name_en ? ` / ${country.name_en}` : ''}</Tag>
    }

    // 文件/图片字段显示
    if (field.type === 'image' && value) {
      return <Image src={getFileUrl(value)} width={40} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} />
    }
    if (field.type === 'file' && value) {
      return <a href={getFileUrl(value)} target="_blank" rel="noreferrer">{value.split('/').pop()}</a>
    }

    // 关联字段显示
    if (field.type === 'relation' && field.relation_config) {
      try {
        const config = JSON.parse(field.relation_config)
        const displayFields = config.display_fields || []
        const relationDataField = row[field.name + '_data']
        
        if (relationDataField) {
          // 处理多个关联值
          if (Array.isArray(relationDataField)) {
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {relationDataField.map((item: any, i: number) => {
                  const label = displayFields.length > 0
                    ? displayFields.map((f: string) => item[f]).filter(Boolean).join(' - ')
                    : item.name || item.id
                  return <Tag key={i} color="purple" style={{ margin: 0 }}>{label}</Tag>
                })}
              </div>
            )
          }
          // 单个关联值
          const label = displayFields.length > 0
            ? displayFields.map((f: string) => relationDataField[f]).filter(Boolean).join(' - ')
            : relationDataField.name || relationDataField.id
          return <Tag color="purple">{label}</Tag>
        }
        // 没有关联数据时显示ID
        if (value) {
          const ids = String(value).split(',').filter(Boolean)
          if (ids.length > 1) {
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ids.map((id: string, i: number) => (
                  <Tag key={i} color="purple" style={{ margin: 0 }}>{id}</Tag>
                ))}
              </div>
            )
          }
          return <Tag color="purple">{ids[0]}</Tag>
        }
      } catch {}
    }

    // 邮件字段显示
    if (field.type === 'email' && value) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>{value}</span>
          <Button 
            type="text" 
            size="small" 
            icon={<MailOutlined style={{ color: '#ff4d4f' }} />} 
            onClick={(e) => {
              e.stopPropagation()
              onEmailClick?.(value)
            }}
          />
        </div>
      )
    }

    return <span style={{ color: value ? 'inherit' : '#bfbfbf' }}>{value || '点击编辑'}</span>
  }

  return (
    <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, background: '#fff', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* 表头 */}
        <div style={{ display: 'flex', background: '#fafafa', borderBottom: '2px solid #e8e8e8', fontWeight: 500, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexShrink: 0 }}>
            <div style={{ width: 50, padding: '12px', borderRight: '1px solid #e8e8e8', background: '#fafafa' }}>#</div>
            {fields.filter(f => visibleFields.includes(f.id!)).slice(0, frozenColumns).map((field, index) => (
              <div key={field.id} style={{ width: columnWidths[field.id!] || 200, padding: '12px', borderRight: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa', position: 'relative' }}>
                <span style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${getFieldColor(field.type)}20`, color: getFieldColor(field.type), borderRadius: 4, fontSize: 12 }}>{getFieldIcon(field.type)}</span>
                <span style={{ flex: 1 }}>{field.display_name}</span>
                <Dropdown menu={fieldMenu(field, index)} trigger={['click']}><Button type="text" size="small" icon={<MoreOutlined />} /></Dropdown>
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 1, background: resizing === field.id ? '#1890ff' : 'transparent' }} onMouseDown={(e) => onColumnResize(e, field.id!)} />
              </div>
            ))}
          </div>
          <div ref={headerScrollRef} onScroll={handleHeaderScroll} className="hide-scrollbar" style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div style={{ display: 'flex', minWidth: 'max-content' }}>
              {fields.filter(f => visibleFields.includes(f.id!)).slice(frozenColumns).map((field, index) => (
                <div key={field.id} style={{ width: columnWidths[field.id!] || 200, padding: '12px', borderRight: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                  <span style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${getFieldColor(field.type)}20`, color: getFieldColor(field.type), borderRadius: 4, fontSize: 12 }}>{getFieldIcon(field.type)}</span>
                  <span style={{ flex: 1 }}>{field.display_name}</span>
                  <Dropdown menu={fieldMenu(field, frozenColumns + index)} trigger={['click']}><Button type="text" size="small" icon={<MoreOutlined />} /></Dropdown>
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 1, background: resizing === field.id ? '#1890ff' : 'transparent' }} onMouseDown={(e) => onColumnResize(e, field.id!)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 数据行 */}
        <div ref={bodyScrollRef} onScroll={handleBodyScroll} style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {data.map((row, rowIndex) => (
            <div key={row.id} onMouseEnter={() => onRowHover(row.id)} onMouseLeave={() => onRowHover(null)} style={{ display: 'flex', borderBottom: '1px solid #e8e8e8', background: hoveredRow === row.id ? '#f5f5f5' : '#fff' }}>
              <div style={{ display: 'flex', flexShrink: 0, position: 'sticky', left: 0, zIndex: 5 }}>
                <div style={{ width: 50, padding: '12px', borderRight: '1px solid #e8e8e8', cursor: 'pointer', position: 'relative', background: '#fff' }} onClick={() => onRecordClick(row)}>
                  {rowIndex + 1}
                  {commentCounts[row.id] > 0 && <span style={{ position: 'absolute', top: 4, right: 4, background: '#ff4d4f', color: '#fff', fontSize: 10, padding: '0 4px', borderRadius: 10, minWidth: 16, textAlign: 'center' }}>{commentCounts[row.id]}</span>}
                </div>
                {fields.filter(f => visibleFields.includes(f.id!)).slice(0, frozenColumns).map((field) => (
                  <div key={field.id} style={{ width: columnWidths[field.id!] || 200, padding: '12px', borderRight: '1px solid #e8e8e8', cursor: 'pointer', background: editingCell === `${row.id}-${field.name}` ? '#e6f7ff' : '#fafafa', minHeight: 46, display: 'flex', alignItems: 'center' }} onClick={() => onCellClick(row, field)}>
                    {renderCell(row, field)}
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, display: 'flex', minWidth: 'max-content' }}>
                {fields.filter(f => visibleFields.includes(f.id!)).slice(frozenColumns).map((field) => (
                  <div key={field.id} style={{ width: columnWidths[field.id!] || 200, padding: '12px', borderRight: '1px solid #e8e8e8', cursor: 'pointer', background: editingCell === `${row.id}-${field.name}` ? '#e6f7ff' : 'transparent', minHeight: 46, display: 'flex', alignItems: 'center' }} onClick={() => onCellClick(row, field)}>
                    {renderCell(row, field)}
                  </div>
                ))}
              </div>
              <div style={{ width: 80, padding: '12px' }}>
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => Modal.confirm({ title: '确认删除', content: '确定要删除这条记录吗?', onOk: () => onDeleteRow(row.id) })} />
              </div>
            </div>
          ))}
        </div>

        {/* 添加行按钮 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8', background: '#fafafa', flexShrink: 0 }}>
          <div style={{ width: 50, padding: '12px', borderRight: '1px solid #e8e8e8' }} />
          <div style={{ padding: '12px' }}>
            <Button type="dashed" icon={<PlusOutlined />} onClick={onAddRow}>添加记录</Button>
          </div>
        </div>
      </div>
    </div>
  )
}



