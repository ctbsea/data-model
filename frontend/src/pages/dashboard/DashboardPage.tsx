import React from 'react'
import { Button, Empty } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

export const DashboardPage: React.FC = () => {
  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center',
      background: '#f5f5f5',
      gap: 16,
    }}>
      <Empty
        description="欢迎使用数据平台"
        style={{ marginBottom: 16 }}
      >
        <p style={{ color: '#666', marginBottom: 16 }}>
          点击左侧"面板"旁边的 + 按钮创建新面板
        </p>
      </Empty>
    </div>
  )
}

export default DashboardPage
