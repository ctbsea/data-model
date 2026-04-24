// 数据操作相关函数
import { dataApi } from '../../api/data'
import { message } from 'antd'

// 创建数据
export const createRecord = async (
  modelName: string,
  record: any,
  onSuccess: (id: string) => void
) => {
  try {
    const id = await dataApi.create(modelName, record)
    message.success('创建成功')
    onSuccess(id)
    return id
  } catch (error: any) {
    message.error(error.response?.data?.error || '创建失败')
    throw error
  }
}

// 更新数据
export const updateRecord = async (
  modelName: string,
  id: string,
  updates: any,
  onSuccess?: () => void
) => {
  try {
    await dataApi.update(modelName, id, updates)
    message.success('更新成功')
    onSuccess?.()
  } catch (error: any) {
    message.error(error.response?.data?.error || '更新失败')
    throw error
  }
}

// 删除数据
export const deleteRecord = async (
  modelName: string,
  id: string,
  onSuccess?: () => void
) => {
  try {
    await dataApi.delete(modelName, id)
    message.success('删除成功')
    onSuccess?.()
  } catch (error: any) {
    message.error(error.response?.data?.error || '删除失败')
    throw error
  }
}

// 批量删除
export const batchDeleteRecords = async (
  modelName: string,
  ids: string[],
  onSuccess?: () => void
) => {
  try {
    await dataApi.batchDelete(modelName, ids)
    message.success(`成功删除 ${ids.length} 条记录`)
    onSuccess?.()
  } catch (error: any) {
    message.error(error.response?.data?.error || '批量删除失败')
    throw error
  }
}

// 批量更新
export const batchUpdateRecords = async (
  modelName: string,
  updates: Array<{ id: string; data: any }>,
  onSuccess?: () => void
) => {
  try {
    await dataApi.batchUpdate(modelName, updates)
    message.success(`成功更新 ${updates.length} 条记录`)
    onSuccess?.()
  } catch (error: any) {
    message.error(error.response?.data?.error || '批量更新失败')
    throw error
  }
}

// 导出数据为 CSV
export const exportToCSV = (
  data: any[],
  fields: any[],
  filename: string = 'data.csv'
) => {
  const headers = fields.map(f => f.display_name || f.name).join(',')
  const rows = data.map(row => {
    return fields.map(field => {
      let value = row[field.name]
      if (value === null || value === undefined) return ''
      if (typeof value === 'object') value = JSON.stringify(value)
      // 转义逗号和引号
      value = String(value).replace(/"/g, '""')
      return `"${value}"`
    }).join(',')
  })
  
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

// 从 CSV 导入数据
export const importFromCSV = (
  file: File,
  fields: any[],
  onImport: (data: any[]) => void
) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string
      const lines = text.split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const record: any = {}
        fields.forEach((field, index) => {
          const headerIndex = headers.findIndex(h => 
            h === field.display_name || h === field.name
          )
          if (headerIndex >= 0 && values[headerIndex]) {
            record[field.name] = values[headerIndex]
          }
        })
        return record
      }).filter(r => Object.keys(r).length > 0)
      
      onImport(data)
      message.success(`成功解析 ${data.length} 条记录`)
    } catch (error) {
      message.error('CSV 解析失败')
    }
  }
  reader.readAsText(file)
}
