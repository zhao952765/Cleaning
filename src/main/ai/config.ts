import { LLMConfig, PRESET_PROVIDERS } from './types'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

/**
 * AI 配置管理器
 * 负责持久化存储和读取 AI 配置
 */
export class AIConfigManager {
  private configPath: string
  private currentConfig: LLMConfig | null = null

  constructor() {
    // 配置文件存储在用户数据目录
    this.configPath = path.join(app.getPath('userData'), 'ai_config.json')
  }

  /**
   * 获取当前配置
   */
  getConfig(): LLMConfig | null {
    if (this.currentConfig) {
      return this.currentConfig
    }

    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8')
        this.currentConfig = JSON.parse(data) as LLMConfig
        console.log('[AIConfigManager] 配置加载成功')
        return this.currentConfig
      } else {
        console.log('[AIConfigManager] 配置文件不存在，使用默认配置')
        return null
      }
    } catch (error) {
      console.error('[AIConfigManager] 加载配置失败:', error)
      return null
    }
  }

  /**
   * 保存配置
   */
  saveConfig(config: LLMConfig): void {
    try {
      // 确保目录存在
      const dir = path.dirname(this.configPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // 保存配置（注意：API Key 应该加密存储，这里简化处理）
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
      
      this.currentConfig = config
      console.log('[AIConfigManager] 配置保存成功')
    } catch (error) {
      console.error('[AIConfigManager] 保存配置失败:', error)
      throw error
    }
  }

  /**
   * 使用预设提供商配置
   */
  usePresetProvider(provider: 'deepseek' | 'openai' | 'claude', apiKey: string): LLMConfig {
    const preset = PRESET_PROVIDERS[provider]
    
    const config: LLMConfig = {
      provider,
      apiUrl: preset.apiUrl,
      apiKey,
      model: preset.model,
      temperature: 0.7,
      maxTokens: 2000
    }

    this.saveConfig(config)
    return config
  }

  /**
   * 清除配置
   */
  clearConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath)
      }
      this.currentConfig = null
      console.log('[AIConfigManager] 配置已清除')
    } catch (error) {
      console.error('[AIConfigManager] 清除配置失败:', error)
    }
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    const config = this.getConfig()
    return !!(config && config.apiKey && config.apiUrl && config.model)
  }

  /**
   * 验证配置有效性
   */
  validateConfig(config: Partial<LLMConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.provider || !['deepseek', 'openai', 'claude', 'custom'].includes(config.provider)) {
      errors.push('无效的提供商类型')
    }

    if (!config.apiKey || config.apiKey.trim().length === 0) {
      errors.push('API Key 不能为空')
    }

    if (!config.apiUrl || !config.apiUrl.startsWith('http')) {
      errors.push('API URL 必须是有效的 HTTP/HTTPS 地址')
    }

    if (!config.model || config.model.trim().length === 0) {
      errors.push('模型名称不能为空')
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 1)) {
      errors.push('Temperature 必须在 0-1 之间')
    }

    if (config.maxTokens !== undefined && config.maxTokens < 100) {
      errors.push('Max Tokens 必须大于 100')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

/**
 * 导出单例实例
 */
export const aiConfigManager = new AIConfigManager()
