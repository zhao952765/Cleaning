import { StartupItem } from '../../shared/types'

/**
 * 扫描结果缓存
 * 5分钟内重复扫描直接返回缓存
 */
export class ScanCache {
  private cache: Map<string, { data: StartupItem[]; timestamp: number }> = new Map()
  private readonly TTL = 5 * 60 * 1000 // 5分钟

  /**
   * 获取缓存
   */
  get(cacheKey: string): StartupItem[] | null {
    const cached = this.cache.get(cacheKey)
    
    if (!cached) {
      return null
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(cacheKey)
      return null
    }

    console.log(`[ScanCache] 使用缓存数据 (${cacheKey})`)
    return cached.data
  }

  /**
   * 设置缓存
   */
  set(cacheKey: string, data: StartupItem[]): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    })
    console.log(`[ScanCache] 缓存已更新 (${cacheKey}, ${data.length} 项)`)
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear()
    console.log('[ScanCache] 缓存已清除')
  }

  /**
   * 清除过期缓存
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.TTL) {
        this.cache.delete(key)
      }
    }
  }
}

/**
 * AI 请求缓存
 * 7天有效期，LRU 淘汰策略
 */
export class AICache {
  private cache: Map<string, { data: any; timestamp: number; accessCount: number }> = new Map()
  private readonly TTL = 7 * 24 * 60 * 60 * 1000 // 7天
  private readonly MAX_SIZE = 100 // 最大缓存条目数

  /**
   * 获取缓存
   */
  get(hash: string): any | null {
    const cached = this.cache.get(hash)
    
    if (!cached) {
      return null
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(hash)
      return null
    }

    // 更新访问次数（LRU）
    cached.accessCount++
    
    console.log(`[AICache] 使用缓存 (hash: ${hash.substring(0, 8)}...)`)
    return cached.data
  }

  /**
   * 设置缓存
   */
  set(hash: string, data: any): void {
    // 如果达到最大容量，删除最少使用的
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictLRU()
    }

    this.cache.set(hash, {
      data,
      timestamp: Date.now(),
      accessCount: 0
    })
    
    console.log(`[AICache] 缓存已保存 (hash: ${hash.substring(0, 8)}...)`)
  }

  /**
   * LRU 淘汰
   */
  private evictLRU(): void {
    let minAccessCount = Infinity
    let minKey: string | null = null

    for (const [key, value] of this.cache.entries()) {
      if (value.accessCount < minAccessCount) {
        minAccessCount = value.accessCount
        minKey = key
      }
    }

    if (minKey) {
      this.cache.delete(minKey)
      console.log(`[AICache] LRU 淘汰: ${minKey.substring(0, 8)}...`)
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear()
    console.log('[AICache] 缓存已清除')
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE
    }
  }
}

/**
 * 并发控制器
 * 限制同时执行的请求数量
 */
export class ConcurrencyController {
  private runningCount = 0
  private queue: Array<{ task: () => Promise<any>; resolve: Function; reject: Function }> = []

  constructor(private maxConcurrency: number = 5) {}

  /**
   * 执行任务（带并发控制）
   */
  async execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.runningCount < this.maxConcurrency) {
      // 直接执行
      this.runningCount++
      try {
        return await task()
      } finally {
        this.runningCount--
        this.processQueue()
      }
    } else {
      // 加入队列
      return new Promise((resolve, reject) => {
        this.queue.push({ task, resolve, reject })
      })
    }
  }

  /**
   * 处理队列
   */
  private processQueue(): void {
    if (this.queue.length > 0 && this.runningCount < this.maxConcurrency) {
      const { task, resolve, reject } = this.queue.shift()!
      
      this.runningCount++
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.runningCount--
          this.processQueue()
        })
    }
  }

  /**
   * 批量执行（带并发控制）
   */
  async executeBatch<T>(tasks: Array<() => Promise<T>>, concurrency: number = this.maxConcurrency): Promise<T[]> {
    const controller = new ConcurrencyController(concurrency)
    const results: T[] = []

    for (const task of tasks) {
      const result = await controller.execute(task)
      results.push(result)
    }

    return results
  }
}

/**
 * 请求队列（指数退避重试）
 */
export class RetryQueue {
  private readonly maxRetries = 3
  private readonly baseDelay = 1000 // 1秒

  /**
   * 执行带重试的请求
   */
  async executeWithRetry<T>(
    task: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error | null = null

    for (let i = 0; i <= retries; i++) {
      try {
        return await task()
      } catch (error: any) {
        lastError = error
        
        if (i < retries) {
          // 指数退避：1s, 2s, 4s, 8s...
          const delay = this.baseDelay * Math.pow(2, i)
          console.log(`[RetryQueue] 第 ${i + 1} 次重试，等待 ${delay}ms...`)
          await this.sleep(delay)
        }
      }
    }

    throw lastError || new Error('未知错误')
  }

  /**
   * 睡眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * 内存监控
 */
export class MemoryMonitor {
  /**
   * 获取主进程内存使用情况
   */
  getMainProcessMemory(): NodeJS.MemoryUsage {
    return process.memoryUsage()
  }

  /**
   * 格式化字节数
   */
  formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let unitIndex = 0
    let value = bytes

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024
      unitIndex++
    }

    return `${value.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * 记录内存快照
   */
  logMemorySnapshot(label: string = ''): void {
    const memory = this.getMainProcessMemory()
    console.log(`[MemoryMonitor] ${label || '当前'} 内存使用:`)
    console.log(`  RSS: ${this.formatBytes(memory.rss)}`)
    console.log(`  Heap Total: ${this.formatBytes(memory.heapTotal)}`)
    console.log(`  Heap Used: ${this.formatBytes(memory.heapUsed)}`)
    console.log(`  External: ${this.formatBytes(memory.external)}`)
  }
}

// 导出单例
export const scanCache = new ScanCache()
export const aiCache = new AICache()
export const concurrencyController = new ConcurrencyController(5)
export const retryQueue = new RetryQueue()
export const memoryMonitor = new MemoryMonitor()
