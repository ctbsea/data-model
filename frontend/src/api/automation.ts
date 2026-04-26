import request from '../utils/request'

export interface Automation {
  id: string
  model_id: string
  name: string
  description: string
  enabled: boolean
  triggers: string
  actions: string
  run_count: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface AutomationRun {
  id: string
  automation_id: string
  status: string
  trigger_data: string
  result: string
  error: string
  started_at: string
  completed_at: string | null
}

export const automationApi = {
  list: (modelId: string) =>
    request.get<any, { automations: Automation[] }>(`/automations/model/${modelId}`),

  get: (id: string) =>
    request.get<any, Automation>(`/automations/${id}`),

  create: (data: Partial<Automation>) =>
    request.post<any, Automation>('/automations', data),

  update: (id: string, data: Partial<Automation>) =>
    request.put<any, Automation>(`/automations/${id}`, data),

  delete: (id: string) =>
    request.delete(`/automations/${id}`),

  toggleEnable: (id: string) =>
    request.put<any, Automation>(`/automations/${id}/toggle`),

  listRuns: (id: string) =>
    request.get<any, { runs: AutomationRun[] }>(`/automations/${id}/runs`),
}
