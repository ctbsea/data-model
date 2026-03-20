import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, theme, Button, Spin, message, Dropdown, Avatar, Modal, Input, Form } from 'antd'
import {
  DashboardOutlined,
  DatabaseOutlined,
  PlusOutlined,
  UserOutlined,
  LogoutOutlined,
  MailOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { modelApi, Model } from '../api/model'
import { authApi, User } from '../api/auth'

const { Sider, Content } = AntLayout

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [emailSettingVisible, setEmailSettingVisible] = useState(false)
  const [emailForm] = Form.useForm()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    token: { colorBgContainer },
  } = theme.useToken()

  // 获取模型列表
  useEffect(() => {
    fetchModels()
    fetchCurrentUser()
  }, [])

  const fetchModels = async () => {
    setLoading(true)
    try {
      const response = await modelApi.list(1, 100)
      setModels(response.models || [])
    } catch (error: any) {
      message.error(error.response?.data?.error || '获取模型列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentUser = async () => {
    try {
      const user = await authApi.me()
      setCurrentUser(user)
    } catch (error) {
      console.error('Failed to fetch current user:', error)
    }
  }

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === '/dashboard' || key === '/model-list') {
      navigate(key)
    } else if (key.startsWith('/data/')) {
      navigate(key)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    navigate('/login')
  }

  const handleEmailSetting = () => {
    emailForm.setFieldsValue({ email_address: currentUser?.email_address || '' })
    setEmailSettingVisible(true)
  }

  const handleSaveEmailAddress = async (values: { email_address: string }) => {
    try {
      await authApi.updateEmailAddress(values.email_address)
      message.success('邮件地址已更新')
      setEmailSettingVisible(false)
      fetchCurrentUser()
    } catch (error: any) {
      message.error(error.response?.data?.error || '更新失败')
    }
  }

  // 用户菜单
  const userMenuItems = [
    {
      key: 'email-setting',
      icon: <MailOutlined />,
      label: '邮件设置',
      onClick: handleEmailSetting,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  // 构建菜单项
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/model-list',
      icon: <DatabaseOutlined />,
      label: '模型模板',
    },
  ]

  // 模型列表菜单项
  const modelMenuItems = models.map(model => ({
    key: `/data/${model.name}`,
    icon: <DatabaseOutlined />,
    label: model.display_name,
  }))

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider 
        style={{
          background: colorBgContainer,
          borderRight: '1px solid #f0f0f0',
        }}
        width={240}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Logo区域 */}
          <div style={{ 
            height: 64, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            borderBottom: '1px solid #f0f0f0',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }}>
              数据平台
            </span>
          </div>

          {/* 上部菜单 */}
          <div style={{ flexShrink: 0 }}>
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              style={{ 
                borderRight: 0,
                background: colorBgContainer,
              }}
              items={menuItems}
              onClick={handleMenuClick}
            />
          </div>

          {/* 分割线 */}
          <div style={{ 
            height: 1, 
            background: '#f0f0f0', 
            margin: '8px 16px',
            flexShrink: 0,
          }} />

          {/* 模型列表标题 */}
          <div style={{ 
            padding: '8px 24px', 
            fontSize: 12, 
            color: '#999',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <span>应用</span>
            <Button 
              type="text" 
              size="small" 
              icon={<PlusOutlined />}
              onClick={() => navigate('/model-list')}
            />
          </div>

          {/* 模型列表 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Spin />
              </div>
            ) : (
              <Menu
                mode="inline"
                selectedKeys={[location.pathname]}
                style={{ 
                  borderRight: 0,
                  background: colorBgContainer,
                }}
                items={modelMenuItems}
                onClick={handleMenuClick}
              />
            )}
          </div>

          {/* 底部用户区域 */}
          <div style={{ 
            flexShrink: 0,
            borderTop: '1px solid #f0f0f0',
            padding: '12px 16px',
            background: colorBgContainer,
          }}>
            <Dropdown 
              menu={{ items: userMenuItems }} 
              placement="topLeft" 
              trigger={['click']}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer',
                gap: 8,
              }}>
                <Avatar 
                  size={32} 
                  icon={<UserOutlined />} 
                  style={{ backgroundColor: '#1890ff' }}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ 
                    fontSize: 14, 
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {currentUser?.nickname || currentUser?.username || '用户'}
                  </div>
                  <div style={{ 
                    fontSize: 12, 
                    color: '#999',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {currentUser?.email || ''}
                  </div>
                </div>
              </div>
            </Dropdown>
          </div>
        </div>
      </Sider>
      <AntLayout>
        <Content style={{ 
          background: '#f5f5f5',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
        }}>
          <Outlet />
        </Content>
      </AntLayout>

      {/* 邮件设置弹窗 */}
      <Modal
        title="邮件设置"
        open={emailSettingVisible}
        onCancel={() => setEmailSettingVisible(false)}
        onOk={() => emailForm.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form form={emailForm} layout="vertical" onFinish={handleSaveEmailAddress}>
          <Form.Item 
            name="email_address" 
            label="邮件地址" 
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="请输入您的邮件地址" />
          </Form.Item>
        </Form>
      </Modal>
    </AntLayout>
  )
}

export default Layout
