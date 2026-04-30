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
  success_count: number
  fail_count: number
  webhook_token: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface StepLog {
  type: string
  status: 'success' | 'failed'
  result: string
  error: string
  duration_ms: number
}

export interface AutomationRun {
  id: string
  automation_id: string
  status: 'running' | 'success' | 'failed'
  trigger_data: string
  steps: string  // JSON: StepLog[]
  result: string
  error: string
  retry_count: number
  started_at: string
  completed_at: string | null
}

export interface AutomationWebhookLog {
  id: string
  automation_id: string
  webhook_token: string
  idempotency_key: string
  status: 'accepted' | 'duplicate' | 'failed'
  message: string
  payload: string
  remote_ip: string
  user_agent: string
  created_at: string
}

export interface AutomationStats {
  run_count: number
  success_count: number
  fail_count: number
  avg_duration_ms: number
  daily_stats: { date: string; success_count: number; fail_count: number }[]
  last_run: AutomationRun | null
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

  listRuns: (id: string, status?: string) =>
    request.get<any, { runs: AutomationRun[] }>(`/automations/${id}/runs`, { params: status ? { status } : {} }),

  listWebhookLogs: (id: string) =>
    request.get<any, { logs: AutomationWebhookLog[] }>(`/automations/${id}/webhook-logs`),

  getStats: (id: string) =>
    request.get<any, AutomationStats>(`/automations/${id}/stats`),

  regenerateWebhookToken: (id: string) =>
    request.post<any, { webhook_token: string }>(`/automations/${id}/webhook-token`),
}
