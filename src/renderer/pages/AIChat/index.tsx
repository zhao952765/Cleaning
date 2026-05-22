import React, { useState, useRef, useEffect } from 'react'
import { Card, Input, Button, Space, Avatar, Empty, Tag, Divider } from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, StopOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAppStore } from '../../stores/appStore'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const AIChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { scanItems, aiConnected } = useAppStore()

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 快捷问题
  const quickQuestions = [
    '哪些启动项可以安全关闭？',
    '为什么开机这么慢？',
    '如何优化系统性能？',
    '这个软件是病毒吗？'
  ]

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    try {
      // 构建上下文，包含详细的启动项信息
      const context = {
        systemInfo: {
          osVersion: navigator.platform,
          totalItems: scanItems.length,
          enabledCount: scanItems.filter(i => i.enabled).length,
          disabledCount: scanItems.filter(i => !i.enabled).length
        },
        // 添加所有启动项的详细信息
        startupItems: scanItems.map(item => ({
          id: item.id,
          name: item.name,
          path: item.path,
          type: item.type,
          source: item.source,
          enabled: item.enabled,
          description: item.description || '',
          securityLevel: item.securityLevel,
          impact: item.impact,
          publisher: item.publisher || '',
          version: item.version || ''
        }))
      }

      const result = await window.electronAPI.aiChat(inputValue, context)

      if (result.success && result.data) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.data.answer,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage])
      } else {
        throw new Error(result.error || 'AI 响应失败')
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ 抱歉，发生错误：${error.message}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 点击快捷问题
  const handleQuickQuestion = (question: string) => {
    setInputValue(question)
  }

  // 清空历史
  const handleClearHistory = () => {
    setMessages([])
  }

  // 未连接 AI 提示
  if (!aiConnected) {
    return (
      <Card title="AI 助手">
        <Empty
          description="AI 未连接"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <p style={{ color: '#999' }}>请先在设置页面配置 AI</p>
        </Empty>
      </Card>
    )
  }

  return (
    <div style={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      {/* 头部信息 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Tag color="blue">基于 {scanItems.length} 个启动项</Tag>
          <Tag color="green">已启用: {scanItems.filter(i => i.enabled).length}</Tag>
          <Tag color="red">已禁用: {scanItems.filter(i => !i.enabled).length}</Tag>
          <Button size="small" onClick={handleClearHistory}>
            清空历史
          </Button>
        </Space>
      </Card>

      {/* 消息列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {messages.length === 0 ? (
          <Empty
            description="开始与 AI 助手对话吧"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Space wrap>
              {quickQuestions.map((q, idx) => (
                <Button key={idx} size="small" onClick={() => handleQuickQuestion(q)}>
                  {q}
                </Button>
              ))}
            </Space>
          </Empty>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 16
              }}
            >
              <Space align="start">
                {msg.role === 'assistant' && (
                  <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff' }} />
                )}
                
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: msg.role === 'user' ? '#1890ff' : '#f5f5f5',
                    color: msg.role === 'user' ? '#fff' : '#000'
                  }}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <div>{msg.content}</div>
                  )}
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#52c41a' }} />
                )}
              </Space>
            </div>
          ))
        )}
        
        {loading && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <RobotOutlined spin style={{ fontSize: 24, color: '#1890ff' }} />
            <p>AI 思考中...</p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* 输入框 */}
      <Space.Compact style={{ width: '100%' }}>
        <Input.TextArea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入您的问题..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={loading}
        />
        <Button
          type="primary"
          icon={loading ? <StopOutlined /> : <SendOutlined />}
          onClick={handleSend}
          loading={loading}
          disabled={!inputValue.trim()}
        >
          发送
        </Button>
      </Space.Compact>
    </div>
  )
}

export default AIChatPage
