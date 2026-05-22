import { registryScanner } from './registry'
import { serviceScanner } from './service'
import { scheduledTaskScanner } from './scheduledTask'
import { startupFolderScanner } from './startupFolder'
import { driverScanner } from './driver'
import { shellExtensionScanner } from './shellExtension'
import { databaseManager } from '../database'
import { StartupItem, ScanOptions } from '../../shared/types'
import fs from 'fs'

export type ScanProgressCallback = (progress: {
  current: number
  total: number
  stage: string
  message: string
}) => void

/**
 * StartupScanner - 统一启动项扫描管理器
 * 异步队列顺序执行各扫描器，带实时进度回调
 * 所有扫描器返回一致的 StartupItem 格式
 */
export class StartupScanner {
  private progressCallback: ScanProgressCallback = () => {}

  setProgressCallback(callback: ScanProgressCallback): void {
    this.progressCallback = callback
  }

  async scan(options?: Partial<ScanOptions>): Promise<StartupItem[]> {
    const opts = { scanRegistry: true, scanServices: true, scanScheduledTasks: true, scanStartupFolder: true, scanDrivers: true, scanShellExtensions: true, ...options }
    const allItems: StartupItem[] = []
    const startTime = Date.now()

    this.progressCallback({ current: 0, total: 100, stage: 'init', message: '开始扫描...' })

    const stages: Array<{ key: string; label: string; run: () => Promise<StartupItem[]> }> = []
    if (opts.scanRegistry) stages.push({ key: 'registry', label: '注册表启动项', run: () => registryScanner.scan() })
    if (opts.scanServices) stages.push({ key: 'services', label: '系统服务', run: () => serviceScanner.scan() })
    if (opts.scanScheduledTasks) stages.push({ key: 'tasks', label: '计划任务', run: () => scheduledTaskScanner.scan() })
    if (opts.scanStartupFolder) stages.push({ key: 'folder', label: '启动文件夹', run: () => startupFolderScanner.scan() })
    if (opts.scanDrivers) stages.push({ key: 'drivers', label: '驱动程序', run: () => driverScanner.scan() })
    if (opts.scanShellExtensions) stages.push({ key: 'shell', label: 'Shell扩展', run: () => shellExtensionScanner.scan() })

    const perStage = stages.length > 0 ? 85 / stages.length : 0

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i]
      const baseProgress = Math.round(i * perStage)

      this.progressCallback({ current: baseProgress, total: 100, stage: stage.key, message: `扫描 ${stage.label}...` })

      try {
        const items = await stage.run()
        allItems.push(...items)
      } catch (error) {
        console.error(`[Scanner] ${stage.label} 失败:`, error)
      }
    }

    this.progressCallback({ current: 88, total: 100, stage: 'dedup', message: '去重处理中...' })
    const uniqueItems = this.removeDuplicates(allItems)

    this.progressCallback({ current: 94, total: 100, stage: 'cache', message: '更新缓存...' })
    this.updateScanCache(uniqueItems)

    const sortedItems = this.sortByPriority(uniqueItems)
    const duration = Date.now() - startTime

    this.progressCallback({ current: 100, total: 100, stage: 'done', message: `扫描完成：${sortedItems.length} 项（${duration}ms）` })
    return sortedItems
  }

  private removeDuplicates(items: StartupItem[]): StartupItem[] {
    const seen = new Map<string, StartupItem>()
    for (const item of items) {
      const key = item.hash || this.simpleHash(`${item.name}|${item.path}`.toLowerCase())
      if (!seen.has(key)) { seen.set(key, item) }
      else {
        const e = seen.get(key)!
        if (!e.description && item.description) e.description = item.description
        if (!e.enabled && item.enabled) seen.set(key, item)
      }
    }
    return Array.from(seen.values())
  }

  private sortByPriority(items: StartupItem[]): StartupItem[] {
    const p: Record<string, number> = { service: 1, driver: 2, registry: 3, task: 4, folder: 5, shell: 6, plugin: 7 }
    return items.sort((a, b) => (p[a.source] ?? 99) - (p[b.source] ?? 99))
  }

  private updateScanCache(items: StartupItem[]): void {
    const cache: Array<{ path: string; mtime: number; hash: string; scannedAt: string }> = []
    for (const item of items) {
      if (!item.path || !fs.existsSync(item.path)) continue
      try {
        const stat = fs.statSync(item.path)
        cache.push({ path: item.path, mtime: stat.mtimeMs, hash: item.hash || '', scannedAt: new Date().toISOString() })
      } catch { /* skip */ }
    }
    databaseManager.saveScanCache(cache)
  }

  async scanRegistryOnly(): Promise<StartupItem[]> { return registryScanner.scan() }
  async scanServicesOnly(): Promise<StartupItem[]> { return serviceScanner.scan() }
  async scanScheduledTasksOnly(): Promise<StartupItem[]> { return scheduledTaskScanner.scan() }
  async scanStartupFolderOnly(): Promise<StartupItem[]> { return startupFolderScanner.scan() }
  async scanDriversOnly(): Promise<StartupItem[]> { return driverScanner.scan() }
  async scanShellExtensionsOnly(): Promise<StartupItem[]> { return shellExtensionScanner.scan() }

  private simpleHash(input: string): string {
    let h = 0
    for (let i = 0; i < input.length; i++) { h = ((h << 5) - h) + input.charCodeAt(i); h = h & h }
    return Math.abs(h).toString(16)
  }
}

export const startupScanner = new StartupScanner()
