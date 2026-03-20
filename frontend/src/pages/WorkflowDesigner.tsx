import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Space, message, Spin, Card, Modal, Form, Input, Select, InputNumber } from 'antd'
import { SaveOutlined, PlayCircleOutlined, ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons'
import { workflowApi, Workflow, WorkflowNode, WorkflowEdge } from '../api/workflow'

const WorkflowDesigner = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [edges, setEdges] = useState<WorkflowEdge[]>([])
  const [nodeModalVisible, setNodeModalVisible] = useState(false)
  const [nodeForm] = Form.useForm()

  useEffect(() => {
    if (id) {
      fetchWorkflow()
    }
  }, [id])

  const fetchWorkflow = async () => {
    setLoading(true)
    try {
      const response = await workflowApi.get(id!)
      setWorkflow(response)
      setNodes(response.nodes || [])
      setEdges(response.edges || [])
    } catch (error: any) {
      message.error(error.response?.data?.error || '获取工作流失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddNode = async (values: any) => {
    try {
      // 处理config字段,确保是有效的JSON字符串
      let config = '{}'
      if (values.config && values.config.trim()) {
        try {
          // 验证是否是有效的JSON
          JSON.parse(values.config)
          config = values.config
        } catch (e) {
          message.error('配置必须是有效的JSON格式')
          return
        }
      }

      const node = await workflowApi.addNode(id!, {
        ...values,
        config: config,
        x: 100 + nodes.length * 150,
        y: 100,
      })
      setNodes([...nodes, node])
      setNodeModalVisible(false)
      nodeForm.resetFields()
      message.success('节点添加成功')
    } catch (error: any) {
      message.error(error.response?.data?.error || '添加节点失败')
    }
  }

  const handleValidate = async () => {
    try {
      const result = await workflowApi.validate(id!)
      if (result.valid) {
        message.success('工作流验证通过')
      } else {
        message.error(result.message || '工作流验证失败')
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '验证失败')
    }
  }

  const handlePublish = async () => {
    try {
      await workflowApi.update(id!, { status: 'published' })
      message.success('发布成功')
      fetchWorkflow()
    } catch (error: any) {
      message.error(error.response?.data?.error || '发布失败')
    }
  }

  const getNodeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      start: '#52c41a',
      end: '#ff4d4f',
      task: '#1890ff',
      condition: '#faad14',
      parallel: '#722ed1',
      approval: '#eb2f96',
      script: '#13c2c2',
    }
    return colorMap[type] || '#d9d9d9'
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <div style={{
        padding: '16px 24px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/workflows')}
          >
            返回
          </Button>
          <h2 style={{ margin: 0 }}>
            {workflow?.display_name || '工作流设计器'}
          </h2>
        </div>

        <Space>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setNodeModalVisible(true)}
          >
            添加节点
          </Button>
          <Button onClick={handleValidate}>
            验证
          </Button>
          {workflow?.status === 'draft' && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handlePublish}
            >
              发布
            </Button>
          )}
        </Space>
      </div>

      {/* 设计区域 */}
      <div style={{
        flex: 1,
        padding: 24,
        background: '#f0f2f5',
        overflow: 'auto'
      }}>
        {nodes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 100,
            background: '#fff',
            borderRadius: 8
          }}>
            <p style={{ color: '#999', fontSize: 16 }}>
              暂无节点,点击"添加节点"开始设计工作流
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16
          }}>
            {nodes.map(node => (
              <Card
                key={node.id}
                style={{
                  width: 200,
                  borderLeft: `4px solid ${getNodeColor(node.type)}`
                }}
                title={node.name}
                size="small"
              >
                <div style={{ color: '#666', fontSize: 12 }}>
                  类型: {node.type}
                </div>
                {node.config && (
                  <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                    配置: {node.config.substring(0, 30)}...
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 添加节点弹窗 */}
      <Modal
        title="添加节点"
        open={nodeModalVisible}
        onCancel={() => {
          setNodeModalVisible(false)
          nodeForm.resetFields()
        }}
        onOk={() => nodeForm.submit()}
      >
        <Form
          form={nodeForm}
          layout="vertical"
          onFinish={handleAddNode}
        >
          <Form.Item
            label="节点类型"
            name="type"
            rules={[{ required: true, message: '请选择节点类型' }]}
          >
            <Select placeholder="请选择节点类型">
              <Select.Option value="start">起始节点</Select.Option>
              <Select.Option value="end">结束节点</Select.Option>
              <Select.Option value="task">任务节点</Select.Option>
              <Select.Option value="condition">条件节点</Select.Option>
              <Select.Option value="parallel">并行节点</Select.Option>
              <Select.Option value="approval">审批节点</Select.Option>
              <Select.Option value="script">脚本节点</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="节点名称"
            name="name"
            rules={[{ required: true, message: '请输入节点名称' }]}
          >
            <Input placeholder="请输入节点名称" />
          </Form.Item>

          <Form.Item
            label="配置(JSON)"
            name="config"
          >
            <Input.TextArea
              rows={4}
              placeholder='{"key": "value"}'
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default WorkflowDesigner
