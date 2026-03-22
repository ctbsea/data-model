import dayjs from 'dayjs'
import { Field } from '../../api/model'

// 获取字段图标
export const getFieldIcon = (type: string) => {
  const iconMap: Record<string, string> = {
    text: 'A',
    number: '#',
    select: '○',
    boolean: '☑',
    date: '📅',
    email: '@',
    url: '🔗',
  }
  return iconMap[type] || 'A'
}

// 获取字段颜色
export const getFieldColor = (type: string) => {
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

// 格式化日期
export const formatDate = (date: any): string => {
  try {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return date
  }
}

// 处理字段值显示
export const formatFieldValue = (field: Field, value: any, users: any[] = []): any => {
  if (value === null || value === undefined || value === '') {
    return '点击编辑'
  }

  switch (field.type) {
    case 'date':
      return formatDate(value)
    case 'boolean':
      return value ? '是' : '否'
    case 'user':
      const user = users.find((u: any) => u.id === value)
      return user ? user.nickname || user.username : value
    default:
      return value
  }
}

// 解析选项
export const parseOptions = (optionsStr: string): string[] => {
  try {
    return JSON.parse(optionsStr || '[]')
  } catch {
    return []
  }
}

// 解析关联配置
export const parseRelationConfig = (configStr: string) => {
  try {
    return JSON.parse(configStr || '{}')
  } catch {
    return {}
  }
}

// 颜色数组
export const TAG_COLORS = ['blue', 'green', 'orange', 'purple', 'cyan', 'magenta', 'red', 'gold', 'lime', 'geekblue']
