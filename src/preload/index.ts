import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc/channels'

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用信息
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_APP_INFO),
  
  // 检查管理员权限
  isAdmin: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.IS_ADMIN),
  
  // 扫描相关
  scanRegistry: () => ipcRenderer.invoke(IPC_CHANNELS.SCAN.REGISTRY),
  scanServices: () => ipcRenderer.invoke(IPC_CHANNELS.SCAN.SERVICES),
  scanScheduledTasks: () => ipcRenderer.invoke(IPC_CHANNELS.SCAN.TASKS),
  scanStartupFolder: () => ipcRenderer.invoke(IPC_CHANNELS.SCAN.FOLDER),
  scanAll: (options?: any) => ipcRenderer.invoke(IPC_CHANNELS.SCAN.ALL, options),
  
  // 文件信息
  getFileInfo: (filePath: string, useCache?: boolean) => 
    ipcRenderer.invoke(IPC_CHANNELS.FILE.GET_INFO, filePath, useCache),
  
  // 数据库操作
  getSoftwareCache: (hash: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.DB.GET_CACHE, hash),
  getUserActions: (itemId: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.DB.GET_HISTORY, itemId),
  logUserAction: (itemId: string, action: string, note?: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.ITEM.TOGGLE, itemId, action, note),
  getDatabaseStats: () => 
    ipcRenderer.invoke(IPC_CHANNELS.DB.GET_STATS),
  
  // AI 操作
  testAIConnection: () => ipcRenderer.invoke(IPC_CHANNELS.AI.TEST_CONNECTION),
  getAIConfig: () => ipcRenderer.invoke(IPC_CHANNELS.AI.GET_CONFIG),
  setAIConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.AI.SET_CONFIG, config),
  clearAIConfig: () => ipcRenderer.invoke(IPC_CHANNELS.AI.CLEAR_CONFIG),
  getAIModels: () => ipcRenderer.invoke(IPC_CHANNELS.AI.GET_MODELS),  // 新增：获取模型列表
  analyzeSoftware: (item: any, fileInfo: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.AI.ANALYZE, item, fileInfo),
  batchAnalyze: (items: any[]) => 
    ipcRenderer.invoke(IPC_CHANNELS.AI.BATCH_ANALYZE, items),
  aiChat: (query: string, context?: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.AI.CHAT, query, context),
  
  // 系统操作
  openFileLocation: (filePath: string) => 
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.OPEN_FILE_LOCATION, filePath),
  getBootTime: () => 
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_BOOT_TIME),
  
  // 启用/禁用启动项
  toggleStartupItem: (item: any, enabled: boolean) => 
    ipcRenderer.invoke(IPC_CHANNELS.ITEM.TOGGLE, item, enabled),

  // 强制切换（绕过关键项警告）
  toggleStartupItemForce: (item: any, enabled: boolean) => 
    ipcRenderer.invoke('item:toggle-force', item, enabled),

  // 删除启动项
  deleteStartupItem: (item: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.ITEM.DELETE, item),

  // 强制删除（绕过关键项保护）
  deleteStartupItemForce: (item: any) => 
    ipcRenderer.invoke('item:delete-force', item),

  // 批量操作
  batchToggleItems: (items: any[], enable: boolean) => 
    ipcRenderer.invoke(IPC_CHANNELS.ITEM.BATCH_TOGGLE, items, enable),

  // 还原所有修改
  restoreAllItems: () => 
    ipcRenderer.invoke(IPC_CHANNELS.ITEM.RESTORE_ALL),

  // 检查是否为系统关键项
  isCriticalItem: (item: any) => 
    ipcRenderer.invoke(IPC_CHANNELS.ITEM.IS_CRITICAL, item),

  // 缓存管理
  clearScanCache: () => 
    ipcRenderer.invoke(IPC_CHANNELS.CACHE.CLEAR_SCAN),
  clearAICache: () => 
    ipcRenderer.invoke(IPC_CHANNELS.CACHE.CLEAR_AI),
  getCacheStats: () => 
    ipcRenderer.invoke(IPC_CHANNELS.CACHE.GET_STATS),

  // 内存监控
  getMemoryUsage: () => 
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_MEMORY),

  // AI 分析
  analyzeSingle: (item: any) => 
    ipcRenderer.invoke('ai:analyze-single', item),
  analyzeBatch: (items: any[]) => 
    ipcRenderer.invoke('ai:analyze-batch', items),

  // 监听扫描进度（增强版：含 stage 字段）
  onScanProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress)
    ipcRenderer.on(IPC_CHANNELS.SCAN.PROGRESS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SCAN.PROGRESS, handler)
  },

  // 以管理员身份重启
  relaunchAsAdmin: () => 
    ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.RELAUNCH_AS_ADMIN),

  // 监听管理员权限推送
  onAdminStatus: (callback: (result: any) => void) => {
    const handler = (_event: any, result: any) => callback(result)
    ipcRenderer.on(IPC_CHANNELS.SYSTEM.IS_ADMIN, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SYSTEM.IS_ADMIN, handler)
  }
})

