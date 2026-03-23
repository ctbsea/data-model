import React, { useState, useRef, useEffect } from 'react'
import { Button, Dropdown, Input, Modal, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, MoreOutlined } from '@ant-design/icons'
import GridLayout from 'react-grid-layout'
import { Panel, Widget } from './types'
import { ChartWidget } from './ChartWidget'
import { Model } from '../../api/model'
import type { MenuProps } from 'antd'

interface PanelComponentProps {
  panel: Panel
  models: Model[]
  onUpdate: (panel: Panel) => void
  onDelete: () => void
}

export const PanelComponent: React.FC<PanelComponentProps> = ({ panel, models, onUpdate, onDelete }) => {
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState(panel.name)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1100)
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false)

  // 监听容器宽度变化
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth - 32) // 减去padding
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [panel.widgets.length])

  const handleAddWidget = () => {
    // 计算新组件位置
    const existingWidgets = panel.widgets
    let maxY = 0
    existingWidgets.forEach(w => {
      if (w.y + w.h > maxY) maxY = w.y + w.h
    })

    const newWidget: Widget = {
      id: `widget-${Date.now()}`,
      type: 'chart',
      title: '新统计图表',
      config: {
        modelId: '',
        modelName: '',
        chartType: 'bar',
        dimensionField: '',
        valueField: '',
        valueAggregation: 'count',
      },
      x: 0,
      y: maxY,
      w: 6,
      h: 4,
    }

    onUpdate({
      ...panel,
      widgets: [...panel.widgets, newWidget],
    })
    message.success('已添加新统计组件')
  }

  const handleUpdateWidget = (widgetId: string, updatedWidget: Widget) => {
    onUpdate({
      ...panel,
      widgets: panel.widgets.map(w => w.id === widgetId ? updatedWidget : w),
    })
  }

  const handleDeleteWidget = (widgetId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个统计组件吗？',
      onOk: () => {
        onUpdate({
          ...panel,
          widgets: panel.widgets.filter(w => w.id !== widgetId),
        })
        message.success('已删除统计组件')
      },
    })
  }

  const handleNameSave = () => {
    if (tempName.trim()) {
      onUpdate({ ...panel, name: tempName.trim() })
      setEditingName(false)
    }
  }

  const menu: MenuProps = {
    items: [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: '编辑名称',
        onClick: () => setEditingName(true),
      },
      {
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除面板',
        danger: true,
        onClick: () => {
          Modal.confirm({
            title: '确认删除',
            content: `确定要删除面板 "${panel.name}" 吗？`,
            onOk: onDelete,
          })
        },
      },
    ],
  }

  // 生成布局
  const layout = panel.widgets.map(w => ({
    i: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
  }))

  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: 8, 
      overflow: 'hidden',
      border: '1px solid #e8e8e8',
    }}>
      {/* 面板头部 */}
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fafafa',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {editingName ? (
            <Input
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onBlur={handleNameSave}
              onPressEnter={handleNameSave}
              autoFocus
              style={{ width: 200 }}
            />
          ) : (
            <h3 style={{ margin: 0, fontSize: 16 }}>{panel.name}</h3>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            size="small"
            onClick={handleAddWidget}
          >
            添加统计组件
          </Button>
          <Dropdown menu={menu} trigger={['click']}>
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </div>
      </div>

      {/* 面板内容 */}
      <div ref={containerRef} style={{ padding: 16, minHeight: 300 }}>
        {panel.widgets.length === 0 ? (
          <div style={{ 
            height: 200, 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            color: '#6b7280',
            gap: 16,
          }}>
            <PlusOutlined style={{ fontSize: 48 }} />
            <span>点击上方按钮添加统计组件</span>
          </div>
        ) : (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={80}
            width={containerWidth}
            onLayoutChange={(newLayout) => {
              if (configDrawerOpen) return // 配置打开时不处理布局变化
              const updatedWidgets = panel.widgets.map(w => {
                const layoutItem = newLayout.find(l => l.i === w.id)
                if (layoutItem) {
                  return { ...w, x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h }
                }
                return w
              })
              // 只在布局真正变化时更新
              const hasChange = updatedWidgets.some((w, i) => 
                w.x !== panel.widgets[i].x || 
                w.y !== panel.widgets[i].y || 
                w.w !== panel.widgets[i].w || 
                w.h !== panel.widgets[i].h
              )
              if (hasChange) {
                onUpdate({ ...panel, widgets: updatedWidgets })
              }
            }}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            useCSSTransforms={true}
            draggableHandle={configDrawerOpen ? '.drag-handle-disabled' : '.drag-handle'}
          >
            {panel.widgets.map(widget => (
              <div key={widget.id}>
                <ChartWidget
                  widget={widget}
                  models={models}
                  onUpdate={(w) => handleUpdateWidget(widget.id, w)}
                  onDelete={() => handleDeleteWidget(widget.id)}
                  onConfigDrawerChange={setConfigDrawerOpen}
                />
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </div>
  )
}
