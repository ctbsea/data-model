import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, message, Spin, Empty, Popconfirm } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { PanelComponent } from './PanelComponent'
import { Panel } from './types'
import { modelApi, Model } from '../../api/model'
import { dashboardApi } from '../../api/dashboard'
import './dashboard.css'

export const PanelPage: React.FC = () => {
  const { panelId } = useParams<{ panelId: string }>()
  const navigate = useNavigate()
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [allPanels, setAllPanels] = useState<Panel[]>([])

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载模型列表
        const res = await modelApi.list(1, 100)
        setModels(res.models || [])
        
        // 加载仪表盘配置
        const dashboardRes = await dashboardApi.get()
        if (dashboardRes && dashboardRes.config) {
          const config = JSON.parse(dashboardRes.config)
          const panels = config.panels || []
          setAllPanels(panels)
          
          // 找到当前面板
          const currentPanel = panels.find((p: Panel) => p.id === panelId)
          if (currentPanel) {
            setPanel(currentPanel)
          } else {
            message.error('面板不存在')
            navigate('/dashboard')
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [panelId])

  // 保存面板配置
  const savePanel = async (updatedPanel: Panel) => {
    const newPanels = allPanels.map(p => p.id === panelId ? updatedPanel : p)
    setAllPanels(newPanels)
    setPanel(updatedPanel)
    
    try {
      await dashboardApi.save({
        name: '仪表盘',
        config: JSON.stringify({ panels: newPanels }),
      })
    } catch (error) {
      console.error('Failed to save panel:', error)
    }
  }

  const handleDeletePanel = async () => {
    const newPanels = allPanels.filter(p => p.id !== panelId)
    
    try {
      await dashboardApi.save({
        name: '仪表盘',
        config: JSON.stringify({ panels: newPanels }),
      })
      message.success('面板已删除')
      navigate('/dashboard')
    } catch (error) {
      console.error('Failed to delete panel:', error)
    }
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!panel) {
    return (
      <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Empty description="面板不存在" />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      {/* 顶部工具栏 */}
      <div style={{ 
        padding: '16px 24px', 
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>{panel.name}</h2>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个面板吗？"
            onConfirm={handleDeletePanel}
          >
            <Button danger icon={<DeleteOutlined />}>删除面板</Button>
          </Popconfirm>
        </div>
      </div>

      {/* 面板内容 */}
      <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        <PanelComponent
          panel={panel}
          models={models}
          onUpdate={savePanel}
          onDelete={handleDeletePanel}
        />
      </div>
    </div>
  )
}

export default PanelPage
