/**
 * IPC 通信通道常量定义
 * 避免硬编码字符串，统一管理通道名称
 */

export const IPC_CHANNELS = {
  // 扫描相关通道
  SCAN: {
    REGISTRY: 'scan:registry',
    SERVICES: 'scan:services',
    TASKS: 'scan:tasks',
    FOLDER: 'scan:folder',
    ALL: 'scan:all'
  },

  // 启动项操作通道
  ITEM: {
    TOGGLE: 'item:toggle',
    DELETE: 'item:delete',
    GET_DETAIL: 'item:get-detail',
    GET_LIST: 'item:get-list'
  },

  // AI 相关通道
  AI: {
    ANALYZE: 'ai:analyze',
    BATCH_ANALYZE: 'ai:batch-analyze',
    CHAT: 'ai:chat',
    TEST_CONNECTION: 'ai:test-connection',
    GET_CONFIG: 'ai:get-config',
    SET_CONFIG: 'ai:set-config',
    CLEAR_CONFIG: 'ai:clear-config',
    GET_MODELS: 'ai:get-models'  // 新增：获取模型列表
  },

  // 数据库相关通道
  DB: {
    GET_CACHE: 'db:get-cache',
    SAVE_CACHE: 'db:save-cache',
    GET_HISTORY: 'db:get-history',
    GET_STATS: 'db:get-stats'
  },

  // 文件信息通道
  FILE: {
    GET_INFO: 'file:get-info',
    CLEAR_CACHE: 'file:clear-cache'
  },

  // 系统相关通道
  SYSTEM: {
    GET_APP_INFO: 'system:get-app-info',
    OPEN_FILE_LOCATION: 'system:open-file-location',
    IS_ADMIN: 'system:is-admin'  // 新增：检查管理员权限
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
 */
export interface ProgressNotification {
  progress: number
  total: number
  message: string
}
