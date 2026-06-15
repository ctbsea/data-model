import { Field } from '../api/model'
import { DictionaryItem } from '../api/dictionary'

export const DICTIONARY_TYPE_META = '__dictionary_type'

export const BUILTIN_DICTIONARY_TYPES = [
  { value: 'currency', label: '货币' },
  { value: 'country', label: '国家' },
]

export interface DictionaryTypeOption {
  value: string
  label: string
}

export const buildDictionaryTypes = (items: DictionaryItem[]): DictionaryTypeOption[] => {
  const merged = [...BUILTIN_DICTIONARY_TYPES]

  items
    .filter(item => item.type === DICTIONARY_TYPE_META)
    .forEach(item => {
      const value = item.code || item.name
      if (value && !merged.some(type => type.value === value)) {
        merged.push({ value, label: item.name_zh || item.name || value })
      }
    })

  Array.from(new Set(items.map(item => item.type)))
    .filter(type => type && type !== DICTIONARY_TYPE_META)
    .forEach(type => {
      if (!merged.some(item => item.value === type)) {
        merged.push({ value: type, label: type })
      }
    })

  return merged
}

export const parseFieldOptions = (options?: string): any => {
  if (!options) return []
  try {
    let parsed = JSON.parse(options)
    if (Array.isArray(parsed) && parsed.length === 1 && typeof parsed[0] === 'string') {
      parsed = JSON.parse(parsed[0])
    }
    return parsed
  } catch {
    return []
  }
}

export const getFieldDictionaryType = (field: Pick<Field, 'options'>): string => {
  const parsed = parseFieldOptions(field.options)
  return !Array.isArray(parsed) && parsed?.source === 'dictionary' ? parsed.dictionary_type || '' : ''
}

export const getDictionaryItemsForField = (field: Pick<Field, 'options'>, items: DictionaryItem[]) => {
  const dictionaryType = getFieldDictionaryType(field)
  if (!dictionaryType) return []
  return items.filter(item => item.type === dictionaryType && item.enabled !== false)
}

export const getDictionaryItemLabel = (item: DictionaryItem) => {
  const label = item.name_zh || item.name || item.code
  const en = item.name_en && item.name_en !== label ? ` / ${item.name_en}` : ''
  return `${item.icon || ''} ${label}${en}`.trim()
}

export const getDictionaryValueLabel = (field: Pick<Field, 'options'>, value: any, items: DictionaryItem[]) => {
  const item = getDictionaryItemsForField(field, items).find(option => option.code === value)
  return item ? getDictionaryItemLabel(item) : String(value ?? '')
}
