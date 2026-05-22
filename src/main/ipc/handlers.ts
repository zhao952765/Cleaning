import { ipcMain, BrowserWindow, app } from 'electron'
import { IPC_CHANNELS, IPCResponse, ProgressNotification } from '../../shared/ipc/channels'
import { startupScanner } from '../scanner'
import { fileInfoExtractor } from '../scanner/fileInfo'
import { databaseManager } from '../database'
import { aiClient } from '../ai/client'
import { aiConfigManager } from '../ai/config'
import { promptBuilder } from '../ai/prompts'
import { ScanOptions, SystemInfo, StartupItem } from '../../shared/types'
import { isAdminPrivilege } from '../index'

/**
 * IPC 通信处理器
 * 统一管理所有 IPC 通道的处理逻辑
 */
export class IPCHandlers {
  private mainWindow: BrowserWindow | null = null

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
    this.registerHandlers()
  }

  /**
   * 注册所有 IPC 处理器
   */
  private registerHandlers(): void {
    // ==================== 系统相关 ====================
    
    // 获取应用信息
    ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_APP_INFO, () => {
      return this.success({
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch
      })
    })

    // 检查管理员权限
    ipcMain.handle(IPC_CHANNELS.SYSTEM.IS_ADMIN, () => {
      return this.success(isAdminPrivilege)
    })

    // 打开文件位置或系统工具
    ipcMain.handle(IPC_CHANNELS.SYSTEM.OPEN_FILE_LOCATION, async (_event, filePath: string) => {
      try {
        const { shell } = await import('electron')
        
        // 如果是系统工具，直接运行
        if (filePath.endsWith('.msc') || filePath.endsWith('.exe')) {
          shell.openPath(filePath)
          return this.success({ message: '已打开' })
        }
        
        // 否则显示文件所在文件夹
        shell.showItemInFolder(filePath)
        return this.success({ message: '已打开文件位置' })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // ==================== 扫描相关 ====================
    
    // 扫描注册表
    ipcMain.handle(IPC_CHANNELS.SCAN.REGISTRY, async () => {
      try {
        const items = await startupScanner.scanRegistryOnly()
        return this.success(items)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 扫描服务
    ipcMain.handle(IPC_CHANNELS.SCAN.SERVICES, async () => {
      try {
        const items = await startupScanner.scanServicesOnly()
        return this.success(items)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 扫描计划任务
    ipcMain.handle(IPC_CHANNELS.SCAN.TASKS, async () => {
      try {
        const items = await startupScanner.scanScheduledTasksOnly()
        return this.success(items)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 扫描启动文件夹
    ipcMain.handle(IPC_CHANNELS.SCAN.FOLDER, async () => {
      try {
        const items = await startupScanner.scanStartupFolderOnly()
        return this.success(items)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 完整扫描（异步队列 + 实时进度回调）
    ipcMain.handle(IPC_CHANNELS.SCAN.ALL, async (_event, options?: Partial<ScanOptions>) => {
      try {
        const startTime = Date.now()

        // 连接扫描器进度回调 → 渲染进程
        startupScanner.setProgressCallback((progress) => {
          this.sendProgressForScan(progress.current, progress.total, progress.stage, progress.message)
        })

        const items = await startupScanner.scan(options)

        const duration = Date.now() - startTime
        this.sendProgress(100, 100, `扫描完成，共 ${items.length} 项`)

        // 保存扫描历史
        try {
          databaseManager.saveScanHistory(items.length, duration, { items })
        } catch (e) {
          console.warn('保存扫描历史失败:', e)
        }

        return this.success({ items, count: items.length, duration })
      } catch (error: any) {
        console.error('[IPCHandlers] 全面扫描失败:', error)
        return this.error(`扫描失败: ${error.message}`)
      }
    })

    // ==================== 启动项操作 ====================

    // 获取启动项详情
    ipcMain.handle(IPC_CHANNELS.ITEM.GET_DETAIL, async (_event, itemId: string) => {
      try {
        // TODO: 根据 ID 在数据库或扫描结果中查找
        return this.success(null)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 切换启动项状态（启用/禁用）- 完整实现：备份 + 执行 + 回滚
    ipcMain.handle(IPC_CHANNELS.ITEM.TOGGLE, async (_event, item: StartupItem, enabled: boolean) => {
      try {
        const { systemOperationsManager } = await import('../system/operations')

        // 禁用时检测系统关键项
        if (!enabled) {
          const warning = systemOperationsManager.getCriticalWarning(item)
          if (warning) {
            return this.success({
              requireConfirm: true,
              warning,
              canProceed: true
            })
          }
        }

        const result = await systemOperationsManager.toggleItem(item, enabled)
        return this.success({
          success: result.success,
          message: result.message,
          backupPath: result.backupPath,
          item: { ...item, enabled }
        })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 确认禁用关键项（二次确认后实际执行）
    ipcMain.handle('item:toggle-force', async (_event, item: StartupItem, enabled: boolean) => {
      try {
        const { systemOperationsManager } = await import('../system/operations')
        const result = await systemOperationsManager.toggleItem(item, enabled)
        return this.success({
          success: result.success,
          message: result.message,
          backupPath: result.backupPath,
          item: { ...item, enabled }
        })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 删除启动项
    ipcMain.handle(IPC_CHANNELS.ITEM.DELETE, async (_event, item: StartupItem) => {
      try {
        const { systemOperationsManager } = await import('../system/operations')

        // 删除系统关键项也需警告
        const warning = systemOperationsManager.getCriticalWarning(item)
        if (warning) {
          return this.success({
            requireConfirm: true,
            warning,
            canProceed: false // 删除关键项默认不允许强制
          })
        }

        const result = await systemOperationsManager.deleteItem(item)
        return this.success({
          success: result.success,
          message: result.message,
          backupPath: result.backupPath
        })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 强制删除（绕过关键项保护，仅限明确确认）
    ipcMain.handle('item:delete-force', async (_event, item: StartupItem) => {
      try {
        const { systemOperationsManager } = await import('../system/operations')
        const result = await systemOperationsManager.deleteItem(item)
        return this.success({
          success: result.success,
          message: result.message,
          backupPath: result.backupPath
        })
      } catch (error: any) {
        return this.error(error.message)
      }
    })
    
    // 测试 AI 连接
    ipcMain.handle(IPC_CHANNELS.AI.TEST_CONNECTION, async () => {
      try {
        const config = aiConfigManager.getConfig()
        if (!config) {
          return this.error('请先配置 AI 客户端')
        }

        aiClient.initialize(config)
        const result = await aiClient.testConnection()
        
        return this.success(result)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 分析单个启动项（使用 AIService 智能分析）
    ipcMain.handle('ai:analyze-single', async (_event, item: any) => {
      try {
        const config = aiConfigManager.getConfig()
        if (!config) {
          return this.error('请先配置 AI 客户端')
        }

        const { aiService } = await import('../ai/AIService')
        const result = await aiService.analyzeSingle(item)
        return this.success(result)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 批量分析启动项（智能分批 8-10 项）
    ipcMain.handle('ai:analyze-batch', async (_event, items: any[]) => {
      try {
        const config = aiConfigManager.getConfig()
        if (!config) {
          return this.error('请先配置 AI 客户端')
        }

        const { aiService } = await import('../ai/AIService')
        const result = await aiService.analyzeBatch(items)
        return this.success(result)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 获取 AI 配置
    ipcMain.handle(IPC_CHANNELS.AI.GET_CONFIG, async () => {
      try {
        const config = aiConfigManager.getConfig()
        return this.success(config)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 设置 AI 配置
    ipcMain.handle(IPC_CHANNELS.AI.SET_CONFIG, async (_event, config: any) => {
      try {
        const validation = aiConfigManager.validateConfig(config)
        if (!validation.valid) {
          return this.error(`配置验证失败: ${validation.errors.join(', ')}`)
        }

        aiConfigManager.saveConfig(config)
        aiClient.initialize(config)
        
        return this.success({ message: '配置保存成功' })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 清除 AI 配置
    ipcMain.handle(IPC_CHANNELS.AI.CLEAR_CONFIG, async () => {
      try {
        aiConfigManager.clearConfig()
        aiClient.clearApiKey()
        return this.success({ message: '配置已清除' })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 获取可用模型列表
    ipcMain.handle(IPC_CHANNELS.AI.GET_MODELS, async () => {
      try {
        const config = aiConfigManager.getConfig()
        if (!config) {
          return this.error('请先配置 AI 客户端')
        }

        aiClient.initialize(config)
        
        const models = await aiClient.getModels()
        return this.success(models)
      } catch (error: any) {
        console.error('[IPCHandlers] 获取模型列表失败:', error)
        return this.error(error.message)
      }
    })

    // 分析单个软件
    ipcMain.handle(IPC_CHANNELS.AI.ANALYZE, async (_event, item: any, fileInfo: any) => {
      try {
        const config = aiConfigManager.getConfig()
        if (!config) {
          return this.error('请先配置 AI 客户端')
        }

        aiClient.initialize(config)
        
        // 构建提示词
        const prompt = promptBuilder.buildAnalyzePrompt(item, fileInfo)
        
        const result = await aiClient.analyzeSoftware(prompt)
        return this.success(result)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 批量分析
    ipcMain.handle(IPC_CHANNELS.AI.BATCH_ANALYZE, async (_event, items: any[]) => {
      try {
        const config = aiConfigManager.getConfig()
        if (!config) {
          return this.error('请先配置 AI 客户端')
        }

        aiClient.initialize(config)
        
        // 构建提示词数组
        const prompts = items.map(item => 
          promptBuilder.buildAnalyzePrompt(item, null)
        )
        
        const results = await aiClient.batchAnalyze(prompts, 5)
        return this.success(results)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // AI 对话
    ipcMain.handle(IPC_CHANNELS.AI.CHAT, async (_event, query: string, context?: any) => {
      try {
        const config = aiConfigManager.getConfig()
        if (!config) {
          return this.error('请先配置 AI 客户端')
        }

        aiClient.initialize(config)
        
        // 构建系统信息
        const systemInfo: SystemInfo = context?.systemInfo || {
          osVersion: process.platform,
          architecture: process.arch,
          totalMemory: 0,
          cpuModel: '',
          uptime: 0
        }

        // 如果有启动项信息，添加到上下文中
        const startupItemsContext = context?.startupItems ? 
          `\n\n当前系统中的启动项详情：\n${JSON.stringify(context.startupItems, null, 2)}` : ''
        
        const prompt = promptBuilder.buildChatPrompt(
          query + startupItemsContext,
          systemInfo,
          context?.totalItems || 0,
          context?.enabledCount || 0,
          context?.disabledCount || 0
        )
        
        const result = await aiClient.chat(prompt)
        return this.success(result)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // ==================== 数据库相关 ====================
    
    // 获取缓存
    ipcMain.handle(IPC_CHANNELS.DB.GET_CACHE, async (_event, hash: string) => {
      try {
        const cached = databaseManager.getSoftwareByHash(hash)
        const isValid = cached ? databaseManager.isCacheValid(hash) : false
        
        return this.success({ data: cached, isValid })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 保存缓存
    ipcMain.handle(IPC_CHANNELS.DB.SAVE_CACHE, async (_event, hash: string, data: any) => {
      try {
        databaseManager.saveSoftwareAnalysis(hash, data)
        return this.success({ message: '缓存保存成功' })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 获取历史记录
    ipcMain.handle(IPC_CHANNELS.DB.GET_HISTORY, async (_event, limit: number = 10) => {
      try {
        const history = databaseManager.getRecentScanHistory(limit)
        return this.success(history)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 获取数据库统计
    ipcMain.handle(IPC_CHANNELS.DB.GET_STATS, async () => {
      try {
        const stats = databaseManager.getStats()
        return this.success(stats)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // ==================== 文件信息相关 ====================
    
    // 获取文件信息
    ipcMain.handle(IPC_CHANNELS.FILE.GET_INFO, async (_event, filePath: string, useCache: boolean = true) => {
      try {
        const info = await fileInfoExtractor.getFileInfo(filePath, useCache)
        
        if (!info) {
          return this.error('无法获取文件信息')
        }
        
        return this.success(info)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 清除文件缓存
    ipcMain.handle(IPC_CHANNELS.FILE.CLEAR_CACHE, async () => {
      try {
        fileInfoExtractor.clearCache()
        return this.success({ message: '缓存已清除' })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // ==================== 系统操作相关 ====================
    
    // 获取启动时间
    ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_BOOT_TIME, async () => {
      try {
        const { systemOperationsManager } = await import('../system/operations')
        const bootTimeSeconds = await systemOperationsManager.getBootTime()
        return this.success(bootTimeSeconds)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 切换启动项状态（实际执行）
    ipcMain.handle(IPC_CHANNELS.ITEM.TOGGLE, async (_event, item: StartupItem, enabled: boolean) => {
      try {
        // 检查是否为系统关键项
        const { systemOperationsManager } = await import('../system/operations')
        if (!enabled && systemOperationsManager.isSystemCritical(item)) {
          return this.error('系统关键项，禁止禁用')
        }

        await systemOperationsManager.toggleItem(item, enabled)
        
        return this.success({
          message: `已${enabled ? '启用' : '禁用'}: ${item.name}`,
          item: { ...item, enabled }
        })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 批量操作
    ipcMain.handle(IPC_CHANNELS.ITEM.BATCH_TOGGLE, async (_event, items: any[], enable: boolean) => {
      try {
        const { systemOperationsManager } = await import('../system/operations')
        const result = await systemOperationsManager.batchToggle(items, enable)
        return this.success(result)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 还原所有修改
    ipcMain.handle(IPC_CHANNELS.ITEM.RESTORE_ALL, async () => {
      try {
        const { systemOperationsManager } = await import('../system/operations')
        const result = await systemOperationsManager.restoreAll()
        return this.success(result)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 检查是否为系统关键项
    ipcMain.handle(IPC_CHANNELS.ITEM.IS_CRITICAL, async (_event, item: any) => {
      try {
        const { systemOperationsManager } = await import('../system/operations')
        const isCritical = systemOperationsManager.isSystemCritical(item)
        return this.success(isCritical)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // ==================== 缓存管理 ====================

    // 清除扫描缓存
    ipcMain.handle(IPC_CHANNELS.CACHE.CLEAR_SCAN, async () => {
      try {
        const { scanCache } = await import('../system/performance')
        scanCache.clear()
        return this.success({ message: '扫描缓存已清除' })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 清除 AI 缓存
    ipcMain.handle(IPC_CHANNELS.CACHE.CLEAR_AI, async () => {
      try {
        const { aiCache } = await import('../system/performance')
        aiCache.clear()
        return this.success({ message: 'AI 缓存已清除' })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 获取缓存统计
    ipcMain.handle(IPC_CHANNELS.CACHE.GET_STATS, async () => {
      try {
        const { aiCache } = await import('../system/performance')
        const stats = aiCache.getStats()
        return this.success(stats)
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    // 获取内存使用情况
    ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_MEMORY, async () => {
      try {
        const { memoryMonitor } = await import('../system/performance')
        const memory = memoryMonitor.getMainProcessMemory()
        return this.success({
          rss: memory.rss,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed,
          external: memory.external
        })
      } catch (error: any) {
        return this.error(error.message)
      }
    })

    console.log('[IPCHandlers] 所有 IPC 处理器注册完成')
  }

  /**
   * 发送成功响应
   */
  private success<T>(data?: T): IPCResponse<T> {
    return {
      success: true,
      data
    }
  }

  /**
   * 发送错误响应
   */
  private error(message: string): IPCResponse {
    return {
      success: false,
      error: message
    }
  }

  /**
   * 发送进度通知（兼容旧格式）
   */
  private sendProgress(current: number, total: number, message: string): void {
    if (!this.mainWindow || !this.mainWindow.webContents) return
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0
    this.mainWindow.webContents.send(IPC_CHANNELS.SCAN.PROGRESS, { current, total, message, percentage })
  }

  /**
   * 发送扫描进度通知（增强版，含 stage 字段）
   */
  private sendProgressForScan(current: number, total: number, stage: string, message: string): void {
    if (!this.mainWindow || !this.mainWindow.webContents) return
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0
    this.mainWindow.webContents.send(IPC_CHANNELS.SCAN.PROGRESS, { current, total, stage, message, percentage })
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 移除所有 IPC 监听器
    Object.entries(IPC_CHANNELS).forEach(([, category]) => {
      if (typeof category === 'object' && category !== null) {
        Object.values(category).forEach(channel => {
          if (typeof channel === 'string') {
            ipcMain.removeHandler(channel)
          }
        })
      }
    })
    
    console.log('[IPCHandlers] IPC 处理器已清理')
  }
}
