import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Form, Select, Input, Button, Tag, message, InputNumber, DatePicker, Radio } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { Field } from '../../../api/model'
import { dictionaryApi, DictionaryItem } from '../../../api/dictionary'
import { getDictionaryItemsForField, getDictionaryItemLabel, parseFieldOptions } from '../../../utils/dictionaryField'

const { Option } = Select

interface FilterModalProps {
  visible: boolean
  fields: Field[]
  filters: Record<string, any>
  currentField: Field | null
  currentCondition: string
  currentValue: any
  onFiltersChange: (filters: Record<string, any>) => void
  onCurrentFieldChange: (field: Field | null) => void
  onCurrentConditionChange: (condition: string) => void
  onCurrentValueChange: (value: any) => void
  onClose: () => void
}

const CONDITION_LABELS: Record<string, string> = {
  equals: '等于',
  not_equals: '不等于',
  contains: '包含',
  not_contains: '不包含',
  greater_than: '大于',
  less_than: '小于',
  greater_or_equal: '大于等于',
  less_or_equal: '小于等于',
  date_range: '日期范围',
  is_empty: '为空',
  is_not_empty: '不为空',
}

const TEXT_CONDITIONS = ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty']
const NUMBER_CONDITIONS = ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'is_empty', 'is_not_empty']
const DATE_CONDITIONS = ['equals', 'not_equals', 'date_range', 'is_empty', 'is_not_empty']
const SELECT_CONDITIONS = ['equals', 'not_equals', 'is_empty', 'is_not_empty']
const BOOLEAN_CONDITIONS = ['equals', 'not_equals', 'is_empty', 'is_not_empty']

const getConditionsForField = (field: Field | null) => {
  if (!field) return TEXT_CONDITIONS
  if (field.type === 'number' || field.type === 'currency') return NUMBER_CONDITIONS
  if (field.type === 'date' || field.type === 'datetime') return DATE_CONDITIONS
  if (field.type === 'select' || field.type === 'multi_select' || field.type === 'country' || field.type === 'user') return SELECT_CONDITIONS
  if (field.type === 'boolean') return BOOLEAN_CONDITIONS
  return TEXT_CONDITIONS
}

const needsValue = (condition: string) => condition !== 'is_empty' && condition !== 'is_not_empty'

