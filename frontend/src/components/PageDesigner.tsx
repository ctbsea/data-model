import React, { useState, useCallback } from 'react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Layout, Tabs, Card, Button, Space, Modal, Form, Input, Select, InputNumber, Switch, ColorPicker, message } from 'antd'
import { 
  EditOutlined, 
  DeleteOutlined, 
  CopyOutlined, 
  SettingOutlined,
  SaveOutlined,
  EyeOutlined
} from '@ant-design/icons'
import { 
  componentRegistry, 
  getComponentsByCategory, 
  getAllComponents,
  ComponentType,
  ComponentDefinition 
} from './ComponentRegistry'
import type { Component } from '../api/page'

const { Sider, Content } = Layout
const { TabPane } = Tabs

interface PageDesignerProps {
  pageId?: string
  initialComponents?: Component[]
  onSave: (components: Component[]) => void
  onPreview?: (components: Component[]) => void
}

interface DragItem {
  type: 'new' | 'existing'
  component?: Component
  componentType?: ComponentType
}

const ComponentItem: React.FC<{ definition: ComponentDefinition }> = ({ definition }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'COMPONENT',
    item: { type: 'new', componentType: definition.type } as DragItem,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }))

  return (
    <div
      ref={drag}
      style={{
        padding: '8px 12px',
        marginBottom: 8,
        background: isDragging ? '#e6f7ff' : '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: 4,
        cursor: 'move',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <Space>
        <span>{definition.name}</span>
      </Space>
    </div>
  )
}

const ComponentPanel: React.FC = () => {
  const formComponents = getComponentsByCategory('form')
  const displayComponents = getComponentsByCategory('display')
  const layoutComponents = getComponentsByCategory('layout')

  return (
    <div style={{ padding: 16 }}>
      <Tabs defaultActiveKey="form" tabPosition="top">
        <TabPane tab="表单组件" key="form">
          {formComponents.map(comp => (
            <ComponentItem key={comp.type} definition={comp} />
          ))}
        </TabPane>
        <TabPane tab="展示组件" key="display">
          {displayComponents.map(comp => (
            <ComponentItem key={comp.type} definition={comp} />
          ))}
        </TabPane>
        <TabPane tab="布局组件" key="layout">
          {layoutComponents.map(comp => (
            <ComponentItem key={comp.type} definition={comp} />
          ))}
        </TabPane>
      </Tabs>
    </div>
  )
}

const CanvasComponent: React.FC<{
  component: Component
  isSelected: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, updates: Partial<Component>) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onMove: (dragId: string, hoverId: string) => void
}> = ({ component, isSelected, onSelect, onUpdate, onDelete, onDuplicate, onMove }) => {
  const ref = React.useRef<HTMLDivElement>(null)
  
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'COMPONENT',
    item: { type: 'existing', component } as DragItem,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }))

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'COMPONENT',
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
    drop: (item: DragItem) => {
      if (item.type === 'existing' && item.component && item.component.id !== component.id) {
        onMove(item.component.id, component.id)
      }
    },
  }))

  drag(drop(ref))

  const definition = componentRegistry[component.type]

  return (
    <div
      ref={ref}
      onClick={() => onSelect(component.id)}
      style={{
        position: 'relative',
        padding: 16,
        marginBottom: 8,
        background: isSelected ? '#e6f7ff' : '#fff',
        border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
        borderRadius: 4,
        cursor: 'move',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
        {definition?.name || component.type}
      </div>
      
      <div style={{ color: '#666', fontSize: 12 }}>
        {component.name}
      </div>

      {isSelected && (
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <Space size="small">
            <Button
              size="small"
              icon={<SettingOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(component.id)
              }}
            />
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate(component.id)
              }}
            />
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                onDelete(component.id)
              }}
            />
          </Space>
        </div>
      )}
    </div>
  )
}

