import React, { useState, useEffect } from 'react'
import { Card, Form, Select, Input, Button, message, Collapse, Alert, Space, Tag, Spin, Modal, App } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import { LLMConfig, PRESET_PROVIDERS, ModelInfo } from '../../../main/ai/types'

const { Option } = Select
const { Panel } = Collapse

// 声明 window 扩展类型
declare global {
  interface Window {
    electronAPI: any
  }
}

const AISettingsPage: React.FC = () => {
  const { message: antdMessage } = App.useApp()
  const [form] = Form.useForm()
  const { aiConfig, setAIConfig, setAIConnected } = useAppStore()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)

  // 初始化表单
  useEffect(() => {
    if (aiConfig) {
      form.setFieldsValue(aiConfig)
      // 如果已有配置且已连接，尝试获取模型列表
      if (aiConfig.apiKey) {
        loadModels()
      }
    }
  }, [aiConfig, form])

  // 加载模型列表（不触发测试连接）
  const loadModels = async () => {
    try {
      // 检查是否有配置
      const currentValues = form.getFieldsValue()
      
      if (!currentValues.apiKey || !currentValues.apiUrl) {
        antdMessage.warning('请先填写 API Key 和 API 地址')
        return
      }

      setLoadingModels(true)
      const result = await window.electronAPI.getAIModels()
      
      if (result.success && result.data) {
        setModels(result.data)
        antdMessage.success(`成功获取 ${result.data.length} 个模型`)
      } else {
        console.warn('获取模型列表失败:', result.error)
        antdMessage.error(result.error || '获取模型列表失败，请检查配置')
        
        // 如果失败，提示用户先测试连接
        Modal.confirm({
          title: '获取模型失败',
          icon: <InfoCircleOutlined />,
          content: '可能是 API Key 无效或网络连接问题。建议先点击"测试连接"按钮验证配置是否正确。',
          okText: '去测试连接',
          cancelText: '取消',
          onOk: () => handleTestConnection()
        })
      }
    } catch (error: any) {
      console.error('获取模型列表失败:', error)
      antdMessage.error('获取模型列表失败: ' + error.message)
    } finally {
      setLoadingModels(false)
    }
  }

  // 提供商选择变化 - 自动更新 API 地址和模型
  const handleProviderChange = (provider: string) => {
    const preset = PRESET_PROVIDERS[provider as keyof typeof PRESET_PROVIDERS]
    
    if (preset) {
      // 根据提供商自动设置 API 地址和模型
      const updates: any = {}
      
      if (provider !== 'custom') {
        // 非自定义提供商：使用预设的 API 地址和模型
        updates.apiUrl = preset.apiUrl
        updates.model = preset.model
        
        antdMessage.info(`已切换到 ${provider}，API 地址已自动设置为 ${preset.apiUrl}`)
      } else {
        // 自定义提供商：清空 API 地址，让用户自己输入
        updates.apiUrl = ''
        updates.model = ''
        
        antdMessage.info('已切换到自定义模式，请手动输入 API 地址和模型名称')
      }
      
      // 更新表单字段
      form.setFieldsValue(updates)
      
      // 清空模型列表，等待测试连接后重新加载
      setModels([])
    }
  }

  // API 地址变化时自动适配格式
  const handleApiUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let url = e.target.value
    
    // 移除末尾的斜杠
    url = url.replace(/\/+$/, '')
    
    // 根据当前选择的提供商自动添加路径
    const provider = form.getFieldValue('provider')
    
    if (provider === 'deepseek') {
      // DeepSeek: 确保以 /v1 结尾
      if (url && !url.endsWith('/v1')) {
        url = url + '/v1'
      }
    } else if (provider === 'openai') {
      // OpenAI: 确保包含 /v1
      if (url && !url.includes('/v1')) {
        url = url + '/v1'
      }
    } else if (provider === 'claude') {
      // Claude: 强制使用官方域名
      if (url && !url.includes('anthropic.com')) {
        url = 'https://api.anthropic.com/v1'
      }
    } else if (provider === 'custom') {
      // 自定义: 智能判断是否需要 /v1
      if (url && !url.includes('/v1') && !url.includes('/api')) {
        url = url + '/v1'
      }
    }
    
    form.setFieldValue('apiUrl', url)
  }

  // 测试连接（不触发加载模型，避免循环）
  const handleTestConnection = async (autoLoadModels = true) => {
    try {
      const values = await form.validateFields()
      setTesting(true)
      setTestResult(null)

      // 先保存配置
      await window.electronAPI.setAIConfig(values)
      
      // 测试连接
      const result = await window.electronAPI.testAIConnection()
      
      if (result.success && result.data) {
        setTestResult({ success: true, latency: result.data.latency })
        setAIConnected(true)
        antdMessage.success(`连接成功！延迟: ${result.data.latency}ms`)
        
        // 如果需要自动加载模型（由保存配置触发时才加载）
        if (autoLoadModels) {
          setTimeout(() => loadModels(), 500)
        }
      } else {
        setTestResult({ success: false, error: result.data?.error || '连接失败' })
        setAIConnected(false)
        antdMessage.error(result.data?.error || '连接失败')
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message })
      antdMessage.error('测试失败: ' + error.message)
    } finally {
      setTesting(false)
    }
  }

  // 保存配置
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      await window.electronAPI.setAIConfig(values)
      setAIConfig(values)
      antdMessage.success('配置保存成功')
      
      // 保存后测试连接并加载模型
      if (values.apiKey) {
        await handleTestConnection(true)
      }
    } catch (error: any) {
      antdMessage.error('保存失败: ' + error.message)
    }
  }

  // 清除配置
  const handleClear = async () => {
    await window.electronAPI.clearAIConfig()
    setAIConfig(null)
    setAIConnected(false)
    form.resetFields()
    setModels([])
    setTestResult(null)
    antdMessage.success('配置已清除')
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <Card title="AI 大模型配置">
        {/* 测试结果提示 */}
        {testResult && (
          <Alert
            message={testResult.success ? '连接成功' : '连接失败'}
            description={
              testResult.success
                ? `API 连接正常，响应延迟: ${testResult.latency}ms`
                : testResult.error
            }
            type={testResult.success ? 'success' : 'error'}
            icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            showIcon
            closable
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            provider: 'deepseek',
            temperature: 0.7,
            maxTokens: 2000
          }}
        >
          {/* 提供商选择 */}
          <Form.Item
            label="AI 提供商"
            name="provider"
            rules={[{ required: true, message: '请选择 AI 提供商' }]}
            extra="选择后将自动配置对应的 API 地址和默认模型"
          >
            <Select onChange={handleProviderChange}>
              <Option value="deepseek">DeepSeek</Option>
              <Option value="openai">OpenAI</Option>
              <Option value="claude">Claude</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </Form.Item>

          {/* API Key */}
          <Form.Item
            label="API Key"
            name="apiKey"
            rules={[{ required: true, message: '请输入 API Key' }]}
            extra="您的 API Key 将加密存储在本地"
          >
            <Input.Password
              placeholder="请输入您的 API Key"
              visibilityToggle={{ visible: showApiKey, onVisibleChange: setShowApiKey }}
            />
          </Form.Item>

          {/* API 地址 */}
          <Form.Item
            label="API 地址"
            name="apiUrl"
            rules={[
              { required: true, message: '请输入 API 地址' },
              { type: 'url', message: '请输入有效的 URL' }
            ]}
            extra={
              <Space direction="vertical" size="small">
                <span>系统会根据选择的提供商自动适配地址格式</span>
                <Tag color="blue">DeepSeek: https://api.deepseek.com/v1</Tag>
                <Tag color="green">OpenAI: https://api.openai.com/v1</Tag>
                <Tag color="purple">Claude: https://api.anthropic.com/v1</Tag>
              </Space>
            }
          >
            <Input 
              placeholder="https://api.deepseek.com" 
              onChange={handleApiUrlChange}
            />
          </Form.Item>

          {/* 模型选择 */}
          <Form.Item
            label="模型"
            name="model"
            rules={[{ required: true, message: '请选择或输入模型名称' }]}
            extra={
              <Space>
                <Button 
                  size="small" 
                  icon={<ReloadOutlined />} 
                  onClick={loadModels}
                  loading={loadingModels}
                  disabled={!form.getFieldValue('apiKey')}
                >
                  刷新模型列表
                </Button>
                {models.length > 0 && (
                  <Tag color="blue">{models.length} 个可用模型</Tag>
                )}
              </Space>
            }
          >
            <Select
              showSearch
              placeholder="选择或输入模型名称"
              optionFilterProp="children"
              loading={loadingModels}
              notFoundContent={loadingModels ? <Spin size="small" /> : '无可用模型'}
            >
              {models.map(model => (
                <Option key={model.id} value={model.id}>
                  <Space>
                    <span>{model.name}</span>
                    {model.description && (
                      <span style={{ color: '#999', fontSize: 12 }}>
                        - {model.description}
                      </span>
                    )}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* 温度参数 */}
          <Form.Item
            label="Temperature（创造性）"
            name="temperature"
            extra="值越高输出越随机，建议范围 0.5-1.0"
          >
            <Input type="number" min={0} max={1} step={0.1} />
          </Form.Item>

          {/* 最大 Token 数 */}
          <Form.Item
            label="Max Tokens（最大输出长度）"
            name="maxTokens"
            extra="单次对话的最大 token 数量"
          >
            <Input type="number" min={100} max={8000} />
          </Form.Item>

          {/* 操作按钮 */}
          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                onClick={handleSave}
              >
                保存配置
              </Button>
              <Button 
                onClick={() => handleTestConnection(false)}
                loading={testing}
                icon={testing ? <LoadingOutlined /> : undefined}
              >
                测试连接
              </Button>
              <Button danger onClick={handleClear}>
                清除配置
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {/* 使用说明 - 使用 items 替代 children */}
        <Collapse 
          style={{ marginTop: 24 }}
          items={[
            {
              key: '1',
              label: '如何获取 API Key？',
              children: (
                <div style={{ lineHeight: 1.8 }}>
                  <p><strong>DeepSeek：</strong></p>
                  <ol>
                    <li>访问 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer">DeepSeek 开放平台</a></li>
                    <li>注册并登录账号</li>
                    <li>进入「API Keys」页面</li>
                    <li>点击「创建 API Key」</li>
                    <li>复制生成的密钥（格式：sk-xxxxxxxx）</li>
                  </ol>
                  
                  <p><strong>OpenAI：</strong></p>
                  <ol>
                    <li>访问 <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer">OpenAI Platform</a></li>
                    <li>注册并充值</li>
                    <li>进入「API Keys」页面</li>
                    <li>创建新的密钥</li>
                  </ol>
                  
                  <p><strong>Claude：</strong></p>
                  <ol>
                    <li>访问 <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">Anthropic Console</a></li>
                    <li>注册并充值</li>
                    <li>进入「API Keys」页面</li>
                    <li>创建新的密钥</li>
                  </ol>
                </div>
              )
            },
            {
              key: '2',
              label: '常见问题',
              children: (
                <div style={{ lineHeight: 1.8 }}>
                  <p><strong>Q: API 地址需要手动添加 /v1 吗？</strong></p>
                  <p>A: 不需要。系统会根据选择的提供商自动适配地址格式。</p>
                  
                  <p><strong>Q: 为什么获取不到模型列表？</strong></p>
                  <p>A: 请确保：</p>
                  <ul>
                    <li>✓ API Key 正确且有效</li>
                    <li>✓ API 地址填写正确</li>
                    <li>✓ 网络连接正常</li>
                    <li>✓ API 账户有足够余额</li>
                    <li>✓ Claude API 不支持获取模型列表，这是正常的</li>
                  </ul>
                  
                  <p><strong>Q: 如何选择适合的模型？</strong></p>
                  <p>A: 建议：</p>
                  <ul>
                    <li>日常使用：选择通用对话模型（如 deepseek-chat、gpt-4o）</li>
                    <li>代码分析：选择代码专用模型（如 deepseek-coder）</li>
                    <li>快速响应：选择轻量级模型（如 gpt-3.5-turbo）</li>
                  </ul>
                  
                  <p><strong>Q: 填入 API Key 后如何获取模型？</strong></p>
                  <p>A: 有三种方式：</p>
                  <ol>
                    <li>点击"保存配置"按钮，会自动测试连接并获取模型列表</li>
                    <li>点击"测试连接"按钮，验证配置是否正确</li>
                    <li>点击"刷新模型列表"按钮，直接获取模型（需先确保配置正确）</li>
                  </ol>
                  
                  <p><strong>Q: 切换提供商后 API 地址会自动更新吗？</strong></p>
                  <p>A: 会的！选择提供商后，系统会自动填充对应的默认 API 地址和模型：</p>
                  <ul>
                    <li>DeepSeek → https://api.deepseek.com/v1</li>
                    <li>OpenAI → https://api.openai.com/v1</li>
                    <li>Claude → https://api.anthropic.com/v1</li>
                    <li>自定义 → 需要手动输入</li>
                  </ul>
                </div>
              )
            }
          ]}
        />
      </Card>
    </div>
  )
}

export default AISettingsPage
