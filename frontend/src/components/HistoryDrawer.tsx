import React, { useEffect, useState } from 'react'
import { Drawer, Table, Avatar, Empty, Spin, Tag, Pagination } from 'antd'
import { UserOutlined, CheckCircleOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons'
import { historyApi, HistoryRecord } from '../api/history'

interface HistoryDrawerProps {
  visible: boolean
  modelName: string
  recordId: string
  onClose: () => void
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  visible,
  modelName,
  recordId,
  onClose
}) => {
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => {
    if (visible && modelName && recordId) {
      fetchHistory()
    }
  }, [visible, modelName, recordId, page, pageSize])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const response = await historyApi.list(modelName, recordId, page, pageSize)
      setHistory(response?.data || [])
      setTotal(response?.total || 0)
    } catch (error) {
      console.error('Failed to fetch history:', error)
      setHistory([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const renderValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span style={{ color: '#999' }}>空</span>
    }
    if (typeof value === 'boolean') {
      return value ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <span style={{ color: '#999' }}>否</span>
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  }

  const getFieldIcon = (fieldName: string) => {
    if (fieldName.includes('文本') || fieldName.includes('内容')) {
      return <FileTextOutlined style={{ marginRight: 4 }} />
    }
    if (fieldName.includes('勾选') || fieldName.includes('状态')) {
      return <CheckCircleOutlined style={{ marginRight: 4 }} />
    }
    return <EditOutlined style={{ marginRight: 4 }} />
  }

  const columns = [
    {
      title: '操作时间',
      dataIndex: 'changed_at',
      key: 'changed_at',
      width: 150,
    },
    {
      title: '操作人',
      dataIndex: 'user',
      key: 'user',
      width: 80,
      render: (user: HistoryRecord['user']) => (
        <Avatar 
          src={user.avatar} 
          icon={<UserOutlined />}
          size="small"
        />
      ),
    },
    {
      title: '字段',
      dataIndex: 'field_name',
      key: 'field_name',
      width: 120,
      render: (fieldName: string) => (
        <span>
          {getFieldIcon(fieldName)}
          {fieldName}
        </span>
      ),
    },
    {
      title: '变更前',
      dataIndex: 'old_value',
      key: 'old_value',
      width: 150,
      render: renderValue,
    },
    {
      title: '',
      key: 'arrow',
      width: 30,
      render: () => <span style={{ color: '#1890ff' }}>→</span>,
    },
    {
      title: '变更后',
      dataIndex: 'new_value',
      key: 'new_value',
      width: 150,
      render: renderValue,
    },
  ]

  return (
    <Drawer
      title="变更历史"
      placement="right"
      width={700}
      onClose={onClose}
      open={visible}
    >
      <Spin spinning={loading}>
        {history.length === 0 ? (
          <Empty description="暂无变更记录" />
        ) : (
          <>
            <Table
              dataSource={history}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="small"
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                onChange={(p, ps) => {
                  setPage(p)
                  setPageSize(ps)
                }}
                showSizeChanger
                showTotal={(total) => `共 ${total} 条`}
              />
            </div>
          </>
        )}
      </Spin>
    </Drawer>
  )
}

export default HistoryDrawer
