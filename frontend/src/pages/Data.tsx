import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import KanbanView from '../components/KanbanView'
import RecordDetail from '../components/RecordDetail'
import EmailModal from '../components/EmailModal'
import { commentApi } from '../api/comment'
import { 
  message, 
  Spin, 
  Button, 
  Space, 
  Drawer, 
  Form, 
  Input, 
  InputNumber,
  Select, 
  Dropdown,
  Modal,
  Tag,
  Checkbox,
  Popover,
  DatePicker,
  Radio,
  Badge,
  Upload
} from 'antd'
import { 
  PlusOutlined, 
  DeleteOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  DownloadOutlined,
  UploadOutlined,
  SortDescendingOutlined,
  GroupOutlined,
  MoreOutlined,
  ClearOutlined,
  EditOutlined,
  ArrowLeftOutlined,
  SettingOutlined,
  LockOutlined,
  EyeInvisibleOutlined,
  MailOutlined,
  BellOutlined
} from '@ant-design/icons'
import { modelApi, Model, Field } from '../api/model'
import { dataApi } from '../api/data'
import { viewConfigApi } from '../api/viewConfig'
import { userApi } from '../api/user'
import { emailApi } from '../api/email'
import type { MenuProps } from 'antd'
import { useAuthStore } from '../stores/authStore'
import { TableView, CalendarView, AddRecordModal, FilterModal, getFieldIcon, getFieldColor } from './data/index'

const { Option } = Select

