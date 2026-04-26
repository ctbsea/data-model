import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import KanbanView from '../components/KanbanView'
import RecordDetail from '../components/RecordDetail'
import EmailModal from '../components/EmailModal'
import { RecordFormModal } from './data/components/RecordFormModal'
import { AutomationModal } from './data/components/AutomationModal'
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
  ThunderboltOutlined,
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
import {
  TableView,
  CalendarView,
  AddRecordModal,
  FilterModal,
  getFieldIcon,
  getFieldColor,
  AddFieldPopover,
  EditFieldDrawer,
  FieldModal,
  FieldConfigDrawer,
  RelationSelectModal,
  AddRecordModalComponent,
  FilterModalComponent,
  SortModalComponent,
  FieldEditor,
  FieldDisplay,
  useDataState,
  useEditState,
  useFilterSortState,
  useViewState,
  useTableState,
  useRelationState,
  createRecord,
  updateRecord,
  deleteRecord,
  batchDeleteRecords,
  exportToCSV,
  importFromCSV
} from './data/index'

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
  const [automationModalVisible, setAutomationModalVisible] = useState(false)
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

        // 检查是否有 email 字段,有才获取未读邮件数量
        const hasEmailField = sortedFields.some((f: Field) => f.type === 'email')
        if (hasEmailField) {
          fetchUnreadCount()
        }
        
        // 2. 加载视图配置
        let loadedFilters = {}
        let loadedSorts: any[] = []
        let loadedColumnWidths: Record<string, number> = {}
        let loadedFrozenColumns = 0
        let loadedVisibleFields: string[] = []
        let loadedCalendarStart = ''
        let loadedCalendarEnd = ''
        
        try {
          const currentViewMode = getInitialViewMode()
          const config = await viewConfigApi.get(foundModel.name, currentViewMode)
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

  // 导出数据（按筛选条件）
  const handleExportData = () => {
    if (!model || !fields.length || !data.length) {
      message.warning('暂无数据可导出')
      return
    }
    
    // 获取可见字段
    const visibleFieldsList = fields.filter(f => !f.deleted && f.name !== 'id' && f.name !== 'created_at' && f.name !== 'updated_at')
    const headers = visibleFieldsList.map(f => f.display_name)
    
    // 构建CSV内容
    const rows = data.map(row => {
      return visibleFieldsList.map(field => {
        const value = row[field.name]
        if (value === null || value === undefined) return ''
        
        let displayValue = value
        
        // 处理用户字段
        if (field.type === 'user' && value) {
          const user = users.find((u: any) => u.id === value)
          if (user) {
            displayValue = user.nickname || user.username
          }
        }
        
        // 处理关联字段
        if (field.type === 'relation' && field.relation_config) {
          try {
            const config = JSON.parse(field.relation_config)
            const displayFields = config.display_fields || []
            const relationDataField = row[field.name + '_data']
            
            if (relationDataField) {
              if (Array.isArray(relationDataField)) {
                displayValue = relationDataField.map((item: any) => {
                  return displayFields.length > 0
                    ? displayFields.map((f: string) => item[f]).filter(Boolean).join(' - ')
                    : item.name || item.id
                }).join(', ')
              } else {
                displayValue = displayFields.length > 0
                  ? displayFields.map((f: string) => relationDataField[f]).filter(Boolean).join(' - ')
                  : relationDataField.name || relationDataField.id
              }
            }
          } catch {}
        }
        
        // 处理多选字段
        if (field.type === 'multi_select' && value) {
          const values = Array.isArray(value) ? value : String(value).split(',')
          displayValue = values.map((v: string) => v.trim()).join(', ')
        }
        
        // 处理包含逗号或换行的值
        const strValue = String(displayValue)
        if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
          return `"${strValue.replace(/"/g, '""')}"`
        }
        return strValue
      }).join(',')
    })
    
    const csvContent = headers.join(',') + '\n' + rows.join('\n')
    
    // 创建Blob并下载
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${model.display_name}_导出数据.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    message.success(`成功导出 ${data.length} 条数据`)
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

  // 当编辑字段时，设置表单值
  useEffect(() => {
    if (currentField && drawerVisible) {
      // 解析选项
      let optionsText = ''
      if (currentField.options) {
        try {
          const opts = JSON.parse(currentField.options)
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
      if (currentField.relation_config) {
        try {
          const config = JSON.parse(currentField.relation_config)
          relationTargetModel = config.target_model_id || ''
          relationType = config.relation_type || 'one_to_many'
          relationDisplayFields = config.display_fields || []
        } catch (e) {
          console.error('Failed to parse relation config:', e)
        }
      }
      
      fieldForm.setFieldsValue({
        display_name: currentField.display_name,
        type: currentField.type,
        default_value: currentField.default_value,
        options: optionsText,
        relation_target_model: relationTargetModel,
        relation_type: relationType,
        relation_display_fields: relationDisplayFields,
      })
    }
  }, [currentField, drawerVisible])

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
            onChange={async (e) => {
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
              // 切换到日历视图时,加载日历视图配置
              if (value === 'calendar' && model) {
                try {
                  const config = await viewConfigApi.get(model.name, 'calendar')
                  if (config && config.id) {
                    if (config.calendar_start) {
                      setCalendarStartField(config.calendar_start)
                      setCalendarEndField(config.calendar_end || config.calendar_start)
                    } else {
                      // 没有保存的配置,使用默认值
                      const dateField = fields.find(f => f.type === 'date')
                      if (dateField) {
                        setCalendarStartField(dateField.name)
                        setCalendarEndField(dateField.name)
                      }
                    }
                  }
                } catch (e) {
                  console.error('Failed to load calendar config:', e)
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
            icon={<PlusOutlined />}
            onClick={() => setAddFieldPopoverVisible(true)}
          >
            添加字段
          </Button>
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
        <>
          {/* 表格工具栏 */}
          <div style={{ padding: '8px 24px', background: '#fff', borderBottom: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <Button icon={<DownloadOutlined />}
              onClick={handleExportData}
            >
              导出数据
            </Button>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => setAutomationModalVisible(true)}
            >
              自动化
            </Button>
            {Object.keys(filters).length > 0 && (
              <Tag color="blue">已应用筛选条件</Tag>
            )}
          </div>
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
            } else if (action === 'freeze') {
              const fieldIndex = fields.filter(f => !f.deleted && visibleFields.includes(f.id!)).findIndex(f => f.id === field.id)
              if (fieldIndex >= 0) {
                if (frozenColumns > fieldIndex) {
                  setFrozenColumns(fieldIndex)
                  message.success('已取消冻结')
                } else {
                  setFrozenColumns(fieldIndex + 1)
                  message.success(`已冻结前 ${fieldIndex + 1} 列`)
                }
              }
            }
          }}
          onAddRow={handleAddRow}
          onRowHover={setHoveredRow}
          onRecordClick={(row) => {
            setCurrentRecord(row)
            setRecordDetailVisible(true)
          }}
          onEmailClick={(email) => {
            setCurrentEmail(email)
            setEmailModalVisible(true)
          }}
          headerScrollRef={headerScrollRef}
          bodyScrollRef={bodyScrollRef}
        />
        </>
      )}

      {/* 添加记录 - 复用 RecordDetail */}
      <RecordDetail
        visible={addRecordModalVisible}
        record={null}
        model={model}
        fields={fields}
        onClose={() => {
          setAddRecordModalVisible(false)
        }}
        onUpdate={() => {
          fetchData()
        }}
      />

      {/* 筛选Modal */}
      <FilterModalComponent
        visible={filterVisible}
        fields={fields}
        filters={filters}
        currentField={currentField}
        currentCondition={currentFilterCondition}
        currentValue={currentFilterValue}
        onFiltersChange={setFilters}
        onCurrentFieldChange={setCurrentField}
        onCurrentConditionChange={setCurrentFilterCondition}
        onCurrentValueChange={setCurrentFilterValue}
        onClose={() => setFilterVisible(false)}
      />

      {/* 排序Modal */}
      <SortModalComponent
        visible={sortVisible}
        fields={fields}
        sorts={sorts}
        currentField={currentField}
        currentOrder={currentSortOrder}
        onSortsChange={setSorts}
        onCurrentFieldChange={setCurrentField}
        onCurrentOrderChange={setCurrentSortOrder}
        onClose={() => setSortVisible(false)}
      />

      {/* 添加字段Modal */}
      <FieldModal
        model={model}
        field={null}
        visible={addFieldPopoverVisible}
        onClose={() => setAddFieldPopoverVisible(false)}
        onSuccess={() => {
          fetchModel()
          fetchData()
        }}
        fields={fields}
      />

      {/* 编辑字段Modal */}
      <FieldModal
        model={model}
        field={currentField}
        visible={drawerVisible && currentField !== null}
        onClose={() => {
          setDrawerVisible(false)
          setCurrentField(null)
        }}
        onSuccess={fetchModel}
      />

      {/* 关联字段选择Modal */}
      <RelationSelectModal
        visible={relationModalVisible}
        field={currentRelationField}
        row={currentRelationRow}
        selectedIds={selectedRelationIds}
        relationData={relationData}
        relationDataLoading={relationDataLoading}
        relationDataTotal={relationDataTotal}
        allModels={allModels}
        onSelectIds={setSelectedRelationIds}
        onClose={() => {
          setRelationModalVisible(false)
          setCurrentRelationField(null)
          setCurrentRelationRow(null)
          setSelectedRelationIds([])
        }}
        onConfirm={(value) => {
          if (currentRelationField && currentRelationRow) {
            handleUpdateCell(currentRelationRow.id, currentRelationField.name, value)
          }
        }}
        onLoadMore={loadMoreRelationData}
      />

      {/* 字段配置Drawer */}
      <FieldConfigDrawer
        visible={fieldConfigVisible}
        onClose={() => setFieldConfigVisible(false)}
        fields={fields}
        visibleFields={visibleFields}
        onVisibleFieldsChange={setVisibleFields}
        onMoveField={handleMoveField}
      />

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

      {/* 自动化Modal */}
      <AutomationModal
        visible={automationModalVisible}
        modelId={model?.id || ''}
        modelName={model?.display_name || ''}
        fields={fields}
        onClose={() => setAutomationModalVisible(false)}
      />
    </div>
    </>
  )
}

export default Data
