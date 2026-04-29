import React, { useEffect, useState } from 'react'
import { Form, Input, Select, message, Modal, Button, Popover } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { modelApi, Field, Model } from '../../../api/model'
import { dictionaryApi, DictionaryItem } from '../../../api/dictionary'

const { Option } = Select

// 预设颜色
const PRESET_COLORS = [
  '#52c41a', '#1890ff', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#2f54eb', '#a0d911',
]

// 颜色选择器组件
const ColorPicker: React.FC<{
  color: string
  onChange: (color: string) => void
}> = ({ color, onChange }) => {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: 200 }}>
      {PRESET_COLORS.map(c => (
        <div
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            background: c,
            cursor: 'pointer',
            border: color === c ? '2px solid #000' : '2px solid transparent',
          }}
        />
      ))}
    </div>
  )
}

// 选项编辑器组件
const OptionEditor: React.FC<{
  value?: string
  onChange?: (value: string) => void
}> = ({ value, onChange }) => {
  // 解析选项: 格式为 JSON 数组 [{label, color}]
  const parseOptions = (val?: string) => {
    if (!val) return []
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed) && parsed[0]?.label) {
        return parsed
      }
      // 兼容旧格式: 字符串数组
      return parsed.map((label: string, index: number) => ({
        label,
        color: PRESET_COLORS[index % PRESET_COLORS.length]
      }))
    } catch {
      return []
    }
  }

  const [options, setOptions] = useState<Array<{label: string, color: string}>>(parseOptions(value))

  const handleChange = (newOptions: Array<{label: string, color: string}>) => {
    setOptions(newOptions)
    onChange?.(JSON.stringify(newOptions))
  }

  const addOption = () => {
    handleChange([...options, {
      label: '',
      color: PRESET_COLORS[options.length % PRESET_COLORS.length]
    }])
  }

  const updateOption = (index: number, field: 'label' | 'color', value: string) => {
    const newOptions = [...options]
    newOptions[index] = { ...newOptions[index], [field]: value }
    handleChange(newOptions)
  }

  const deleteOption = (index: number) => {
    handleChange(options.filter((_, i) => i !== index))
  }

  return (
    <div>
      {options.map((opt, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Popover
            content={<ColorPicker color={opt.color} onChange={(c) => updateOption(index, 'color', c)} />}
            trigger="click"
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: opt.color,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            />
          </Popover>
          <Input
            value={opt.label}
            onChange={(e) => updateOption(index, 'label', e.target.value)}
            placeholder="选项名称"
            style={{ flex: 1 }}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteOption(index)}
          />
        </div>
      ))}
      <Button type="dashed" icon={<PlusOutlined />} onClick={addOption} block>
        添加选项
      </Button>
    </div>
  )
}

interface FieldModalProps {
  model: Model | null
  field: Field | null  // null = 添加模式, 有值 = 编辑模式
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  fields?: Field[]  // 用于添加时设置 order
}

