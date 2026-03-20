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
