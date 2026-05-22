import { StartupType, StartupStatus, SecurityLevel } from '@shared/types'

/**
 * 格式化启动项类型
 */
export function formatStartupType(type: StartupType): string {
  const typeMap: Record<StartupType, string> = {
    [StartupType.Registry]: '注册表启动项',
    [StartupType.Service]: 'Windows 服务',
    [StartupType.ScheduledTask]: '计划任务',
    [StartupType.StartupFolder]: '启动文件夹',
    [StartupType.Plugin]: '插件/扩展'
  }
  return typeMap[type] || '未知类型'
}

/**
 * 格式化状态
 */
export function formatStatus(status: StartupStatus): string {
  const statusMap: Record<StartupStatus, string> = {
    [StartupStatus.Enabled]: '已启用',
    [StartupStatus.Disabled]: '已禁用',
    [StartupStatus.Unknown]: '未知'
  }
  return statusMap[status] || '未知状态'
}

/**
 * 获取安全等级颜色
 */
export function getSecurityLevelColor(level: SecurityLevel): string {
  const colorMap: Record<SecurityLevel, string> = {
    [SecurityLevel.Safe]: '#52c41a',      // 绿色
    [SecurityLevel.Caution]: '#faad14',   // 橙色
    [SecurityLevel.Dangerous]: '#ff4d4f'  // 红色
  }
  return colorMap[level] || '#d9d9d9'
}

/**
 * 格式化安全等级
 */
export function formatSecurityLevel(level: SecurityLevel): string {
  const levelMap: Record<SecurityLevel, string> = {
    [SecurityLevel.Safe]: '安全',
    [SecurityLevel.Caution]: '需谨慎',
    [SecurityLevel.Dangerous]: '危险'
  }
  return levelMap[level] || '未知'
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * 格式化时间（毫秒转可读格式）
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(2)}s`
  const minutes = seconds / 60
  if (minutes < 60) return `${minutes.toFixed(2)}min`
  const hours = minutes / 60
  return `${hours.toFixed(2)}h`
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

/**
 * 验证路径是否有效
 */
export function isValidPath(path: string): boolean {
  if (!path || path.trim().length === 0) return false
  // 简单的路径验证逻辑
  return /^[a-zA-Z]:\\|^\\\\|^\//.test(path) || path.startsWith('/')
}
