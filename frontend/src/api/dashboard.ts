import request from '../utils/request'

export interface Dashboard {
  id: string
  user_id: string
  name: string
  config: string
  created_at: string
  updated_at: string
}

export interface SaveDashboardRequest {
  name: string
  config: string
}

export const dashboardApi = {
  get: () => request.get<any, Dashboard>('/dashboards'),
  
  save: (data: SaveDashboardRequest) => request.post<any, Dashboard>('/dashboards', data),
}
