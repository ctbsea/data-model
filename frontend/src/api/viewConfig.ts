import request from '../utils/request'

export interface ViewConfig {
  id: string
  user_id: string
  model_name: string
  view_type: string
  filters: string
  sorts: string
  column_widths: string
  frozen_columns: number
  visible_fields: string
  calendar_start: string
  calendar_end: string
  created_at: string
  updated_at: string
}

export interface SaveViewConfigRequest {
  model_name: string
  view_type: string
  filters?: string
  sorts?: string
  column_widths?: string
  frozen_columns?: number
  visible_fields?: string
  calendar_start?: string
  calendar_end?: string
}

export const viewConfigApi = {
  get: (modelName: string, viewType: string) =>
    request.get<any, ViewConfig>('/view-configs', { 
      params: { model_name: modelName, view_type: viewType } 
    }),
  
  save: (data: SaveViewConfigRequest) =>
    request.post<any, ViewConfig>('/view-configs', data),
}