const normalizeFilterValue = (field: Field, condition: string, value: any) => {
  if (!needsValue(condition)) return ''
  if (condition === 'date_range' && Array.isArray(value)) {
    return {
      start: value[0] ? dayjs(value[0]).format(field.type === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD') : '',
      end: value[1] ? dayjs(value[1]).format(field.type === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD') : '',
    }
  }
  if ((field.type === 'date' || field.type === 'datetime') && value) {
    return dayjs(value).format(field.type === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD')
  }
  return value
}

const formatFilterValue = (field: Field | undefined, filter: any, dictionaryItems: DictionaryItem[]) => {
  if (!field) return String(filter.value ?? '')
  if (filter.condition === 'date_range') return [filter.start, filter.end].filter(Boolean).join(' ~ ')
  if (filter.condition === 'is_empty' || filter.condition === 'is_not_empty') return '-'
  if (field.type === 'boolean') return filter.value === true || filter.value === 'true' ? '是' : '否'
  if (field.type === 'country') {
    const item = dictionaryItems.find(dict => dict.type === 'country' && dict.code === filter.value)
    return item ? getDictionaryItemLabel(item) : String(filter.value ?? '')
  }
  if (field.type === 'select' || field.type === 'multi_select') {
    const options = getDictionaryItemsForField(field, dictionaryItems)
    if (options.length) {
      const values = Array.isArray(filter.value) ? filter.value : String(filter.value ?? '').split(',').filter(Boolean)
      return values.map(value => {
        const item = options.find(option => option.code === value)
        return item ? getDictionaryItemLabel(item) : value
      }).join('，')
    }
  }
  return Array.isArray(filter.value) ? filter.value.join('，') : String(filter.value ?? '')
}

export const FilterModalComponent: React.FC<FilterModalProps> = ({
  visible,
  fields,
  filters,
  currentField,
  currentCondition,
  currentValue,
  onFiltersChange,
  onCurrentFieldChange,
  onCurrentConditionChange,
  onCurrentValueChange,
  onClose
}) => {
  const [dictionaryItems, setDictionaryItems] = useState<DictionaryItem[]>([])

  useEffect(() => {
    if (!visible) return
    dictionaryApi.list(undefined, true).then(res => setDictionaryItems(res.items || [])).catch(console.error)
  }, [visible])

  const availableConditions = useMemo(() => getConditionsForField(currentField), [currentField])

  const handleFieldChange = (value: string) => {
    const nextField = fields.find(field => field.name === value) || null
    const nextCondition = getConditionsForField(nextField)[0] || 'equals'
    onCurrentFieldChange(nextField)
    onCurrentConditionChange(nextCondition)
    onCurrentValueChange('')
  }

  const handleConditionChange = (condition: string) => {
    onCurrentConditionChange(condition)
    onCurrentValueChange('')
  }

  const handleAddFilter = () => {
    if (!currentField) return
    if (needsValue(currentCondition) && (currentValue === undefined || currentValue === null || currentValue === '' || (Array.isArray(currentValue) && currentValue.length === 0))) return

    const normalizedValue = normalizeFilterValue(currentField, currentCondition, currentValue)
    const nextFilter = currentCondition === 'date_range'
      ? { condition: currentCondition, ...(normalizedValue as Record<string, any>) }
      : { condition: currentCondition, value: normalizedValue }

    onFiltersChange({ ...filters, [currentField.name]: nextFilter })
    onCurrentValueChange('')
    onCurrentFieldChange(null)
  }

  const renderValueEditor = () => {
    if (!currentField || !needsValue(currentCondition)) return null

    if (currentCondition === 'date_range') {
      return <DatePicker.RangePicker showTime={currentField.type === 'datetime'} value={currentValue} onChange={onCurrentValueChange} style={{ width: '100%' }} />
    }

    if (currentField.type === 'date' || currentField.type === 'datetime') {
      return <DatePicker showTime={currentField.type === 'datetime'} value={currentValue} onChange={onCurrentValueChange} style={{ width: '100%' }} />
    }

    if (currentField.type === 'number' || currentField.type === 'currency') {
      return <InputNumber value={currentValue} onChange={onCurrentValueChange} style={{ width: '100%' }} placeholder="请输入数值" />
    }

    if (currentField.type === 'boolean') {
      return (
        <Radio.Group optionType="button" buttonStyle="solid" value={currentValue} onChange={event => onCurrentValueChange(event.target.value)} style={{ width: '100%' }}>
          <Radio.Button value={true} style={{ width: '50%', textAlign: 'center' }}>是</Radio.Button>
          <Radio.Button value={false} style={{ width: '50%', textAlign: 'center' }}>否</Radio.Button>
        </Radio.Group>
      )
    }

    if (currentField.type === 'country') {
      const countries = dictionaryItems.filter(item => item.type === 'country' && item.enabled !== false)
      return (
        <Select showSearch value={currentValue} onChange={onCurrentValueChange} placeholder="请选择国家" optionFilterProp="label" allowClear>
          {countries.map(country => (
            <Option key={country.code} value={country.code} label={getDictionaryItemLabel(country)}>{getDictionaryItemLabel(country)}</Option>
          ))}
        </Select>
      )
    }

    if (currentField.type === 'select' || currentField.type === 'multi_select') {
      const dictionaryOptions = getDictionaryItemsForField(currentField, dictionaryItems)
      const parsedOptions = dictionaryOptions.length ? dictionaryOptions : parseFieldOptions(currentField.options)
      const isMulti = currentField.type === 'multi_select'
      return (
        <Select mode={isMulti ? 'multiple' : undefined} value={currentValue} onChange={onCurrentValueChange} placeholder={`请选择${currentField.display_name}`} allowClear>
          {dictionaryOptions.length ? dictionaryOptions.map(item => (
            <Option key={item.code} value={item.code}>{getDictionaryItemLabel(item)}</Option>
          )) : Array.isArray(parsedOptions) && parsedOptions.map((option: any) => {
            const label = option?.label || option
            return <Option key={label} value={label}>{label}</Option>
          })}
        </Select>
      )
    }

    return <Input placeholder="请输入值" value={currentValue} onChange={event => onCurrentValueChange(event.target.value)} />
  }

  return (
    <Modal
      title="筛选"
      open={visible}
      onCancel={onClose}
      onOk={() => {
        onClose()
        message.success('筛选已应用')
      }}
      width={720}
    >
      <div style={{ marginBottom: 16 }}>
        {Object.entries(filters).map(([fieldName, filter]: [string, any]) => {
          const field = fields.find(f => f.name === fieldName)
          return (
            <div key={fieldName} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
              <span style={{ fontWeight: 500, minWidth: 100 }}>{field?.display_name || fieldName}</span>
              <span style={{ color: '#666' }}>{CONDITION_LABELS[filter.condition] || filter.condition}</span>
              <Tag color="blue">{formatFilterValue(field, filter, dictionaryItems)}</Tag>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => {
                const newFilters = { ...filters }
                delete newFilters[fieldName]
                onFiltersChange(newFilters)
              }} />
            </div>
          )
        })}
      </div>
      <Form layout="vertical">
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 130px 1.4fr auto', gap: 8, alignItems: 'start' }}>
          <Form.Item>
            <Select placeholder="选择字段" value={currentField?.name} onChange={handleFieldChange}>
              {fields.filter(f => f.type !== 'relation' && !f.deleted).map(field => (
                <Option key={field.id || field.name} value={field.name}>{field.display_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Select placeholder="条件" value={currentCondition} onChange={handleConditionChange}>
              {availableConditions.map(condition => <Option key={condition} value={condition}>{CONDITION_LABELS[condition]}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item>
            {renderValueEditor()}
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleAddFilter}>添加</Button>
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}
