import { registryScanner } from './registry'
import { serviceScanner } from './service'
import { scheduledTaskScanner } from './scheduledTask'
import { startupFolderScanner } from './startupFolder'
import { StartupItem, ScanOptions } from '../../shared/types'

/**
 * 统一启动项扫描管理器（增强版）
 * 协调各种扫描器，提供统一的扫描接口
 */
export class StartupScanner {
  /**
   * 执行完整扫描
   * @param options 扫描选项
   */
  async scan(options?: Partial<ScanOptions>): Promise<StartupItem[]> {
    const defaultOptions: ScanOptions = {
      scanRegistry: true,
      scanServices: true,
      scanScheduledTasks: true,
      scanStartupFolder: true,
      scanPlugins: false
    }

    const opts = { ...defaultOptions, ...options }
    const allItems: StartupItem[] = []

    console.log('[StartupScanner] 开始扫描...')
    const startTime = Date.now()

    // 并行执行各个扫描任务
    const promises: Promise<StartupItem[]>[] = []

    if (opts.scanRegistry) {
      promises.push(
        registryScanner.scan().then(items => {
          console.log(`[StartupScanner] 注册表扫描完成: ${items.length} 项`)
          return items
        })
      )
    }

    if (opts.scanServices) {
      promises.push(
        serviceScanner.scan().then(items => {
          console.log(`[StartupScanner] 服务扫描完成: ${items.length} 项`)
          return items
        })
      )
    }

    if (opts.scanScheduledTasks) {
      promises.push(
        scheduledTaskScanner.scan().then(items => {
          console.log(`[StartupScanner] 计划任务扫描完成: ${items.length} 项`)
          return items
        })
      )
    }

    if (opts.scanStartupFolder) {
      promises.push(
        startupFolderScanner.scan().then(items => {
          console.log(`[StartupScanner] 启动文件夹扫描完成: ${items.length} 项`)
          return items
        })
      )
    }

    // 等待所有扫描完成
    const results = await Promise.all(promises)
    results.forEach(items => allItems.push(...items))

    // 去重处理
    const uniqueItems = this.removeDuplicates(allItems)

    // 排序处理（按优先级）
    const sortedItems = this.sortByPriority(uniqueItems)

    const duration = Date.now() - startTime
    console.log(`[StartupScanner] 扫描完成，总计 ${sortedItems.length} 项（耗时 ${duration}ms）`)

    return sortedItems
  }

  /**
   * 去重处理：基于名称+路径组合去除重复项
   */
  private removeDuplicates(items: StartupItem[]): StartupItem[] {
    const seen = new Set<string>()
    const unique: StartupItem[] = []

    for (const item of items) {
      // 使用名称和路径的组合作为唯一标识
      const key = `${item.name.toLowerCase()}|${item.path.toLowerCase()}`

      if (!seen.has(key)) {
        seen.add(key)
        unique.push(item)
      }
    }

    console.log(`[StartupScanner] 去重: ${items.length} -> ${unique.length} 项`)
    return unique
  }

  /**
   * 按优先级排序
   * 优先级：系统服务 > 注册表启动项 > 计划任务 > 启动文件夹 > 插件
   */
  private sortByPriority(items: StartupItem[]): StartupItem[] {
    const priorityMap: Record<string, number> = {
      'service': 1,
      'registry': 2,
      'task': 3,
      'folder': 4,
      'plugin': 5
    }

    return items.sort((a, b) => {
      const sourceA = a.source || a.type
      const sourceB = b.source || b.type
      const priorityA = priorityMap[sourceA] || 99
      const priorityB = priorityMap[sourceB] || 99
      return priorityA - priorityB
    })
  }

  /**
   * 仅扫描注册表
   */
  async scanRegistryOnly(): Promise<StartupItem[]> {
    return registryScanner.scan()
  }

  /**
   * 仅扫描服务
   */
  async scanServicesOnly(): Promise<StartupItem[]> {
    return serviceScanner.scan()
  }

  /**
   * 仅扫描计划任务
   */
  async scanScheduledTasksOnly(): Promise<StartupItem[]> {
    return scheduledTaskScanner.scan()
  }

  /**
   * 仅扫描启动文件夹
   */
  async scanStartupFolderOnly(): Promise<StartupItem[]> {
    return startupFolderScanner.scan()
  }
}

/**
 * 导出单例实例
 */
export const startupScanner = new StartupScanner()
