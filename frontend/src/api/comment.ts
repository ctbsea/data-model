import request from '../utils/request'

export interface Comment {
  id: string
  record_id: string
  model_name: string
  user_id: string
  user_name: string
  content: string
  created_at: string
}

export interface CreateCommentRequest {
  record_id: string
  model_name: string
  content: string
}

export const commentApi = {
  // 获取某条记录的评论列表
  list: (modelName: string, recordId: string) =>
    request.get<any, Comment[]>(`/comments/${modelName}/${recordId}`),
  
  // 批量获取评论数量
  getCounts: (modelName: string, recordIds: string[]) =>
    request.get<any, Record<string, number>>('/comments/counts', {
      params: { model_name: modelName, record_ids: recordIds.join(',') }
    }),
  
  // 创建评论
  create: (data: CreateCommentRequest) =>
    request.post('/comments', data),
  
  // 删除评论
  delete: (commentId: string) =>
    request.delete(`/comments/${commentId}`),
}
