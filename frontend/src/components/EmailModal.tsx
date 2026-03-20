import React, { useState, useEffect } from 'react'
import { Drawer, Tabs, List, Button, Input, Form, message, Tag, Empty, Badge, Divider } from 'antd'
import { MailOutlined, SendOutlined, InboxOutlined, DeleteOutlined, PaperClipOutlined, CloseOutlined } from '@ant-design/icons'
import { emailApi, Email } from '../api/email'
import dayjs from 'dayjs'

const { TextArea } = Input

interface EmailModalProps {
  visible: boolean
  email: string
  onClose: () => void
  onFilterChange?: (email: string | null) => void
}

const EmailModal: React.FC<EmailModalProps> = ({ visible, email, onClose, onFilterChange }) => {
  const [activeTab, setActiveTab] = useState('inbox')
  const [inboxEmails, setInboxEmails] = useState<Email[]>([])
  const [sentEmails, setSentEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(false)
  const [sendForm] = Form.useForm()
  const [showSendForm, setShowSendForm] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [currentEmail, setCurrentEmail] = useState(email)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)

  useEffect(() => {
    setCurrentEmail(email)
  }, [email])

  useEffect(() => {
    if (visible) {
      loadEmails()
    }
  }, [visible, activeTab, currentEmail])

  const loadEmails = async () => {
    setLoading(true)
    try {
      if (activeTab === 'inbox') {
        const res = await emailApi.getInbox(1, 50, currentEmail || undefined)
        setInboxEmails(res.emails || [])
      } else {
        const res = await emailApi.getSent(1, 50, currentEmail || undefined)
        setSentEmails(res.emails || [])
      }
    } catch (error) {
      console.error('Failed to load emails:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (values: any) => {
    try {
      await emailApi.send({
        to: values.to,
        subject: values.subject,
        body: values.body
      })
      message.success('邮件已发送')
      sendForm.resetFields()
      setAttachments([])
      setShowSendForm(false)
      setActiveTab('sent')
    } catch (error: any) {
      message.error(error.response?.data?.error || '发送失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await emailApi.delete(id)
      message.success('已删除')
      loadEmails()
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleClearFilter = () => {
    onFilterChange?.(null)
    setCurrentEmail('')
  }

  const handleEmailClick = async (emailItem: Email) => {
    setSelectedEmail(emailItem)
    // 标记已读
    if (!emailItem.is_read) {
      try {
        await emailApi.markAsRead(emailItem.id)
        loadEmails()
      } catch (error) {
        console.error('Failed to mark as read:', error)
      }
    }
  }

  const renderEmailList = (emails: Email[], type: 'inbox' | 'sent') => (
    <List
      dataSource={emails}
      loading={loading}
      locale={{ emptyText: <Empty description="暂无邮件" /> }}
      renderItem={(item) => (
        <List.Item
          onClick={() => handleEmailClick(item)}
          style={{ 
            cursor: 'pointer',
            background: !item.is_read && type === 'inbox' ? '#f0f5ff' : 'transparent',
            fontWeight: !item.is_read && type === 'inbox' ? 'bold' : 'normal'
          }}
          actions={[
            <Button 
              type="text" 
              size="small" 
              icon={<DeleteOutlined />} 
              danger 
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(item.id)
              }} 
            />
          ]}
        >
          <List.Item.Meta
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!item.is_read && type === 'inbox' && (
                  <Badge status="processing" />
                )}
                <span>{item.subject}</span>
              </div>
            }
            description={
              <div>
                <div style={{ marginBottom: 4 }}>
                  {type === 'inbox' ? `来自: ${item.from}` : `发送至: ${item.to}`}
                </div>
                <div style={{ color: '#999', fontSize: 12 }}>
                  {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                </div>
              </div>
            }
          />
        </List.Item>
      )}
    />
  )

  return (
    <>
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MailOutlined />
              <span>邮件</span>
              {currentEmail && (
                <Tag color="blue" closable onClose={(e) => {
                  e.preventDefault()
                  handleClearFilter()
                }}>
                  {currentEmail}
                </Tag>
              )}
            </div>
            <Button type="primary" icon={<SendOutlined />} onClick={() => setShowSendForm(true)}>
              发送邮件
            </Button>
          </div>
        }
        placement="right"
        open={visible}
        onClose={onClose}
        width={600}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'inbox',
              label: (
                <span>
                  <InboxOutlined /> 收件箱
                </span>
              ),
              children: renderEmailList(inboxEmails, 'inbox')
            },
            {
              key: 'sent',
              label: (
                <span>
                  <SendOutlined /> 发件箱
                </span>
              ),
              children: renderEmailList(sentEmails, 'sent')
            }
          ]}
        />
      </Drawer>

      {/* 发送邮件表单 */}
      <Drawer
        title="发送邮件"
        placement="right"
        open={showSendForm}
        onClose={() => {
          setShowSendForm(false)
          setAttachments([])
        }}
        width={500}
      >
        <Form form={sendForm} layout="vertical" onFinish={handleSend}>
          <Form.Item name="to" label="收件人" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="请输入收件人邮箱" />
          </Form.Item>
          <Form.Item name="subject" label="主题" rules={[{ required: true }]}>
            <Input placeholder="请输入邮件主题" />
          </Form.Item>
          <Form.Item name="body" label="内容" rules={[{ required: true }]}>
            <TextArea rows={6} placeholder="请输入邮件内容" />
          </Form.Item>
          <Form.Item label="附件">
            <Input type="file" multiple onChange={(e) => {
              const files = e.target.files
              if (files) {
                setAttachments(Array.from(files))
              }
            }} />
            {attachments.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {attachments.map((f, i) => (
                  <Tag key={i} closable onClose={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                    {f.name}
                  </Tag>
                ))}
              </div>
            )}
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block icon={<SendOutlined />}>
              发送
            </Button>
          </Form.Item>
        </Form>
      </Drawer>

      {/* 邮件详情 */}
      <Drawer
        title={selectedEmail?.subject}
        placement="right"
        open={!!selectedEmail}
        onClose={() => setSelectedEmail(null)}
        width={500}
      >
        {selectedEmail && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#666', marginBottom: 8 }}>
                <strong>发件人:</strong> {selectedEmail.from}
              </div>
              <div style={{ color: '#666', marginBottom: 8 }}>
                <strong>收件人:</strong> {selectedEmail.to}
              </div>
              <div style={{ color: '#666', marginBottom: 8 }}>
                <strong>时间:</strong> {dayjs(selectedEmail.created_at).format('YYYY-MM-DD HH:mm')}
              </div>
              <div style={{ color: '#666', marginBottom: 8 }}>
                <strong>状态:</strong> {selectedEmail.is_read ? '已读' : '未读'}
              </div>
            </div>
            <Divider />
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {selectedEmail.body}
            </div>
          </div>
        )}
      </Drawer>
    </>
  )
}

export default EmailModal
