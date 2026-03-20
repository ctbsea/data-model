import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  message, 
  Spin, 
  Button, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Card,
  Tag,
  Dropdown
} from 'antd'
import { 
  PlusOutlined, 
  DeleteOutlined,
  SettingOutlined,
  TableOutlined
} from '@ant-design/icons'
import { modelApi, Model } from '../api/model'
import type { MenuProps } from 'antd'

const { TextArea } = Input

const ModelList = () => {
  const navigate = useNavigate()
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchModels()
  }, [])

  const fetchModels = async () => {
    setLoading(true)
    try {
      const response = await modelApi.list(1, 100)
      setModels(response.models || [])
    } catch (error: any) {
      message.error(error.response?.data?.error || '获取模型列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateModel = async (values: any) => {
    try {
      await modelApi.create({
        name: values.name,
        display_name: values.display_name,
        description: values.description,
      })
      message.success('模型创建成功')
      setModalVisible(false)
      form.resetFields()
      fetchModels()
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建模型失败')
    }
  }

  const handleDeleteModel = async (modelId: string) => {
    try {
      await modelApi.delete(modelId)
      message.success('模型删除成功')
      fetchModels()
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除模型失败')
    }
  }

  const modelMenu = (model: Model): MenuProps => ({
    items: [
      {
        key: 'fields',
        icon: <SettingOutlined />,
        label: '字段配置',
        onClick: () => navigate(`/models/${model.id}`),
      },
      {
        key: 'data',
        icon: <TableOutlined />,
        label: '管理数据',
        onClick: () => navigate(`/data/${model.name}`),
      },
      {
        type: 'divider',
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除模型',
        danger: true,
        onClick: () => {
          Modal.confirm({
            title: '确认删除',
            content: `确定要删除模型 "${model.display_name}" 吗?`,
            onOk: () => handleDeleteModel(model.id),
          })
        },
      },
    ],
  })

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>模型模板</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalVisible(true)}
        >
          创建模型模板
        </Button>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: 16 
      }}>
        {models.map(model => (
          <Card
            key={model.id}
            hoverable
            style={{ borderRadius: 8 }}
            actions={[
              <Button 
                type="link" 
                icon={<SettingOutlined />}
                onClick={() => navigate(`/models/${model.id}`)}
              >
                字段配置
              </Button>,
              <Button 
                type="link" 
                icon={<TableOutlined />}
                onClick={() => navigate(`/data/${model.name}`)}
              >
                管理数据
              </Button>,
            ]}
          >
            <Card.Meta
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{model.display_name}</span>
                  <Dropdown menu={modelMenu(model)} trigger={['click']}>
                    <Button type="text" size="small" icon={<SettingOutlined />} />
                  </Dropdown>
                </div>
              }
              description={
                <div>
                  <div style={{ marginBottom: 8, color: '#999' }}>
                    {model.description || '暂无描述'}
                  </div>
                  <div>
                    <Tag color="blue">{model.fields?.length || 0} 个字段</Tag>
                    <Tag color={model.status === 'applied' ? 'green' : 'default'}>
                      {model.status === 'applied' ? '已应用' : '草稿'}
                    </Tag>
                  </div>
                </div>
              }
            />
          </Card>
        ))}
      </div>

      {models.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: 60, 
          background: '#fff', 
          borderRadius: 8,
          color: '#999'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>暂无模型模板</div>
          <div>点击"创建模型模板"开始创建您的第一个模型</div>
        </div>
      )}

      <Modal
        title="创建模型模板"
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
          onFinish={handleCreateModel}
        >
          <Form.Item
            label="模型名称"
            name="display_name"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="输入模型显示名称" />
          </Form.Item>

          <Form.Item
            label="标识"
            name="name"
            rules={[
              { required: true, message: '请输入标识' },
              { pattern: /^[a-z0-9_]+$/, message: '只能包含小写字母、数字和下划线' }
            ]}
          >
            <Input placeholder="输入标识 (如: products)" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea rows={3} placeholder="输入模型描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ModelList
