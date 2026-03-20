import request from '../utils/request'

export interface WorkflowNode {
  id: string
  workflow_id: string
  type: 'start' | 'end' | 'task' | 'condition' | 'parallel' | 'approval' | 'script'
  name: string
  config: string
  x: number
  y: number
  created_at: string
}

export interface WorkflowEdge {
  id: string
  workflow_id: string
  source_node_id: string
  target_node_id: string
  condition: string
  label: string
  created_at: string
}

export interface Workflow {
  id: string
  name: string
  display_name: string
  description: string
  trigger_config: string
  status: string
  created_by: string
  created_at: string
  updated_at: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface WorkflowInstance {
  id: string
  workflow_id: string
  status: string
  input: string
  output: string
  current_node: string
  started_by: string
  started_at: string
  completed_at: string
  error: string
}

export interface ListWorkflowsResponse {
  workflows: Workflow[]
  total: number
  page: number
  size: number
}

export interface CreateWorkflowRequest {
  name: string
  display_name: string
  description?: string
}

export interface UpdateWorkflowRequest {
  display_name?: string
  description?: string
  status?: string
  trigger_config?: string
}

export interface AddNodeRequest {
  type: string
  name: string
  config?: string
  x: number
  y: number
}

export interface AddEdgeRequest {
  source_node_id: string
  target_node_id: string
  condition?: string
  label?: string
}

export interface StartWorkflowRequest {
  input: Record<string, any>
}

export const workflowApi = {
  list: (page = 1, pageSize = 10) =>
    request.get<any, ListWorkflowsResponse>('/workflows', { params: { page, page_size: pageSize } }),
  
  create: (data: CreateWorkflowRequest) =>
    request.post<any, Workflow>('/workflows', data),
  
  get: (id: string) =>
    request.get<any, Workflow>(`/workflows/${id}`),
  
  update: (id: string, data: UpdateWorkflowRequest) =>
    request.put(`/workflows/${id}`, data),
  
  delete: (id: string) =>
    request.delete(`/workflows/${id}`),
  
  addNode: (workflowId: string, data: AddNodeRequest) =>
    request.post<any, WorkflowNode>(`/workflows/${workflowId}/nodes`, data),
  
  addEdge: (workflowId: string, data: AddEdgeRequest) =>
    request.post<any, WorkflowEdge>(`/workflows/${workflowId}/edges`, data),
  
  validate: (id: string) =>
    request.post<any, { valid: boolean; message: string }>(`/workflows/${id}/validate`),
  
  start: (id: string, data: StartWorkflowRequest) =>
    request.post<any, WorkflowInstance>(`/workflows/${id}/start`, data),
  
  completeTask: (instanceId: string, taskId: string, output: Record<string, any>) =>
    request.post(`/instances/${instanceId}/tasks/${taskId}/complete`, { output }),
  
  cancelInstance: (instanceId: string) =>
    request.post(`/instances/${instanceId}/cancel`),
}
