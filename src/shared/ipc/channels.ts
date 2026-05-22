/**
 * IPC 通信通道常量定义
 * 避免硬编码字符串，统一管理通道名称
 * 所有 main 和 renderer 必须使用此常量，禁止直接写字符串
 */

export const IPC_CHANNELS = {
  // ==================== 扫描相关 ====================
  SCAN: {
    REGISTRY: 'scan:registry',
    SERVICES: 'scan:services',
    TASKS: 'scan:tasks',
    FOLDER: 'scan:folder',
    ALL: 'scan:all',
    PROGRESS: 'scan:progress'
  },

  // ==================== 启动项操作 ====================
  ITEM: {
    TOGGLE: 'item:toggle',
    DELETE: 'item:delete',
    GET_DETAIL: 'item:get-detail',
    GET_LIST: 'item:get-list',
    BATCH_TOGGLE: 'item:batch-toggle',
    RESTORE_ALL: 'item:restore-all',
    IS_CRITICAL: 'item:is-critical'
  },

  // ==================== AI 相关 ====================
  AI: {
    ANALYZE: 'ai:analyze',
    BATCH_ANALYZE: 'ai:batch-analyze',
    CHAT: 'ai:chat',
    TEST_CONNECTION: 'ai:test-connection',
    GET_CONFIG: 'ai:get-config',
    SET_CONFIG: 'ai:set-config',
    CLEAR_CONFIG: 'ai:clear-config',
    GET_MODELS: 'ai:get-models'
  },

  // ==================== 数据库相关 ====================
  DB: {
    GET_CACHE: 'db:get-cache',
    SAVE_CACHE: 'db:save-cache',
    GET_HISTORY: 'db:get-history',
    GET_STATS: 'db:get-stats'
  },

  // ==================== 文件信息 ====================
  FILE: {
    GET_INFO: 'file:get-info',
    CLEAR_CACHE: 'file:clear-cache'
  },

  // ==================== 缓存管理 ====================
  CACHE: {
    CLEAR_SCAN: 'cache:clear-scan',
    CLEAR_AI: 'cache:clear-ai',
    GET_STATS: 'cache:get-stats'
  },

  // ==================== 系统相关 ====================
  SYSTEM: {
    GET_APP_INFO: 'system:get-app-info',
    OPEN_FILE_LOCATION: 'system:open-file-location',
    IS_ADMIN: 'system:is-admin',
    GET_BOOT_TIME: 'system:get-boot-time',
    GET_MEMORY: 'system:get-memory',
    RELAUNCH_AS_ADMIN: 'system:relaunch-as-admin'
  }
} as const

/**
 * IPC 响应格式
 */
export interface IPCResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 进度通知格式
 * current/total 表示当前值和总量
 * stage 表示当前扫描阶段（enum: init | registry | services | tasks | folder | drivers | shell | dedup | cache | done）
 * percentage 为自动计算的百分比
 */
export interface ProgressNotification {
  current: number
  total: number
  message: string
  percentage: number
  stage?: string
}
