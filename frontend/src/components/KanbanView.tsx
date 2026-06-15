import React, { useState } from 'react'
import { Card, Button, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { Field, Model } from '../api/model'
import { dataApi } from '../api/data'
import dayjs from 'dayjs'
import RecordDetail from './RecordDetail'


interface KanbanViewProps {
  model: Model | null
  fields: Field[]
  data: any[]
  kanbanField: string
  visibleFields: string[]
  users: any[]
  relationData: Record<string, any[]>
  allModels: Model[]
  onDataChange: () => void
  onAddRecord?: (initialValues?: Record<string, any>) => void
}

const KanbanView: React.FC<KanbanViewProps> = ({
  model,
  fields,
  data,
  kanbanField,
  visibleFields,
  users,
  relationData,
  allModels,
  onDataChange,
  onAddRecord
}) => {
  const [draggedCard, setDraggedCard] = useState<any>(null)
  const [dragOverCategory, setDragOverCategory] = useState<string>('')
  const [currentRecord, setCurrentRecord] = useState<any>(null)
  const [recordDetailVisible, setRecordDetailVisible] = useState(false)

  // 获取分类选项
  const getCategoryOptions = () => {
    const field = fields.find(f => f.id === kanbanField || f.name === kanbanField)
    if (!field) return []
    
    try {
      let options = JSON.parse(field.options || '[]')
      // 处理双重编码
      if (Array.isArray(options) && options.length === 1 && typeof options[0] === 'string') {
        options = JSON.parse(options[0])
      }
      // 新格式: [{label, color}] -> 返回 label 数组
      if (Array.isArray(options) && options.length > 0 && options[0]?.label) {
        return options.map((opt: any) => opt.label)
      }
      return options
    } catch {
      return []
    }
  }

  // 按分类分组数据
  const getGroupedData = () => {
    const options = getCategoryOptions()
    const grouped: Record<string, any[]> = {}
    
    // 初始化所有分类
    options.forEach((option: string) => {
      grouped[option] = []
    })
    
    // 分组数据
    const field = fields.find(f => f.id === kanbanField || f.name === kanbanField)
    const fieldName = field?.name || kanbanField
    
    data.forEach(item => {
      const category = item[fieldName] || '未分类'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(item)
    })
    
    return grouped
  }

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, record: any) => {
    setDraggedCard(record)
    e.dataTransfer.effectAllowed = 'move'
  }

  // 拖拽进入分类
  const handleDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault()
    setDragOverCategory(category)
  }

  // 拖拽离开分类
  const handleDragLeave = () => {
    setDragOverCategory('')
  }

  // 放下卡片
  const handleDrop = async (e: React.DragEvent, category: string) => {
    e.preventDefault()
    setDragOverCategory('')
    
    if (!draggedCard || !model) return
    
    const field = fields.find(f => f.id === kanbanField || f.name === kanbanField)
    if (!field) return
    
    try {
      await dataApi.update(model.name, draggedCard.id, {
        [field.name]: category
      })
      message.success('移动成功')
      onDataChange()
    } catch (error: any) {
      message.error(error.response?.data?.error || '移动失败')
    }
    
    setDraggedCard(null)
  }

  const handleAddRecord = (category: string) => {
    const field = fields.find(f => f.id === kanbanField || f.name === kanbanField)
    onAddRecord?.(field ? { [field.name]: category } : undefined)
  }

  const getFieldValue = (record: any, field: Field) => {
    const value = record[field.name]
    if (value === null || value === undefined || value === '') return '-'
    
    if (field.type === 'select' || field.type === 'multi_select') {
      try {
        const options = JSON.parse(field.options || '[]')
        const colors = ['blue', 'green', 'orange', 'purple', 'cyan', 'magenta', 'red', 'gold']
        
        if (field.type === 'multi_select' && value) {
          const values = typeof value === 'string' ? value.split(',') : value
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {values.map((v: string, i: number) => (
                <Tag key={v} color={colors[i % colors.length]} style={{ margin: 0 }}>{v}</Tag>
              ))}
            </div>
          )
        }
        return <Tag color="blue" style={{ margin: 0 }}>{value}</Tag>
      } catch {
        return value
      }
    }
    
    if (field.type === 'date') {
      return dayjs(value).format('YYYY-MM-DD')
    }
    
    if (field.type === 'boolean') {
      return value ? '是' : '否'
    }
    
    // 用户字段
    if (field.type === 'user' && value) {
      const user = users.find((u: any) => u.id === value)
      return user ? (
        <Tag color="blue" style={{ margin: 0 }}>
          {user.nickname || user.username}
        </Tag>
      ) : value
    }
    
    // 关联字段使用后端返回的 _data
    if (field.type === 'relation' && value) {
      const relationDataKey = `${field.name}_data`
      if (record[relationDataKey]) {
        const relData = record[relationDataKey]
        if (Array.isArray(relData) && relData.length > 0) {
          const config = JSON.parse(field.relation_config || '{}')
          const displayFields = config.display_fields || []
          if (displayFields.length > 0) {
            return displayFields.map((f: string) => relData[0][f]).filter(Boolean).join(' - ')
          }
          const firstField = Object.keys(relData[0]).find(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at')
          return firstField ? relData[0][firstField] || value : value
        }
      }
    }
    
    return String(value)
  }

  const groupedData = getGroupedData()
  const categories = Object.keys(groupedData)

  // 过滤可见字段
  const displayFields = fields.filter(f => 
    visibleFields.includes(f.id!) && !f.deleted && 
    !['id', 'created_at', 'updated_at'].includes(f.name)
  )

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 16, minWidth: 'max-content', flex: 1, minHeight: 0 }}>
        {categories.map(category => (
          <div
            key={category}
            style={{
              width: 300,
              flexShrink: 0,
              background: '#f5f5f5',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
            }}
            onDragOver={(e) => handleDragOver(e, category)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, category)}
          >
            {/* 分类标题 */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e8e8e8',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgb(235, 236, 239)',
              borderRadius: '8px 8px 0 0',
              flexShrink: 0,
            }}>
              <span style={{ fontWeight: 500 }}>{category}</span>
              <Tag color="blue">{groupedData[category].length}</Tag>
            </div>
            
            {/* 卡片列表 */}
            <div style={{ flex: 1, overflow: 'auto', padding: 8, minHeight: 0 }}>
              {groupedData[category].map(record => (
                <Card
                  key={record.id}
                  size="small"
                  style={{
                    marginBottom: 8,
                    cursor: 'pointer',
                    border: dragOverCategory === category ? '2px dashed #1890ff' : undefined,
                    position: 'relative',
                  }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, record)}
                  onClick={() => {
                    setCurrentRecord(record)
                    setRecordDetailVisible(true)
                  }}
                >
                  {/* 评论数 */}
                  {record._comment_count > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: '#ff4d4f',
                      color: '#fff',
                      fontSize: 10,
                      padding: '0 4px',
                      borderRadius: 10,
                      minWidth: 16,
                      textAlign: 'center',
                    }}>
                      {record._comment_count}
                    </span>
                  )}
                  {displayFields.map(field => (
                    <div key={field.id} style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#666' }}>{field.display_name}: </span>
                      <span style={{ fontSize: 12 }}>{getFieldValue(record, field)}</span>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
            
            {/* 添加按钮固定底部 */}
            <div style={{ padding: 8, borderTop: '1px solid #e8e8e8', background: '#fff', borderRadius: '0 0 8px 8px', flexShrink: 0 }}>
              <Button
                type="dashed"
                block
                icon={<PlusOutlined />}
                onClick={() => handleAddRecord(category)}
              >
                添加
              </Button>
            </div>
          </div>
        ))}
      </div>


      {/* 记录详情 */}
      {currentRecord && (
        <RecordDetail
          visible={recordDetailVisible}
          record={currentRecord}
          model={model}
          fields={fields}
          onClose={() => {
            setRecordDetailVisible(false)
            setCurrentRecord(null)
          }}
          onUpdate={onDataChange}
        />
      )}
    </div>
  )
}

export default KanbanView
