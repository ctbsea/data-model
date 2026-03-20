import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  message, 
  Spin, 
  Button, 
  Space, 
  Drawer, 
  Form, 
  Input, 
  Select, 
  Dropdown,
  Modal,
  Tag,
  Checkbox,
  Switch,
  Tooltip
} from 'antd'
import { 
  PlusOutlined, 
  DeleteOutlined,
  CopyOutlined,
  ArrowLeftOutlined,
  PlayCircleOutlined,
  LockOutlined,
  UnlockOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { modelApi, Model, Field } from '../api/model'
import type { MenuProps } from 'antd'

const { Option } = Select

const Models = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [model, setModel] = useState<Model | null>(null)
  const [loading, setLoading] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [fieldForm] = Form.useForm()
  const [editingField, setEditingField] = useState<Field | null>(null)

  useEffect(() => {
    if (id) {
      fetchModel()
    }
  }, [id])

  const fetchModel = async () => {
    setLoading(true)
    try {
      const response = await modelApi.get(id!)
      setModel(response)
    } catch (error: any) {
      message.error(error.response?.data?.error || '获取模型失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddField = async (values: any) => {
    if (!model) return

    try {
      if (editingField) {
        // 更新字段
        await modelApi.updateField(model.id, editingField.id!, {
          name: editingField.name,
          display_name: values.display_name,
          type: values.type,
          required: false,
          unique: false,
          default_value: values.default_value,
          order: editingField.order,
          validation: '{}',
        })
        message.success('字段更新成功')
      } else {
        // 添加字段
        await modelApi.addField(model.id, {
          name: values.name || `field_${Date.now()}`,
          display_name: values.display_name,
          type: values.type,
          required: false,
          unique: false,
          default_value: values.default_value,
          order: model.fields?.length || 0,
          validation: '{}',
        })
        message.success('字段添加成功')
      }
      setDrawerVisible(false)
      fieldForm.resetFields()
      setEditingField(null)
      fetchModel()
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败')
    }
  }

  const handleDeleteField = async (fieldId: string) => {
    if (!model) return

    try {
      await modelApi.deleteField(model.id, fieldId)
      message.success('字段删除成功')
      fetchModel()
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除字段失败')
    }
  }

  const handleToggleLock = async (field: Field) => {
    if (!model) return
    try {
      await modelApi.updateField(model.id, field.id!, { is_lock: !field.is_lock })
      message.success(field.is_lock ? '已解锁' : '已锁定')
      fetchModel()
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败')
    }
  }

  const handleApplyModel = async () => {
    if (!model) return

    try {
      await modelApi.apply(model.id)
      message.success('模型应用成功,数据表已创建')
      fetchModel()
    } catch (error: any) {
      message.error(error.response?.data?.error || '应用模型失败')
    }
  }

  const getFieldIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      text: 'A',
      textarea: '¶',
      number: '#',
      select: '○',
      multi_select: '☐',
      boolean: '☑',
      date: '📅',
      datetime: '🕐',
      email: '@',
      phone: '📞',
      url: '🔗',
      file: '📎',
      image: '🖼',
      json: '{ }',
      password: '🔒',
      color: '🎨',
      rating: '⭐',
    }
    return iconMap[type] || 'A'
  }

  const getFieldColor = (type: string) => {
    const colorMap: Record<string, string> = {
      text: '#1890ff',
      number: '#52c41a',
      select: '#fa8c16',
      boolean: '#722ed1',
      date: '#eb2f96',
      email: '#13c2c2',
      url: '#2f54eb',
    }
    return colorMap[type] || '#8c8c8c'
  }

  const fieldMenu = (field: Field): MenuProps => ({
    items: [
      {
        key: 'lock',
        icon: field.is_lock ? <UnlockOutlined /> : <LockOutlined />,
        label: field.is_lock ? '解锁字段' : '锁定字段',
        onClick: () => handleToggleLock(field),
      },
      {
        key: 'edit',
        icon: <PlusOutlined />,
        label: '编辑字段',
        disabled: field.is_lock,
        onClick: () => {
          if (field.is_lock) return
          setEditingField(field)
          fieldForm.setFieldsValue({
            display_name: field.display_name,
            type: field.type,
            required: field.required,
            unique: field.unique,
            default_value: field.default_value,
            is_lock: field.is_lock,
          })
          setDrawerVisible(true)
        },
      },
      {
        key: 'duplicate',
        icon: <CopyOutlined />,
        label: '复制字段',
        disabled: field.is_lock,
      },
      {
        type: 'divider',
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除字段',
        danger: true,
        disabled: field.is_lock,
        onClick: () => {
          if (field.is_lock) return
          Modal.confirm({
            title: '确认删除',
            content: `确定要删除字段 "${field.display_name}" 吗?`,
            onOk: () => handleDeleteField(field.id!),
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

  if (!model) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <div>模型不存在</div>
        <Button onClick={() => navigate('/model-list')}>返回模型列表</Button>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      {/* 顶部工具栏 */}
      <div style={{
        padding: '12px 24px',
        background: '#fff',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/model-list')}
          >
            返回
          </Button>
          <h2 style={{ margin: 0 }}>{model.display_name} - 字段配置</h2>
        </div>
        
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            disabled={model.status === 'applied'}
            onClick={handleApplyModel}
          >
            应用模型
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingField(null)
              fieldForm.resetFields()
              setDrawerVisible(true)
            }}
          >
            添加字段
          </Button>
        </Space>
      </div>

      {/* 字段列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ 
          border: '1px solid #e8e8e8', 
          borderRadius: 8,
          overflow: 'hidden',
          background: '#fff'
        }}>
          {/* 表头 */}
          <div style={{
            display: 'flex',
            background: '#fafafa',
            borderBottom: '2px solid #e8e8e8',
            fontWeight: 500,
          }}>
            <div style={{ width: 50, padding: '12px', borderRight: '1px solid #e8e8e8' }}>#</div>
            <div style={{ width: 200, padding: '12px', borderRight: '1px solid #e8e8e8' }}>字段名称</div>
            <div style={{ width: 150, padding: '12px', borderRight: '1px solid #e8e8e8' }}>字段类型</div>
            <div style={{ width: 120, padding: '12px', borderRight: '1px solid #e8e8e8' }}>默认值</div>
            <div style={{ width: 120, padding: '12px' }}>操作</div>
          </div>

          {/* 字段行 */}
          {model.fields?.map((field, index) => (
            <div
              key={field.id}
              style={{
                display: 'flex',
                borderBottom: '1px solid #e8e8e8',
                background: '#fff',
              }}
            >
              <div style={{ width: 50, padding: '12px', borderRight: '1px solid #e8e8e8' }}>
                {index + 1}
              </div>
              <div style={{ width: 200, padding: '12px', borderRight: '1px solid #e8e8e8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ 
                    width: 24, 
                    height: 24, 
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${getFieldColor(field.type)}20`,
                    color: getFieldColor(field.type),
                    borderRadius: 4,
                    fontSize: 12,
                  }}>
                    {getFieldIcon(field.type)}
                  </span>
                  {field.display_name}
                  {field.is_lock && <LockOutlined style={{ color: '#ff4d4f', marginLeft: 4 }} />}
                </div>
              </div>
              <div style={{ width: 150, padding: '12px', borderRight: '1px solid #e8e8e8' }}>
                <Tag color={getFieldColor(field.type)}>{field.type}</Tag>
              </div>
              <div style={{ width: 120, padding: '12px', borderRight: '1px solid #e8e8e8' }}>
                {field.default_value || '-'}
              </div>
              <div style={{ width: 120, padding: '12px' }}>
                <Space size="small">
                  <Tooltip title={field.is_lock ? '解锁字段' : '锁定字段'}>
                    <Button 
                      type="text" 
                      size="small" 
                      icon={field.is_lock ? <UnlockOutlined /> : <LockOutlined />}
                      onClick={() => handleToggleLock(field)}
                      style={{ color: field.is_lock ? '#52c41a' : '#ff4d4f' }}
                    />
                  </Tooltip>
                  <Tooltip title="编辑字段">
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<PlusOutlined />}
                      onClick={() => {
                        if (field.is_lock) return
                        setEditingField(field)
                        fieldForm.setFieldsValue({
                          display_name: field.display_name,
                          type: field.type,
                          required: field.required,
                          unique: field.unique,
                          default_value: field.default_value,
                          is_lock: field.is_lock,
                        })
                        setDrawerVisible(true)
                      }}
                      disabled={field.is_lock}
                    />
                  </Tooltip>
                  <Tooltip title="删除字段">
                    <Button 
                      type="text" 
                      size="small" 
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        if (field.is_lock) return
                        Modal.confirm({
                          title: '确认删除',
                          content: `确定要删除字段 "${field.display_name}" 吗?`,
                          onOk: () => handleDeleteField(field.id!),
                        })
                      }}
                      disabled={field.is_lock}
                    />
                  </Tooltip>
                </Space>
              </div>
            </div>
          ))}

          {/* 添加字段按钮 */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #e8e8e8',
              background: '#fafafa',
            }}
          >
            <div style={{ width: 50, padding: '12px', borderRight: '1px solid #e8e8e8' }} />
            <div style={{ padding: '12px' }}>
              <Button 
                type="dashed" 
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingField(null)
                  fieldForm.resetFields()
                  setDrawerVisible(true)
                }}
              >
                添加字段
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 添加字段抽屉 */}
      <Drawer
        title={editingField ? '编辑字段' : '添加字段'}
        placement="right"
        width={400}
        onClose={() => {
          setDrawerVisible(false)
          fieldForm.resetFields()
          setEditingField(null)
        }}
        open={drawerVisible}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setDrawerVisible(false)
                fieldForm.resetFields()
                setEditingField(null)
              }}>
                取消
              </Button>
              <Button type="primary" onClick={() => fieldForm.submit()}>
                保存
              </Button>
            </Space>
          </div>
        }
      >
        <Form
          form={fieldForm}
          layout="vertical"
          onFinish={handleAddField}
        >
          <Form.Item
            label="字段名称"
            name="display_name"
            rules={[{ required: true, message: '请输入字段名称' }]}
          >
            <Input placeholder="输入字段显示名称" />
          </Form.Item>

          <Form.Item
            label="字段类型"
            name="type"
            rules={[{ required: true, message: '请选择字段类型' }]}
            initialValue="text"
          >
            <Select
              showSearch
              placeholder="选择字段类型"
              optionFilterProp="children"
            >
              <Option value="text">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#1890ff' }}>A</span>
                  单行文本
                </div>
              </Option>
              <Option value="number">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#52c41a' }}>#</span>
                  数字
                </div>
              </Option>
              <Option value="select">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#fa8c16' }}>○</span>
                  单选
                </div>
              </Option>
              <Option value="boolean">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#722ed1' }}>☑</span>
                  复选框
                </div>
              </Option>
              <Option value="date">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#eb2f96' }}>📅</span>
                  日期
                </div>
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="默认值"
            name="default_value"
          >
            <Input placeholder="输入默认值" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}

export default Models
