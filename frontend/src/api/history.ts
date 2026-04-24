import request from '../utils/request'

export interface HistoryRecord {
  id: string
  changed_at: string
  user: {
    id: string
    name: string
    avatar: string
  }
  field_name: string
  old_value: any
  new_value: any
}

export interface HistoryResponse {
  data: HistoryRecord[]
  total: number
  page: number
  page_size: number
}

export const historyApi = {
  // 获取某条记录的变更历史
  list: (modelName: string, recordId: string, page: number = 1, pageSize: number = 20) =>
    request.get<any, HistoryResponse>(`/history/${modelName}/${recordId}`, {
      params: { page, page_size: pageSize }
    }),
}
