import React from 'react'
import { Button, Space } from 'antd'
import dayjs from 'dayjs'
import { Field, Model } from '../../api/model'

interface CalendarViewProps {
  model: Model | null
  fields: Field[]
  data: any[]
  users: any[]
  visibleFields: string[]
  calendarStartField: string
  calendarEndField: string
  currentMonth: Date
  onMonthChange: (date: Date) => void
  onRecordClick: (record: any) => void
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  model,
  fields,
  data,
  users,
  visibleFields,
  calendarStartField,
  calendarEndField,
  currentMonth,
  onMonthChange,
  onRecordClick,
}) => {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = (firstDay.getDay() + 6) % 7

  const displayFields = fields.filter(f => 
    visibleFields.includes(f.id!) && 
    !f.deleted && 
    !['id', 'created_at', 'updated_at'].includes(f.name)
  )

  const days = []

  // 填充前面的空白
  for (let i = 0; i < startPadding; i++) {
    days.push(<div key={`empty-${i}`} style={{ background: '#fff', padding: '12px', minHeight: 100 }} />)
  }

  // 填充日期
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayEvents = data.filter(row => {
      const start = row[calendarStartField]
      if (!start) return false

      let startDate = start
      if (typeof start === 'string' && start.includes('T')) {
        startDate = start.split('T')[0]
      }

      const end = calendarEndField ? row[calendarEndField] : null
      let endDate = end
      if (end && typeof end === 'string' && end.includes('T')) {
        endDate = end.split('T')[0]
      }

      if (!endDate || startDate === endDate) {
        return startDate === dateStr
      }
      return dateStr >= startDate && dateStr <= endDate
    })

    days.push(
      <div key={day} style={{ background: '#fff', padding: '12px', minHeight: 100 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>{day}</div>
        {dayEvents.map(event => {
          const displayContent = displayFields.slice(0, 2).map(f => {
            const value = event[f.name]
            if (value === null || value === undefined || value === '') return null

            if (f.type === 'user') {
              const user = users.find((u: any) => u.id === value)
              return user ? user.nickname || user.username : null
            }
            if (f.type === 'date') {
              return dayjs(value).format('MM-DD')
            }
            return String(value)
          }).filter(Boolean).join(' - ')

          return (
            <div
              key={event.id}
              style={{
                background: '#722ed1',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 12,
                marginBottom: 4,
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onClick={() => onRecordClick(event)}
            >
              {displayContent || event.id}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>上个月</Button>
          <span style={{ fontSize: 18, fontWeight: 500 }}>{year}年{month + 1}月</span>
          <Button onClick={() => onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>下个月</Button>
          <Button onClick={() => onMonthChange(new Date())}>今天</Button>
        </Space>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: '#e8e8e8', border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
        {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(day => (
          <div key={day} style={{ background: '#fafafa', padding: '12px', textAlign: 'center', fontWeight: 500 }}>{day}</div>
        ))}
        {days}
      </div>
    </div>
  )
}
