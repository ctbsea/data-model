import { useState, useEffect, useRef } from 'react'
import { message } from 'antd'
import { modelApi, Model, Field } from '../../api/model'
import { dataApi } from '../../api/data'
import { viewConfigApi } from '../../api/viewConfig'
import { userApi } from '../../api/user'

// 数据加载Hook
export const useDataLoader = (modelName: string | undefined, pageSize: number = 20) => {
  const [model, setModel] = useState<Model | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [allModels, setAllModels] = useState<Model[]>([])
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  
  const initRequestRef = useRef(false)

  // 加载模型
  const fetchModel = async () => {
    if (!modelName) return
    try {
      const response = await modelApi.list(1, 100)
      const foundModel = response.models.find((m: Model) => m.name === modelName)
      if (foundModel) {
        setModel(foundModel)
        const sortedFields = (foundModel.fields || []).sort((a: Field, b: Field) => (a.order ?? 0) - (b.order ?? 0))
        setFields(sortedFields)
      }
    } catch (error) {
      console.error('Failed to fetch model:', error)
    }
  }

  // 加载数据
  const fetchData = async (filters: any = {}, sorts: any[] = []) => {
    if (!model) return
    try {
      const dataRes = await dataApi.list(model.name, 1, pageSize, filters, sorts)
      setData(dataRes.data || [])
      setTotal(dataRes.total || 0)
      setPage(1)
      setHasMore((dataRes.data || []).length < (dataRes.total || 0))
      
      // 提取评论统计
      if (dataRes.data && dataRes.data.length > 0) {
        const counts: Record<string, number> = {}
        dataRes.data.forEach((row: any) => {
          if (row._comment_count !== undefined) {
            counts[row.id] = row._comment_count
          }
        })
        setCommentCounts(counts)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    }
  }

  // 加载更多
  const loadMore = async (filters: any = {}, sorts: any[] = []) => {
    if (!model || loadingMore || !hasMore) return
    
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const dataRes = await dataApi.list(model.name, nextPage, pageSize, filters, sorts)
      setData(prev => [...prev, ...(dataRes.data || [])])
      setPage(nextPage)
      setHasMore(data.length + (dataRes.data || []).length < (dataRes.total || 0))
    } catch (error: any) {
      message.error(error.response?.data?.error || '加载更多失败')
    } finally {
      setLoadingMore(false)
    }
  }

  // 初始化
  useEffect(() => {
    if (!modelName) return

    const init = async () => {
      if (initRequestRef.current) return
      initRequestRef.current = true
      
      setLoading(true)
      try {
        // 加载用户
        const userRes = await userApi.list(1, 100)
        setUsers(userRes.users || [])
        
        // 加载模型列表
        const response = await modelApi.list(1, 100)
        setAllModels(response.models || [])
        
        // 加载当前模型
        const foundModel = response.models.find((m: Model) => m.name === modelName)
        if (!foundModel) {
          message.error('模型不存在')
          return
        }
        
        setModel(foundModel)
        const sortedFields = (foundModel.fields || []).sort((a: Field, b: Field) => (a.order ?? 0) - (b.order ?? 0))
        setFields(sortedFields)
        
        // 加载数据
        const dataRes = await dataApi.list(foundModel.name, 1, pageSize)
        setData(dataRes.data || [])
        setTotal(dataRes.total || 0)
        setHasMore((dataRes.data || []).length < (dataRes.total || 0))
      } catch (error: any) {
        message.error(error.response?.data?.error || '加载失败')
      } finally {
        setLoading(false)
        initRequestRef.current = false
      }
    }

    init()
  }, [modelName])

  return {
    model,
    setModel,
    fields,
    setFields,
    data,
    setData,
    loading,
    setLoading,
    total,
    setTotal,
    page,
    hasMore,
    loadingMore,
    users,
    allModels,
    commentCounts,
    setCommentCounts,
    fetchModel,
    fetchData,
    loadMore,
  }
}

// 列宽调整Hook
export const useColumnResize = () => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resizing, setResizing] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)

  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const currentWidth = columnWidths[fieldId] || 200
    setResizing(fieldId)
    setResizeStartX(e.clientX)
    setResizeStartWidth(currentWidth)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!resizing) return
    const diff = e.clientX - resizeStartX
    const newWidth = Math.max(100, Math.min(500, resizeStartWidth + diff))
    setColumnWidths(prev => ({ ...prev, [resizing]: newWidth }))
  }

  const handleMouseUp = () => {
    setResizing(null)
    setResizeStartX(0)
    setResizeStartWidth(0)
  }

  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [resizing, resizeStartX, resizeStartWidth])

  return {
    columnWidths,
    setColumnWidths,
    resizing,
    handleMouseDown,
  }
}
