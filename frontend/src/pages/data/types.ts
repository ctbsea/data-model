// Data 页面的类型定义
import { Field, Model } from '../../api/model'

export interface DataState {
  model: Model | null
  fields: Field[]
  data: any[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  hasMore: boolean
  loadingMore: boolean
}

export interface EditState {
  editingCell: string | null
  editValue: any
  originalValue: any
}

export interface FilterSortState {
  filterVisible: boolean
  sortVisible: boolean
  currentField: Field | null
  filters: any
  sorts: any[]
  currentFilterValue: string
  currentFilterCondition: string
  currentSortOrder: 'asc' | 'desc'
}

export interface ViewState {
  viewMode: 'table' | 'kanban' | 'calendar'
  kanbanField: string
  calendarStartField: string
  calendarEndField: string
  currentMonth: Date
}

export interface TableState {
  visibleFields: string[]
  fieldConfigVisible: boolean
  columnWidths: Record<string, number>
  resizing: string | null
  resizeStartX: number
  resizeStartWidth: number
  frozenColumns: number
}

export interface RelationState {
  relationData: Record<string, any[]>
  relationDataPage: Record<string, number>
  relationDataTotal: Record<string, number>
  relationDataLoading: Record<string, boolean>
  relationModalVisible: boolean
  currentRelationField: Field | null
  currentRelationRow: any
  selectedRelationIds: string[]
}

export interface DataProps {
  modelName: string
}

export type ViewMode = 'table' | 'kanban' | 'calendar'
