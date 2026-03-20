import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Spin, message, Result, Button } from 'antd'
import { pageApi, Page } from '../api/page'

const DynamicPage = () => {
  const { '*': route } = useParams()
  const navigate = useNavigate()
  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPage()
  }, [route])

  const fetchPage = async () => {
    setLoading(true)
    setError(null)
    try {
      const fullRoute = '/' + (route || '')
      const response = await pageApi.getByRoute(fullRoute)
      setPage(response)
    } catch (error: any) {
      console.error('Failed to fetch page:', error)
      setError(error.response?.data?.error || '页面不存在')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <Result
        status="404"
        title="页面不存在"
        subTitle={error}
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            返回首页
          </Button>
        }
      />
    )
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f0f2f5' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {page?.title && (
          <h1 style={{ marginBottom: 24 }}>{page.title}</h1>
        )}
        
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          页面内容渲染功能开发中
        </div>
      </div>
    </div>
  )
}

export default DynamicPage
