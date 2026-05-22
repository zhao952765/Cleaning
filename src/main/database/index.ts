import fs from 'fs'
import path from 'path'
import { app } from 'electron'

/**
 * 软件缓存数据接口
 */
export interface SoftwareCache {
  id: string              // 文件哈希（主键）
  name?: string
  vendor?: string
  category?: string
  description?: string
  trust_level?: number    // 0-100
  necessity?: number      // 0-100
  recommendation?: string // keep/disable/enable
  features?: string       // JSON 数组
  related_hardware?: string // JSON 数组
  ai_analyzed: boolean
  analyzed_at?: string    // ISO 时间字符串
  raw_response?: string   // AI 原始返回
}

/**
 * 用户操作记录接口
 */
export interface UserAction {
  id: number
  item_id: string
  action: string          // keep/disable/enable/delay
  timestamp: string       // ISO 时间字符串
  note?: string
}

/**
 * 扫描历史记录接口
 */
export interface ScanHistory {
  id: number
  scan_time: string       // ISO 时间字符串
  total_items: number
  boot_time_estimate: number
  report_json: string     // JSON 字符串
}

/**
 * 扫描缓存条目
 */
export interface ScanCacheEntry {
  path: string
  mtime: number
  hash: string
  scannedAt: string
}

/**
 * JSON 文件数据库管理器（开发环境友好）
 */
export class DatabaseManager {
  private dbPath: string
  private data: {
    software_cache: Map<string, SoftwareCache>
    user_actions: UserAction[]
    scan_history: ScanHistory[]
    scan_cache: ScanCacheEntry[]
  } = {
    software_cache: new Map(),
    user_actions: [],
    scan_history: [],
    scan_cache: []
  }

  constructor() {
    // 数据库文件存储在用户数据目录
    this.dbPath = path.join(app.getPath('userData'), 'startup_manager_db.json')
  }

