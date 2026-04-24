import React from 'react'
import { Modal, Input, Checkbox, Spin } from 'antd'
import { Field, Model } from '../../../api/model'

interface RelationSelectModalProps {
  visible: boolean
  field: Field | null
  row: any | null
  selectedIds: string[]
  relationData: Record<string, any[]>
  relationDataLoading: Record<string, boolean>
  relationDataTotal: Record<string, number>
  allModels: Model[]
  onSelectIds: (ids: string[]) => void
  onClose: () => void
  onConfirm: (value: string) => void
  onLoadMore: (field: Field) => void
}

export const RelationSelectModal: React.FC<RelationSelectModalProps> = ({
  visible,
  field,
  row,
  selectedIds,
  relationData,
  relationDataLoading,
  relationDataTotal,
  allModels,
  onSelectIds,
  onClose,
  onConfirm,
  onLoadMore
}) => {
  if (!field) return null

  const records = relationData[field.name] || []
  const config = JSON.parse(field.relation_config || '{}')
  const allowMultiple = config.allow_multiple
  const isLoading = relationDataLoading[field.name]
  const total = relationDataTotal[field.name] || 0

  const targetModelId = config.target_model_id
  const targetModel = allModels.find((m: Model) => m.id === targetModelId)
  const targetFields = targetModel?.fields || []

  const configuredDisplayFields = config.display_fields || []
  const displayFields = configuredDisplayFields.length > 0
    ? targetFields.filter(f => configuredDisplayFields.includes(f.name))
    : targetFields.filter(f => 
        f.name !== 'id' && 
        f.name !== 'created_at' && 
        f.name !== 'updated_at'
      )

  const handleOk = () => {
    const saveValue = selectedIds.join(',')
    onConfirm(saveValue)
    onClose()
  }

  return (
    <Modal
      title={`选择${field.display_name || '关联记录'}`}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      width={800}
    >
      <div>
        <Input.Search
          placeholder="搜索记录..."
          style={{ marginBottom: 16 }}
        />
        <div 
          style={{ maxHeight: 400, overflow: 'auto' }}
          onScroll={(e) => {
            const target = e.target as HTMLDivElement
            if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
              if (!relationDataLoading[field.name]) {
                onLoadMore(field)
              }
            }
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                  <th style={{ width: 40, padding: '12px 8px', textAlign: 'center', position: 'sticky', left: 0, background: '#fafafa', zIndex: 1 }}>
                    {allowMultiple ? '多选' : '单选'}
                  </th>
                  {displayFields.map(f => (
                    <th key={f.id} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, minWidth: 120, whiteSpace: 'nowrap' }}>
                      {f.display_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record: any) => {
                  const isSelected = selectedIds.includes(record.id)
                  return (
                    <tr
                      key={record.id}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? '#e6f7ff' : '#fff',
                        transition: 'background 0.2s',
                      }}
                      onClick={() => {
                        if (allowMultiple) {
                          if (isSelected) {
                            onSelectIds(selectedIds.filter(id => id !== record.id))
                          } else {
                            onSelectIds([...selectedIds, record.id])
                          }
                        } else {
                          onSelectIds([record.id])
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#f5f5f5'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#fff'
                        }
                      }}
                    >
                      <td style={{ padding: '12px 8px', textAlign: 'center', borderBottom: '1px solid #f0f0f0', position: 'sticky', left: 0, background: isSelected ? '#e6f7ff' : '#fff', zIndex: 1 }}>
                        {allowMultiple ? (
                          <Checkbox checked={isSelected} />
                        ) : (
                          <div style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            border: '2px solid',
                            borderColor: isSelected ? '#1890ff' : '#d9d9d9',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {isSelected && (
                              <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#1890ff',
                              }} />
                            )}
                          </div>
                        )}
                      </td>
                      {displayFields.map(f => (
                        <td key={f.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>
                          {record[f.name] || '-'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {isLoading && (
                  <tr>
                    <td colSpan={displayFields.length + 1} style={{ textAlign: 'center', padding: 16 }}>
                      <Spin size="small" />
                    </td>
                  </tr>
                )}
                {!isLoading && records.length === 0 && (
                  <tr>
                    <td colSpan={displayFields.length + 1} style={{ textAlign: 'center', padding: 16, color: '#999' }}>
                      暂无数据
                    </td>
                  </tr>
                )}
                {!isLoading && records.length > 0 && records.length < total && (
                  <tr>
                    <td colSpan={displayFields.length + 1} style={{ textAlign: 'center', padding: 8, color: '#999' }}>
                      已加载 {records.length} / {total} 条
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {selectedIds.length > 0 && (
          <div style={{ marginTop: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
            已选择 {selectedIds.length} 条记录
          </div>
        )}
      </div>
    </Modal>
  )
}
