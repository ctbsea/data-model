import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Form, Input, Button, Card, message, Space, Tabs, Table, Modal, Select, Switch, InputNumber, Drawer, Tag, Tooltip } from 'antd'
import { SaveOutlined, PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, UnlockOutlined, UpOutlined, DownOutlined } from '@ant-design/icons'
import { modelApi, Model, Field, Relation, AddFieldRequest, AddRelationRequest } from '../api/model'

const { TabPane } = Tabs
const { TextArea } = Input

const ModelDesigner = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState<Model | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [relations, setRelations] = useState<Relation[]>([])
  const [fieldModalVisible, setFieldModalVisible] = useState(false)
  const [relationModalVisible, setRelationModalVisible] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)
  const [editingRelation, setEditingRelation] = useState<Relation | null>(null)
  const [fieldForm] = Form.useForm()
  const [relationForm] = Form.useForm()

  useEffect(() => {
    if (id && id !== 'new') {
      fetchModel()
    }
  }, [id])

  const fetchModel = async () => {
    setLoading(true)
    try {
      const data = await modelApi.get(id!)
      setModel(data)
      setFields(data.fields || [])
      setRelations(data.relations || [])
      form.setFieldsValue(data)
    } catch (error: any) {
      message.error(error.response?.data?.error || '获取模型失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)
      
      if (id === 'new') {
        const newModel = await modelApi.create(values)
        message.success('创建成功')
        navigate(`/models/${newModel.id}`)
      } else {
        await modelApi.update(id!, values)
        message.success('保存成功')
        fetchModel()
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddField = () => {
    setEditingField(null)
    fieldForm.resetFields()
    fieldForm.setFieldsValue({ required: false, unique: false, is_lock: false, order: fields.length })
    setFieldModalVisible(true)
  }

  const handleEditField = (field: Field) => {
    setEditingField(field)
    fieldForm.setFieldsValue(field)
    setFieldModalVisible(true)
  }

  const handleSaveField = async () => {
    try {
      const values = await fieldForm.validateFields()
      setLoading(true)
      
      if (editingField) {
        await modelApi.updateField(model!.id, editingField.id!, values)
        message.success('字段更新成功')
      } else {
        await modelApi.addField(model!.id, values)
        message.success('字段添加成功')
      }
      
      setFieldModalVisible(false)
      fetchModel()
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存字段失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteField = async (fieldId: string) => {
    try {
      await modelApi.deleteField(model!.id, fieldId)
      message.success('字段删除成功')
      fetchModel()
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除字段失败')
    }
  }

  const handleMoveField = async (fieldId: string, direction: 'up' | 'down') => {
    const currentIndex = fields.findIndex(f => f.id === fieldId)
    if (currentIndex === -1) return
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= fields.length) return
    
    // 交换order
    const newFields = [...fields]
    const temp = newFields[currentIndex].order
    newFields[currentIndex].order = newFields[newIndex].order
    newFields[newIndex].order = temp
    
    try {
      // 批量更新order
      await Promise.all([
        modelApi.updateField(model!.id, newFields[currentIndex].id!, { order: newFields[currentIndex].order }),
        modelApi.updateField(model!.id, newFields[newIndex].id!, { order: newFields[newIndex].order }),
      ])
      fetchModel()
    } catch (error: any) {
      message.error(error.response?.data?.error || '移动失败')
    }
  }

  const handleToggleLock = async (field: Field) => {
    try {
      await modelApi.updateField(model!.id, field.id!, { is_lock: !field.is_lock })
      message.success(field.is_lock ? '已解锁' : '已锁定')
      fetchModel()
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败')
    }
  }

  const handleAddRelation = () => {
    setEditingRelation(null)
    relationForm.resetFields()
    relationForm.setFieldsValue({ cascade_delete: false })
    setRelationModalVisible(true)
  }

  const handleEditRelation = (relation: Relation) => {
    setEditingRelation(relation)
    relationForm.setFieldsValue(relation)
    setRelationModalVisible(true)
  }

  const handleSaveRelation = async () => {
    try {
      const values = await relationForm.validateFields()
      setLoading(true)
      
      if (editingRelation) {
        await modelApi.updateRelation(model!.id, editingRelation.id!, values)
        message.success('关联关系更新成功')
      } else {
        await modelApi.addRelation(model!.id, values)
        message.success('关联关系添加成功')
      }
      
      setRelationModalVisible(false)
      fetchModel()
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存关联关系失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteRelation = async (relationId: string) => {
    try {
      await modelApi.deleteRelation(model!.id, relationId)
      message.success('关联关系删除成功')
      fetchModel()
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除关联关系失败')
    }
  }

  const fieldColumns = [
    { title: '字段名', dataIndex: 'name', key: 'name' },
    { title: '显示名称', dataIndex: 'display_name', key: 'display_name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { 
      title: '必填', 
      dataIndex: 'required', 
      key: 'required',
      render: (required: boolean) => required ? '是' : '否'
    },
    { 
      title: '唯一', 
      dataIndex: 'unique', 
      key: 'unique',
      render: (unique: boolean) => unique ? '是' : '否'
    },
    { 
      title: '锁定', 
      dataIndex: 'is_lock', 
      key: 'is_lock',
      render: (is_lock: boolean) => is_lock ? <Tag color="red"><LockOutlined /> 锁定</Tag> : <Tag color="green"><UnlockOutlined /> 未锁定</Tag>
    },
    {
      title: '操作',
      key: 'action',
      render: (record: Field, _, index: number) => (
        <Space>
          <Button 
            type="link" 
            icon={<UpOutlined />} 
            onClick={() => handleMoveField(record.id!, 'up')}
            disabled={index === 0}
            title="上移"
          />
          <Button 
            type="link" 
            icon={<DownOutlined />} 
            onClick={() => handleMoveField(record.id!, 'down')}
            disabled={index === fields.length - 1}
            title="下移"
          />
          <Button 
            type="link" 
            icon={record.is_lock ? <UnlockOutlined /> : <LockOutlined />} 
            onClick={() => handleToggleLock(record)}
            style={{ color: record.is_lock ? '#52c41a' : '#ff4d4f' }}
          >
            {record.is_lock ? '解锁' : '锁定'}
          </Button>
          <Tooltip title={record.is_lock ? '字段已锁定，无法编辑' : ''}>
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => handleEditField(record)}
              disabled={record.is_lock}
            >
              编辑
            </Button>
          </Tooltip>
          <Tooltip title={record.is_lock ? '字段已锁定，无法删除' : ''}>
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => handleDeleteField(record.id!)}
              disabled={record.is_lock}
            >
              删除
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  const relationColumns = [
    { title: '关联名称', dataIndex: 'name', key: 'name' },
    { title: '关联类型', dataIndex: 'type', key: 'type' },
    { title: '目标模型', dataIndex: 'target_model_id', key: 'target_model_id' },
    { 
      title: '级联删除', 
      dataIndex: 'cascade_delete', 
      key: 'cascade_delete',
      render: (cascade: boolean) => cascade ? '是' : '否'
    },
    {
      title: '操作',
      key: 'action',
      render: (record: Relation) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditRelation(record)}>
            编辑
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteRelation(record.id!)}>
            删除
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>{id === 'new' ? '创建模型' : '编辑模型'}</h2>
        <Space>
          <Button onClick={() => navigate('/models')}>返回</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>
            保存
          </Button>
        </Space>
      </div>

      <Card>
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="模型名称"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="请输入模型名称(英文)" disabled={id !== 'new'} />
          </Form.Item>
          <Form.Item
            name="display_name"
            label="显示名称"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="请输入显示名称" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入模型描述" />
          </Form.Item>
        </Form>
      </Card>

      {id !== 'new' && model && (
        <Card style={{ marginTop: 16 }}>
          <Tabs defaultActiveKey="fields">
            <TabPane 
              tab={
                <span>
                  字段管理
                  <Button 
                    type="link" 
                    size="small" 
                    icon={<PlusOutlined />} 
                    onClick={(e) => { e.stopPropagation(); handleAddField() }}
                    style={{ marginLeft: 8 }}
                  >
                    添加字段
                  </Button>
                </span>
              } 
              key="fields"
            >
              <Table
                columns={fieldColumns}
                dataSource={fields}
                rowKey="id"
                pagination={false}
              />
            </TabPane>
            <TabPane tab="关联关系" key="relations">
              <div style={{ marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRelation}>
                  添加关联
                </Button>
              </div>
              <Table
                columns={relationColumns}
                dataSource={relations}
                rowKey="id"
                pagination={false}
              />
            </TabPane>
          </Tabs>
        </Card>
      )}

      {/* 字段编辑Drawer - 左侧弹出 */}
      <Drawer
        title={editingField ? '编辑字段' : '添加字段'}
        placement="left"
        open={fieldModalVisible}
        onClose={() => setFieldModalVisible(false)}
        width={500}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setFieldModalVisible(false)} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" onClick={handleSaveField} loading={loading}>
              保存
            </Button>
          </div>
        }
      >
        <Form form={fieldForm} layout="vertical">
          <Form.Item name="name" label="字段名" rules={[{ required: true }]}>
            <Input placeholder="字段名(英文)" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称" rules={[{ required: true }]}>
            <Input placeholder="显示名称" />
          </Form.Item>
          <Form.Item name="type" label="字段类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="text">文本</Select.Option>
              <Select.Option value="number">数字</Select.Option>
              <Select.Option value="date">日期</Select.Option>
              <Select.Option value="bool">布尔值</Select.Option>
              <Select.Option value="enum">枚举</Select.Option>
              <Select.Option value="file">文件</Select.Option>
              <Select.Option value="relation">关联</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="required" label="必填" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="unique" label="唯一" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="is_lock" label="锁定" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="default_value" label="默认值">
            <Input placeholder="默认值" />
          </Form.Item>
          <Form.Item name="order" label="排序">
            <InputNumber min={0} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 关联关系编辑弹窗 */}
      <Modal
        title={editingRelation ? '编辑关联关系' : '添加关联关系'}
        open={relationModalVisible}
        onOk={handleSaveRelation}
        onCancel={() => setRelationModalVisible(false)}
        width={600}
      >
        <Form form={relationForm} layout="vertical">
          <Form.Item name="name" label="关联名称" rules={[{ required: true }]}>
            <Input placeholder="关联名称" />
          </Form.Item>
          <Form.Item name="type" label="关联类型" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="one_to_one">一对一</Select.Option>
              <Select.Option value="one_to_many">一对多</Select.Option>
              <Select.Option value="many_to_many">多对多</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="target_model_id" label="目标模型" rules={[{ required: true }]}>
            <Input placeholder="目标模型ID" />
          </Form.Item>
          <Form.Item name="foreign_key" label="外键字段">
            <Input placeholder="外键字段名" />
          </Form.Item>
          <Form.Item name="cascade_delete" label="级联删除" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ModelDesigner