const PropertyPanel: React.FC<{
  component: Component | null
  onUpdate: (id: string, updates: Partial<Component>) => void
}> = ({ component, onUpdate }) => {
  const [form] = Form.useForm()

  React.useEffect(() => {
    if (component) {
      form.setFieldsValue({
        name: component.name,
        ...component.props,
      })
    }
  }, [component, form])

  if (!component) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>
        请选择一个组件
      </div>
    )
  }

  const definition = componentRegistry[component.type]

  const handleValuesChange = (changedValues: any) => {
    onUpdate(component.id, { props: { ...component.props, ...changedValues } })
  }

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ marginBottom: 16 }}>属性配置</h3>
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
      >
        <Form.Item label="组件名称" name="name">
          <Input />
        </Form.Item>
        
        {definition?.propSchema.map(prop => (
          <Form.Item key={prop.name} label={prop.label} name={prop.name}>
            {prop.type === 'string' && <Input />}
            {prop.type === 'number' && <InputNumber style={{ width: '100%' }} />}
            {prop.type === 'boolean' && <Switch />}
            {prop.type === 'color' && <ColorPicker />}
            {prop.type === 'select' && (
              <Select options={prop.options} />
            )}
          </Form.Item>
        ))}
      </Form>
    </div>
  )
}

const PageDesigner: React.FC<PageDesignerProps> = ({ 
  pageId, 
  initialComponents = [], 
  onSave,
  onPreview 
}) => {
  const [components, setComponents] = useState<Component[]>(initialComponents)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const selectedComponent = components.find(c => c.id === selectedId) || null

  const handleDrop = useCallback((item: DragItem) => {
    if (item.type === 'new' && item.componentType) {
      const definition = componentRegistry[item.componentType]
      const newComponent: Component = {
        id: `comp_${Date.now()}`,
        type: item.componentType,
        name: definition.name,
        props: { ...definition.defaultProps },
        style: { ...definition.defaultStyle },
        events: [],
      }
      setComponents(prev => [...prev, newComponent])
    }
  }, [])

  const handleUpdate = useCallback((id: string, updates: Partial<Component>) => {
    setComponents(prev => prev.map(comp => 
      comp.id === id ? { ...comp, ...updates } : comp
    ))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setComponents(prev => prev.filter(comp => comp.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
    }
  }, [selectedId])

  const handleDuplicate = useCallback((id: string) => {
    const component = components.find(c => c.id === id)
    if (component) {
      const newComponent: Component = {
        ...component,
        id: `comp_${Date.now()}`,
        name: `${component.name} (副本)`,
      }
      setComponents(prev => [...prev, newComponent])
    }
  }, [components])

  const handleMove = useCallback((dragId: string, hoverId: string) => {
    const dragIndex = components.findIndex(c => c.id === dragId)
    const hoverIndex = components.findIndex(c => c.id === hoverId)
    
    if (dragIndex !== -1 && hoverIndex !== -1) {
      const newComponents = [...components]
      const [draggedComponent] = newComponents.splice(dragIndex, 1)
      newComponents.splice(hoverIndex, 0, draggedComponent)
      setComponents(newComponents)
    }
  }, [components])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(components)
      message.success('保存成功')
    } catch (error) {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'COMPONENT',
    drop: handleDrop,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }))

  return (
    <DndProvider backend={HTML5Backend}>
      <Layout style={{ height: '100vh', background: '#f0f2f5' }}>
        <Sider width={300} theme="light" style={{ borderRight: '1px solid #d9d9d9' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #d9d9d9' }}>
            <h3>组件库</h3>
          </div>
          <ComponentPanel />
        </Sider>
        
        <Content style={{ padding: 16, overflow: 'auto' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <h2>页面设计器</h2>
            <Space>
              {onPreview && (
                <Button 
                  icon={<EyeOutlined />}
                  onClick={() => onPreview(components)}
                >
                  预览
                </Button>
              )}
              <Button 
                type="primary" 
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSave}
              >
                保存
              </Button>
            </Space>
          </div>
          
          <div
            ref={drop}
            style={{
              minHeight: 600,
              padding: 16,
              background: isOver ? '#f0f9ff' : '#fff',
              border: '2px dashed #d9d9d9',
              borderRadius: 4,
            }}
          >
            {components.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                从左侧拖拽组件到此处
              </div>
            ) : (
              components.map(comp => (
                <CanvasComponent
                  key={comp.id}
                  component={comp}
                  isSelected={selectedId === comp.id}
                  onSelect={setSelectedId}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onMove={handleMove}
                />
              ))
            )}
          </div>
        </Content>
        
        <Sider width={300} theme="light" style={{ borderLeft: '1px solid #d9d9d9' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #d9d9d9' }}>
            <h3>属性面板</h3>
          </div>
          <PropertyPanel component={selectedComponent} onUpdate={handleUpdate} />
        </Sider>
      </Layout>
    </DndProvider>
  )
}

export default PageDesigner