export const FieldModal: React.FC<FieldModalProps> = ({
  model,
  field,
  visible,
  onClose,
  onSuccess,
  fields = []
}) => {
  const [form] = Form.useForm()
  const isEdit = !!field
  const [currencies, setCurrencies] = useState<DictionaryItem[]>([])
  const [models, setModels] = useState<Model[]>([])

  useEffect(() => {
    if (visible) {
      dictionaryApi.list('currency').then(res => setCurrencies(res.items || [])).catch(console.error)
      modelApi.list(1, 1000).then(res => setModels(res.models || [])).catch(console.error)
      if (field) {
        // 编辑模式: 填充现有数据
        let currency = 'CNY'
        let options = ''
        let relationConfig: any = {}
        try {
          if (field.type === 'currency') {
            currency = JSON.parse(field.options || '{}').currency || 'CNY'
          } else if (field.options) {
            const parsed = JSON.parse(field.options)
            options = Array.isArray(parsed) ? parsed.join('\n') : field.options
          }
          relationConfig = field.relation_config ? JSON.parse(field.relation_config) : {}
        } catch {
          options = field.options || ''
        }
        form.setFieldsValue({
          display_name: field.display_name,
          type: field.type,
          options,
          currency,
          relation_target_model: relationConfig.target_model_id,
          relation_type: relationConfig.relation_type || (relationConfig.allow_multiple ? 'one_to_many' : 'one_to_one'),
          relation_display_fields: relationConfig.display_fields || [],
        })
      } else {
        // 添加模式: 重置表单
        form.resetFields()
      }
    }
  }, [field, visible, form])

  const handleSubmit = async (values: any) => {
    if (!model) return

    try {
      // 处理选项数据
      let optionsStr = '[]'
      if (values.type === 'currency') {
        optionsStr = JSON.stringify({ currency: values.currency || 'CNY' })
      } else if (values.options) {
        try {
          JSON.parse(values.options)
          optionsStr = values.options
        } catch {
          const optionsArray = values.options.split('\n').filter((s: string) => s.trim())
          optionsStr = JSON.stringify(optionsArray)
        }
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

      if (isEdit) {
        // 编辑模式
        await modelApi.updateField(model.id, field!.id!, {
          name: field!.name,
          display_name: values.display_name,
          type: values.type,
          required: field!.required,
          unique: field!.unique,
          options: optionsStr,
          validation: field!.validation,
          relation_config: relationConfigStr || field!.relation_config,
        })
        message.success('字段更新成功')
      } else {
        // 添加模式
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
      }

      onClose()
      form.resetFields()
      onSuccess()
    } catch (error: any) {
      message.error(error.response?.data?.error || (isEdit ? '更新字段失败' : '添加字段失败'))
    }
  }

  return (
    <Modal
      title={isEdit ? '编辑字段' : '添加字段'}
      open={visible}
      onCancel={() => {
        onClose()
        form.resetFields()
      }}
      onOk={() => form.submit()}
      okText={isEdit ? '保存' : '添加'}
      cancelText="取消"
      width={500}
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
          initialValue="text"
        >
          <Select placeholder="选择字段类型">
            <Option value="text">文本</Option>
            <Option value="textarea">多行文本</Option>
            <Option value="number">数字</Option>
            <Option value="currency">货币金额</Option>
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
            <Option value="country">国家</Option>
            <Option value="relation">关联字段</Option>
            <Option value="user">用户</Option>
          </Select>
        </Form.Item>

        <Form.Item shouldUpdate>
          {({ getFieldValue }) => {
            const type = getFieldValue('type')
            
            if (type === 'select' || type === 'multi_select') {
              return (
                <Form.Item
                  label="选项配置"
                  name="options"
                >
                  <OptionEditor />
                </Form.Item>
              )
            }

            if (type === 'currency') {
              return (
                <Form.Item label="默认币种" name="currency" initialValue="CNY">
                  <Select showSearch placeholder="选择默认币种">
                    {currencies.map(item => (
                      <Option key={item.code} value={item.code}>{item.symbol} {item.name_zh || item.name} / {item.name_en}</Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }

            if (type === 'relation') {
              const targetModelId = getFieldValue('relation_target_model')
              const targetModel = models.find(item => item.id === targetModelId)
              return (
                <>
                  <Form.Item
                    label="关联表"
                    name="relation_target_model"
                    rules={[{ required: true, message: '请选择关联表' }]}
                  >
                    <Select showSearch placeholder="选择要关联的数据表">
                      {models.filter(item => item.id !== model?.id).map(item => (
                        <Option key={item.id} value={item.id}>{item.display_name || item.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item label="关联类型" name="relation_type" initialValue="one_to_many">
                    <Select>
                      <Option value="one_to_one">一对一</Option>
                      <Option value="one_to_many">一对多</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="显示字段" name="relation_display_fields">
                    <Select mode="multiple" placeholder="选择关联记录在列表中显示的字段">
                      {(targetModel?.fields || []).filter(item => !item.deleted).map(item => (
                        <Option key={item.name} value={item.name}>{item.display_name || item.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </>
              )
            }
            
            return null
          }}
        </Form.Item>
      </Form>
    </Modal>
  )
}


