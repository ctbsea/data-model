import request from '../utils/request'

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  refresh_token: string
}

export interface User {
  id: string
  username: string
  email: string
  nickname: string
  avatar: string
  status: string
  email_address: string
  roles: Role[]
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  name: string
  display_name: string
  permissions?: Permission[]
}

export interface Permission {
  id: string
  name: string
  display_name: string
  resource: string
  action: string
}

export const authApi = {
  login: (data: LoginRequest) =>
    request.post<any, AuthResponse>('/auth/login', data),
  
  register: (data: RegisterRequest) =>
    request.post('/auth/register', data),
  
  refresh: (refreshToken: string) =>
    request.post('/auth/refresh', { refresh_token: refreshToken }),
  
  me: () =>
    request.get<any, User>('/auth/me'),
  
  updateEmailAddress: (emailAddress: string) =>
    request.put('/auth/email-address', { email_address: emailAddress }),
}
