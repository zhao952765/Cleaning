import { aiClient } from './client'
import { promptBuilder } from './prompts'
import { aiConfigManager } from './config'
import { AnalyzeProgress, BatchAnalysisItem, BatchAnalysisResult } from './types'
import { StartupItem } from '../../shared/types'

const BATCH_SIZE = 6  // 每批最多 6 项
const MAX_RETRIES = 2
const BATCH_DELAY_MS = 1500

/**
 * AIService - 启动项 AI 分析服务
 *
 * 功能：
 * - 每批最多 6 项分析（避免 token 超限）
 * - 失败自动重试 2 次（指数退避）
 * - isProtected:true 的项强制返回"不建议禁用"
 * - 进度回调
 */
export class AIService {
  private onProgress?: (progress: AnalyzeProgress) => void

  setProgressCallback(callback: (progress: AnalyzeProgress) => void): void {
    this.onProgress = callback
  }

  /**
   * 分析单个启动项
   */
  async analyzeSingle(item: StartupItem): Promise<any | null> {
    // 受保护项直接返回
    if (item.isProtected) {
      return {
        item_name: item.name,
        risk_level: 'Low',
        can_disable: false,
        disable_warning: item.protectedReason || '系统关键项，不建议禁用',
        reason: `${item.name} 是受保护的系统关键项，${item.protectedReason || '禁用可能导致系统不稳定'}`,
        suggestion: '保留此启动项，不要禁用',
        risk_score: 10,
      }
    }

    const config = aiConfigManager.getConfig()
    if (!config || !config.apiKey) throw new Error('请先配置 AI API')

    aiClient.initialize(config)
    this.emitProgress(0, 1, `分析: ${item.name}`)

    const systemPrompt = this.buildSystemPrompt()
    const userContent = this.buildSingleItemContent(item)

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt))
        const response = await aiClient.chat(userContent, { systemPrompt, history: [] })
        if (!response.answer) throw new Error('空响应')

        const result = this.parseJsonResponse(response.answer)
        if (result) {
          if (!result.item_name) result.item_name = item.name
          this.emitProgress(1, 1, `${item.name} 分析完成`)
          return result
        }
        throw new Error('JSON 解析失败')
      } catch (error: any) {
        if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') break
        if (attempt === MAX_RETRIES) console.error(`[AIService] ${item.name} 失败:`, error.message)
      }
    }
    this.emitProgress(1, 1, `${item.name} 分析失败`)
    return null
  }

  /**
   * 批量分析（每批最多 BATCH_SIZE 项）
   */
  async analyzeBatch(
    items: StartupItem[],
    onItemComplete?: (result: BatchAnalysisItem) => void
  ): Promise<BatchAnalysisResult> {
    const config = aiConfigManager.getConfig()
    if (!config || !config.apiKey) throw new Error('请先配置 AI API')

    aiClient.initialize(config)
    const allResults: BatchAnalysisItem[] = []
    const total = items.length
    let completed = 0

    this.emitProgress(0, total, `准备分析 ${total} 项...`)

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(items.length / BATCH_SIZE)

      this.emitProgress(completed, total, `分析第 ${batchNum}/${totalBatches} 批...`)

      // 对受保护项直接返回结果，不调用 API
      const normalItems = batch.filter(it => !it.isProtected)

      // 受保护项直接标记
      for (const it of batch) {
        if (it.isProtected) {
          const result: BatchAnalysisItem = {
            itemId: it.id, name: it.name,
            riskLevel: 'low' as 'low' | 'medium' | 'high' | 'critical', canDisable: false,
            disableWarning: it.protectedReason || '系统关键项',
            reason: `${it.name} 是系统关键项，受保护不可禁用`,
            suggestion: '建议保留此启动项',
            riskScore: 10,
          }
          allResults.push(result)
          onItemComplete?.(result)
          completed++
        }
      }

      // 正常项调用 AI 分析
      if (normalItems.length > 0) {
        const batchResults = await this.analyzeBatchGroup(normalItems)
        for (const result of batchResults) {
          completed++
          if (result) {
            allResults.push(result)
            onItemComplete?.(result)
          }
          this.emitProgress(completed, total, `已完成 ${completed}/${total}`)
        }
      }

      // 批次间延迟
      if (i + BATCH_SIZE < items.length) await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    }

    const optimizable = allResults.filter(r => r.canDisable && r.riskLevel === 'low').length
    const highRisk = allResults.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length

    this.emitProgress(total, total, '分析完成')
    return {
      items: allResults,
      summary: `分析完成：${total} 项，可优化 ${optimizable} 项，高风险 ${highRisk} 项`,
      totalOptimizable: optimizable,
    }
  }

  private async analyzeBatchGroup(batch: StartupItem[]): Promise<(BatchAnalysisItem | null)[]> {
    const { systemPrompt, userContent } = promptBuilder.buildBatchAnalysisPrompt(
      batch.map(it => ({
        id: it.id, name: it.name, path: it.path,
        description: it.description, publisher: it.publisher,
        source: it.source, enabled: it.enabled,
      }))
    )

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 3000 * attempt))
        const response = await aiClient.chat(userContent, { systemPrompt, history: [] })
        if (!response.answer) throw new Error('空响应')

        const parsed = this.parseJsonResponse(response.answer)
        if (parsed?.items && Array.isArray(parsed.items)) return parsed.items
        throw new Error('JSON 格式错误')
      } catch (error: any) {
        if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') break
      }
    }
    return batch.map(() => null)
  }

  /**
   * 改进的 System Prompt - 分析启动项
   */
  private buildSystemPrompt(): string {
    return `你是一位 Windows 系统启动项分析专家。分析以下启动项并输出 JSON。

评估维度：
1. risk_level: "Low" | "Medium" | "High" | "Critical"
2. can_disable: true/false（是否可安全禁用）
3. disable_warning: 如果 can_disable=false，写明原因
4. reason: 用中文说明分析理由，识别出常见软件（微信、QQ、NVIDIA、Steam、Adobe、百度网盘等）直接说名称和功能
5. suggestion: 明确的操作建议（中文）
6. risk_score: 0-100（越高越危险）

输出严格的 JSON 格式：
{"item_name":"...","risk_level":"Low|Medium|High|Critical","can_disable":true/false,"disable_warning":"...或null","reason":"...","suggestion":"...","risk_score":0-100}`
  }

  private buildSingleItemContent(item: StartupItem): string {
    return `分析: ${item.name}
路径: ${item.path || '未知'}
描述: ${item.description || '无'}
来源: ${item.source}
${item.fileInfo ? `发布者: ${item.fileInfo.company || '未知'}\n版本: ${item.fileInfo.version || '未知'}\n数字签名: ${item.fileInfo.signature?.status || '未知'}` : ''}`
  }

  private parseJsonResponse(text: string): any {
    try { return JSON.parse(text) } catch {}
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (m) try { return JSON.parse(m[1].trim()) } catch {}
    const b = text.match(/\{[\s\S]*\}/)
    if (b) try { return JSON.parse(b[0]) } catch {}
    return null
  }

  private emitProgress(current: number, total: number, message: string): void {
    this.onProgress?.({ current, total, message, percentage: total > 0 ? Math.round((current / total) * 100) : 0 })
  }
}

export const aiService = new AIService()
