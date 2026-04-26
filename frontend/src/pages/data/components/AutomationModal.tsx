import React, { useState, useEffect } from 'react'
import { Modal, Button, Switch, List, message, Popconfirm, Typography } from 'antd'
import { PlusOutlined, ThunderboltOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons'
import { automationApi, Automation } from '../../../api/automation'
import { AutomationDetail } from './AutomationDetail'

const { Text } = Typography

interface AutomationModalProps {
  visible: boolean
  modelId: string
  modelName: string
  fields: any[]
  onClose: () => void
}

export const AutomationModal: React.FC<AutomationModalProps> = ({
  visible,
  modelId,
  modelName,
  fields,
  onClose
}) => {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentAutomation, setCurrentAutomation] = useState<Automation | null>(null)

  const fetchAutomations = async () => {
    if (!modelId) return
    setLoading(true)
    try {
      const res = await automationApi.list(modelId)
      setAutomations(res.automations || [])
    } catch (error) {
      console.error('Failed to fetch automations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible) fetchAutomations()
  }, [visible, modelId])

  const handleToggle = async (item: Automation) => {
    try {
      await automationApi.toggleEnable(item.id)
      fetchAutomations()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await automationApi.delete(id)
      message.success('已删除')
      fetchAutomations()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleCreate = () => {
    setCurrentAutomation(null)
    setDetailVisible(true)
  }

  const handleEdit = (item: Automation) => {
    setCurrentAutomation(item)
    setDetailVisible(true)
  }

  const handleDetailClose = () => {
    setDetailVisible(false)
    setCurrentAutomation(null)
    fetchAutomations()
  }

  return (
    <>
      <Modal
        title={
          <span>
            <ThunderboltOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            自动化 - {modelName}
          </span>
        }
        open={visible}
        onCancel={onClose}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Button type="dashed" icon={<PlusOutlined />} onClick={handleCreate} block>
            新建自动化
          </Button>
        </div>

        <List
          loading={loading}
          dataSource={automations}
          locale={{ emptyText: '暂无自动化规则' }}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: 'pointer', padding: '12px 16px' }}
              onClick={() => handleEdit(item)}
              actions={[
                <Switch
                  key="switch"
                  size="small"
                  checked={item.enabled}
                  onClick={(_, e) => { e.stopPropagation(); handleToggle(item) }}
                />,
                <Popconfirm
                  key="delete"
                  title="确定删除此自动化？"
                  onConfirm={(e) => { e?.stopPropagation(); handleDelete(item.id) }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              ]}
            >
              <List.Item.Meta
                avatar={<ThunderboltOutlined style={{ fontSize: 20, color: item.enabled ? '#1890ff' : '#999' }} />}
                title={item.name}
                description={
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      运行 {item.run_count} 次
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      <AutomationDetail
        visible={detailVisible}
        automation={currentAutomation}
        modelId={modelId}
        fields={fields}
        onClose={handleDetailClose}
      />
    </>
  )
}
