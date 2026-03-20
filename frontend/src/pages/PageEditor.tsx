import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Form, Input, Button, Card, message, Spin } from 'antd'
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import PageDesigner from '../components/PageDesigner'
import { pageApi, Page, Component } from '../api/page'

const PageEditor = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [components, setComponents] = useState<Component[]>([])

  useEffect(() => {
    if (id && id !== 'new') {
      fetchPage()
    }
  }, [id])

  const fetchPage = async () => {
    setLoading(true)
    try {
      const response = await pageApi.get(id!)
      setPage(response)
      form.setFieldsValue({
        name: response.name,
        route: response.route,
        title: response.title,
      })
      
      // 解析组件
      if (response.components) {
        try {
          const comps = JSON.parse(response.components)
          setComponents(comps)
        } catch (e) {
          console.error('Failed to parse components:', e)
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '获取页面失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (newComponents: Component[]) => {
    setSaving(true)
    try {
      const values = await form.validateFields()
      const pageData = {
        name: values.name,
        title: values.title,
        components: JSON.stringify(newComponents),
      }

      if (id === 'new') {
        // 创建新页面
        const newPage = await pageApi.create({
          name: values.name,
          route: values.route,
          title: values.title,
        })
        await pageApi.update(newPage.id, pageData)
        message.success('页面创建成功')
        navigate(`/pages/${newPage.id}`)
      } else {
        // 更新现有页面
        await pageApi.update(id!, pageData)
        message.success('页面保存成功')
      }
      
      setComponents(newComponents)
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = (components: Component[]) => {
    // TODO: 实现预览功能
    message.info('预览功能开发中')
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ 
        padding: '16px 24px', 
        background: '#fff', 
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/pages')}
          >
            返回
          </Button>
          <h2 style={{ margin: 0 }}>
            {id === 'new' ? '创建页面' : '编辑页面'}
          </h2>
        </div>
        
        <Form
          form={form}
          layout="inline"
          style={{ gap: 16 }}
        >
          <Form.Item
            name="name"
            rules={[{ required: true, message: '请输入页面名称' }]}
          >
            <Input placeholder="页面名称" style={{ width: 200 }} />
          </Form.Item>
          
          <Form.Item
            name="route"
            rules={[
              { required: true, message: '请输入路由' },
              { pattern: /^\//, message: '路由必须以 / 开头' }
            ]}
          >
            <Input placeholder="路由 (如: /products)" style={{ width: 200 }} disabled={id !== 'new'} />
          </Form.Item>
          
          <Form.Item name="title">
            <Input placeholder="页面标题" style={{ width: 200 }} />
          </Form.Item>
        </Form>
      </div>
      
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PageDesigner
          pageId={id}
          initialComponents={components}
          onSave={handleSave}
          onPreview={handlePreview}
        />
      </div>
    </div>
  )
}

export default PageEditor
