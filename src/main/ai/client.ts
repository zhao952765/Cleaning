import OpenAI from 'openai'
import { LLMConfig, AIAnalysisResult, SecurityAnalysisResult, PerformanceOptimizeResult, AIChatResult, ModelInfo } from './types'

/**
 * AI 大模型客户端
 * 支持 DeepSeek、OpenAI、Claude 等提供商
 */
export class AIClient {
  private config: LLMConfig | null = null
  private client: OpenAI | null = null
  private retryCount: number = 3

  constructor(config?: LLMConfig) {
    if (config) {
      this.initialize(config)
    }
  }

  /**
   * 初始化 AI 客户端
   */
  initialize(config: LLMConfig): void {
    this.config = config

    // 自动适配 API 地址格式
    const apiUrl = this.normalizeApiUrl(config.provider, config.apiUrl)

    // 创建 OpenAI 客户端实例（兼容所有提供商）
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: apiUrl,
      timeout: 30000, // 30秒超时
      maxRetries: this.retryCount
    })

    console.log(`[AIClient] 初始化完成，提供商: ${config.provider}, 模型: ${config.model}, URL: ${apiUrl}`)
  }

  /**
   * 自动适配 API 地址格式
   */
  private normalizeApiUrl(provider: string, apiUrl: string): string {
    // 移除末尾的斜杠
    let url = apiUrl.replace(/\/+$/, '')

    // 根据不同提供商自动添加路径
    switch (provider) {
      case 'deepseek':
        // DeepSeek 需要 /v1 后缀
        if (!url.endsWith('/v1')) {
          url = url + '/v1'
        }
        break
      case 'openai':
        // OpenAI 已经包含 /v1
        if (!url.includes('/v1')) {
          url = url + '/v1'
        }
        break
      case 'claude':
        // Claude 使用不同的基础 URL，确保有 /v1
        if (!url.includes('anthropic.com')) {
          url = 'https://api.anthropic.com/v1'
        } else if (!url.endsWith('/v1')) {
          url = url + '/v1'
        }
        break
      case 'custom':
        // 自定义提供商，尝试智能判断
        if (!url.includes('/v1') && !url.includes('/api')) {
          // 如果 URL 看起来像基础域名，添加 /v1
          url = url + '/v1'
        }
        break
    }

    return url
  }

  /**
   * 测试 API 连通性
   */
  async testConnection(): Promise<{
    success: boolean
    latency?: number
    error?: string
  }> {
    if (!this.client || !this.config) {
      return { success: false, error: 'AI 客户端未初始化' }
    }

    const startTime = Date.now()

    try {
      // 发送一个简单的测试请求
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        max_tokens: 5
      })

      const latency = Date.now() - startTime

      // 检查是否有有效响应
      if (response.choices && response.choices.length > 0) {
        console.log(`[AIClient] 连接测试成功，延迟: ${latency}ms`)
        return { success: true, latency }
      } else {
        return { success: false, error: 'API 返回空响应' }
      }
    } catch (error: any) {
      const latency = Date.now() - startTime
      
      let errorMessage = '连接失败'
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage = '无法连接到 API 服务器，请检查网络或代理设置'
      } else if (error.status === 401) {
        errorMessage = 'API Key 无效，请检查密钥配置'
      } else if (error.status === 429) {
        errorMessage = 'API 调用次数超限，请稍后重试'
      } else if (error.message) {
        errorMessage = error.message
      }

      console.error('[AIClient] 连接测试失败:', errorMessage)
      return { success: false, latency, error: errorMessage }
    }
  }

  /**
   * 分析单个软件
   */
  async analyzeSoftware(
    prompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<AIAnalysisResult | null> {
    if (!this.client || !this.config) {
      throw new Error('AI 客户端未初始化')
    }

    try {
      console.log('[AIClient] 开始分析软件...')

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的 Windows 启动项分析助手。请严格按照要求的 JSON 格式返回分析结果。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: options?.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 2000,
        response_format: { type: 'json_object' } // 强制 JSON 输出
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        console.warn('[AIClient] API 返回空内容')
        return null
      }

      // 解析 JSON 响应
      const result = JSON.parse(content) as AIAnalysisResult

      console.log('[AIClient] 软件分析完成')
      return result
    } catch (error: any) {
      console.error('[AIClient] 软件分析失败:', error.message)
      throw error
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels(): Promise<ModelInfo[]> {
    if (!this.client || !this.config) {
      throw new Error('AI 客户端未初始化')
    }

    // Claude API 不支持模型列表
    if (this.config.provider === 'claude') {
      console.log('[AIClient] Claude API 不支持获取模型列表')
      return this.getDefaultModels()
    }

    try {
      console.log('[AIClient] 正在获取模型列表...')
      console.log(`[AIClient] API URL: ${this.client.baseURL}`)
      console.log(`[AIClient] Provider: ${this.config.provider}`)

      // 使用 fetch API 直接调用 models 端点
      // 注意：baseURL 已经包含 /v1，所以只需要添加 /models
      const modelsUrl = `${this.client.baseURL}/models`
      
      console.log(`[AIClient] Models endpoint: ${modelsUrl}`)

      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10秒超时
      })

      console.log(`[AIClient] Response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[AIClient] API error response:`, errorText)
        
        let errorMessage = `HTTP ${response.status}`
        if (response.status === 401) {
          errorMessage = 'API Key 无效或已过期'
        } else if (response.status === 403) {
          errorMessage = '没有权限访问此 API'
        } else if (response.status === 429) {
          errorMessage = 'API 调用次数超限'
        } else if (response.status >= 500) {
          errorMessage = '服务器错误，请稍后重试'
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json() as any
      console.log(`[AIClient] Raw response:`, JSON.stringify(data).substring(0, 200))
      
      // 解析模型数据（OpenAI 兼容格式）
      if (!data.data || !Array.isArray(data.data)) {
        console.warn('[AIClient] Invalid response format, using default models')
        return this.getDefaultModels()
      }

      const models: ModelInfo[] = data.data.map((model: any) => ({
        id: model.id,
        name: model.id,
        description: model.description || '',
        contextWindow: model.context_window,
        maxOutput: model.max_output_tokens,
        pricing: model.pricing
      }))

      console.log(`[AIClient] 成功获取到 ${models.length} 个模型`)
      return models
    } catch (error: any) {
      console.error('[AIClient] 获取模型列表失败:', error.message)
      
      // 更详细的错误信息
      if (error.name === 'AbortError') {
        console.error('[AIClient] 请求超时')
      } else if (error.code === 'ECONNREFUSED') {
        console.error('[AIClient] 无法连接到服务器')
      } else if (error.code === 'ENOTFOUND') {
        console.error('[AIClient] 域名解析失败')
      }
      
      // 返回默认模型作为后备
      console.log('[AIClient] 使用默认模型列表')
      return this.getDefaultModels()
    }
  }

  /**
   * 获取默认模型列表（当 API 调用失败时）
   */
  private getDefaultModels(): ModelInfo[] {
    const defaultModels: Record<string, ModelInfo[]> = {
      deepseek: [
        { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '通用对话模型' },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', description: '代码专用模型' },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: '推理专用模型' }
      ],
      openai: [
        { id: 'gpt-4o', name: 'GPT-4o', description: '最新多模态模型' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '高性能模型' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '快速经济模型' }
      ],
      claude: [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: '最强性能模型' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: '平衡性能和速度' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: '快速响应模型' }
      ],
      custom: [
        { id: 'custom-model', name: '自定义模型', description: '请手动输入模型名称' }
      ]
    }

    return defaultModels[this.config?.provider || 'deepseek'] || defaultModels.custom
  }

  /**
   * 批量分析启动项（支持并发控制）
   */
  async batchAnalyze(
    prompts: string[],
    concurrency: number = 5
  ): Promise<(AIAnalysisResult | null)[]> {
    const results: (AIAnalysisResult | null)[] = []
    
    console.log(`[AIClient] 开始批量分析，共 ${prompts.length} 项，并发数: ${concurrency}`)

    // 分批处理
    for (let i = 0; i < prompts.length; i += concurrency) {
      const batch = prompts.slice(i, i + concurrency)
      console.log(`[AIClient] 处理批次 ${Math.floor(i / concurrency) + 1}/${Math.ceil(prompts.length / concurrency)}`)

      const batchResults = await Promise.all(
        batch.map(async (prompt) => {
          try {
            return await this.analyzeSoftware(prompt)
          } catch (error) {
            console.error('[AIClient] 批量分析中某项失败:', error)
            return null
          }
        })
      )

      results.push(...batchResults)

      // 避免触发速率限制，批次间延迟
      if (i + concurrency < prompts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log('[AIClient] 批量分析完成')
    return results
  }

  /**
   * AI 对话（支持上下文）
   */
  async chat(
    query: string,
    context?: {
      systemPrompt?: string
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
    }
  ): Promise<AIChatResult> {
    if (!this.client || !this.config) {
      throw new Error('AI 客户端未初始化')
    }

    try {
      console.log('[AIClient] 开始 AI 对话...')

      const messages: any[] = []

      // 添加系统提示
      if (context?.systemPrompt) {
        messages.push({
          role: 'system',
          content: context.systemPrompt
        })
      }

      // 添加历史对话
      if (context?.history) {
        messages.push(...context.history)
      }

      // 添加当前问题
      messages.push({
        role: 'user',
        content: query
      })

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 2000
      })

      const answer = response.choices[0]?.message?.content || ''

      console.log('[AIClient] AI 对话完成')

      return {
        answer,
        related_items: [],
        suggested_questions: [
          '哪些启动项可以安全禁用？',
          '如何优化开机速度？',
          '这个软件是必需的吗？'
        ]
      }
    } catch (error: any) {
      console.error('[AIClient] AI 对话失败:', error.message)
      throw error
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): LLMConfig | null {
    return this.config
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LLMConfig>): void {
    if (!this.config) {
      throw new Error('请先初始化配置')
    }

    this.config = { ...this.config, ...config }
    this.initialize(this.config)
  }

  /**
   * 清除 API Key（安全考虑）
   */
  clearApiKey(): void {
    if (this.config) {
      this.config.apiKey = ''
      this.client = null
      console.log('[AIClient] API Key 已清除')
    }
  }
}

/**
 * 导出单例实例
 */
export const aiClient = new AIClient()
