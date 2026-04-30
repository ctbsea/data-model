import request from '../utils/request'

export interface DictionaryItem {
  id: string
  type: 'currency' | 'country' | string
  code: string
  name: string
  name_zh?: string
  name_en?: string
  symbol?: string
  icon?: string
  sort?: number
  enabled?: boolean
}

export const dictionaryApi = {
  list: (type?: string, all = false) =>
    request.get<any, { items: DictionaryItem[] }>(type ? `/dictionaries/${type}` : '/dictionaries', {
      params: all ? { all: 'true' } : undefined,
    }),
  create: (data: Partial<DictionaryItem>) =>
    request.post<any, DictionaryItem>('/dictionaries', data),
  update: (id: string, data: Partial<DictionaryItem>) =>
    request.put<any, DictionaryItem>(`/dictionaries/${id}`, data),
  delete: (id: string) =>
    request.delete<any, { message: string }>(`/dictionaries/${id}`),
}
