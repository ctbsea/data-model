import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons'
import { dictionaryApi, DictionaryItem } from '../api/dictionary'

const { Title, Text } = Typography
const { Option } = Select

type DictionaryFormValues = {
  type: string
  code: string
  name: string
  name_zh?: string
  name_en?: string
  symbol?: string
  icon?: string
  sort?: number
  enabled?: boolean
}

const BUILTIN_TYPES = [
  { value: 'currency', label: '货币' },
  { value: 'country', label: '国家' },
]

const Dictionaries: React.FC = () => {
  const [items, setItems] = useState<DictionaryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [currentType, setCurrentType] = useState<string>('currency')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<DictionaryItem | null>(null)
  const [form] = Form.useForm<DictionaryFormValues>()

  const dictionaryTypes = useMemo(() => {
    const fromItems = Array.from(new Set(items.map(item => item.type))).filter(Boolean)
    const merged = [...BUILTIN_TYPES]
    fromItems.forEach(type => {
      if (!merged.some(item => item.value === type)) {
        merged.push({ value: type, label: type })
      }
    })
    return merged
  }, [items])

  const filteredItems = useMemo(() => (
    currentType ? items.filter(item => item.type === currentType) : items
  ), [items, currentType])

  const loadItems = async () => {
    setLoading(true)
    try {
      const res = await dictionaryApi.list(undefined, true)
      setItems(res.items || [])
    } catch (error: any) {
      message.error(error.response?.data?.error || '获取字典失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  useEffect(() => {
    if (!modalVisible) return
    if (editingItem) {
      form.setFieldsValue({
        type: editingItem.type,
        code: editingItem.code,
        name: editingItem.name,
        name_zh: editingItem.name_zh,
        name_en: editingItem.name_en,
        symbol: editingItem.symbol,
        icon: editingItem.icon,
        sort: editingItem.sort ?? 0,
        enabled: editingItem.enabled ?? true,
      })
    } else {
      form.setFieldsValue({ type: currentType || 'currency', enabled: true, sort: 0 })
    }
  }, [modalVisible, editingItem, currentType, form])

  const openCreateModal = () => {
    setEditingItem(null)
    form.resetFields()
    setModalVisible(true)
  }

  const openEditModal = (item: DictionaryItem) => {
    setEditingItem(item)
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        code: values.code.trim().toUpperCase(),
        name_zh: values.name_zh || values.name,
        name_en: values.name_en || values.name,
        enabled: values.enabled ?? true,
        sort: values.sort ?? 0,
      }
      if (editingItem) {
        await dictionaryApi.update(editingItem.id, payload)
        message.success('字典项已更新')
      } else {
        await dictionaryApi.create(payload)
        message.success('字典项已创建')
      }
      setModalVisible(false)
      form.resetFields()
      loadItems()
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error.response?.data?.error || '保存失败')
    }
  }

  const handleDelete = async (item: DictionaryItem) => {
    try {
      await dictionaryApi.delete(item.id)
      message.success('字典项已删除')
      loadItems()
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败')
    }
  }

  const columns = [
    {
      title: '编码',
      dataIndex: 'code',
      width: 120,
      render: (code: string) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: '名称',
      dataIndex: 'name',
      render: (_: string, record: DictionaryItem) => (
        <Space direction="vertical" size={0}>
          <span>{record.icon} {record.name_zh || record.name}</span>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.name_en}</Text>
        </Space>
      ),
    },
    {
      title: '符号',
      dataIndex: 'symbol',
      width: 100,
      render: (symbol: string) => symbol ? <Text strong>{symbol}</Text> : '-',
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 120,
      render: (type: string) => dictionaryTypes.find(item => item.value === type)?.label || type,
    },
    {
      title: '排序',
      dataIndex: 'sort',
      width: 90,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 100,
      render: (enabled: boolean) => <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: DictionaryItem) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
          <Popconfirm title="确定删除该字典项？" onConfirm={() => handleDelete(record)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space direction="vertical" size={0}>
            <Title level={4} style={{ margin: 0 }}>字典功能</Title>
            <Text type="secondary">维护国家、货币，也可以新增其他业务字典类型。</Text>
          </Space>
        }
        extra={
          <Space>
            <Select value={currentType} onChange={setCurrentType} style={{ width: 160 }} allowClear placeholder="全部类型">
              {dictionaryTypes.map(type => <Option key={type.value} value={type.value}>{type.label}</Option>)}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={loadItems}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新增字典项</Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredItems}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑字典项' : '新增字典项'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setEditingItem(null)
          form.resetFields()
        }}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="字典类型" name="type" rules={[{ required: true, message: '请输入字典类型' }]}>
            <Select showSearch placeholder="选择或输入类型" options={dictionaryTypes} />
          </Form.Item>
          <Form.Item label="编码" name="code" rules={[{ required: true, message: '请输入编码' }]}>
            <Input placeholder="如 CNY、CN、status" />
          </Form.Item>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="默认名称" />
          </Form.Item>
          <Form.Item label="中文名称" name="name_zh">
            <Input placeholder="如 人民币、中国" />
          </Form.Item>
          <Form.Item label="英文名称" name="name_en">
            <Input placeholder="如 Chinese Yuan、China" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item label="符号" name="symbol" style={{ flex: 1 }}>
              <Input placeholder="如 ¥、$" />
            </Form.Item>
            <Form.Item label="图标" name="icon" style={{ flex: 1 }}>
              <Input placeholder="如 🇨🇳、💰" />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item label="排序" name="sort" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="启用" name="enabled" valuePropName="checked" style={{ flex: 1 }}>
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

export default Dictionaries
