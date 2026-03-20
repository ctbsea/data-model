import request from '../utils/request'

export interface Email {
  id: string
  user_id: string
  from: string
  to: string
  subject: string
  body: string
  status: string
  is_read: boolean
  created_at: string
  updated_at: string
}

export interface SendEmailRequest {
  to: string
  subject: string
  body: string
}

export interface ListEmailsResponse {
  emails: Email[]
  total: number
  page: number
  size: number
}

export const emailApi = {
  send: (data: SendEmailRequest) =>
    request.post<any, Email>('/emails/send', data),
  
  getInbox: (page = 1, pageSize = 20, filterEmail?: string) =>
    request.get<any, ListEmailsResponse>('/emails/inbox', { 
      params: { page, page_size: pageSize, filter_email: filterEmail } 
    }),
  
  getSent: (page = 1, pageSize = 20, filterEmail?: string) =>
    request.get<any, ListEmailsResponse>('/emails/sent', { 
      params: { page, page_size: pageSize, filter_email: filterEmail } 
    }),
  
  getUnreadCount: () =>
    request.get<any, { count: number }>('/emails/unread-count'),
  
  markAsRead: (id: string) =>
    request.put(`/emails/${id}/read`),
  
  delete: (id: string) =>
    request.delete(`/emails/${id}`),
}
