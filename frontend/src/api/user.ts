import request from '../utils/request'
import { User, Role, Permission } from './auth'

export interface ListUsersResponse {
  users: User[]
  total: number
  page: number
  size: number
}

export interface CreateUserRequest {
  username: string
  email: string
  password: string
  nickname?: string
}

export interface UpdateUserRequest {
  nickname?: string
  avatar?: string
  status?: string
}

export interface AssignRolesRequest {
  role_ids: string[]
}

export interface CreateRoleRequest {
  name: string
  display_name: string
}

export interface AssignPermissionsRequest {
  permission_ids: string[]
}

export const userApi = {
  list: (page = 1, pageSize = 10) =>
    request.get<any, ListUsersResponse>('/users', { params: { page, page_size: pageSize } }),
  
  create: (data: CreateUserRequest) =>
    request.post<any, User>('/users', data),
  
  get: (id: string) =>
    request.get<any, User>(`/users/${id}`),
  
  update: (id: string, data: UpdateUserRequest) =>
    request.put(`/users/${id}`, data),
  
  delete: (id: string) =>
    request.delete(`/users/${id}`),
  
  assignRoles: (id: string, data: AssignRolesRequest) =>
    request.post(`/users/${id}/roles`, data),
}

export const roleApi = {
  list: () =>
    request.get<any, Role[]>('/roles'),
  
  create: (data: CreateRoleRequest) =>
    request.post<any, Role>('/roles', data),
  
  update: (id: string, data: CreateRoleRequest) =>
    request.put<any, Role>(`/roles/${id}`, data),
  
  delete: (id: string) =>
    request.delete(`/roles/${id}`),
  
  assignPermissions: (id: string, data: AssignPermissionsRequest) =>
    request.post(`/roles/${id}/permissions`, data),
}

export const permissionApi = {
  list: () =>
    request.get<any, Permission[]>('/permissions'),
}
