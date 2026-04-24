import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout as AntLayout, Menu, theme, Button, Spin, message, Dropdown, Avatar, Modal, Input, Form, Badge } from 'antd'
import {
  DashboardOutlined,
  DatabaseOutlined,
  PlusOutlined,
  UserOutlined,
  LogoutOutlined,
  MailOutlined,
  SettingOutlined,
  LayoutOutlined,
} from '@ant-design/icons'
import { modelApi, Model } from '../api/model'
import { authApi, User } from '../api/auth'
import { dashboardApi } from '../api/dashboard'
import { emailApi } from '../api/email'
import EmailModal from './EmailModal'

const { Sider, Content } = AntLayout

interface Panel {
  id: string
  name: string
  widgets: any[]
  layout: any[]
}

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [emailSettingVisible, setEmailSettingVisible] = useState(false)
  const [emailForm] = Form.useForm()
  const [panels, setPanels] = useState<Panel[]>([])
  const [addPanelVisible, setAddPanelVisible] = useState(false)
  const [newPanelName, setNewPanelName] = useState('')
  const [emailModalVisible, setEmailModalVisible] = useState(false)
  const [unreadEmailCount, setUnreadEmailCount] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const {
    token: { colorBgContainer },
  } = theme.useToken()

  // 获取未读邮件数量
  const fetchUnreadCount = async () => {
    try {
      const res = await emailApi.getUnreadCount()
      setUnreadEmailCount(res.count || 0)
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  // 获取模型列表
  useEffect(() => {
    fetchModels()
    fetchCurrentUser()
    fetchPanels()
    // 不在 Layout 中自动获取未读邮件数量,由具体页面根据需要调用
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

  const fetchPanels = async () => {
    try {
      const dashboardRes = await dashboardApi.get()
      if (dashboardRes && dashboardRes.config) {
        const config = JSON.parse(dashboardRes.config)
        setPanels(config.panels || [])
      }
    } catch (error) {
      console.error('Failed to fetch panels:', error)
    }
  }

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === '/dashboard' || key === '/model-list') {
      navigate(key)
    } else if (key.startsWith('/data/')) {
      navigate(key)
    } else if (key.startsWith('/panel/')) {
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

  const handleAddPanel = async () => {
    if (!newPanelName.trim()) {
      message.warning('请输入面板名称')
      return
    }

    const newPanel: Panel = {
      id: `panel-${Date.now()}`,
      name: newPanelName.trim(),
      widgets: [],
      layout: [],
    }

    const newPanels = [...panels, newPanel]
    setPanels(newPanels)
    setNewPanelName('')
    setAddPanelVisible(false)

    // 保存到后端
    try {
      await dashboardApi.save({
        name: '仪表盘',
        config: JSON.stringify({ panels: newPanels }),
      })
      message.success('面板添加成功')
      navigate(`/panel/${newPanel.id}`)
    } catch (error) {
      console.error('Failed to save panel:', error)
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

  // 面板菜单项
  const panelMenuItems = panels.map(panel => ({
    key: `/panel/${panel.id}`,
    icon: <LayoutOutlined />,
    label: panel.name,
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

          {/* 面板列表标题 */}
          <div style={{ 
            padding: '8px 24px', 
            fontSize: 12, 
            color: '#999',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <span>面板</span>
            <Button 
              type="text" 
              size="small" 
              icon={<PlusOutlined />}
              onClick={() => setAddPanelVisible(true)}
            />
          </div>
          
          {panels.length > 0 && (
            <div style={{ flexShrink: 0 }}>
              <Menu
                mode="inline"
                selectedKeys={[location.pathname]}
                style={{ 
                  borderRight: 0,
                  background: colorBgContainer,
                }}
                items={panelMenuItems}
                onClick={handleMenuClick}
              />
            </div>
          )}

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
            flexShrink: 0,
          }}>
            <span>应用</span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* 邮件图标 */}
              <Badge count={unreadEmailCount} size="small">
                <Button 
                  type="text" 
                  icon={<MailOutlined />} 
                  onClick={() => setEmailModalVisible(true)}
                  style={{ marginRight: 4 }}
                />
              </Badge>
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
                  flex: 1,
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

      {/* 邮件列表 */}
      <EmailModal
        visible={emailModalVisible}
        email=""
        onClose={() => {
          setEmailModalVisible(false)
          fetchUnreadCount()
        }}
      />

      {/* 添加面板弹窗 */}
      <Modal
        title="添加面板"
        open={addPanelVisible}
        onOk={handleAddPanel}
        onCancel={() => {
          setAddPanelVisible(false)
          setNewPanelName('')
        }}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="请输入面板名称"
          value={newPanelName}
          onChange={e => setNewPanelName(e.target.value)}
          onPressEnter={handleAddPanel}
          autoFocus
        />
      </Modal>
    </AntLayout>
  )
}

export default Layout
