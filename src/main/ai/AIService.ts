import { aiClient } from './client'
import { promptBuilder, STARTUP_ANALYSIS_SYSTEM_PROMPT, BATCH_ANALYSIS_SYSTEM_PROMPT } from './prompts'
import { aiConfigManager } from './config'
import { EnhancedAnalysisResult, BatchAnalysisItem, BatchAnalysisResult, AnalyzeProgress } from './types'
import { StartupItem } from '../../shared/types'

const BATCH_SIZE = 10  // 每批最多 10 个

/**
 * 启动项 AI 分析服务
 * 提供智能分批、重试、超时控制、进度回调
 */
export class AIService {
  private onProgress?: (progress: AnalyzeProgress) => void

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: (progress: AnalyzeProgress) => void): void {
    this.onProgress = callback
  }

  /**
   * 分析单个启动项
   */
  async analyzeSingle(item: StartupItem): Promise<EnhancedAnalysisResult | null> {
    const config = aiConfigManager.getConfig()
    if (!config || !config.apiKey) {
      throw new Error('请先配置 AI API')
    }

    aiClient.initialize(config)

    this.emitProgress(0, 1, `正在分析: ${item.name}`)

    const systemPrompt = promptBuilder.getSingleAnalysisSystemPrompt()
    const userContent = this.buildSingleItemContent(item)

    const maxRetries = 2
    let lastError: any = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[AIService] 重试第 ${attempt} 次: ${item.name}`)
          await new Promise(r => setTimeout(r, 2000 * attempt))
        }

        const response = await aiClient.chat(userContent, {
          systemPrompt,
          history: []
        })

        if (!response.answer) {
          throw new Error('AI 返回空响应')
        }

        // 尝试解析 JSON
        const result = this.parseJsonResponse(response.answer)
        if (result) {
          // 确保 item_name 不为空
          if (!result.item_name) result.item_name = item.name
          this.emitProgress(1, 1, `${item.name} 分析完成`)
          return result
        }

        throw new Error('无法解析 AI 返回的 JSON')
      } catch (error: any) {
        lastError = error
        console.warn(`[AIService] 分析失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, error.message)

        // 超时不重试
        if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') break
      }
    }

    console.error(`[AIService] ${item.name} 分析最终失败:`, lastError?.message)
    this.emitProgress(1, 1, `${item.name} 分析失败`)
    return null
  }

  /**
   * 批量分析启动项（智能分批，每批 8-10 个，共享上下文节省 token）
   * @param items 启动项列表
   * @param onItemComplete 每项完成回调（用于前段逐项显示）
   */
  async analyzeBatch(
    items: StartupItem[],
    onItemComplete?: (result: BatchAnalysisItem) => void
  ): Promise<BatchAnalysisResult> {
    const config = aiConfigManager.getConfig()
    if (!config || !config.apiKey) {
      throw new Error('请先配置 AI API')
    }

    aiClient.initialize(config)

    const allResults: BatchAnalysisItem[] = []
    const totalItems = items.length
    let completedCount = 0

    this.emitProgress(0, totalItems, `准备分析 ${totalItems} 个启动项...`)

    // 智能分批：每批 BATCH_SIZE 个
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(items.length / BATCH_SIZE)

      this.emitProgress(
        completedCount, totalItems,
        `正在分析第 ${batchNum}/${totalBatches} 批 (${batch.length} 项)...`
      )

      const batchResults = await this.analyzeBatchGroup(batch)

      for (const result of batchResults) {
        completedCount++
        if (result) {
          allResults.push(result)
          onItemComplete?.(result)
        }
        this.emitProgress(completedCount, totalItems, `已完成 ${completedCount}/${totalItems}`)
      }

      // 批次间延迟 1s 避免限流
      if (i + BATCH_SIZE < items.length) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    // 统计摘要
    const optimizable = allResults.filter(r => r.canDisable && r.riskLevel === 'low').length
    const highRisk = allResults.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length

    this.emitProgress(totalItems, totalItems, '分析完成')

    return {
      items: allResults,
      summary: `分析完成：共 ${totalItems} 项，可优化 ${optimizable} 项，高风险 ${highRisk} 项`,
      totalOptimizable: optimizable
    }
  }

  /**
   * 分析一批启动项（10 个以内）
   */
  private async analyzeBatchGroup(batch: StartupItem[]): Promise<(BatchAnalysisItem | null)[]> {
    const maxRetries = 2

    // 构建批量分析内容
    const { systemPrompt, userContent } = promptBuilder.buildBatchAnalysisPrompt(
      batch.map(item => ({
        id: item.id,
        name: item.name,
        path: item.path,
        description: item.description,
        publisher: item.publisher,
        source: item.source,
        enabled: item.enabled
      }))
    )

    let lastError: any = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[AIService] 批量分析重试第 ${attempt} 次`)
          await new Promise(r => setTimeout(r, 3000 * attempt))
        }

        const response = await aiClient.chat(userContent, {
          systemPrompt,
          history: []
        })

        if (!response.answer) {
          throw new Error('AI 返回空响应')
        }

        const parsed = this.parseJsonResponse(response.answer)
        if (!parsed || !parsed.items || !Array.isArray(parsed.items)) {
          throw new Error('JSON 格式错误：缺少 items 数组')
        }

        // 确保返回项数量与 batch 一致
        if (parsed.items.length !== batch.length) {
          console.warn(`[AIService] 返回项数 (${parsed.items.length}) 与请求 (${batch.length}) 不匹配`)
        }

        return parsed.items
      } catch (error: any) {
        lastError = error
        console.warn(`[AIService] 批量分析失败 (${attempt + 1}/${maxRetries + 1}):`, error.message)

        if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') break
      }
    }

    console.error('[AIService] 批量分析最终失败:', lastError?.message)
    // 返回空结果
    return batch.map(() => null)
  }

  private buildSingleItemContent(item: StartupItem): string {
    return `请分析以下 Windows 启动项：
名称: ${item.name}
路径: ${item.path || '未知'}
描述: ${item.description || '无'}
发布者: ${item.publisher || '未知'}
来源类型: ${item.source}
当前状态: ${item.enabled ? '已启用' : '已禁用'}
${item.fileInfo ? `文件版本: ${item.fileInfo.version || '未知'}
文件大小: ${item.fileInfo.fileSize || '未知'} bytes
数字签名: ${item.fileInfo.signature?.status || '未知'}` : ''}`
  }

  /**
   * 从 AI 回复中提取 JSON（处理可能的 Markdown 包裹）
   */
  private parseJsonResponse(text: string): any {
    // 尝试直接解析
    try {
      return JSON.parse(text)
    } catch {
      // 尝试提取 ```json ... ``` 中的内容
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1].trim())
        } catch {}
      }
      // 尝试提取 {...} 或 [{...}]
      const braceMatch = text.match(/\{[\s\S]*\}/)
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0])
        } catch {}
      }
    }
    return null
  }

  private emitProgress(current: number, total: number, message: string): void {
    this.onProgress?.({
      current,
      total,
      message,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0
    })
  }
}

export const aiService = new AIService()
