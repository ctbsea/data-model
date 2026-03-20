import request from '../utils/request'

export interface Component {
  id: string
  type: string
  name: string
  props: any
  style: any
  dataBinding?: DataBinding
  events: Event[]
  children?: Component[]
}

export interface DataBinding {
  type: 'model' | 'api' | 'static'
  source: string
  field?: string
  transform?: string
}

export interface Event {
  name: string
  type: string
  action: string
  config: any
}

export interface Page {
  id: string
  name: string
  route: string
  title: string
  layout: string
  components: string
  permissions: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface ListPagesResponse {
  pages: Page[]
  total: number
  page: number
  size: number
}

export interface CreatePageRequest {
  name: string
  route: string
  title?: string
}

export interface UpdatePageRequest {
  name?: string
  title?: string
  layout?: string
  components?: string
  permissions?: string
}

export const pageApi = {
  list: (page = 1, pageSize = 10) =>
    request.get<any, ListPagesResponse>('/pages', { params: { page, page_size: pageSize } }),
  
  create: (data: CreatePageRequest) =>
    request.post<any, Page>('/pages', data),
  
  get: (id: string) =>
    request.get<any, Page>(`/pages/${id}`),
  
  getByRoute: (route: string) =>
    request.get<any, Page>(`/pages/route/${route}`),
  
  update: (id: string, data: UpdatePageRequest) =>
    request.put(`/pages/${id}`, data),
  
  delete: (id: string) =>
    request.delete(`/pages/${id}`),
}
