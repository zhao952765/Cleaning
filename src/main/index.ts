import { app, BrowserWindow } from 'electron'
import path from 'path'
import { startupScanner } from './scanner'
import { fileInfoExtractor } from './scanner/fileInfo'
import { databaseManager } from './database'
import { aiConfigManager } from './ai/config'
import { IPCHandlers } from './ipc/handlers'
import { logger } from './utils/logger'
import { ScanOptions } from '../shared/types'
import isAdmin from 'is-admin'

// 开发环境下使用 Vite 服务器
const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null
let ipcHandlers: IPCHandlers | null = null
let isAdminPrivilege = false

/**
 * 全局错误处理
 */
function setupGlobalErrorHandling(): void {
  // 未捕获的异常
  process.on('uncaughtException', (error) => {
    logger.recordError(error, 'UncaughtException')
  })

  // 未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('[UnhandledRejection]', reason)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
      devTools: isDev // 开发环境自动开启开发者工具
    },
    show: false,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hiddenInset' // Windows 上使用隐藏标题栏样式
  })

  if (isDev) {
    // 开发环境加载 Vite 开发服务器
    mainWindow.loadURL('http://localhost:5173')
  } else {
    // 生产环境加载构建后的文件
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Electron 初始化完成时创建窗口
app.whenReady().then(async () => {
  // 初始化日志系统
  logger.initialize()
  logger.info('[Main] 应用启动')

  // 检测管理员权限
  try {
    isAdminPrivilege = await isAdmin()
    logger.info(`[Main] 当前权限: ${isAdminPrivilege ? '管理员' : '普通用户'}`)
  } catch (error) {
    logger.error('[Main] 权限检测失败:', error)
    isAdminPrivilege = false
  }

  // ========== 权限诊断 ==========
  const { execSync } = require('child_process')
  try {
    execSync('net session', { encoding: 'utf8', timeout: 3000 })
    logger.info('✅ 当前以管理员权限运行')
  } catch (err: any) {
    logger.info('❌ 未以管理员权限运行，扫描将失败')
    logger.info('错误:', err.message)
  }

  // 设置全局错误处理
  setupGlobalErrorHandling()

  // 初始化数据库
  try {
    databaseManager.initialize()
    logger.info('[Main] 数据库初始化成功')
  } catch (error) {
    logger.recordError(error as Error, 'DatabaseInit')
  }

  // 加载 AI 配置
  const aiConfig = aiConfigManager.getConfig()
  if (aiConfig) {
    logger.info('[Main] AI 配置已加载')
  }

  createWindow()

  // 初始化 IPC 处理器（传入主窗口）
  if (mainWindow) {
    ipcHandlers = new IPCHandlers(mainWindow)
    logger.info('[Main] IPC 处理器初始化成功')
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 导出权限状态供 IPC handlers 使用
export { isAdminPrivilege }
