/**
 * Electron API 类型声明
 * 这些 API 通过预加载脚本暴露给渲染进程
 */

export interface ElectronAPI {
  getAppInfo: () => Promise<{
    version: string
    platform: string
    arch: string
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
  scanAll: (options?: any) => Promise<{
    success: boolean
    data: any[]
    count: number
    duration: number
    error?: string
  }>
  toggleStartupItem: (itemId: string, enabled: boolean) => Promise<{
    success: boolean
    message?: string
    error?: string
  }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
