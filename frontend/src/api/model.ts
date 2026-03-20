import request from '../utils/request'

export interface Field {
  id?: string
  model_id?: string
  name: string
  display_name: string
  type: string
  required: boolean
  unique: boolean
  default_value?: string
  options?: string  // JSON字符串
  validation?: string  // JSON字符串
  relation_config?: string  // JSON字符串: {target_model_id, relation_type, display_field, allow_multiple, allow_duplicate, bidirectional}
  is_lock?: boolean  // 字段锁定
  created_by?: string  // 创建人用户ID
  order: number
  created_at?: string
  updated_at?: string
}

export interface Relation {
  id?: string
  model_id?: string
  name: string
  type: 'one_to_one' | 'one_to_many' | 'many_to_many'
  target_model_id: string
  foreign_key?: string
  junction_table?: string
  cascade_delete: boolean
  created_at?: string
  updated_at?: string
}

export interface Model {
  id: string
  name: string
  display_name: string
  description: string
  table_name: string
  version: number
  status: 'draft' | 'applied' | 'rolled_back'
  created_by: string
  created_at: string
  updated_at: string
  fields?: Field[]
  relations?: Relation[]
}

export interface ModelVersion {
  id: string
  model_id: string
  version: number
  schema: string
  change_log: string
  created_by: string
  created_at: string
}

export interface ListModelsResponse {
  models: Model[]
  total: number
  page: number
  size: number
}

export interface CreateModelRequest {
  name: string
  display_name: string
  description?: string
}

export interface UpdateModelRequest {
  display_name?: string
  description?: string
  status?: string
}

export interface AddFieldRequest {
  name: string
  display_name: string
  type: Field['type']
  required: boolean
  unique: boolean
  default_value?: string
  options?: string  // JSON字符串
  validation?: string  // JSON字符串
  relation_config?: string  // JSON字符串
  order: number
  deleted?: boolean
}

export interface AddRelationRequest {
  name: string
  type: Relation['type']
  target_model_id: string
  foreign_key?: string
  junction_table?: string
  cascade_delete: boolean
}

export const modelApi = {
  list: (page = 1, pageSize = 10) =>
    request.get<any, ListModelsResponse>('/models', { params: { page, page_size: pageSize } }),
  
  create: (data: CreateModelRequest) =>
    request.post<any, Model>('/models', data),
  
  get: (id: string) =>
    request.get<any, Model>(`/models/${id}`),
  
  update: (id: string, data: UpdateModelRequest) =>
    request.put(`/models/${id}`, data),
  
  delete: (id: string) =>
    request.delete(`/models/${id}`),
  
  apply: (id: string) =>
    request.post(`/models/${id}/apply`),
  
  getVersions: (id: string) =>
    request.get<any, ModelVersion[]>(`/models/${id}/versions`),
  
  rollback: (id: string, version: number) =>
    request.post(`/models/${id}/rollback`, { version }),
  
  // 字段管理
  addField: (modelId: string, data: AddFieldRequest) =>
    request.post<any, Field>(`/models/${modelId}/fields`, data),
  
  updateField: (modelId: string, fieldId: string, data: AddFieldRequest) =>
    request.put(`/models/${modelId}/fields/${fieldId}`, data),
  
  deleteField: (modelId: string, fieldId: string) =>
    request.delete(`/models/${modelId}/fields/${fieldId}`),
  
  // 关联关系管理
  addRelation: (modelId: string, data: AddRelationRequest) =>
    request.post<any, Relation>(`/models/${modelId}/relations`, data),
  
  updateRelation: (modelId: string, relationId: string, data: AddRelationRequest) =>
    request.put(`/models/${modelId}/relations/${relationId}`, data),
  
  deleteRelation: (modelId: string, relationId: string) =>
    request.delete(`/models/${modelId}/relations/${relationId}`),
}
