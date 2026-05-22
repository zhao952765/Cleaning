/**
 * AI 大模型配置接口
 */

// AI 提供商类型
export type AIProvider = 'deepseek' | 'openai' | 'claude' | 'custom'

// LLM 配置接口
export interface LLMConfig {
  provider: AIProvider
  apiUrl: string
  apiKey: string
  model: string
  temperature?: number    // 0-1，默认 0.7
  maxTokens?: number      // 最大 token 数，默认 2000
}

// 模型信息接口
export interface ModelInfo {
  id: string              // 模型 ID
  name: string            // 模型名称
  description?: string    // 描述
  contextWindow?: number  // 上下文窗口大小
  maxOutput?: number      // 最大输出长度
  pricing?: {
    input: number         // 输入价格（每百万 tokens）
    output: number        // 输出价格（每百万 tokens）
  }
}

// AI 分析结果接口
export interface AIAnalysisResult {
  software_name: string
  vendor: string
  category: string
  description: string
  features: string[]
  trust_level: 'trusted' | 'mostly_trusted' | 'unknown' | 'suspicious' | 'malicious'
  trust_reason: string
  necessity: 'required' | 'recommended' | 'optional' | 'not_recommended' | 'must_disable'
  necessity_reason: string
  disable_impact: string
  performance_impact: {
    boot_time_ms: number      // 启动耗时（毫秒）
    memory_mb: number         // 内存占用（MB）
    cpu_percent: number       // CPU 占用百分比
  }
  recommendation: 'keep' | 'disable' | 'delay' | 'uninstall'
  recommendation_reason: string
  related_hardware: string[]
  alternatives: string[]
  warnings: string[]
  tags: string[]
}

// 安全威胁分析结果
export interface SecurityAnalysisResult {
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  risk_score: number          // 0-100
  file_path_risk: string
  behavior_analysis: string
  network_analysis: string
  indicators: string[]
  recommendation: {
    immediate_action: boolean
    action_options: string[]
  }
}

// 性能优化结果
export interface PerformanceOptimizeResult {
  boot_time_breakdown: {
    total_ms: number
    registry_ms: number
    services_ms: number
    tasks_ms: number
    folders_ms: number
  }
  slow_items: Array<{
    name: string
    path: string
    impact_ms: number
  }>
  optimization_plan: {
    quick_wins: string[]
    recommended_settings: string[]
  }
  expected_result: {
    estimated_boot_reduction_ms: number
    estimated_boot_reduction_percent: number
  }
}

// AI 对话结果
export interface AIChatResult {
  answer: string
  related_items: Array<{
    id: string
    name: string
    relevance: number  // 0-1
  }>
  suggested_questions: string[]
}

// 预设提供商配置
export const PRESET_PROVIDERS: Record<AIProvider, { 
  apiUrl: string
  model: string
  modelsEndpoint?: string  // 获取模型列表的端点
}> = {
  deepseek: {
    apiUrl: 'https://api.deepseek.com/v1',  // 统一添加 /v1
    model: 'deepseek-chat',
    modelsEndpoint: '/models'
  },
  openai: {
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',  // 更新为最新模型
    modelsEndpoint: '/models'
  },
  claude: {
    apiUrl: 'https://api.anthropic.com/v1',  // Claude 也使用 /v1
    model: 'claude-3-opus-20240229',
    modelsEndpoint: undefined  // Claude API 不支持模型列表
  },
  custom: {
    apiUrl: '',
    model: '',
    modelsEndpoint: '/models'
  }
}
