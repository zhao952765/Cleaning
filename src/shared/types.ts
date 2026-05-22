// 启动项来源类型
export type StartupSource = 'registry' | 'task' | 'service' | 'folder' | 'plugin' | 'driver' | 'shell'

// 启动项类型
export enum StartupType {
  Registry = 'registry',
  Service = 'service',
  ScheduledTask = 'scheduledTask',
  Folder = 'folder',
  Driver = 'driver',
  Shell = 'shell',
  Plugin = 'plugin'
}

// 启动项状态
export enum StartupStatus {
  Enabled = 'enabled',
  Disabled = 'disabled',
  Unknown = 'unknown'
}

// 安全等级
export enum SecurityLevel {
  Safe = 'safe',
  Caution = 'caution',
  Dangerous = 'dangerous'
}

// 风险等级
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical' | 'Unknown'

// 启动项接口（增强版）
export interface StartupItem {
  id: string
  name: string
  description?: string
  type: StartupType | string
  source: string
  status: string
  path: string
  arguments?: string
  publisher?: string
  version?: string
  securityLevel: string
  impact: string
  enabled: boolean
  isSystem?: boolean
  isProtected?: boolean           // 是否为受保护项（不可禁用）
  protectedReason?: string        // 保护原因说明
  triggerSummary?: string         // 计划任务触发器摘要（如"每日10:00触发"）
  riskLevel?: RiskLevel           // AI 风险评估等级
  lastModified?: Date
  icon?: string
  iconColor?: string
  banRateValue?: number
  location?: string
  hash?: string
  fileInfo?: FileInfo
}

// 文件信息接口
export interface FileInfo {
  filePath: string
  fileSize: number
  version: string
  description: string
  company: string
  icon?: string
  signature: SignatureInfo
  md5: string
  sha256: string
  createTime: Date
  modifyTime: Date
}

// 签名信息
export interface SignatureInfo {
  status: 'valid' | 'invalid' | 'unsigned'
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
  scanDrivers?: boolean
  scanShellExtensions?: boolean
  scanPlugins?: boolean
}

// 扫描结果
export interface ScanResult {
  items: StartupItem[]
  totalCount: number
  enabledCount: number
  disabledCount: number
  scanDuration: number
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
  action: 'keep' | 'disable' | 'enable'
  reason: string
  confidence: number
  priority: 'high' | 'medium' | 'low'
}

// 系统信息
export interface SystemInfo {
  osVersion: string
  architecture: string
  totalMemory: number
  cpuModel: string
  uptime: number
}

// 优化操作/结果
export interface OptimizationAction {
  itemId: string
  action: 'disable' | 'enable'
  success: boolean
  error?: string
}

export interface OptimizationResult {
  actions: OptimizationAction[]
  successCount: number
  failedCount: number
}

// 操作结果（统一格式）
export interface OperationResult {
  success: boolean
  message: string
  backupPath?: string
}
