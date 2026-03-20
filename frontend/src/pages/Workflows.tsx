import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { workflowApi, Workflow } from '../api/workflow'

const { TextArea } = Input

const Workflows = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  useEffect(() => {
    fetchWorkflows()
  }, [page, pageSize])

  const fetchWorkflows = async () => {
    setLoading(true)
    try {
      const response = await workflowApi.list(page, pageSize)
      setWorkflows(response.workflows)
      setTotal(response.total)
    } catch (error: any) {
      message.error(error.response?.data?.error || '获取工作流列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (values: any) => {
    try {
      const workflow = await workflowApi.create(values)
      message.success('创建成功')
      setModalVisible(false)
      form.resetFields()
      fetchWorkflows()
      // 跳转到编辑页面
      navigate(`/workflows/${workflow.id}`)
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await workflowApi.delete(id)
      message.success('删除成功')
      fetchWorkflows()
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败')
    }
  }

  const handlePublish = async (workflow: Workflow) => {
    try {
      await workflowApi.update(workflow.id, { status: 'published' })
      message.success('发布成功')
      fetchWorkflows()
    } catch (error: any) {
      message.error(error.response?.data?.error || '发布失败')
    }
  }

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: '草稿' },
      published: { color: 'green', text: '已发布' },
      archived: { color: 'orange', text: '已归档' },
    }
    const config = statusMap[status] || { color: 'default', text: status }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const columns = [
    {
      title: '工作流名称',
      dataIndex: 'display_name',
      key: 'display_name',
    },
    {
      title: '标识',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '节点数',
      key: 'nodes',
      render: (record: Workflow) => record.nodes?.length || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      render: (record: Workflow) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/workflows/${record.id}`)}
          >
            设计
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handlePublish(record)}
            >
              发布
            </Button>
          )}
          {record.status === 'published' && (
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => message.info('启动功能开发中')}
            >
              启动
            </Button>
          )}
          <Popconfirm
            title="确定要删除这个工作流吗?"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>工作流管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
        >
          创建工作流
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={workflows}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />

      <Modal
        title="创建工作流"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            label="工作流名称"
            name="display_name"
            rules={[{ required: true, message: '请输入工作流名称' }]}
          >
            <Input placeholder="请输入工作流名称" />
          </Form.Item>

          <Form.Item
            label="标识"
            name="name"
            rules={[
              { required: true, message: '请输入标识' },
              { pattern: /^[a-z0-9_]+$/, message: '只能包含小写字母、数字和下划线' }
            ]}
          >
            <Input placeholder="请输入标识 (如: approval_flow)" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Workflows
