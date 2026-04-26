import request from '../utils/request'

export interface ListDataResponse {
  data: any[]
  total: number
  page: number
  size: number
}

export interface BatchOperationRequest {
  operation: 'create' | 'update' | 'delete'
  data?: any[]
  ids?: string[]
  updates?: Array<{ id: string; data: any }>
}

export interface SortItem {
  field: string
  order: 'asc' | 'desc'
}

export interface MetricOption {
  field?: string
  func: 'count' | 'sum' | 'avg'
  alias?: string
}

export interface AggregateParams {
  group_by?: string
  metrics?: MetricOption[]
  filter?: Record<string, any>
  time_field?: string
  granularity?: 'day' | 'week' | 'month'
  limit?: number
  sorts?: SortItem[]
}

export interface AggregateResult {
  name?: string
  value?: number
  [key: string]: any
}

export const dataApi = {
  list: (modelName: string, page = 1, pageSize = 10, filters?: Record<string, any>, sorts?: SortItem[]) => {
    const params: any = { page, page_size: pageSize }
    if (filters && Object.keys(filters).length > 0) {
      params.filter = JSON.stringify(filters)
    }
    if (sorts && sorts.length > 0) {
      params.sorts = JSON.stringify(sorts)
    }
    return request.get<any, ListDataResponse>(`/data/${modelName}`, { params })
  },

  aggregate: (modelName: string, params: AggregateParams): Promise<AggregateResult[]> => {
    const queryParams: any = {}
    if (params.group_by) queryParams.group_by = params.group_by
    if (params.time_field) queryParams.time_field = params.time_field
    if (params.granularity) queryParams.granularity = params.granularity
    if (params.limit) queryParams.limit = params.limit
    if (params.metrics && params.metrics.length > 0) {
      queryParams.metrics = JSON.stringify(params.metrics)
    }
    if (params.filter && Object.keys(params.filter).length > 0) {
      queryParams.filter = JSON.stringify(params.filter)
    }
    if (params.sorts && params.sorts.length > 0) {
      queryParams.sorts = JSON.stringify(params.sorts)
    }
    return request.get<any, AggregateResult[]>(`/data/${modelName}/aggregate`, { params: queryParams })
  },

  get: (modelName: string, id: string) =>
    request.get<any, any>(`/data/${modelName}/${id}`),

  create: (modelName: string, data: any) =>
    request.post(`/data/${modelName}`, data),

  update: (modelName: string, id: string, data: any) =>
    request.put(`/data/${modelName}/${id}`, data),

  delete: (modelName: string, id: string) =>
    request.delete(`/data/${modelName}/${id}`),

  batch: (modelName: string, data: BatchOperationRequest) =>
    request.post(`/data/${modelName}/batch`, data),
}
