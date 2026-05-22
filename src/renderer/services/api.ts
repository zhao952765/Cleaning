import { ipcRenderer } from 'electron'
import { IPC_CHANNELS, IPCResponse, ProgressNotification } from '../shared/ipc/channels'
import { StartupItem, FileInfo, SystemInfo } from '../shared/types'

/**
 * 渲染进程 API 封装
 * 提供统一的 Promise 接口调用主进程功能
 */
export class RendererAPI {
  // ==================== 扫描相关 ====================

  /**
   * 扫描注册表
   */
  static async scanRegistry(): Promise<IPCResponse<StartupItem[]>> {
    return ipcRenderer.invoke(IPC_CHANNELS.SCAN.REGISTRY)
  }

  /**
   * 扫描服务
   */
  static async scanServices(): Promise<IPCResponse<StartupItem[]>> {
    return ipcRenderer.invoke(IPC_CHANNELS.SCAN.SERVICES)
  }

  /**
   * 扫描计划任务
   */
  static async scanTasks(): Promise<IPCResponse<StartupItem[]>> {
    return ipcRenderer.invoke(IPC_CHANNELS.SCAN.TASKS)
  }

  /**
   * 扫描启动文件夹
   */
  static async scanFolder(): Promise<IPCResponse<StartupItem[]>> {
    return ipcRenderer.invoke(IPC_CHANNELS.SCAN.FOLDER)
  }

  /**
   * 完整扫描
   */
  static async scanAll(options?: any): Promise<IPCResponse<{
    items: StartupItem[]
    count: number
    duration: number
  }>> {
    return ipcRenderer.invoke(IPC_CHANNELS.SCAN.ALL, options)
  }

  /**
   * 监听扫描进度
   */
  static onScanProgress(callback: (progress: ProgressNotification) => void): () => void {
    const listener = (_event: any, progress: ProgressNotification) => callback(progress)
    ipcRenderer.on('scan:progress', listener)
    
    // 返回取消监听的函数
    return () => {
      ipcRenderer.removeListener('scan:progress', listener)
    }
  }

  // ==================== 启动项操作 ====================

  /**
   * 切换启动项状态
   */
  static async toggleItem(itemId: string, enabled: boolean): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.ITEM.TOGGLE, itemId, enabled)
  }

  /**
   * 获取启动项详情
   */
  static async getItemDetail(itemId: string): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.ITEM.GET_DETAIL, itemId)
  }

  // ==================== AI 相关 ====================

  /**
   * 测试 AI 连接
   */
  static async testAIConnection(): Promise<IPCResponse<{
    success: boolean
    latency?: number
    error?: string
  }>> {
    return ipcRenderer.invoke(IPC_CHANNELS.AI.TEST_CONNECTION)
  }

  /**
   * 获取 AI 配置
   */
  static async getAIConfig(): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.AI.GET_CONFIG)
  }

  /**
   * 设置 AI 配置
   */
  static async setAIConfig(config: any): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.AI.SET_CONFIG, config)
  }

  /**
   * 清除 AI 配置
   */
  static async clearAIConfig(): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.AI.CLEAR_CONFIG)
  }

  /**
   * 分析单个软件
   */
  static async analyzeSoftware(item: StartupItem, fileInfo?: FileInfo | null): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.AI.ANALYZE, item, fileInfo)
  }

  /**
   * 批量分析
   */
  static async batchAnalyze(items: StartupItem[]): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.AI.BATCH_ANALYZE, items)
  }

  /**
   * AI 对话
   */
  static async aiChat(query: string, context?: any): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.AI.CHAT, query, context)
  }

  // ==================== 数据库相关 ====================

  /**
   * 获取缓存
   */
  static async getCache(hash: string): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.DB.GET_CACHE, hash)
  }

  /**
   * 保存缓存
   */
  static async saveCache(hash: string, data: any): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.DB.SAVE_CACHE, hash, data)
  }

  /**
   * 获取历史记录
   */
  static async getHistory(limit: number = 10): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.DB.GET_HISTORY, limit)
  }

  /**
   * 获取数据库统计
   */
  static async getDatabaseStats(): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.DB.GET_STATS)
  }

  // ==================== 文件信息相关 ====================

  /**
   * 获取文件信息
   */
  static async getFileInfo(filePath: string, useCache: boolean = true): Promise<IPCResponse<FileInfo>> {
    return ipcRenderer.invoke(IPC_CHANNELS.FILE.GET_INFO, filePath, useCache)
  }

  /**
   * 清除文件缓存
   */
  static async clearFileCache(): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.FILE.CLEAR_CACHE)
  }

  // ==================== 系统相关 ====================

  /**
   * 获取开机时间
   */
  static async getBootTime(): Promise<IPCResponse<number>> {
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_BOOT_TIME)
  }

  /**
   * 打开文件位置
   */
  static async openFileLocation(filePath: string): Promise<IPCResponse> {
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.OPEN_FILE_LOCATION, filePath)
  }
}

// 导出为全局 API（可选）
declare global {
  interface Window {
    rendererAPI: typeof RendererAPI
  }
}

if (typeof window !== 'undefined') {
  window.rendererAPI = RendererAPI
}

export default RendererAPI