  /**
   * 初始化数据库
   */
  initialize(): void {
    try {
      console.log(`[Database] 初始化数据库: ${this.dbPath}`)

      // 确保目录存在
      const dbDir = path.dirname(this.dbPath)
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }

      // 加载现有数据
      this.loadData()

      console.log('[Database] 数据库初始化完成')
    } catch (error) {
      console.error('[Database] 数据库初始化失败:', error)
      // 失败时创建空数据库
      this.saveData()
    }
  }

  /**
   * 从文件加载数据
   */
  private loadData(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const rawData = fs.readFileSync(this.dbPath, 'utf-8')
        const parsed = JSON.parse(rawData)

        this.data.software_cache = new Map(Object.entries(parsed.software_cache || {}))
        this.data.user_actions = parsed.user_actions || []
        this.data.scan_history = parsed.scan_history || []
        this.data.scan_cache = parsed.scan_cache || []

        console.log('[Database] 数据加载成功')
      } else {
        console.log('[Database] 数据库文件不存在，创建新数据库')
        this.saveData()
      }
    } catch (error) {
      console.error('[Database] 数据加载失败:', error)
      throw error
    }
  }

  /**
   * 保存数据到文件
   */
  private saveData(): void {
    try {
      const serialized = {
        software_cache: Object.fromEntries(this.data.software_cache),
        user_actions: this.data.user_actions,
        scan_history: this.data.scan_history,
        scan_cache: this.data.scan_cache
      }

      fs.writeFileSync(this.dbPath, JSON.stringify(serialized, null, 2), 'utf-8')
      console.log('[Database] 数据保存成功')
    } catch (error) {
      console.error('[Database] 数据保存失败:', error)
      throw error
    }
  }

  /**
   * 关闭数据库（保存数据）
   */
  close(): void {
    try {
      this.saveData()
      console.log('[Database] 数据库已关闭')
    } catch (error) {
      console.error('[Database] 关闭数据库失败:', error)
    }
  }

  // ==================== Software Cache 操作 ====================

  /**
   * 根据哈希查询软件缓存
   */
  getSoftwareByHash(hash: string): SoftwareCache | null {
    return this.data.software_cache.get(hash) || null
  }

  /**
   * 保存软件分析结果
   */
  saveSoftwareAnalysis(hash: string, data: Partial<SoftwareCache>): void {
    const now = new Date().toISOString()
    
    const existing = this.data.software_cache.get(hash)
    
    const updated: SoftwareCache = {
      id: hash,
      name: data.name || existing?.name,
      vendor: data.vendor || existing?.vendor,
      category: data.category || existing?.category,
      description: data.description || existing?.description,
      trust_level: data.trust_level || existing?.trust_level,
      necessity: data.necessity || existing?.necessity,
      recommendation: data.recommendation || existing?.recommendation,
      features: data.features || existing?.features,
      related_hardware: data.related_hardware || existing?.related_hardware,
      ai_analyzed: true,
      analyzed_at: now,
      raw_response: data.raw_response || existing?.raw_response
    }

    this.data.software_cache.set(hash, updated)
    this.saveData()

    console.log(`[Database] 保存软件分析结果: ${hash}`)
  }

  /**
   * 检查缓存是否有效（7天内）
   */
  isCacheValid(hash: string, maxAgeDays: number = 7): boolean {
    const cached = this.getSoftwareByHash(hash)
    if (!cached || !cached.analyzed_at) return false

    const analyzedAt = new Date(cached.analyzed_at)
    const now = new Date()
    const diffDays = (now.getTime() - analyzedAt.getTime()) / (1000 * 60 * 60 * 24)

    return diffDays < maxAgeDays
  }

  // ==================== User Actions 操作 ====================

  /**
   * 获取启动项的操作历史
   */
  getUserActions(itemId: string): UserAction[] {
    return this.data.user_actions
      .filter(action => action.item_id === itemId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  /**
   * 记录用户操作
   */
  logUserAction(itemId: string, action: string, note?: string): void {
    const now = new Date().toISOString()
    
    const newAction: UserAction = {
      id: this.data.user_actions.length + 1,
      item_id: itemId,
      action,
      timestamp: now,
      note
    }

    this.data.user_actions.push(newAction)
    this.saveData()

    console.log(`[Database] 记录用户操作: ${itemId} -> ${action}`)
  }

  /**
   * 获取所有用户操作
   */
  getAllUserActions(): UserAction[] {
    return this.data.user_actions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  // ==================== Scan History 操作 ====================

  /**
   * 保存扫描历史
   */
  saveScanHistory(
    totalItems: number,
    bootTimeEstimate: number,
    report: any
  ): void {
    const now = new Date().toISOString()
    
    const newHistory: ScanHistory = {
      id: this.data.scan_history.length + 1,
      scan_time: now,
      total_items: totalItems,
      boot_time_estimate: bootTimeEstimate,
      report_json: JSON.stringify(report)
    }

    this.data.scan_history.push(newHistory)
    
    // 只保留最近 100 条记录
    if (this.data.scan_history.length > 100) {
      this.data.scan_history = this.data.scan_history.slice(-100)
    }
    
    this.saveData()

    console.log(`[Database] 保存扫描历史: ${totalItems} 项`)
  }

  /**
   * 获取最近的扫描历史
   */
  getRecentScanHistory(limit: number = 10): ScanHistory[] {
    return this.data.scan_history
      .sort((a, b) => new Date(b.scan_time).getTime() - new Date(a.scan_time).getTime())
      .slice(0, limit)
  }

  /**
   * 获取数据库统计信息
   */
  getStats(): {
    softwareCacheCount: number
    userActionsCount: number
    scanHistoryCount: number
  } {
    return {
      softwareCacheCount: this.data.software_cache.size,
      userActionsCount: this.data.user_actions.length,
      scanHistoryCount: this.data.scan_history.length
    }
  }

  // ==================== 扫描缓存操作 ====================

  /**
   * 保存扫描缓存
   */
  saveScanCache(cache: ScanCacheEntry[]): void {
    this.data.scan_cache = cache
    this.saveData()
    console.log(`[Database] 扫描缓存已保存 (${cache.length} 项)`)
  }

  /**
   * 获取扫描缓存
   */
  getScanCache(): ScanCacheEntry[] {
    return [...this.data.scan_cache]
  }

  /**
   * 清除扫描缓存
   */
  clearScanCache(): void {
    this.data.scan_cache = []
    this.saveData()
    console.log('[Database] 扫描缓存已清除')
  }
}

/**
 * 导出单例实例
 */
export const databaseManager = new DatabaseManager()