const Data = () => {
  const { modelName } = useParams<{ modelName: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const [model, setModel] = useState<Model | null>(null)
  const [fields, setFields] = useState<Field[]>([])
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [fieldForm] = Form.useForm()
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<any>('')
  const [originalValue, setOriginalValue] = useState<any>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filterVisible, setFilterVisible] = useState(false)
  const [sortVisible, setSortVisible] = useState(false)
  const [currentField, setCurrentField] = useState<Field | null>(null)
  const [filters, setFilters] = useState<any>({})
  const [sorts, setSorts] = useState<any[]>([])
  const [visibleFields, setVisibleFields] = useState<string[]>([])
  const [fieldConfigVisible, setFieldConfigVisible] = useState(false)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resizing, setResizing] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  
  // 从URL获取视图模式
  const getInitialViewMode = (): 'table' | 'kanban' | 'calendar' => {
    const view = searchParams.get('view')
    if (view === 'kanban' || view === 'calendar') return view
    return 'table'
  }
  
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'calendar'>(getInitialViewMode)
  const [kanbanField, setKanbanField] = useState<string>('')
  const [calendarStartField, setCalendarStartField] = useState<string>('')
  const [calendarEndField, setCalendarEndField] = useState<string>('')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [relationData, setRelationData] = useState<Record<string, any[]>>({})
  const [relationDataPage, setRelationDataPage] = useState<Record<string, number>>({})
  const [relationDataTotal, setRelationDataTotal] = useState<Record<string, number>>({})
  const [relationDataLoading, setRelationDataLoading] = useState<Record<string, boolean>>({})
  const [allModels, setAllModels] = useState<Model[]>([])
  const [relationModalVisible, setRelationModalVisible] = useState(false)
  const [currentRelationField, setCurrentRelationField] = useState<Field | null>(null)
  const [currentRelationRow, setCurrentRelationRow] = useState<any>(null)
  const [selectedRelationIds, setSelectedRelationIds] = useState<string[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [addFieldPopoverVisible, setAddFieldPopoverVisible] = useState(false)
  const [frozenColumns, setFrozenColumns] = useState<number>(0)
  const [currentFilterValue, setCurrentFilterValue] = useState<string>('')
  const [currentFilterCondition, setCurrentFilterCondition] = useState<string>('equals')
  const [currentSortOrder, setCurrentSortOrder] = useState<'asc' | 'desc'>('asc')
  const [recordDetailVisible, setRecordDetailVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState<any>(null)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [addRecordModalVisible, setAddRecordModalVisible] = useState(false)
  const [addRecordForm] = Form.useForm()
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  
  // 邮件相关状态
  const [emailModalVisible, setEmailModalVisible] = useState(false)
  const [currentEmail, setCurrentEmail] = useState<string>('')
  const [emailFilter, setEmailFilter] = useState<string | null>(null)
  const [unreadEmailCount, setUnreadEmailCount] = useState(0)

  // 同步表头和数据行的水平滚动
  const handleHeaderScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }
  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }

  // 是否正在加载视图配置
  const [loadingConfig, setLoadingConfig] = useState(false)
  const initRequestRef = useRef(false) // 防止重复初始化请求

  // 获取未读邮件数量
  const fetchUnreadCount = async () => {
    try {
      const res = await emailApi.getUnreadCount()
      setUnreadEmailCount(res.count || 0)
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  // 加载关联字段数据（分页）
  const loadRelationData = async (field: Field, page: number = 1, pageSize: number = 20) => {
    if (!field.relation_config) return
    
    try {
      setRelationDataLoading(prev => ({ ...prev, [field.name]: true }))
      const config = JSON.parse(field.relation_config)
      const targetModel = allModels.find((m: Model) => m.id === config.target_model_id)
      if (!targetModel) return
      
      const dataRes = await dataApi.list(targetModel.name, page, pageSize)
      
      setRelationData(prev => ({
        ...prev,
        [field.name]: page === 1 ? (dataRes.data || []) : [...(prev[field.name] || []), ...(dataRes.data || [])]
      }))
      setRelationDataPage(prev => ({ ...prev, [field.name]: page }))
      setRelationDataTotal(prev => ({ ...prev, [field.name]: dataRes.total || 0 }))
    } catch (error) {
      console.error('Failed to load relation data:', error)
    } finally {
      setRelationDataLoading(prev => ({ ...prev, [field.name]: false }))
    }
  }

  // 加载更多关联数据
  const loadMoreRelationData = async (field: Field) => {
    const currentPage = relationDataPage[field.name] || 1
    const total = relationDataTotal[field.name] || 0
    const currentData = relationData[field.name] || []
    
    if (currentData.length >= total) return
    await loadRelationData(field, currentPage + 1, 20)
  }

  // 加载模型和视图配置
  useEffect(() => {
    if (!modelName) return
    
    const init = async () => {
      // 防止重复请求
      if (initRequestRef.current) return
      initRequestRef.current = true
      
      setLoading(true)
      setLoadingConfig(true)
      
      // 重置状态
      setModel(null)
      setFields([])
      setData([])
      setVisibleFields([])
      setFilters({})
      setSorts([])
      setRelationData({})
      setFrozenColumns(0)
      setEditingCell(null)
      setEditValue('')
      setConfigLoaded(false)
      setIsInitialLoad(true)
      
      try {
        // 0. 加载用户列表
        const userRes = await userApi.list(1, 100)
        setUsers(userRes.users || [])
        
        // 获取未读邮件数量
        fetchUnreadCount()
        
        // 1. 获取模型列表
        const response = await modelApi.list(1, 100)
        setAllModels(response.models || [])
        
        const foundModel = response.models.find((m: Model) => m.name === modelName)
        if (!foundModel) {
          message.error('模型不存在')
          return
        }
        
        setModel(foundModel)
        const sortedFields = (foundModel.fields || []).sort((a: Field, b: Field) => a.order - b.order)
        setFields(sortedFields)
        
        // 2. 加载视图配置
        let loadedFilters = {}
        let loadedSorts: any[] = []
        let loadedColumnWidths: Record<string, number> = {}
        let loadedFrozenColumns = 0
        let loadedVisibleFields: string[] = []
        let loadedCalendarStart = ''
        let loadedCalendarEnd = ''
        
        try {
          const config = await viewConfigApi.get(foundModel.name, viewMode)
          if (config && config.id) {
            if (config.filters) { try { loadedFilters = JSON.parse(config.filters) } catch (e) {} }
            if (config.sorts) { try { loadedSorts = JSON.parse(config.sorts) } catch (e) {} }
            if (config.column_widths) { try { loadedColumnWidths = JSON.parse(config.column_widths) } catch (e) {} }
            if (typeof config.frozen_columns === 'number') { loadedFrozenColumns = config.frozen_columns }
            if (config.visible_fields) { 
              try { 
                loadedVisibleFields = JSON.parse(config.visible_fields)
              } catch (e) {} 
            }
            if (config.calendar_start) { loadedCalendarStart = config.calendar_start }
            if (config.calendar_end) { loadedCalendarEnd = config.calendar_end }
          }
        } catch (e) {
          console.error('Failed to load view config:', e)
        }
        
        // 一次性设置所有状态
        setFilters(loadedFilters)
        setSorts(loadedSorts)
        setColumnWidths(loadedColumnWidths)
        setFrozenColumns(loadedFrozenColumns)
        if (loadedVisibleFields.length > 0) {
          // 确保所有字段都在visibleFields中（处理新增字段的情况）
          const allFieldIds = sortedFields.map(f => f.id!)
          const missingFieldIds = allFieldIds.filter(id => !loadedVisibleFields.includes(id))
          if (missingFieldIds.length > 0) {
            setVisibleFields([...loadedVisibleFields, ...missingFieldIds])
          } else {
            setVisibleFields(loadedVisibleFields)
          }
        } else {
          setVisibleFields(sortedFields.map(f => f.id!))
        }
        
        // 3. 加载数据（后端会自动附加关联数据和评论统计）
        const dataRes = await dataApi.list(foundModel.name, 1, pageSize, loadedFilters, loadedSorts)
        setData(dataRes.data || [])
        setTotal(dataRes.total || 0)
        setPage(1)
        setHasMore((dataRes.data || []).length < (dataRes.total || 0))
        
        // 从数据中提取评论统计
        if (dataRes.data && dataRes.data.length > 0) {
          const counts: Record<string, number> = {}
          dataRes.data.forEach((row: any) => {
            if (row._comment_count !== undefined) {
              counts[row.id] = row._comment_count
            }
          })
          setCommentCounts(counts)
        }
        
        // 4. 如果是看板视图，自动设置分组字段
        const currentViewMode = getInitialViewMode()
        if (currentViewMode === 'kanban') {
          const selectField = sortedFields.find(f => f.type === 'select' || f.type === 'multi_select')
          if (selectField) {
            setKanbanField(selectField.name)
          }
        }
        
        // 5. 如果是日历视图，设置时间字段（优先使用保存的配置）
        if (currentViewMode === 'calendar') {
          if (loadedCalendarStart) {
            setCalendarStartField(loadedCalendarStart)
            setCalendarEndField(loadedCalendarEnd || loadedCalendarStart)
          } else {
            const dateField = sortedFields.find(f => f.type === 'date')
            if (dateField) {
              setCalendarStartField(dateField.name)
              setCalendarEndField(dateField.name)
            }
          }
        }
        
        setConfigLoaded(true)
        setIsInitialLoad(false)
      } catch (error: any) {
        message.error(error.response?.data?.error || '加载失败')
      } finally {
        setLoading(false)
        setLoadingConfig(false)
        initRequestRef.current = false // 请求完成后重置锁
      }
    }
    
    init()
  }, [modelName, viewMode])

  // 当筛选、排序变化时重新加载数据
  useEffect(() => {
    if (!model || loadingConfig || isInitialLoad) return
    
    const reloadData = async () => {
      setLoading(true)
      try {
        const dataRes = await dataApi.list(model.name, 1, pageSize, filters, sorts)
        setData(dataRes.data || [])
        setTotal(dataRes.total || 0)
        setPage(1)
        setHasMore((dataRes.data || []).length < (dataRes.total || 0))
        
        // 从数据中提取评论统计
        if (dataRes.data && dataRes.data.length > 0) {
          const counts: Record<string, number> = {}
          dataRes.data.forEach((row: any) => {
            if (row._comment_count !== undefined) {
              counts[row.id] = row._comment_count
            }
          })
          setCommentCounts(counts)
        }
      } catch (error: any) {
        message.error(error.response?.data?.error || '加载数据失败')
      } finally {
        setLoading(false)
      }
    }
    
    reloadData()
  }, [filters, sorts])

  // 日历视图：当月份变化时重新加载数据
  useEffect(() => {
    if (!model || viewMode !== 'calendar' || !calendarStartField) return
    
    const loadCalendarData = async () => {
      setLoading(true)
      try {
        // 计算当前月份的开始和结束日期
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
        const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`
        
        // 构建日期范围筛选，使用后端支持的date_range条件
        const calendarFilters = {
          ...filters,
          [calendarStartField]: {
            condition: 'date_range',
            start: startDate,
            end: endDate
          }
        }
        
        // 使用日期范围筛选加载数据
        const dataRes = await dataApi.list(model.name, 1, 100, calendarFilters, sorts)
        setData(dataRes.data || [])
        setTotal(dataRes.total || 0)
        
        // 从数据中提取评论统计
        if (dataRes.data && dataRes.data.length > 0) {
          const counts: Record<string, number> = {}
          dataRes.data.forEach((row: any) => {
            if (row._comment_count !== undefined) {
              counts[row.id] = row._comment_count
            }
          })
          setCommentCounts(counts)
        }
      } catch (error: any) {
        console.error('Failed to load calendar data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadCalendarData()
  }, [model, viewMode, calendarStartField, currentMonth, filters, sorts])

  // 加载更多数据
  const loadMoreData = async () => {
    if (!model || loadingMore || !hasMore) return
    
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const dataRes = await dataApi.list(model.name, nextPage, pageSize, filters, sorts)
      
      // 追加数据
      setData(prev => [...prev, ...(dataRes.data || [])])
      setPage(nextPage)
      setHasMore(data.length + (dataRes.data || []).length < (dataRes.total || 0))
      
      // 追加评论统计
      if (dataRes.data && dataRes.data.length > 0) {
        setCommentCounts(prev => {
          const newCounts = { ...prev }
          dataRes.data.forEach((row: any) => {
            if (row._comment_count !== undefined) {
              newCounts[row.id] = row._comment_count
            }
          })
          return newCounts
        })
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '加载更多失败')
    } finally {
      setLoadingMore(false)
    }
  }

  // 滚动加载更多
  const handleScrollLoadMore = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight
    if (scrollBottom < 100 && hasMore && !loadingMore) {
      loadMoreData()
    }
  }

  // 刷新模型数据
  const fetchModel = async () => {
    if (!modelName) return
    try {
      const response = await modelApi.list(1, 100)
      const foundModel = response.models.find((m: Model) => m.name === modelName)
      if (foundModel) {
        setModel(foundModel)
        const sortedFields = (foundModel.fields || []).sort((a: Field, b: Field) => a.order - b.order)
        setFields(sortedFields)
        // 新添加的字段默认显示
        const newFieldIds = sortedFields.filter(f => !f.deleted).map(f => f.id!)
        setVisibleFields(newFieldIds)
      }
    } catch (error) {
      console.error('Failed to fetch model:', error)
    }
  }

  // 刷新数据
  const fetchData = async () => {
    if (!model) return
    try {
      const dataRes = await dataApi.list(model.name, 1, pageSize, filters, sorts)
      setData(dataRes.data || [])
      setTotal(dataRes.total || 0)
      setPage(1)
      setHasMore((dataRes.data || []).length < (dataRes.total || 0))
    } catch (error) {
      console.error('Failed to fetch data:', error)
    }
  }

  const handleAddField = async (values: any) => {
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

      // 添加字段到模型(用户级别)
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
      setAddFieldPopoverVisible(false)
      setDrawerVisible(false)
      fieldForm.resetFields()
      await fetchModel()
      // 刷新数据以显示新字段
      fetchData()
    } catch (error: any) {
      message.error(error.response?.data?.error || '添加字段失败')
    }
  }

  const handleMoveField = async (index: number, direction: number) => {
    if (!model) return
    
    try {
      const newFields = [...fields]
      const newIndex = index + direction
      
      if (newIndex < 0 || newIndex >= newFields.length) return
      
      // 交换字段顺序
      [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]]
      
      // 更新字段的order属性
      const updatedFields = newFields.map((field, i) => ({
        ...field,
        order: i
      }))
      
      // 逐个更新字段到后端
      for (const field of updatedFields) {
        await modelApi.updateField(model.id, field.id!, {
          name: field.name,
          display_name: field.display_name,
          type: field.type,
          required: field.required,
          unique: field.unique,
          default_value: field.default_value,
          options: field.options,
          order: field.order,
          validation: field.validation || '{}',
          relation_config: field.relation_config || '{}',
        })
      }
      
      message.success('字段顺序已更新')
      // 重新获取模型数据,确保字段按order排序
      await fetchModel()
      fetchData()
    } catch (error: any) {
      message.error(error.response?.data?.error || '更新字段顺序失败')
    }
  }

  const handleAddRow = () => {
    setAddRecordModalVisible(true)
  }

  // Excel模板下载
  const handleDownloadTemplate = () => {
    if (!model || !fields.length) return
    
    // 创建CSV内容
    const visibleFieldsList = fields.filter(f => !f.deleted && f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at')
    const headers = visibleFieldsList.map(f => f.display_name)
    const csvContent = headers.join(',') + '\n'
    
    // 创建Blob并下载
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${model.display_name}_导入模板.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    message.success('模板下载成功')
  }

  // Excel导入
  const handleImportExcel = async (file: File) => {
    if (!model) return false
    
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        message.error('文件内容为空或格式不正确')
        return false
      }
      
      // 解析表头
      const headers = lines[0].split(',').map(h => h.trim())
      const visibleFieldsList = fields.filter(f => !f.deleted && f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at')
      
      // 创建字段名映射
      const fieldMap: Record<string, Field> = {}
      visibleFieldsList.forEach(f => {
        fieldMap[f.display_name] = f
      })
      
      // 解析数据行
      const records: any[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',')
        const record: any = {}
        
        headers.forEach((header, index) => {
          const field = fieldMap[header]
          if (field && values[index] !== undefined) {
            let value = values[index].trim()
            // 处理多选字段
            if (field.type === 'multi_select') {
              value = value.split(';').map(v => v.trim()).filter(Boolean).join(',')
            }
            record[field.name] = value
          }
        })
        
        if (Object.keys(record).length > 0) {
          records.push(record)
        }
      }
      
      // 批量创建记录
      let successCount = 0
      let failCount = 0
      for (const record of records) {
        try {
          await dataApi.create(model.name, record)
          successCount++
        } catch {
          failCount++
        }
      }
      
      message.success(`导入完成: 成功 ${successCount} 条, 失败 ${failCount} 条`)
      fetchData()
      return true
    } catch (error) {
      message.error('导入失败,请检查文件格式')
      return false
    }
  }

  const handleAddRecordSubmit = async (values: any) => {
    if (!model) return
    
    try {
      // 处理日期字段
      const processedValues = { ...values }
      fields.forEach(field => {
        if (field.type === 'date' && processedValues[field.name]) {
          processedValues[field.name] = dayjs(processedValues[field.name]).format('YYYY-MM-DD')
        }
      })
      
      const newRecord = await dataApi.create(model.name, processedValues)
      message.success('添加成功')
      setAddRecordModalVisible(false)
      addRecordForm.resetFields()
      
      // 添加到本地数据
      setData(prev => [newRecord, ...prev])
      setTotal(prev => prev + 1)
    } catch (error: any) {
      message.error(error.response?.data?.error || '添加失败')
    }
  }

  const handleUpdateCell = async (rowId: string, fieldName: string, value: any) => {
    if (!model) return

    // 检查值是否发生变化
    const row = data.find(r => r.id === rowId)
    if (row) {
      const currentValue = row[fieldName]
      // 处理数组比较
      if (Array.isArray(value) && Array.isArray(currentValue)) {
        if (value.length === currentValue.length && value.every(v => currentValue.includes(v))) {
          setEditingCell(null)
          return
        }
      } else if (value === currentValue) {
        setEditingCell(null)
        return
      }
    }

    try {
      // 处理多选值,转换为逗号分隔的字符串
      let saveValue = value
      if (Array.isArray(value)) {
        saveValue = value.join(',')
      }
      
      await dataApi.update(model.name, rowId, { [fieldName]: saveValue })
      message.success('保存成功')
      setEditingCell(null)
      // 更新本地数据
      setData(prev => prev.map(r => r.id === rowId ? { ...r, [fieldName]: saveValue } : r))
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存失败')
    }
  }

  const handleDeleteRow = async (rowId: string) => {
    if (!model) return

    try {
      await dataApi.delete(model.name, rowId)
      message.success('记录删除成功')
      // 更新本地数据
      setData(prev => prev.filter(r => r.id !== rowId))
      setTotal(prev => prev - 1)
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败')
    }
  }

  // 列宽调整相关函数
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
    
    setColumnWidths(prev => ({
      ...prev,
      [resizing]: newWidth
    }))
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

  // 是否已加载配置（避免加载后立即触发保存）
  const [configLoaded, setConfigLoaded] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // 当视图配置变化时保存（仅在配置加载完成后且不是初始加载时）
  useEffect(() => {
    if (!model || !configLoaded || isInitialLoad) {
      return
    }
    
    const saveConfig = async () => {
      try {
        await viewConfigApi.save({
          model_name: model.name,
          view_type: viewMode,
          filters: JSON.stringify(filters),
          sorts: JSON.stringify(sorts),
          column_widths: JSON.stringify(columnWidths),
          frozen_columns: frozenColumns,
          visible_fields: JSON.stringify(visibleFields),
          calendar_start: calendarStartField,
          calendar_end: calendarEndField,
        })
      } catch (error) {
        console.error('Failed to save view config:', error)
      }
    }
    
    const timer = setTimeout(saveConfig, 500)
    return () => clearTimeout(timer)
  }, [filters, sorts, columnWidths, frozenColumns, visibleFields, viewMode, configLoaded, isInitialLoad, model?.id, calendarStartField, calendarEndField])

  const fieldMenu = (field: Field, fieldIndex: number): MenuProps => ({
    items: [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: '编辑字段',
        disabled: field.is_lock,
        onClick: () => {
          if (field.is_lock) return
          setCurrentField(field)
          setDrawerVisible(true)
          // 解析选项
          let optionsText = ''
          if (field.options) {
            try {
              const opts = JSON.parse(field.options)
              if (Array.isArray(opts)) {
                optionsText = opts.join('\n')
              }
            } catch (e) {
              console.error('Failed to parse options:', e)
            }
          }
          
          // 解析关联配置
          let relationTargetModel = ''
          let relationType = 'one_to_many'
          let relationDisplayFields: string[] = []
          if (field.relation_config) {
            try {
              const config = JSON.parse(field.relation_config)
              relationTargetModel = config.target_model_id || ''
              relationType = config.relation_type || 'one_to_many'
              relationDisplayFields = config.display_fields || []
            } catch (e) {
              console.error('Failed to parse relation config:', e)
            }
          }
          
          fieldForm.setFieldsValue({
            display_name: field.display_name,
            type: field.type,
            default_value: field.default_value,
            options: optionsText,
            relation_target_model: relationTargetModel,
            relation_type: relationType,
            relation_display_fields: relationDisplayFields,
          })
        },
      },
      {
        type: 'divider',
      },
      {
        key: 'freeze',
        icon: <LockOutlined />,
        label: frozenColumns > fieldIndex ? '取消冻结' : `冻结到此列`,
        onClick: () => {
          if (frozenColumns > fieldIndex) {
            setFrozenColumns(fieldIndex)
          } else {
            setFrozenColumns(fieldIndex + 1)
          }
          message.success(frozenColumns > fieldIndex ? '已取消冻结' : `已冻结前 ${fieldIndex + 1} 列`)
        },
      },
      {
        key: 'hide',
        icon: <EyeInvisibleOutlined />,
        label: '隐藏字段',
        onClick: () => {
          setVisibleFields(visibleFields.filter(id => id !== field.id))
          message.success('字段已隐藏')
        },
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
            content: `确定要删除字段 "${field.display_name}" 吗?字段将被移至回收站，可以恢复。`,
            onOk: async () => {
              if (!model) return
              try {
                // 标记字段为已删除，而不是真正删除
                await modelApi.updateField(model.id, field.id!, {
                  ...field,
                  deleted: true
                })
                message.success('字段已移至回收站')
                fetchModel()
              } catch (error: any) {
                message.error(error.response?.data?.error || '删除失败')
              }
            },
          })
        },
      },
    ],
  })

  if (loading && !model) {
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
    <>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* 顶部工具栏 */}
      <div style={{
        padding: '12px 24px',
        background: '#fff',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ margin: 0 }}>{model.display_name}</h2>
          <Tag color="blue">{total} 条记录</Tag>
        </div>
        
        <Space>
          <Radio.Group 
            value={viewMode}
            onChange={(e) => {
              const value = e.target.value
              setViewMode(value)
              // 更新URL
              const url = new URL(window.location.href)
              if (value === 'table') {
                url.searchParams.delete('view')
              } else {
                url.searchParams.set('view', value)
              }
              window.history.replaceState({}, '', url.toString())
              // 切换到看板视图时,自动选择第一个单选/多选字段
              if (value === 'kanban' && !kanbanField) {
                const selectField = fields.find(f => f.type === 'select' || f.type === 'multi_select')
                if (selectField) {
                  setKanbanField(selectField.name)
                }
              }
            }}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="table">表格</Radio.Button>
            <Radio.Button value="kanban">看板</Radio.Button>
            <Radio.Button value="calendar">日历</Radio.Button>
          </Radio.Group>
          {viewMode === 'kanban' && (
            <Select
              placeholder="选择分组字段"
              value={kanbanField}
              onChange={(value) => setKanbanField(value)}
              style={{ width: 150 }}
            >
              {fields.filter(f => f.type === 'select' || f.type === 'multi_select').map(field => (
                <Option key={field.id} value={field.name}>{field.display_name}</Option>
              ))}
            </Select>
          )}
          {viewMode === 'calendar' && (
            <>
              <Select
                placeholder="选择时间字段"
                value={calendarStartField}
                onChange={(value) => {
                  setCalendarStartField(value)
                  // 单时间字段时，结束时间也设为相同字段
                  if (!calendarEndField) {
                    setCalendarEndField(value)
                  }
                }}
                style={{ width: 150 }}
              >
                {fields.filter(f => f.type === 'date').map(field => (
                  <Option key={field.id} value={field.name}>{field.display_name}</Option>
                ))}
              </Select>
              <Select
                placeholder="结束时间字段(可选)"
                value={calendarEndField}
                onChange={(value) => setCalendarEndField(value)}
                style={{ width: 150 }}
                allowClear
              >
                {fields.filter(f => f.type === 'date').map(field => (
                  <Option key={field.id} value={field.name}>{field.display_name}</Option>
                ))}
              </Select>
            </>
          )}
          <Button 
            icon={<FilterOutlined />}
            onClick={() => setFilterVisible(true)}
            type={Object.keys(filters).length > 0 ? 'primary' : 'default'}
          >
            筛选 {Object.keys(filters).length > 0 && `(${Object.keys(filters).length})`}
          </Button>
          <Button 
            icon={<SortAscendingOutlined />}
            onClick={() => setSortVisible(true)}
            type={sorts.length > 0 ? 'primary' : 'default'}
          >
            排序 {sorts.length > 0 && `(${sorts.length})`}
          </Button>
          {(Object.keys(filters).length > 0 || sorts.length > 0) && (
            <Button 
              icon={<ClearOutlined />}
              onClick={() => {
                setFilters({})
                setSorts([])
                message.success('已重置筛选和排序')
              }}
            >
              重置
            </Button>
          )}
          <Button 
            icon={<SettingOutlined />}
            onClick={() => setFieldConfigVisible(true)}
          >
            字段配置
          </Button>
          <Button 
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
          >
            下载模板
          </Button>
          <Upload
            accept=".csv"
            showUploadList={false}
            beforeUpload={(file) => {
              handleImportExcel(file)
              return false
            }}
          >
            <Button icon={<UploadOutlined />}>导入数据</Button>
          </Upload>
          <Popover
            content={
              <div style={{ width: 300 }}>
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
                    <Input placeholder="输入字段名称" autoFocus />
                  </Form.Item>
                  <Form.Item
                    label="字段类型"
                    name="type"
                    rules={[{ required: true, message: '请选择字段类型' }]}
                    initialValue="text"
                  >
                    <Select onChange={(value) => {
                      if (value === 'select' || value === 'multi_select') {
                        fieldForm.setFieldsValue({ showOptions: true })
                      } else {
                        fieldForm.setFieldsValue({ showOptions: false })
                      }
                    }}>
                      <Option value="text">单行文本</Option>
                      <Option value="email">邮箱</Option>
                      <Option value="url">链接</Option>
                      <Option value="number">数字</Option>
                      <Option value="select">单选</Option>
                      <Option value="multi_select">多选</Option>
                      <Option value="boolean">复选框</Option>
                      <Option value="date">日期</Option>
                      <Option value="relation">关联</Option>
                      <Option value="user">用户</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
                  >
                    {({ getFieldValue }) => {
                      const type = getFieldValue('type')
                      if (type === 'select' || type === 'multi_select') {
                        return (
                          <Form.Item
                            label="选项列表(每行一个)"
                            name="options"
                            rules={[{ required: true, message: '请输入选项' }]}
                          >
                            <Input.TextArea rows={4} placeholder="选项1&#10;选项2&#10;选项3" />
                          </Form.Item>
                        )
                      }
                      if (type === 'relation') {
                        return (
                          <>
                            <Form.Item
                              label="关联表"
                              name="relation_target_model"
                              rules={[{ required: true, message: '请选择关联表' }]}
                            >
                              <Select placeholder="选择要关联的表">
                                {allModels.map((m: Model) => (
                                  <Option key={m.id} value={m.id}>{m.display_name}</Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <Form.Item
                              label="关联类型"
                              name="relation_type"
                              initialValue="one_to_many"
                            >
                              <Select>
                                <Option value="one_to_one">一对一</Option>
                                <Option value="one_to_many">一对多</Option>
                                <Option value="many_to_many">多对多</Option>
                              </Select>
                            </Form.Item>
                          </>
                        )
                      }
                      return null
                    }}
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button type="primary" htmlType="submit" block>
                      添加字段
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            }
            title="添加字段"
            trigger="click"
            placement="bottomRight"
          >
            <Button icon={<PlusOutlined />}>添加字段</Button>
          </Popover>
        </Space>
      </div>

      {/* 看板视图 */}
      {viewMode === 'kanban' && kanbanField && (
        <KanbanView
          model={model}
          fields={fields}
          data={data}
          kanbanField={kanbanField}
          visibleFields={visibleFields}
          users={users}
          relationData={relationData}
          allModels={allModels}
          onDataChange={() => {
            // 重新加载数据
            const reloadData = async () => {
              if (!model) return
              try {
                const dataRes = await dataApi.list(model.name, 1, pageSize, filters, sorts)
                setData(dataRes.data || [])
                setTotal(dataRes.total || 0)
                setPage(1)
                setHasMore((dataRes.data || []).length < (dataRes.total || 0))
                
                // 更新评论统计
                if (dataRes.data && dataRes.data.length > 0) {
                  const counts: Record<string, number> = {}
                  dataRes.data.forEach((row: any) => {
                    if (row._comment_count !== undefined) {
                      counts[row.id] = row._comment_count
                    }
                  })
                  setCommentCounts(counts)
                }
              } catch (e) {
                console.error('Failed to reload data:', e)
              }
            }
            reloadData()
          }}
        />
      )}

      {/* 日历视图 */}
      {viewMode === 'calendar' && calendarStartField && (
        <CalendarView
          model={model}
          fields={fields}
          data={data}
          users={users}
          visibleFields={visibleFields}
          calendarStartField={calendarStartField}
          calendarEndField={calendarEndField}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onRecordClick={(record) => {
            setCurrentRecord(record)
            setRecordDetailVisible(true)
          }}
        />
      )}

      {/* 数据表格 */}
      {viewMode === 'table' && (
        <TableView
          model={model}
          fields={fields}
          data={data}
          users={users}
          visibleFields={visibleFields}
          frozenColumns={frozenColumns}
          columnWidths={columnWidths}
          resizing={resizing}
          editingCell={editingCell}
          editValue={editValue}
          commentCounts={commentCounts}
          hoveredRow={hoveredRow}
          loadingMore={loadingMore}
          filters={filters}
          sorts={sorts}
          relationData={relationData}
          allModels={allModels}
          onColumnResize={handleMouseDown}
          onCellClick={(row, field) => {
            if (field.type === 'relation') {
              setCurrentRelationField(field)
              setCurrentRelationRow(row)
              const cellValue = row[field.name]
              if (typeof cellValue === 'string' && cellValue) {
                setSelectedRelationIds(cellValue.split(',').filter((id: string) => id.trim()))
              } else {
                setSelectedRelationIds([])
              }
              loadRelationData(field, 1, 20)
              setRelationModalVisible(true)
            } else {
              setEditingCell(`${row.id}-${field.name}`)
              const cellValue = row[field.name]
              if (field.type === 'multi_select' && typeof cellValue === 'string' && cellValue) {
                setEditValue(cellValue.split(','))
              } else {
                setEditValue(cellValue || '')
              }
            }
          }}
          onEditChange={setEditValue}
          onEditBlur={handleUpdateCell}
          onDeleteRow={handleDeleteRow}
          onScroll={handleScrollLoadMore}
          onFieldMenuClick={(field, action) => {
            if (action === 'edit') {
              setCurrentField(field)
              setDrawerVisible(true)
            } else if (action === 'hide') {
              setVisibleFields(visibleFields.filter(id => id !== field.id))
            }
          }}
          onAddRow={handleAddRow}
          onRowHover={setHoveredRow}
          onRecordClick={(row) => {
            setCurrentRecord(row)
            setRecordDetailVisible(true)
          }}
          headerScrollRef={headerScrollRef}
          bodyScrollRef={bodyScrollRef}
        />
      )}

      {/* 添加记录Modal */}
      <Modal
        title="添加记录"
        open={addRecordModalVisible}
        onCancel={() => {
          setAddRecordModalVisible(false)
          addRecordForm.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={addRecordForm}
          layout="vertical"
          onFinish={handleAddRecordSubmit}
        >
          {fields.filter(f => !f.deleted).map(field => (
            <Form.Item
              key={field.id}
              label={field.display_name}
              name={field.name}
            >
              {field.type === 'text' || field.type === 'email' || field.type === 'url' ? (
                <Input placeholder={`请输入${field.display_name}`} />
              ) : field.type === 'number' ? (
                <InputNumber style={{ width: '100%' }} placeholder={`请输入${field.display_name}`} />
              ) : field.type === 'select' ? (
                <Select placeholder={`请选择${field.display_name}`}>
                  {JSON.parse(field.options || '[]').map((opt: string) => (
                    <Option key={opt} value={opt}>{opt}</Option>
                  ))}
                </Select>
              ) : field.type === 'multi_select' ? (
                <Select mode="multiple" placeholder={`请选择${field.display_name}`}>
                  {JSON.parse(field.options || '[]').map((opt: string) => (
                    <Option key={opt} value={opt}>{opt}</Option>
                  ))}
                </Select>
              ) : field.type === 'date' ? (
                <DatePicker style={{ width: '100%' }} />
              ) : field.type === 'boolean' ? (
                <Select>
                  <Option value={true}>是</Option>
                  <Option value={false}>否</Option>
                </Select>
              ) : field.type === 'user' ? (
                <Select placeholder={`请选择${field.display_name}`}>
                  {users.map(user => (
                    <Option key={user.id} value={user.id}>{user.nickname || user.username}</Option>
                  ))}
                </Select>
              ) : field.type === 'relation' ? (
                <Select
                  mode={(() => {
                    try {
                      const config = JSON.parse(field.relation_config || '{}')
                      return config.allow_multiple ? 'multiple' : undefined
                    } catch {
                      return undefined
                    }
                  })()}
                  placeholder={`请选择${field.display_name}`}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {(() => {
                    const records = relationData[field.name] || []
                    const config = JSON.parse(field.relation_config || '{}')
                    const displayFields = config.display_fields || []
                    
                    return records.map((rec: any) => {
                      const label = displayFields.length > 0
                        ? displayFields.map((f: string) => rec[f]).filter(Boolean).join(' - ')
                        : rec.name || rec.id
                      
                      return (
                        <Option key={rec.id} value={rec.id} label={label}>
                          {label}
                        </Option>
                      )
                    })
                  })()}
                </Select>
              ) : (
                <Input placeholder={`请输入${field.display_name}`} />
              )}
            </Form.Item>
          ))}
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              添加
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 筛选Modal */}
      <Modal
        title="筛选"
        open={filterVisible}
        onCancel={() => setFilterVisible(false)}
        onOk={() => {
          setFilterVisible(false)
          message.success('筛选已应用')
        }}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          {Object.entries(filters).map(([fieldName, filter]: [string, any]) => {
            const field = fields.find(f => f.name === fieldName)
            return (
              <div key={fieldName} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
                <span style={{ fontWeight: 500, minWidth: 80 }}>{field?.display_name || fieldName}</span>
                <span style={{ color: '#666' }}>
                  {filter.condition === 'equals' ? '等于' :
                   filter.condition === 'not_equals' ? '不等于' :
                   filter.condition === 'contains' ? '包含' : '不包含'}
                </span>
                <Tag color="blue">{filter.value}</Tag>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => {
                  const newFilters = { ...filters }
                  delete newFilters[fieldName]
                  setFilters(newFilters)
                }} />
              </div>
            )
          })}
        </div>
        <Form layout="vertical">
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item style={{ flex: 1 }}>
              <Select 
                placeholder="选择字段"
                value={currentField?.name}
                onChange={(value) => setCurrentField(fields.find(f => f.name === value) || null)}
              >
                {fields.filter(f => f.type !== 'relation').map(field => (
                  <Option key={field.id} value={field.name}>{field.display_name}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item style={{ width: 100 }}>
              <Select 
                placeholder="条件"
                value={currentFilterCondition}
                onChange={(value) => setCurrentFilterCondition(value)}
              >
                <Option value="equals">等于</Option>
                <Option value="not_equals">不等于</Option>
                <Option value="contains">包含</Option>
                <Option value="not_contains">不包含</Option>
              </Select>
            </Form.Item>
            <Form.Item style={{ flex: 1 }}>
              <Input 
                placeholder="值" 
                value={currentFilterValue}
                onChange={(e) => setCurrentFilterValue(e.target.value)}
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={() => {
                if (currentField && currentFilterValue) {
                  setFilters({
                    ...filters,
                    [currentField.name]: {
                      condition: currentFilterCondition,
                      value: currentFilterValue
                    }
                  })
                  setCurrentFilterValue('')
                  setCurrentField(null)
                }
              }}>
                添加
              </Button>
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 排序Modal */}
      <Modal
        title="排序"
        open={sortVisible}
        onCancel={() => setSortVisible(false)}
        onOk={() => {
          setSortVisible(false)
          message.success('排序已应用')
        }}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          {sorts.map((sort, index) => {
            const field = fields.find(f => f.name === sort.field)
            return (
              <div key={sort.field} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 4 }}>
                <span style={{ color: '#999' }}>{index + 1}.</span>
                <span style={{ fontWeight: 500, flex: 1 }}>{field?.display_name || sort.field}</span>
                <Tag color={sort.order === 'asc' ? 'green' : 'orange'}>
                  {sort.order === 'asc' ? '升序' : '降序'}
                </Tag>
                <Button type="text" size="small" onClick={() => {
                  const newSorts = [...sorts]
                  newSorts[index] = { ...newSorts[index], order: newSorts[index].order === 'asc' ? 'desc' : 'asc' }
                  setSorts(newSorts)
                }}>
                  {sort.order === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                </Button>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => {
                  setSorts(sorts.filter((_, i) => i !== index))
                }} />
              </div>
            )
          })}
        </div>
        <Form layout="vertical">
          <div style={{ display: 'flex', gap: 8 }}>
            <Form.Item style={{ flex: 1 }}>
              <Select 
                placeholder="选择字段"
                value={currentField?.name}
                onChange={(value) => setCurrentField(fields.find(f => f.name === value) || null)}
              >
                {fields.map(field => (
                  <Option key={field.id} value={field.name}>{field.display_name}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item style={{ width: 100 }}>
              <Select 
                placeholder="排序"
                value={currentSortOrder}
                onChange={(value) => setCurrentSortOrder(value)}
              >
                <Option value="asc">升序</Option>
                <Option value="desc">降序</Option>
              </Select>
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={() => {
                if (currentField) {
                  const existingSortIndex = sorts.findIndex(s => s.field === currentField.name)
                  const newSorts = [...sorts]
                  if (existingSortIndex >= 0) {
                    newSorts[existingSortIndex] = { field: currentField.name, order: currentSortOrder }
                  } else {
                    newSorts.push({ field: currentField.name, order: currentSortOrder })
                  }
                  setSorts(newSorts)
                  setCurrentField(null)
                }
              }}>
                添加
              </Button>
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 编辑字段Drawer */}
      <Drawer
        title="编辑字段"
        placement="right"
        width={400}
        onClose={() => {
          setDrawerVisible(false)
          setCurrentField(null)
        }}
        open={drawerVisible && currentField !== null}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setDrawerVisible(false)
                setCurrentField(null)
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
          onFinish={async (values) => {
            if (!model || !currentField) return
            try {
              // 处理选项数据
              let optionsStr = '[]'
              if (values.options) {
                const optionsArray = values.options.split('\n').filter((s: string) => s.trim())
                optionsStr = JSON.stringify(optionsArray)
              }

              // 处理关联配置
              let relationConfigStr = currentField.relation_config || '{}'
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

              await modelApi.updateField(model.id, currentField.id!, {
                name: currentField.name,
                display_name: values.display_name,
                type: values.type,
                required: false,
                unique: false,
                default_value: values.default_value,
                options: optionsStr,
                order: currentField.order,
                validation: '{}',
                relation_config: relationConfigStr,
              })
              message.success('字段更新成功')
              setDrawerVisible(false)
              setCurrentField(null)
              fetchModel()
            } catch (error: any) {
              message.error(error.response?.data?.error || '更新失败')
            }
          }}
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
            <Select onChange={(value) => {
              // 触发表单更新以显示/隐藏选项输入框
              fieldForm.setFieldsValue({ type: value })
            }}>
              <Option value="text">单行文本</Option>
              <Option value="email">邮箱</Option>
              <Option value="url">链接</Option>
              <Option value="number">数字</Option>
              <Option value="select">单选</Option>
              <Option value="multi_select">多选</Option>
              <Option value="boolean">复选框</Option>
              <Option value="date">日期</Option>
              <Option value="relation">关联</Option>
              <Option value="user">用户</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type')
              if (type === 'select' || type === 'multi_select') {
                return (
                  <Form.Item
                    label="选项(每行一个)"
                    name="options"
                  >
                    <Input.TextArea 
                      rows={4} 
                      placeholder="选项1&#10;选项2&#10;选项3"
                    />
                  </Form.Item>
                )
              }
              if (type === 'relation') {
                return (
                  <>
                    <Form.Item
                      label="关联表"
                      name="relation_target_model"
                    >
                      <Select placeholder="选择要关联的表" onChange={(value) => {
                        fieldForm.setFieldsValue({ relation_display_fields: [] })
                      }}>
                        {allModels.map((m: Model) => (
                          <Option key={m.id} value={m.id}>{m.display_name}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      label="关联类型"
                      name="relation_type"
                    >
                      <Select>
                        <Option value="one_to_one">一对一</Option>
                        <Option value="one_to_many">一对多</Option>
                        <Option value="many_to_many">多对多</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prevValues, currentValues) => prevValues.relation_target_model !== currentValues.relation_target_model}
                    >
                      {({ getFieldValue }) => {
                        const targetModelId = getFieldValue('relation_target_model')
                        const targetModel = allModels.find((m: Model) => m.id === targetModelId)
                        const targetFields = targetModel?.fields?.filter(f => !f.deleted) || []
                        return (
                          <Form.Item
                            label="显示字段"
                            name="relation_display_fields"
                            tooltip="选择关联记录时显示哪些字段"
                          >
                            <Select mode="multiple" placeholder="选择要显示的字段" allowClear>
                              {targetFields.map(f => (
                                <Option key={f.id} value={f.name}>{f.display_name}</Option>
                              ))}
                            </Select>
                          </Form.Item>
                        )
                      }}
                    </Form.Item>
                  </>
                )
              }
              return null
            }}
          </Form.Item>

          <Form.Item
            label="默认值"
            name="default_value"
          >
            <Input placeholder="输入默认值" />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 关联字段选择Modal */}
      <Modal
        title={`选择${currentRelationField?.display_name || '关联记录'}`}
        open={relationModalVisible}
        onCancel={() => {
          setRelationModalVisible(false)
          setCurrentRelationField(null)
          setCurrentRelationRow(null)
          setSelectedRelationIds([])
        }}
        onOk={() => {
          if (currentRelationField && currentRelationRow) {
            const saveValue = selectedRelationIds.join(',')
            handleUpdateCell(currentRelationRow.id, currentRelationField.name, saveValue)
          }
          setRelationModalVisible(false)
          setCurrentRelationField(null)
          setCurrentRelationRow(null)
          setSelectedRelationIds([])
        }}
        width={800}
      >
        <div>
          <Input.Search
            placeholder="搜索记录..."
            style={{ marginBottom: 16 }}
            onChange={(e) => {
              // 搜索功能可以后续实现
            }}
          />
          <div 
            style={{ maxHeight: 400, overflow: 'auto' }}
            onScroll={(e) => {
              const target = e.target as HTMLDivElement
              if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
                // 滚动到底部时加载更多
                if (currentRelationField && !relationDataLoading[currentRelationField.name]) {
                  loadMoreRelationData(currentRelationField)
                }
              }
            }}
          >
            {(() => {
              if (!currentRelationField) return null
              const records = relationData[currentRelationField.name] || []
              const config = JSON.parse(currentRelationField.relation_config || '{}')
              const allowMultiple = config.allow_multiple
              const isLoading = relationDataLoading[currentRelationField.name]
              const total = relationDataTotal[currentRelationField.name] || 0
              
              // 获取关联表的字段定义
              const targetModelId = config.target_model_id
              const targetModel = allModels.find((m: Model) => m.id === targetModelId)
              const targetFields = targetModel?.fields || []
              
              // 优先使用配置的显示字段，否则显示所有非系统字段
              const configuredDisplayFields = config.display_fields || []
              const displayFields = configuredDisplayFields.length > 0
                ? targetFields.filter(f => configuredDisplayFields.includes(f.name))
                : targetFields.filter(f => 
                    f.name !== 'id' && 
                    f.name !== 'created_at' && 
                    f.name !== 'updated_at'
                  )
              
              return (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
                        <th style={{ width: 40, padding: '12px 8px', textAlign: 'center', position: 'sticky', left: 0, background: '#fafafa', zIndex: 1 }}>
                          {allowMultiple ? '多选' : '单选'}
                        </th>
                        {displayFields.map(field => (
                          <th key={field.id} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, minWidth: 120, whiteSpace: 'nowrap' }}>
                            {field.display_name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record: any) => {
                        const isSelected = selectedRelationIds.includes(record.id)
                        return (
                          <tr
                            key={record.id}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? '#e6f7ff' : '#fff',
                              transition: 'background 0.2s',
                            }}
                            onClick={() => {
                              if (allowMultiple) {
                                if (isSelected) {
                                  setSelectedRelationIds(prev => prev.filter(id => id !== record.id))
                                } else {
                                  setSelectedRelationIds(prev => [...prev, record.id])
                                }
                              } else {
                                setSelectedRelationIds([record.id])
                              }
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = '#f5f5f5'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = '#fff'
                              }
                            }}
                          >
                            <td style={{ padding: '12px 8px', textAlign: 'center', borderBottom: '1px solid #f0f0f0', position: 'sticky', left: 0, background: isSelected ? '#e6f7ff' : '#fff', zIndex: 1 }}>
                              {allowMultiple ? (
                                <Checkbox checked={isSelected} />
                              ) : (
                                <div style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: '50%',
                                  border: '2px solid',
                                  borderColor: isSelected ? '#1890ff' : '#d9d9d9',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  {isSelected && (
                                    <div style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      background: '#1890ff',
                                    }} />
                                  )}
                                </div>
                              )}
                            </td>
                            {displayFields.map(field => (
                              <td key={field.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' }}>
                                {record[field.name] || '-'}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                      {isLoading && (
                        <tr>
                          <td colSpan={displayFields.length + 1} style={{ textAlign: 'center', padding: 16 }}>
                            <Spin size="small" />
                          </td>
                        </tr>
                      )}
                      {!isLoading && records.length === 0 && (
                        <tr>
                          <td colSpan={displayFields.length + 1} style={{ textAlign: 'center', padding: 16, color: '#999' }}>
                            暂无数据
                          </td>
                        </tr>
                      )}
                      {!isLoading && records.length > 0 && records.length < total && (
                        <tr>
                          <td colSpan={displayFields.length + 1} style={{ textAlign: 'center', padding: 8, color: '#999' }}>
                            已加载 {records.length} / {total} 条
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
          {selectedRelationIds.length > 0 && (
            <div style={{ marginTop: 16, padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
              已选择 {selectedRelationIds.length} 条记录
            </div>
          )}
        </div>
      </Modal>

      {/* 字段配置Drawer */}
      <Drawer
        title="字段配置"
        placement="right"
        width={300}
        onClose={() => setFieldConfigVisible(false)}
        open={fieldConfigVisible}
      >
        <div style={{ marginBottom: 16 }}>
          <Button 
            type="primary" 
            block
            onClick={() => setVisibleFields(fields.map(f => f.id!))}
          >
            显示全部
          </Button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Button 
            block
            onClick={() => setVisibleFields([])}
          >
            隐藏全部
          </Button>
        </div>
        <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: 16 }}>
          {fields.map((field, index) => (
            <div 
              key={field.id}
              style={{
                padding: '8px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'move',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center' }}>
                <Button
                  type="text"
                  size="small"
                  disabled={index === 0}
                  onClick={() => handleMoveField(index, -1)}
                  style={{ 
                    padding: 0, 
                    minWidth: 24, 
                    height: 20, 
                    lineHeight: '20px', 
                    fontSize: 16,
                    color: index === 0 ? '#d9d9d9' : '#666',
                  }}
                >
                  ↑
                </Button>
                <Button
                  type="text"
                  size="small"
                  disabled={index === fields.length - 1}
                  onClick={() => handleMoveField(index, 1)}
                  style={{ 
                    padding: 0, 
                    minWidth: 24, 
                    height: 20, 
                    lineHeight: '20px', 
                    fontSize: 16,
                    color: index === fields.length - 1 ? '#d9d9d9' : '#666',
                  }}
                >
                  ↓
                </Button>
              </div>
              <Checkbox
                checked={visibleFields.includes(field.id!)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setVisibleFields([...visibleFields, field.id!])
                  } else {
                    setVisibleFields(visibleFields.filter(id => id !== field.id))
                  }
                }}
              />
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
              <span>{field.display_name}</span>
            </div>
          ))}
        </div>
      </Drawer>

      {/* 记录详情 */}
      <RecordDetail
        visible={recordDetailVisible}
        record={currentRecord}
        model={model}
        fields={fields}
        onClose={() => {
          setRecordDetailVisible(false)
          setCurrentRecord(null)
        }}
        onUpdate={() => {
          fetchData()
        }}
      />

      {/* 邮件Modal */}
      <EmailModal
        visible={emailModalVisible}
        email={currentEmail}
        onClose={() => setEmailModalVisible(false)}
        onFilterChange={(email) => {
          setEmailFilter(email)
          if (email) {
            // 找到email字段并设置筛选
            const emailField = fields.find(f => f.type === 'email')
            if (emailField) {
              setFilters({
                ...filters,
                [emailField.name]: {
                  condition: 'equals',
                  value: email
                }
              })
            }
          } else {
            // 清除email筛选
            const emailField = fields.find(f => f.type === 'email')
            if (emailField) {
              const newFilters = { ...filters }
              delete newFilters[emailField.name]
              setFilters(newFilters)
            }
            // 清空当前邮件
            setCurrentEmail('')
          }
        }}
      />
    </div>
    </>
  )
}

export default Data
