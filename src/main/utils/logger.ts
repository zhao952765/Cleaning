import log from 'electron-log'
import path from 'path'
import { app } from 'electron'

/**
 * 日志系统配置
 * 支持分级日志、文件轮转和调试模式
 */
export class Logger {
  private static initialized = false

  /**
   * 初始化日志系统
   */
  static initialize(): void {
    if (this.initialized) return

    // 配置日志文件路径
    const logPath = path.join(app.getPath('userData'), 'logs')
    
    log.transports.file.resolvePathFn = () => {
      return path.join(logPath, 'main.log')
    }

    // 配置日志级别
    if (process.env.NODE_ENV === 'development') {
      log.transports.file.level = 'debug'
      log.transports.console.level = 'debug'
    } else {
      log.transports.file.level = 'info'
      log.transports.console.level = 'warn'
    }

    // 配置文件轮转（最大 5MB，保留 5 个文件）
    log.transports.file.maxSize = 5 * 1024 * 1024 // 5MB
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'

    this.initialized = true
    
    console.log('[Logger] 日志系统初始化完成')
  }

  /**
   * Debug 级别日志
   */
  static debug(...params: any[]): void {
    log.debug(...params)
  }

  /**
   * Info 级别日志
   */
  static info(...params: any[]): void {
    log.info(...params)
  }

  /**
   * Warn 级别日志
   */
  static warn(...params: any[]): void {
    log.warn(...params)
  }

  /**
   * Error 级别日志
   */
  static error(...params: any[]): void {
    log.error(...params)
  }

  /**
   * 记录异常
   */
  static recordError(error: Error, context?: string): void {
    log.error(`[${context || 'Unknown'}] ${error.message}`)
    if (error.stack) {
      log.error(error.stack)
    }
  }
}

// 导出单例方法
export const logger = Logger
