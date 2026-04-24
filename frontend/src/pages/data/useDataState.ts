import { useState, useCallback } from 'react'
import { Field } from '../../api/model'

// 数据状态管理
export const useDataState = () => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  return {
    data, setData,
    loading, setLoading,
    page, setPage,
    pageSize, setPageSize,
    total, setTotal,
    hasMore, setHasMore,
    loadingMore, setLoadingMore
  }
}

// 编辑状态管理
export const useEditState = () => {
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<any>('')
  const [originalValue, setOriginalValue] = useState<any>('')

  const startEdit = useCallback((cellKey: string, value: any) => {
    setEditingCell(cellKey)
    setEditValue(value)
    setOriginalValue(value)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingCell(null)
    setEditValue('')
    setOriginalValue('')
  }, [])

  return {
    editingCell, setEditingCell,
    editValue, setEditValue,
    originalValue, setOriginalValue,
    startEdit, cancelEdit
  }
}

// 筛选排序状态管理
export const useFilterSortState = () => {
  const [filterVisible, setFilterVisible] = useState(false)
  const [sortVisible, setSortVisible] = useState(false)
  const [currentField, setCurrentField] = useState<Field | null>(null)
  const [filters, setFilters] = useState<any>({})
  const [sorts, setSorts] = useState<any[]>([])
  const [currentFilterValue, setCurrentFilterValue] = useState<string>('')
  const [currentFilterCondition, setCurrentFilterCondition] = useState<string>('equals')
  const [currentSortOrder, setCurrentSortOrder] = useState<'asc' | 'desc'>('asc')

  const clearFilters = useCallback(() => {
    setFilters({})
    setCurrentFilterValue('')
    setCurrentFilterCondition('equals')
  }, [])

  const clearSorts = useCallback(() => {
    setSorts([])
    setCurrentSortOrder('asc')
  }, [])

  return {
    filterVisible, setFilterVisible,
    sortVisible, setSortVisible,
    currentField, setCurrentField,
    filters, setFilters,
    sorts, setSorts,
    currentFilterValue, setCurrentFilterValue,
    currentFilterCondition, setCurrentFilterCondition,
    currentSortOrder, setCurrentSortOrder,
    clearFilters, clearSorts
  }
}

// 视图状态管理
export const useViewState = (searchParams: URLSearchParams) => {
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

  return {
    viewMode, setViewMode,
    kanbanField, setKanbanField,
    calendarStartField, setCalendarStartField,
    calendarEndField, setCalendarEndField,
    currentMonth, setCurrentMonth
  }
}

// 表格列状态管理
export const useTableState = () => {
  const [visibleFields, setVisibleFields] = useState<string[]>([])
  const [fieldConfigVisible, setFieldConfigVisible] = useState(false)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [resizing, setResizing] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [frozenColumns, setFrozenColumns] = useState<number>(0)

  const startResize = useCallback((field: string, x: number, width: number) => {
    setResizing(field)
    setResizeStartX(x)
    setResizeStartWidth(width)
  }, [])

  const updateWidth = useCallback((x: number) => {
    if (!resizing) return
    const newWidth = Math.max(50, resizeStartWidth + (x - resizeStartX))
    setColumnWidths(prev => ({ ...prev, [resizing]: newWidth }))
  }, [resizing, resizeStartX, resizeStartWidth])

  const endResize = useCallback(() => {
    setResizing(null)
  }, [])

  return {
    visibleFields, setVisibleFields,
    fieldConfigVisible, setFieldConfigVisible,
    columnWidths, setColumnWidths,
    resizing, setResizing,
    resizeStartX, setResizeStartX,
    resizeStartWidth, setResizeStartWidth,
    frozenColumns, setFrozenColumns,
    startResize, updateWidth, endResize
  }
}

// 关联字段状态管理
export const useRelationState = () => {
  const [relationData, setRelationData] = useState<Record<string, any[]>>({})
  const [relationDataPage, setRelationDataPage] = useState<Record<string, number>>({})
  const [relationDataTotal, setRelationDataTotal] = useState<Record<string, number>>({})
  const [relationDataLoading, setRelationDataLoading] = useState<Record<string, boolean>>({})
  const [relationModalVisible, setRelationModalVisible] = useState(false)
  const [currentRelationField, setCurrentRelationField] = useState<Field | null>(null)
  const [currentRelationRow, setCurrentRelationRow] = useState<any>(null)
  const [selectedRelationIds, setSelectedRelationIds] = useState<string[]>([])

  return {
    relationData, setRelationData,
    relationDataPage, setRelationDataPage,
    relationDataTotal, setRelationDataTotal,
    relationDataLoading, setRelationDataLoading,
    relationModalVisible, setRelationModalVisible,
    currentRelationField, setCurrentRelationField,
    currentRelationRow, setCurrentRelationRow,
    selectedRelationIds, setSelectedRelationIds
  }
}
