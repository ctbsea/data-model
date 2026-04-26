import React, { useState, useRef, useEffect } from 'react'
import { Button, Dropdown, Input, Modal, Select, DatePicker, Space, Tag, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, MoreOutlined, BarChartOutlined, NumberOutlined, FilterOutlined } from '@ant-design/icons'
import GridLayout from 'react-grid-layout'
import dayjs from 'dayjs'
import { Panel, Widget, GlobalFilter } from './types'
import { ChartWidget } from './ChartWidget'
import { StatisticWidget } from './StatisticWidget'
import { Model } from '../../api/model'
import type { MenuProps } from 'antd'

const { Option } = Select
const { RangePicker } = DatePicker

interface PanelComponentProps {
  panel: Panel
  models: Model[]
  onUpdate: (panel: Panel) => void
  onDelete: () => void
}

interface AddFilterModalState {
  open: boolean
  field: string
  label: string
  type: 'select' | 'date_range' | 'text'
}

export const PanelComponent: React.FC<PanelComponentProps> = ({ panel, models, onUpdate, onDelete }) => {
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState(panel.name)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(1100)
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false)
  const [addFilterModal, setAddFilterModal] = useState<AddFilterModalState>({
    open: false,
    field: '',
    label: '',
    type: 'select',
  })

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth - 32)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [panel.widgets.length])

  const handleAddWidget = (type: 'chart' | 'statistic') => {
    const existingWidgets = panel.widgets
    let maxY = 0
    existingWidgets.forEach(w => {
      if (w.y + w.h > maxY) maxY = w.y + w.h
    })

    const newWidget: Widget = type === 'chart'
      ? {
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
      : {
          id: `widget-${Date.now()}`,
          type: 'statistic',
          title: '新统计卡片',
          config: {
            modelId: '',
            modelName: '',
            aggregation: 'count',
          },
          x: 0,
          y: maxY,
          w: 3,
          h: 2,
        }

    onUpdate({
      ...panel,
      widgets: [...panel.widgets, newWidget],
    })
    message.success(type === 'chart' ? '已添加统计图表' : '已添加统计卡片')
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

  // Global filter handlers
  const handleFilterValueChange = (filterId: string, value: any) => {
    const updated = (panel.globalFilters || []).map(f =>
      f.id === filterId ? { ...f, value } : f
    )
    onUpdate({ ...panel, globalFilters: updated })
  }

  const handleRemoveFilter = (filterId: string) => {
    const updated = (panel.globalFilters || []).filter(f => f.id !== filterId)
    onUpdate({ ...panel, globalFilters: updated })
  }

  const handleAddFilter = () => {
    if (!addFilterModal.field || !addFilterModal.label) {
      message.warning('请填写字段名和显示名')
      return
    }
    const newFilter: GlobalFilter = {
      id: `gf-${Date.now()}`,
      field: addFilterModal.field,
      label: addFilterModal.label,
      type: addFilterModal.type,
    }
    onUpdate({
      ...panel,
      globalFilters: [...(panel.globalFilters || []), newFilter],
    })
    setAddFilterModal({ open: false, field: '', label: '', type: 'select' })
    message.success('已添加全局过滤器')
  }

  const addMenu: MenuProps = {
    items: [
      {
        key: 'chart',
        icon: <BarChartOutlined />,
        label: '添加统计图表',
        onClick: () => handleAddWidget('chart'),
      },
      {
        key: 'statistic',
        icon: <NumberOutlined />,
        label: '添加统计卡片',
        onClick: () => handleAddWidget('statistic'),
      },
    ],
  }

  const panelMenu: MenuProps = {
    items: [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: '编辑名称',
        onClick: () => setEditingName(true),
      },
      {
        key: 'add-filter',
        icon: <FilterOutlined />,
        label: '添加全局过滤器',
        onClick: () => setAddFilterModal(s => ({ ...s, open: true })),
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

  const layout = panel.widgets.map(w => ({
    i: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
  }))

  const globalFilters = panel.globalFilters || []

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
        borderBottom: globalFilters.length > 0 ? 'none' : '1px solid #e8e8e8',
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
          <Dropdown menu={addMenu} trigger={['click']}>
            <Button type="primary" icon={<PlusOutlined />} size="small">
              添加组件
            </Button>
          </Dropdown>
          <Dropdown menu={panelMenu} trigger={['click']}>
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </div>
      </div>

      {/* 全局过滤器条 */}
      {globalFilters.length > 0 && (
        <div style={{
          padding: '10px 20px',
          borderBottom: '1px solid #e8e8e8',
          background: '#f9fafb',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, whiteSpace: 'nowrap' }}>
            <FilterOutlined style={{ marginRight: 4 }} />
            全局筛选
          </span>
          {globalFilters.map(filter => (
            <Space key={filter.id} size={4} align="center">
              <span style={{ fontSize: 12, color: '#374151' }}>{filter.label}：</span>
              {filter.type === 'date_range' ? (
                <RangePicker
                  size="small"
                  value={
                    filter.value && filter.value.length === 2
                      ? [dayjs(filter.value[0]), dayjs(filter.value[1])]
                      : null
                  }
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      handleFilterValueChange(filter.id, [
                        dates[0].format('YYYY-MM-DD'),
                        dates[1].format('YYYY-MM-DD'),
                      ])
                    } else {
                      handleFilterValueChange(filter.id, null)
                    }
                  }}
                />
              ) : filter.type === 'text' ? (
                <Input
                  size="small"
                  style={{ width: 140 }}
                  placeholder={`搜索${filter.label}`}
                  value={filter.value || ''}
                  onChange={e => handleFilterValueChange(filter.id, e.target.value || null)}
                  allowClear
                />
              ) : (
                <Input
                  size="small"
                  style={{ width: 140 }}
                  placeholder={`输入${filter.label}`}
                  value={filter.value || ''}
                  onChange={e => handleFilterValueChange(filter.id, e.target.value || null)}
                  allowClear
                />
              )}
              <Tag
                closable
                onClose={() => handleRemoveFilter(filter.id)}
                style={{ margin: 0, cursor: 'pointer', fontSize: 11 }}
                color="default"
              />
            </Space>
          ))}
        </div>
      )}

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
            <span>点击上方"添加组件"按钮添加图表或统计卡片</span>
          </div>
        ) : (
          <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={80}
            width={containerWidth}
            onLayoutChange={(newLayout) => {
              if (configDrawerOpen) return
              const updatedWidgets = panel.widgets.map(w => {
                const layoutItem = newLayout.find(l => l.i === w.id)
                if (layoutItem) {
                  return { ...w, x: layoutItem.x, y: layoutItem.y, w: layoutItem.w, h: layoutItem.h }
                }
                return w
              })
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
                {widget.type === 'statistic' ? (
                  <StatisticWidget
                    widget={widget}
                    models={models}
                    onUpdate={(w) => handleUpdateWidget(widget.id, w)}
                    onDelete={() => handleDeleteWidget(widget.id)}
                    onConfigDrawerChange={setConfigDrawerOpen}
                    globalFilters={globalFilters}
                  />
                ) : (
                  <ChartWidget
                    widget={widget}
                    models={models}
                    onUpdate={(w) => handleUpdateWidget(widget.id, w)}
                    onDelete={() => handleDeleteWidget(widget.id)}
                    onConfigDrawerChange={setConfigDrawerOpen}
                    globalFilters={globalFilters}
                  />
                )}
              </div>
            ))}
          </GridLayout>
        )}
      </div>

      {/* 添加全局过滤器 Modal */}
      <Modal
        title="添加全局过滤器"
        open={addFilterModal.open}
        onOk={handleAddFilter}
        onCancel={() => setAddFilterModal(s => ({ ...s, open: false }))}
        okText="添加"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>字段名</div>
            <Input
              placeholder="例如：status、created_at"
              value={addFilterModal.field}
              onChange={e => setAddFilterModal(s => ({ ...s, field: e.target.value }))}
            />
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
              各 widget 会自动匹配同名字段，不存在的字段会被忽略
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>显示名称</div>
            <Input
              placeholder="例如：状态、创建时间"
              value={addFilterModal.label}
              onChange={e => setAddFilterModal(s => ({ ...s, label: e.target.value }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>过滤器类型</div>
            <Select
              style={{ width: '100%' }}
              value={addFilterModal.type}
              onChange={value => setAddFilterModal(s => ({ ...s, type: value }))}
            >
              <Option value="select">精确匹配</Option>
              <Option value="text">文本搜索</Option>
              <Option value="date_range">日期范围</Option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
