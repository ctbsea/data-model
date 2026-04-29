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
  list: (type?: string) =>
    request.get<any, { items: DictionaryItem[] }>(type ? `/dictionaries/${type}` : '/dictionaries'),
}
