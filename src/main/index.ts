import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { execSync } from 'child_process'
import { startupScanner } from './scanner'
import { fileInfoExtractor } from './scanner/fileInfo'
import { databaseManager } from './database'
import { aiConfigManager } from './ai/config'
import { IPCHandlers } from './ipc/handlers'
import { logger } from './utils/logger'
import { ScanOptions } from '../shared/types'
import { IPC_CHANNELS } from '../shared/ipc/channels'
import isAdmin from 'is-admin'

// 开发环境下使用 Vite 服务器
const isDev = process.env.NODE_ENV === 'development'

// 应用启动时通过命令行参数确保高 DPI 支持
app.commandLine.appendSwitch('high-dpi-support', '1')
app.commandLine.appendSwitch('force-device-scale-factor', '1')

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
  process.on('unhandledRejection', (reason) => {
    logger.error('[UnhandledRejection]', reason)
  })
}

/**
 * 以管理员身份重启应用（Windows）
 * 使用 PowerShell Start-Process 的 runas 动词提权
 */
function relaunchAsAdmin(): void {
  logger.info('[Main] 请求以管理员身份重启应用')

  try {
    const exePath = process.execPath
    const args = process.argv.slice(1).map(a => `"${a}"`).join(' ')

    // PowerShell 调用比 cmd 更可靠，runas 动词触发 UAC 提权
    execSync(
      `powershell -Command "Start-Process '${exePath}' -Verb runAs -ArgumentList '${args}'"`,
      { stdio: 'ignore', timeout: 10000 }
    )

    logger.info('[Main] 管理员进程已启动，当前进程退出')
  } catch (error) {
    logger.error('[Main] 以管理员身份重启失败:', error)
  }

  // 无论启动成功与否，都退出当前进程
  app.exit(0)
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
      devTools: isDev
    },
    show: false,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hiddenInset'
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()

    // =========================================================
    // 窗口显示后，向渲染进程发送管理员权限状态
    // 渲染进程收到后根据状态决定是否弹出权限提示 Modal
    // =========================================================
    if (mainWindow && !isAdminPrivilege) {
      mainWindow.webContents.send(IPC_CHANNELS.SYSTEM.IS_ADMIN, {
        success: true,
        data: false
      })
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Electron 初始化完成时创建窗口
app.whenReady().then(async () => {
  // ==================== 日志系统初始化 ====================
  logger.initialize()
  logger.info(`[Main] 应用启动 (v${app.getVersion()})`)
  logger.info(`[Main] 平台: ${process.platform}, 进程架构: ${process.arch}`)

  // ==================== 管理员权限检测 ====================
  try {
    isAdminPrivilege = await isAdmin()
    logger.info(`[Main] 权限检测: ${isAdminPrivilege ? '管理员 (Administrator)' : '普通用户'}`)
  } catch (error) {
    logger.error('[Main] 权限检测失败:', error)
    isAdminPrivilege = false
  }

  // 权限诊断：net session 是 Windows 判断管理员权限的经典方式
  try {
    execSync('net session', { encoding: 'utf8', timeout: 3000 })
    logger.info('[Main] net session 验证: 管理员权限')
  } catch (err: any) {
    logger.info(`[Main] net session 验证: 非管理员 (${err.message})`)
  }

  // ==================== 注册管理员重启 IPC ====================
  ipcMain.handle(IPC_CHANNELS.SYSTEM.RELAUNCH_AS_ADMIN, () => {
    relaunchAsAdmin()
    return { success: true }
  })

  // ==================== 全局错误处理 ====================
  setupGlobalErrorHandling()

  // ==================== 数据库初始化 ====================
  try {
    databaseManager.initialize()
    logger.info('[Main] 数据库初始化成功')
  } catch (error) {
    logger.recordError(error as Error, 'DatabaseInit')
  }

  // ==================== AI 配置加载 ====================
  const aiConfig = aiConfigManager.getConfig()
  if (aiConfig) {
    logger.info('[Main] AI 配置已加载')
  }

  // ==================== 创建窗口 ====================
  createWindow()

  // ==================== IPC 处理器初始化 ====================
  if (mainWindow) {
    ipcHandlers = new IPCHandlers(mainWindow)
    logger.info('[Main] IPC 处理器初始化成功')
  }

  // macOS 激活事件
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 导出权限状态供 IPC handlers 使用
export { isAdminPrivilege }
