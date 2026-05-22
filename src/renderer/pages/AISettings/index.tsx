import React, { useState, useEffect } from 'react'
import { Card, Form, Select, Input, Button, message, Collapse, Alert, Space, Tag, Spin, Modal, App, Switch, Divider, Checkbox } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ReloadOutlined, InfoCircleOutlined, SettingOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import { LLMConfig, PRESET_PROVIDERS, ModelInfo } from '../../../main/ai/types'

const { Option } = Select
const { Panel } = Collapse

declare global {
  interface Window { electronAPI: any }
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
  const [autoUpdate, setAutoUpdate] = useState(true)
  const [scanSources, setScanSources] = useState<string[]>(['registry', 'service', 'task', 'folder'])

  useEffect(() => {
    if (aiConfig) {
      form.setFieldsValue(aiConfig)
      if (aiConfig.apiKey) loadModels()
    }
    // 从 localStorage 恢复设置
    try {
      const savedScan = localStorage.getItem('scan_sources')
      if (savedScan) setScanSources(JSON.parse(savedScan))
      const savedUpdate = localStorage.getItem('auto_update')
      if (savedUpdate !== null) setAutoUpdate(savedUpdate === 'true')
    } catch {}
  }, [aiConfig, form])

  const loadModels = async () => {
    const vals = form.getFieldsValue()
    if (!vals.apiKey || !vals.apiUrl) {
      antdMessage.warning('请先填写 API Key 和 API 地址')
      return
    }
    setLoadingModels(true)
    try {
      const r = await window.electronAPI.getAIModels()
      if (r.success && r.data) {
        setModels(r.data)
        antdMessage.success(`成功获取 ${r.data.length} 个模型`)
      } else {
        Modal.confirm({
          title: '获取模型失败', icon: <InfoCircleOutlined />,
          content: '请先点击"测试连接"验证配置是否正确。',
          okText: '测试连接', cancelText: '取消',
          onOk: () => handleTestConnection()
        })
      }
    } catch (e: any) { antdMessage.error('获取模型列表失败: ' + e.message) }
    finally { setLoadingModels(false) }
  }

  const handleProviderChange = (provider: string) => {
    const preset = PRESET_PROVIDERS[provider as keyof typeof PRESET_PROVIDERS]
    if (preset) {
      const updates: any = {}
      if (provider !== 'custom') {
        updates.apiUrl = preset.apiUrl
        updates.model = preset.model
      } else {
        updates.apiUrl = ''
        updates.model = ''
      }
      form.setFieldsValue(updates)
      setModels([])
    }
  }

  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields()
      setTesting(true)
      setTestResult(null)
      await window.electronAPI.setAIConfig(values)
      const result = await window.electronAPI.testAIConnection()
      if (result.success && result.data) {
        setTestResult({ success: true, latency: result.data.latency })
        setAIConnected(true)
        antdMessage.success(`连接成功！延迟: ${result.data.latency}ms`)
      } else {
        setTestResult({ success: false, error: result.data?.error || '连接失败' })
        setAIConnected(false)
        antdMessage.error(result.data?.error || '连接失败')
      }
    } catch (e: any) {
      setTestResult({ success: false, error: e.message })
      antdMessage.error('测试失败: ' + e.message)
    } finally { setTesting(false) }
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      await window.electronAPI.setAIConfig(values)
      setAIConfig(values)
      antdMessage.success('配置保存成功')
      // 保存扫描选项
      localStorage.setItem('scan_sources', JSON.stringify(scanSources))
      localStorage.setItem('auto_update', String(autoUpdate))
    } catch (e: any) { antdMessage.error('保存失败: ' + e.message) }
  }

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
      {/* AI 配置卡片 */}
      <Card title="AI 大模型配置" style={{ marginBottom: 24 }}>
        {testResult && (
          <Alert message={testResult.success ? '连接成功' : '连接失败'}
            description={testResult.success ? `API 响应延迟: ${testResult.latency}ms` : testResult.error}
            type={testResult.success ? 'success' : 'error'}
            icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />} showIcon closable
            style={{ marginBottom: 24 }} />
        )}
        <Form form={form} layout="vertical" initialValues={{
          provider: 'deepseek', temperature: 0.7, maxTokens: 2000
        }}>
          <Form.Item label="AI 提供商" name="provider" rules={[{ required: true, message: '请选择 AI 提供商' }]}>
            <Select onChange={handleProviderChange}>
              <Option value="deepseek">DeepSeek</Option>
              <Option value="openai">OpenAI</Option>
              <Option value="claude">Claude</Option>
              <Option value="tongyi">通义千问</Option>
              <Option value="custom">自定义</Option>
            </Select>
          </Form.Item>
          <Form.Item label="API Key" name="apiKey" rules={[{ required: true, message: '请输入 API Key' }]}>
            <Input.Password placeholder="请输入您的 API Key" visibilityToggle={{ visible: showApiKey, onVisibleChange: setShowApiKey }} />
          </Form.Item>
          <Form.Item label="API 地址" name="apiUrl" rules={[{ required: true, message: '请输入 API 地址' }, { type: 'url', message: '请输入有效的 URL' }]}>
            <Input placeholder="https://api.deepseek.com" onChange={(e) => {
              let url = e.target.value.replace(/\/+$/, '')
              const provider = form.getFieldValue('provider')
              if (provider !== 'custom' && url && !url.includes('/v1')) url = url + '/v1'
              form.setFieldValue('apiUrl', url)
            }} />
          </Form.Item>
          <Form.Item label="模型" name="model" rules={[{ required: true, message: '请选择或输入模型' }]}
            extra={<Space><Button size="small" icon={<ReloadOutlined />} onClick={loadModels} loading={loadingModels}>刷新模型列表</Button>{models.length > 0 && <Tag color="blue">{models.length} 个可用模型</Tag>}</Space>}>
            <Select showSearch placeholder="选择或输入模型" loading={loadingModels}
              notFoundContent={loadingModels ? <Spin size="small" /> : '无可用模型'}>
              {models.map(m => <Option key={m.id} value={m.id}><Space><span>{m.name}</span>{m.description && <span style={{ color: '#999', fontSize: 12 }}>- {m.description}</span>}</Space></Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="Temperature（创造性）" name="temperature" extra="值越高输出越随机，建议 0.3-0.7">
            <Input type="number" min={0} max={1} step={0.1} />
          </Form.Item>
          <Form.Item label="Max Tokens（最大输出）" name="maxTokens">
            <Input type="number" min={100} max={8000} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSave}>保存配置</Button>
              <Button onClick={() => handleTestConnection()} loading={testing}>测试连接</Button>
              <Button danger onClick={handleClear}>清除配置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 扫描选项卡片 */}
      <Card title={<Space><SettingOutlined />扫描选项</Space>} style={{ marginBottom: 24 }}>
        <Form layout="vertical">
          <Form.Item label="默认扫描来源">
            <Checkbox.Group value={scanSources} onChange={setScanSources}>
              <Space direction="vertical">
                <Checkbox value="registry">注册表启动项</Checkbox>
                <Checkbox value="service">系统服务</Checkbox>
                <Checkbox value="task">计划任务</Checkbox>
                <Checkbox value="folder">启动文件夹</Checkbox>
              </Space>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item label="自动检查更新">
            <Switch checked={autoUpdate} onChange={setAutoUpdate} />
            <span style={{ marginLeft: 8, color: '#999' }}>
              {autoUpdate ? '启动时检查新版本' : '手动检查更新'}
            </span>
          </Form.Item>
          <Button type="primary" onClick={handleSave}>保存设置</Button>
        </Form>
      </Card>

      {/* 帮助 */}
      <Collapse items={[
        {
          key: '1', label: '如何获取 API Key？',
          children: (
            <div style={{ lineHeight: 1.8 }}>
              <p><strong>DeepSeek：</strong></p>
              <ol><li>访问 platform.deepseek.com</li><li>注册登录 → API Keys → 创建 API Key</li></ol>
              <p><strong>OpenAI：</strong></p>
              <ol><li>访问 platform.openai.com</li><li>注册充值 → API Keys → 创建密钥</li></ol>
              <p><strong>Claude：</strong></p>
              <ol><li>访问 console.anthropic.com</li><li>注册充值 → API Keys → 创建密钥</li></ol>
              <p><strong>通义千问：</strong></p>
              <ol><li>访问 dashscope.aliyuncs.com</li><li>登录阿里云 → 模型服务灵积 → API-KEY 管理</li></ol>
            </div>
          )
        },
        {
          key: '2', label: '常见问题',
          children: (
            <div style={{ lineHeight: 1.8 }}>
              <p><strong>Q: 为什么获取不到模型列表？</strong></p>
              <p>A: 请检查：API Key 是否正确、网络连接正常、账户有余额。Claude API 不支持获取模型列表。</p>
              <p><strong>Q: 如何选择适合的模型？</strong></p>
              <p>A: 通用分析选择 deepseek-chat 或 gpt-4o，快速响应选择轻量模型。</p>
              <p><strong>Q: 切换提供商会自动更新 API 地址吗？</strong></p>
              <p>A: 会的。选择预设提供商后自动填充地址和默认模型。</p>
            </div>
          )
        }
      ]} />
    </div>
  )
}

export default AISettingsPage
