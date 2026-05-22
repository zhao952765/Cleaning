import { registryScanner } from './registry'
import { serviceScanner } from './service'
import { scheduledTaskScanner } from './scheduledTask'
import { startupFolderScanner } from './startupFolder'
import { driverScanner } from './driver'
import { shellExtensionScanner } from './shellExtension'
import { databaseManager } from '../database'
import { StartupItem, ScanOptions } from '../../shared/types'
import fs from 'fs'

interface ScanCacheEntry {
  path: string
  mtime: number
  hash: string
  scannedAt: string
}

/**
 * 扫描进度回调类型
 */
export type ScanProgressCallback = (progress: {
  current: number
  total: number
  stage: string
  message: string
}) => void

/**
 * 统一启动项扫描管理器（性能优化版）
 * 使用异步队列 + 实时进度回调
 */
export class StartupScanner {
  private progressCallback: ScanProgressCallback = () => {}

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: ScanProgressCallback): void {
    this.progressCallback = callback
  }

  /**
   * 执行完整扫描（异步队列 + 每阶段进度报告）
   */
  async scan(options?: Partial<ScanOptions>): Promise<StartupItem[]> {
    const defaultOptions: ScanOptions = {
      scanRegistry: true,
      scanServices: true,
      scanScheduledTasks: true,
      scanStartupFolder: true,
      scanDrivers: true,
      scanShellExtensions: true,
      scanPlugins: false,
    }
    const opts = { ...defaultOptions, ...options }
    const allItems: StartupItem[] = []
    const startTime = Date.now()

    console.log('[StartupScanner] 开始扫描...')
    this.progressCallback({ current: 0, total: 100, stage: 'init', message: '准备扫描...' })

    // 收集需要执行的扫描阶段
    const stages: Array<{ key: string; label: string; weight: number; run: () => Promise<StartupItem[]> }> = []

    if (opts.scanRegistry) {
      stages.push({ key: 'registry', label: '注册表启动项', weight: 25, run: () => registryScanner.scan() })
    }
    if (opts.scanServices) {
      stages.push({ key: 'services', label: '系统服务', weight: 25, run: () => serviceScanner.scan() })
    }
    if (opts.scanScheduledTasks) {
      stages.push({ key: 'tasks', label: '计划任务', weight: 20, run: () => scheduledTaskScanner.scan() })
    }
    if (opts.scanStartupFolder) {
      stages.push({ key: 'folder', label: '启动文件夹', weight: 15, run: () => startupFolderScanner.scan() })
    }
    if (opts.scanDrivers) {
      stages.push({ key: 'drivers', label: '驱动程序', weight: 10, run: () => driverScanner.scan() })
    }
    if (opts.scanShellExtensions) {
      stages.push({ key: 'shell', label: 'Shell 扩展', weight: 5, run: () => shellExtensionScanner.scan() })
    }

    // 计算权重占比
    const totalActiveWeight = stages.reduce((s, st) => s + st.weight, 0)

    // 异步队列执行各阶段（顺序执行，每个阶段内部可能并行）
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]
      const baseProgress = Math.round((stages.slice(0, i).reduce((s, st) => s + st.weight, 0) / totalActiveWeight) * 90)

      this.progressCallback({
        current: baseProgress,
        total: 100,
        stage: stage.key,
        message: `正在扫描 ${stage.label}...`,
      })

      try {
        const items = await stage.run()
        allItems.push(...items)
        console.log(`[StartupScanner] ${stage.label}: ${items.length} 项`)
      } catch (error) {
        console.error(`[StartupScanner] ${stage.label} 失败:`, error)
      }
    }

    this.progressCallback({ current: 90, total: 100, stage: 'dedup', message: '正在去重处理...' })

    // 去重
    const uniqueItems = this.removeDuplicates(allItems)

    this.progressCallback({ current: 95, total: 100, stage: 'cache', message: '正在更新缓存...' })

    // 更新缓存
    this.updateScanCache(uniqueItems)

    // 排序
    const sortedItems = this.sortByPriority(uniqueItems)

    const duration = Date.now() - startTime

    this.progressCallback({
      current: 100, total: 100, stage: 'done',
      message: `扫描完成：${sortedItems.length} 项（${duration}ms）`,
    })

    console.log(`[StartupScanner] 扫描完成，${sortedItems.length} 项（${duration}ms）`)
    return sortedItems
  }

  /**
   * 去重（基于 path hash + name 组合）
   */
  private removeDuplicates(items: StartupItem[]): StartupItem[] {
    const seen = new Map<string, StartupItem>()

    for (const item of items) {
      const key = item.hash || this.simpleHash(`${item.name}|${item.path}`.toLowerCase())

      if (!seen.has(key)) {
        seen.set(key, item)
      } else {
        const existing = seen.get(key)!
        if (!existing.description && item.description) existing.description = item.description
        if (!existing.enabled && item.enabled) seen.set(key, item)
      }
    }

    return Array.from(seen.values())
  }

  private sortByPriority(items: StartupItem[]): StartupItem[] {
    const priority: Record<string, number> = {
      service: 1, driver: 2, registry: 3,
      task: 4, folder: 5, shell: 6, plugin: 7,
    }
    return items.sort((a, b) => (priority[a.source] ?? 99) - (priority[b.source] ?? 99))
  }

  // ========== 缓存 ==========

  isCacheValid(): boolean {
    const cache = this.loadScanCache()
    if (cache.length === 0) return false
    for (const entry of cache) {
      try {
        if (fs.existsSync(entry.path)) {
          const stat = fs.statSync(entry.path)
          if (stat.mtimeMs !== entry.mtime) return false
        } else {
          return false
        }
      } catch {
        return false
      }
    }
    return true
  }

  private updateScanCache(items: StartupItem[]): void {
    const cache: ScanCacheEntry[] = []
    for (const item of items) {
      if (!item.path || !fs.existsSync(item.path)) continue
      try {
        const stat = fs.statSync(item.path)
        cache.push({
          path: item.path,
          mtime: stat.mtimeMs,
          hash: item.hash || '',
          scannedAt: new Date().toISOString(),
        })
      } catch { /* skip */ }
    }
    databaseManager.saveScanCache(cache)
  }

  private loadScanCache(): ScanCacheEntry[] {
    return databaseManager.getScanCache()
  }

  // ========== 单一扫描 ==========

  async scanRegistryOnly(): Promise<StartupItem[]> { return registryScanner.scan() }
  async scanServicesOnly(): Promise<StartupItem[]> { return serviceScanner.scan() }
  async scanScheduledTasksOnly(): Promise<StartupItem[]> { return scheduledTaskScanner.scan() }
  async scanStartupFolderOnly(): Promise<StartupItem[]> { return startupFolderScanner.scan() }
  async scanDriversOnly(): Promise<StartupItem[]> { return driverScanner.scan() }
  async scanShellExtensionsOnly(): Promise<StartupItem[]> { return shellExtensionScanner.scan() }

  private simpleHash(input: string): string {
    let h = 0
    for (let i = 0; i < input.length; i++) {
      h = ((h << 5) - h) + input.charCodeAt(i)
      h = h & h
    }
    return Math.abs(h).toString(16)
  }
}

export const startupScanner = new StartupScanner()
