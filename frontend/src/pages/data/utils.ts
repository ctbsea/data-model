import dayjs from 'dayjs'
import { Field } from '../../api/model'

// 鑾峰彇瀛楁鍥炬爣
export const getFieldIcon = (type: string) => {
  const iconMap: Record<string, string> = {
    text: 'A',
    textarea: 'T',
    number: '#',
    currency: '¥',
    select: '●',
    multi_select: '◉',
    boolean: '☑',
    date: '📅',
    datetime: '🕒',
    email: '@',
    phone: '☎',
    url: '🔗',
    file: '📎',
    image: '🖼',
    country: '🌐',
    relation: '↔',
    user: '👤',
  }
  return iconMap[type] || 'A'
}

export const getFieldColor = (type: string) => {
  const colorMap: Record<string, string> = {
    text: '#1890ff',
    textarea: '#1890ff',
    number: '#52c41a',
    currency: '#faad14',
    select: '#fa8c16',
    multi_select: '#fa8c16',
    boolean: '#722ed1',
    date: '#eb2f96',
    datetime: '#eb2f96',
    email: '#13c2c2',
    phone: '#13c2c2',
    url: '#2f54eb',
    file: '#8c8c8c',
    image: '#fa541c',
    country: '#1677ff',
    relation: '#722ed1',
    user: '#2f54eb',
  }
  return colorMap[type] || '#8c8c8c'
}
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

export const formatFieldValue = (field: Field, value: any, users: any[] = []): any => {
  if (value === null || value === undefined || value === '') {
    return '点击编辑'
  }

  switch (field.type) {
    case 'date':
      return formatDate(value)
    case 'boolean':
      return value ? '是' : '否'
    case 'currency':
      return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    case 'user':
      const user = users.find((u: any) => u.id === value)
      return user ? user.nickname || user.username : value
    default:
      return value
  }
}
// 瑙ｆ瀽閫夐」
export const parseOptions = (optionsStr: string): string[] => {
  try {
    return JSON.parse(optionsStr || '[]')
  } catch {
    return []
  }
}

// 瑙ｆ瀽鍏宠仈閰嶇疆
export const parseRelationConfig = (configStr: string) => {
  try {
    return JSON.parse(configStr || '{}')
  } catch {
    return {}
  }
}

// 棰滆壊鏁扮粍
export const TAG_COLORS = ['blue', 'green', 'orange', 'purple', 'cyan', 'magenta', 'red', 'gold', 'lime', 'geekblue']