// 类型声明（在渲染进程中可以使用这些类型）
declare global {
  interface Window {
    electronAPI: {
      getAppInfo: () => Promise<{
        version: string
        platform: string
        arch: string
      }>
      isAdmin: () => Promise<{
        success: boolean
        data: boolean
        error?: string
      }>
      scanRegistry: () => Promise<{
        success: boolean
        data: any[]
        count: number
        error?: string
      }>
      scanServices: () => Promise<{
        success: boolean
        data: any[]
        count: number
        error?: string
      }>
      scanScheduledTasks: () => Promise<{
        success: boolean
        data: any[]
        count: number
        error?: string
      }>
      scanStartupFolder: () => Promise<{
        success: boolean
        data: any[]
        count: number
        error?: string
      }>
      scanAll: (options?: any) => Promise<{
        success: boolean
        data: any[]
        count: number
        duration: number
        error?: string
      }>
      getFileInfo: (filePath: string, useCache?: boolean) => Promise<{
        success: boolean
        data?: any
        error?: string
      }>
      getSoftwareCache: (hash: string) => Promise<{
        success: boolean
        data?: any
        isValid: boolean
        error?: string
      }>
      getUserActions: (itemId: string) => Promise<{
        success: boolean
        data: any[]
        error?: string
      }>
      logUserAction: (itemId: string, action: string, note?: string) => Promise<{
        success: boolean
        error?: string
      }>
      getDatabaseStats: () => Promise<{
        success: boolean
        data?: {
          softwareCacheCount: number
          userActionsCount: number
          scanHistoryCount: number
        }
        error?: string
      }>
      testAIConnection: () => Promise<{
        success: boolean
        latency?: number
        error?: string
      }>
      getAIConfig: () => Promise<{
        success: boolean
        data?: any
        error?: string
      }>
      setAIConfig: (config: any) => Promise<{
        success: boolean
        message?: string
        error?: string
      }>
      clearAIConfig: () => Promise<{
        success: boolean
        message?: string
        error?: string
      }>
      getAIModels: () => Promise<{
        success: boolean
        data?: any[]
        error?: string
      }>  // 新增：获取模型列表
      analyzeSoftware: (item: any, fileInfo: any) => Promise<{
        success: boolean
        data?: any
        error?: string
      }>
      batchAnalyze: (items: any[]) => Promise<{
        success: boolean
        data?: any[]
        error?: string
      }>
      aiChat: (query: string, context?: any) => Promise<{
        success: boolean
        data?: any
        error?: string
      }>
      openFileLocation: (filePath: string) => Promise<{
        success: boolean
        error?: string
      }>
      getBootTime: () => Promise<{
        success: boolean
        data?: number
        error?: string
      }>
      toggleStartupItem: (itemId: string, enabled: boolean) => Promise<{
        success: boolean
        message?: string
        data?: any
        warning?: string
        requireConfirm?: boolean
        error?: string
      }>
      toggleStartupItemForce: (item: any, enabled: boolean) => Promise<{
        success: boolean
        message?: string
        data?: any
        error?: string
      }>
      deleteStartupItem: (item: any) => Promise<{
        success: boolean
        message?: string
        backupPath?: string
        requireConfirm?: boolean
        warning?: string
        error?: string
      }>
      deleteStartupItemForce: (item: any) => Promise<{
        success: boolean
        message?: string
        backupPath?: string
        error?: string
      }>
      batchToggleItems: (items: any[], enable: boolean) => Promise<{
        success: boolean
        data?: {
          success: number
          failed: number
          results: Array<{ itemId: string; success: boolean; message: string }>
        }
        error?: string
      }>
      restoreAllItems: () => Promise<{
        success: boolean
        data?: {
          success: number
          failed: number
        }
        error?: string
      }>
      isCriticalItem: (item: any) => Promise<{
        success: boolean
        data?: boolean
        error?: string
      }>
      clearScanCache: () => Promise<{
        success: boolean
        message?: string
        error?: string
      }>
      clearAICache: () => Promise<{
        success: boolean
        message?: string
        error?: string
      }>
      getCacheStats: () => Promise<{
        success: boolean
        data?: {
          size: number
          maxSize: number
        }
        error?: string
      }>
      getMemoryUsage: () => Promise<{
        success: boolean
        data?: {
          rss: number
          heapTotal: number
          heapUsed: number
          external: number
        }
        error?: string
      }>
      analyzeSingle: (item: any) => Promise<{
        success: boolean
        data?: {
          item_name: string
          risk_level: string
          can_disable: boolean
          disable_warning?: string
          reason: string
          suggestion: string
          risk_score: number
        }
        error?: string
      }>
      analyzeBatch: (items: any[]) => Promise<{
        success: boolean
        data?: {
          items: Array<{
            itemId: string
            name: string
            riskLevel: string
            canDisable: boolean
            disableWarning?: string
            reason: string
            suggestion: string
            riskScore: number
          }>
          summary: string
          totalOptimizable: number
        }
        error?: string
      }>
      onScanProgress: (callback: (progress: {
        current: number
        total: number
        stage?: string
        message: string
        percentage: number
      }) => void) => () => void
      relaunchAsAdmin: () => Promise<{ success: boolean }>
      onAdminStatus: (callback: (result: any) => void) => () => void
    }
  }
}
