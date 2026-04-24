import React from 'react'
import { Form, Input, Select, message, Modal, Drawer, Button, Popover } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { modelApi, Field, Model } from '../../../api/model'

const { Option } = Select

interface AddFieldPopoverProps {
  model: Model | null
  fields: Field[]
  visible: boolean
  onVisibleChange: (visible: boolean) => void
  onSuccess: () => void
}

// 添加字段 Popover 组件
export const AddFieldPopover: React.FC<AddFieldPopoverProps> = ({
  model,
  fields,
  visible,
  onVisibleChange,
  onSuccess
}) => {
  const [form] = Form.useForm()

  const handleSubmit = async (values: any) => {
    if (!model) return

    try {
      // 处理选项数据
      let optionsStr = '[]'
      if (values.options) {
        const optionsArray = values.options.split('\n').filter((s: string) => s.trim())
        optionsStr = JSON.stringify(optionsArray)
      }

      // 处理关联配置
      let relationConfigStr = ''
      if (values.type === 'relation') {
        const relationConfig = {
          target_model_id: values.relation_target_model,
          relation_type: values.relation_type || 'one_to_many',
          display_fields: values.relation_display_fields || [],
          allow_multiple: values.relation_type === 'one_to_many' || values.relation_type === 'many_to_many',
          allow_duplicate: values.relation_type === 'many_to_many',
          bidirectional: false
        }
        relationConfigStr = JSON.stringify(relationConfig)
      }

      await modelApi.addField(model.id, {
        name: values.name || `field_${Date.now()}`,
        display_name: values.display_name,
        type: values.type,
        required: false,
        unique: false,
        order: fields.length,
        validation: '{}',
        options: optionsStr,
        relation_config: relationConfigStr,
      })
      
      message.success('字段添加成功')
      onVisibleChange(false)
      form.resetFields()
      onSuccess()
    } catch (error: any) {
      message.error(error.response?.data?.error || '添加字段失败')
    }
  }

  const content = (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      style={{ width: 300 }}
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
      >
        <Select placeholder="选择字段类型">
          <Option value="text">文本</Option>
          <Option value="textarea">多行文本</Option>
          <Option value="number">数字</Option>
          <Option value="select">单选</Option>
          <Option value="multi_select">多选</Option>
          <Option value="boolean">布尔值</Option>
          <Option value="date">日期</Option>
          <Option value="datetime">日期时间</Option>
          <Option value="email">邮箱</Option>
          <Option value="phone">电话</Option>
          <Option value="url">链接</Option>
          <Option value="file">文件</Option>
          <Option value="image">图片</Option>
          <Option value="json">JSON</Option>
          <Option value="password">密码</Option>
          <Option value="color">颜色</Option>
          <Option value="rating">评分</Option>
          <Option value="relation">关联字段</Option>
        </Select>
      </Form.Item>

      <Form.Item shouldUpdate>
        {({ getFieldValue }) => {
          const type = getFieldValue('type')
          
          if (type === 'select' || type === 'multi_select') {
            return (
              <Form.Item
                label="选项(每行一个)"
                name="options"
              >
                <Input.TextArea rows={4} placeholder="选项1&#10;选项2&#10;选项3" />
              </Form.Item>
            )
          }
          
          return null
        }}
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" block>
          添加
        </Button>
      </Form.Item>
    </Form>
  )

  return (
    <Popover
      content={content}
      title="添加字段"
      trigger="click"
      open={visible}
      onOpenChange={onVisibleChange}
    >
      <Button icon={<PlusOutlined />}>添加字段</Button>
    </Popover>
  )
}

interface EditFieldDrawerProps {
  model: Model | null
  field: Field | null
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

// 编辑字段 Drawer 组件
export const EditFieldDrawer: React.FC<EditFieldDrawerProps> = ({
  model,
  field,
  visible,
  onClose,
  onSuccess
}) => {
  const [form] = Form.useForm()

  React.useEffect(() => {
    if (field && visible) {
      form.setFieldsValue({
        display_name: field.display_name,
        type: field.type,
        options: field.options ? JSON.parse(field.options).join('\n') : '',
      })
    }
  }, [field, visible, form])

  const handleSubmit = async (values: any) => {
    if (!model || !field) return

    try {
      let optionsStr = field.options
      if (values.options) {
        const optionsArray = values.options.split('\n').filter((s: string) => s.trim())
        optionsStr = JSON.stringify(optionsArray)
      }

      await modelApi.updateField(model.id, field.id!, {
        name: field.name,
        display_name: values.display_name,
        type: values.type,
        required: field.required,
        unique: field.unique,
        options: optionsStr,
        validation: field.validation,
        relation_config: field.relation_config,
      })

      message.success('字段更新成功')
      onClose()
      form.resetFields()
      onSuccess()
    } catch (error: any) {
      message.error(error.response?.data?.error || '更新字段失败')
    }
  }

  return (
    <Drawer
      title="编辑字段"
      open={visible}
      onClose={() => {
        onClose()
        form.resetFields()
      }}
      width={400}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
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
        >
          <Select placeholder="选择字段类型">
            <Option value="text">文本</Option>
            <Option value="textarea">多行文本</Option>
            <Option value="number">数字</Option>
            <Option value="select">单选</Option>
            <Option value="multi_select">多选</Option>
            <Option value="boolean">布尔值</Option>
            <Option value="date">日期</Option>
            <Option value="datetime">日期时间</Option>
            <Option value="email">邮箱</Option>
            <Option value="phone">电话</Option>
            <Option value="url">链接</Option>
            <Option value="file">文件</Option>
            <Option value="image">图片</Option>
            <Option value="json">JSON</Option>
            <Option value="password">密码</Option>
            <Option value="color">颜色</Option>
            <Option value="rating">评分</Option>
            <Option value="relation">关联字段</Option>
          </Select>
        </Form.Item>

        <Form.Item shouldUpdate>
          {({ getFieldValue }) => {
            const type = getFieldValue('type')
            
            if (type === 'select' || type === 'multi_select') {
              return (
                <Form.Item
                  label="选项(每行一个)"
                  name="options"
                >
                  <Input.TextArea rows={4} placeholder="选项1&#10;选项2&#10;选项3" />
                </Form.Item>
              )
            }
            
            return null
          }}
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            保存
          </Button>
        </Form.Item>
      </Form>
    </Drawer>
  )
}
