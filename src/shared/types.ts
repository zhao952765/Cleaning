/**
 * 启动项相关类型定义
 */

// 启动项来源类型
export type StartupSource = 'registry' | 'task' | 'service' | 'folder' | 'plugin' | 'driver' | 'shell'

// 启动项类型（向后兼容）
export enum StartupType {
  Registry = 'registry',           // 注册表启动项
  Service = 'service',             // Windows 服务
  ScheduledTask = 'scheduledTask', // 计划任务
  Folder = 'folder',               // 启动文件夹
  Driver = 'driver',               // 系统驱动
  Shell = 'shell',                 // Shell 扩展
  Plugin = 'plugin'                // 插件/扩展
}

// 启动项状态
export enum StartupStatus {
  Enabled = 'enabled',     // 已启用
  Disabled = 'disabled',   // 已禁用
  Unknown = 'unknown'      // 未知
}

// 安全等级
export enum SecurityLevel {
  Safe = 'safe',           // 安全
  Caution = 'caution',     // 需谨慎
  Dangerous = 'dangerous'  // 危险
}

// 启动项接口
export interface StartupItem {
  id: string                    // 唯一标识
  name: string                  // 名称
  description?: string          // 描述
  type: StartupType | string    // 类型（支持字符串以兼容自定义类型）
  source: string                // 来源
  status: string                // 状态
  path: string                  // 可执行文件路径
  arguments?: string            // 启动参数
  publisher?: string            // 发布者
  version?: string              // 版本
  securityLevel: string         // 安全等级
  impact: string                // 对系统性能的影响
  enabled: boolean              // 是否启用（便于操作）
  isSystem?: boolean            // 是否为系统关键项
  lastModified?: Date           // 最后修改时间
  icon?: string                 // 图标名称（Font Awesome）
  iconColor?: string            // 图标颜色
  banRateValue?: number         // 禁止率数值（0-100）
  location?: string             // 位置信息（注册表位置或文件路径）
  hash?: string                 // 文件路径的 MD5 哈希，用于去重和缓存
  fileInfo?: FileInfo           // 完整的文件元数据信息（可选，通过 FileInfoExtractor 获取）
}

// 文件信息接口（步骤 4）
export interface FileInfo {
  filePath: string
  fileSize: number
  version: string
  description: string
  company: string
  icon?: string           // base64 图标（可选）
  signature: SignatureInfo
  md5: string
  sha256: string
  createTime: Date
  modifyTime: Date
}

// 签名信息
export interface SignatureInfo {
  status: 'valid' | 'invalid' | 'unsigned'  // 有效/无效/无签名
  signerName?: string
  issuerName?: string
  signedAt?: Date
}

// 扫描选项
export interface ScanOptions {
  scanRegistry?: boolean
  scanServices?: boolean
  scanScheduledTasks?: boolean
  scanStartupFolder?: boolean
  scanDrivers?: boolean        // 驱动程序扫描（可选）
  scanShellExtensions?: boolean // Shell 扩展扫描（可选）
  scanPlugins?: boolean
}

// 扫描结果
export interface ScanResult {
  items: StartupItem[]
  totalCount: number
  enabledCount: number
  disabledCount: number
  scanDuration: number  // 扫描耗时（毫秒）
}

// AI 分析请求
export interface AIAnalysisRequest {
  items: StartupItem[]
  systemInfo: SystemInfo
}

// AI 分析结果
export interface AIAnalysisResult {
  recommendations: AIRecommendation[]
  summary: string
  optimizedCount: number
}

// AI 推荐
export interface AIRecommendation {
  itemId: string
  action: 'keep' | 'disable' | 'enable'  // 建议操作
  reason: string                          // 推荐理由
  confidence: number                      // 置信度 (0-1)
  priority: 'high' | 'medium' | 'low'    // 优先级
}

// 系统信息
export interface SystemInfo {
  osVersion: string
  architecture: string
  totalMemory: number
  cpuModel: string
  uptime: number
}

// 优化操作
export interface OptimizationAction {
  itemId: string
  action: 'disable' | 'enable'
  success: boolean
  error?: string
}

// 优化结果
export interface OptimizationResult {
  actions: OptimizationAction[]
  successCount: number
  failedCount: number
}
