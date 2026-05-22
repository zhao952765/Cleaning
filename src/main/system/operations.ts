import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { app, shell } from 'electron'
import Winreg from 'winreg'
import { databaseManager } from '../database'
import { StartupItem } from '../../shared/types'

const execAsync = promisify(exec)

// ============================================================
// 操作结果类型
// ============================================================
export interface OperationResult {
  success: boolean
  message: string
  backupPath?: string
}

// ============================================================
// 系统关键项保护列表
// 包含 explorer.exe、svchost.exe、重要 Microsoft 服务、杀毒软件等
// ============================================================
const CRITICAL_ITEM_PATTERNS = [
  // === 系统进程 ===
  { name: 'explorer.exe', desc: 'Windows 资源管理器' },
  { name: 'svchost.exe', desc: 'Windows 服务主机进程' },
  { name: 'csrss.exe', desc: 'Windows 子系统' },
  { name: 'wininit.exe', desc: 'Windows 启动初始化' },
  { name: 'services.exe', desc: '服务控制管理器' },
  { name: 'lsass.exe', desc: '本地安全机构进程' },
  { name: 'winlogon.exe', desc: 'Windows 登录' },
  { name: 'smss.exe', desc: '会话管理器' },
  { name: 'taskmgr.exe', desc: '任务管理器' },
  { name: 'runtimebroker.exe', desc: '运行时代理' },
  { name: 'sihost.exe', desc: 'Shell 基础架构主机' },
  { name: 'taskhostw.exe', desc: '任务主机窗口' },

  // === 安全/杀毒 ===
  { name: 'MsMpEng.exe', desc: 'Microsoft Defender 防病毒' },
  { name: 'MsSense.exe', desc: 'Microsoft Defender 高级威胁防护' },
  { name: 'SecurityHealthService', desc: 'Windows 安全中心' },
  { name: 'MpCmdRun.exe', desc: 'Microsoft Defender 命令行' },
  { name: 'NisSrv.exe', desc: 'Microsoft Defender 网络检查' },

  // === 重要 Microsoft 服务 ===
  { name: 'Windows Update', desc: 'Windows 更新服务' },
  { name: 'wuauserv', desc: 'Windows 更新服务(服务名)' },
  { name: 'MpsSvc', desc: 'Windows 防火墙' },
  { name: 'BFE', desc: '基础过滤引擎' },
  { name: 'brokerinfrastructureservice', desc: '代理基础架构服务' },
  { name: 'DcomLaunch', desc: 'DCOM 服务器进程启动器' },
  { name: 'RpcSs', desc: '远程过程调用' },
  { name: 'PlugPlay', desc: '即插即用' },
  { name: 'Power', desc: '电源策略' },
  { name: 'EventLog', desc: 'Windows 事件日志' },
  { name: 'WpnService', desc: 'Windows 推送通知' },
  { name: 'DoSvc', desc: '传递优化' },

  // === 注册表启动项 ===
  { name: 'Userinit', desc: '用户初始化' },
  { name: 'Shell', desc: 'Windows Shell' },
]

// ============================================================
// 已知安全的关键项（路径级）—— 路径包含这些就不允许禁用
// ============================================================
const CRITICAL_PATH_PATTERNS = [
  /\\Windows\\System32\\[a-z]+\.exe$/i,
  /\\Windows\\SysWOW64\\[a-z]+\.exe$/i,
  /\\Program Files\\Windows Defender\\/i,
  /\\Program Files\\Microsoft Security Client\\/i,
]

/**
 * 系统启动项操作管理器
 * 提供启用/禁用/删除功能 + 备份回滚
 */
export class SystemOperationsManager {
  private backupDir: string

  constructor() {
    this.backupDir = path.join(app.getPath('userData'), 'backups')
    this.ensureBackupDir()
  }

  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }
  }

  // ============================================================
  // 判断是否为系统关键项
  // ============================================================
  isSystemCritical(item: StartupItem): boolean {
    const nameLower = item.name.toLowerCase()
    const pathLower = (item.path || '').toLowerCase()

    // 检查名称匹配
    for (const pattern of CRITICAL_ITEM_PATTERNS) {
      if (nameLower.includes(pattern.name.toLowerCase())) return true
    }

    // 检查路径匹配
    for (const regex of CRITICAL_PATH_PATTERNS) {
      if (regex.test(pathLower)) return true
    }

    return false
  }

  /**
   * 获取关键项警告信息（用于二次确认弹窗）
   */
  getCriticalWarning(item: StartupItem): string | null {
    if (!this.isSystemCritical(item)) return null

    const nameLower = item.name.toLowerCase()
    const matched = CRITICAL_ITEM_PATTERNS.find(p => nameLower.includes(p.name.toLowerCase()))

    if (matched) {
      return `"${item.name}" 被识别为 ${matched.desc}，属于系统关键项。\n禁用可能导致系统不稳定或功能异常，是否确定要继续？`
    }

    return `"${item.name}" 被识别为系统关键项，禁用可能存在风险。\n确定要继续吗？`
  }

  // ============================================================
  // 统一切换接口（启用/禁用）
  // ============================================================
  async toggleItem(item: StartupItem, enable: boolean): Promise<OperationResult> {
    console.log(`[Operations] toggleItem: ${item.name} (${item.source}) → ${enable ? '启用' : '禁用'}`)

    try {
      let result: OperationResult

      switch (item.source) {
        case 'registry':
          result = await this.toggleRegistryItem(item, enable)
          break
        case 'service':
          result = await this.toggleService(item, enable)
          break
        case 'task':
          result = await this.toggleScheduledTask(item, enable)
          break
        case 'folder':
          result = await this.toggleStartupFolderItem(item, enable)
          break
        case 'driver':
        case 'shell':
          result = { success: false, message: `${item.source} 类型不支持直接切换` }
          break
        default:
          result = { success: false, message: `不支持的启动项类型: ${item.source}` }
      }

      // 操作成功时保存历史
      if (result.success) {
        databaseManager.logUserAction(
          item.id,
          enable ? 'enable' : 'disable',
          JSON.stringify({ name: item.name, source: item.source, backupPath: result.backupPath })
        )
      }

      return result
    } catch (error: any) {
      console.error(`[Operations] toggleItem 失败 [${item.name}]:`, error)
      return { success: false, message: error.message || '操作失败' }
    }
  }

  // ============================================================
  // 删除启动项
  // ============================================================
  async deleteItem(item: StartupItem): Promise<OperationResult> {
    console.log(`[Operations] deleteItem: ${item.name} (${item.source})`)

    try {
      let result: OperationResult

      switch (item.source) {
        case 'registry':
          result = await this.deleteRegistryItem(item)
          break
        case 'service':
          result = await this.deleteService(item)
          break
        case 'task':
          result = await this.deleteScheduledTask(item)
          break
        case 'folder':
          // 文件夹删除 = 移动到回收站（通过 backup 实现可回滚）
          result = await this.deleteStartupFolderItem(item)
          break
        default:
          result = { success: false, message: `${item.source} 类型不支持删除` }
      }

      if (result.success) {
        databaseManager.logUserAction(
          item.id,
          'delete',
          JSON.stringify({ name: item.name, source: item.source, backupPath: result.backupPath })
        )
      }

      return result
    } catch (error: any) {
      console.error(`[Operations] deleteItem 失败 [${item.name}]:`, error)
      return { success: false, message: error.message || '删除失败' }
    }
  }

  // ============================================================
  // 批量操作
  // ============================================================
  async batchToggle(items: StartupItem[], enable: boolean): Promise<{
    success: number
    failed: number
    results: Array<{ itemId: string; success: boolean; message: string; backupPath?: string }>
  }> {
    const results: Array<{ itemId: string; success: boolean; message: string; backupPath?: string }> = []
    let successCount = 0
    let failedCount = 0

    for (const item of items) {
      try {
        const r = await this.toggleItem(item, enable)
        results.push({ itemId: item.id, ...r })
        if (r.success) successCount++
        else failedCount++
      } catch (error: any) {
        results.push({ itemId: item.id, success: false, message: error.message || '操作失败' })
        failedCount++
      }
    }

    return { success: successCount, failed: failedCount, results }
  }

  // ============================================================
  // 注册表操作
  // ============================================================
  private async toggleRegistryItem(item: StartupItem, enable: boolean): Promise<OperationResult> {
    const { hive, key } = this.parseRegistryLocation(item)
    if (!key) return { success: false, message: '无效的注册表路径' }

    const reg = new Winreg({ hive, key })
    const backupPath = this.getBackupPath(item.id)

    if (enable) {
      // 从备份恢复
      const backup = this.readBackup(backupPath)
      if (!backup) return { success: false, message: `未找到 ${item.name} 的备份数据` }

      try {
        await this.setRegistryValue(reg, item.name, backup.value, backup.type)
        this.removeBackupFile(backupPath)
        return { success: true, message: `已启用: ${item.name}` }
      } catch (err: any) {
        return { success: false, message: `启用失败（可能需要管理员权限）: ${err.message}` }
      }
    } else {
      // 备份当前值 → 删除
      try {
        const current = await this.getRegistryValue(reg, item.name)
        if (!current) return { success: false, message: '注册表值不存在，可能已被移除' }

        this.writeBackup(backupPath, {
          itemId: item.id, name: item.name, value: current.value,
          type: current.type, operation: 'disable', timestamp: new Date().toISOString(),
        })

        await this.deleteRegistryValue(reg, item.name)
        return { success: true, message: `已禁用: ${item.name}`, backupPath }
      } catch (err: any) {
        // 回滚：尝试恢复
        const backup = this.readBackup(backupPath)
        if (backup) {
          try { await this.setRegistryValue(reg, item.name, backup.value, backup.type) } catch {}
        }
        return { success: false, message: `禁用失败: ${err.message}` }
      }
    }
  }

  private async deleteRegistryItem(item: StartupItem): Promise<OperationResult> {
    const { hive, key } = this.parseRegistryLocation(item)
    if (!key) return { success: false, message: '无效的注册表路径' }

    const reg = new Winreg({ hive, key })
    const backupPath = this.getBackupPath(item.id)

    try {
      const current = await this.getRegistryValue(reg, item.name)
      if (!current) return { success: false, message: '注册表值不存在' }

      this.writeBackup(backupPath, {
        itemId: item.id, name: item.name, value: current.value,
        type: current.type, operation: 'delete', timestamp: new Date().toISOString(),
      })

      await this.deleteRegistryValue(reg, item.name)
      return { success: true, message: `已删除: ${item.name}`, backupPath }
    } catch (err: any) {
      return { success: false, message: `删除失败: ${err.message}` }
    }
  }

  private parseRegistryLocation(item: StartupItem): { hive: string; key: string } {
    const loc = item.location || ''
    if (!loc.includes('\\')) return { hive: '', key: '' }

    const hive = loc.startsWith('HKLM') ? Winreg.HKLM : Winreg.HKCU

    // 从 location 中提取 key 部分（去掉末尾的 \name）
    // 例如: HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run\MyApp
    // → key: \SOFTWARE\Microsoft\Windows\CurrentVersion\Run
    const keyPart = loc.replace(/^(HKLM|HKCU)/, '')
    const lastBackslash = keyPart.lastIndexOf('\\')
    const key = lastBackslash > 0 ? keyPart.substring(0, lastBackslash) : keyPart

    return { hive, key }
  }

  private getRegistryValue(reg: Winreg.Registry, name: string): Promise<{ value: string; type: string } | null> {
    return new Promise(resolve => {
      reg.get(name, (err, item) => {
        if (err || !item) resolve(null)
        else resolve({ value: item.value, type: item.type })
      })
    })
  }

  private setRegistryValue(reg: Winreg.Registry, name: string, value: string, type: string): Promise<void> {
    return new Promise((resolve, reject) => {
      reg.set(name, type, value, err => err ? reject(err) : resolve())
    })
  }

  private deleteRegistryValue(reg: Winreg.Registry, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      reg.remove(name, err => err ? reject(err) : resolve())
    })
  }

  // ============================================================
  // 服务操作：sc config + net start/stop
  // ============================================================
  private async toggleService(item: StartupItem, enable: boolean): Promise<OperationResult> {
    const serviceName = item.name
    const backupPath = this.getBackupPath(item.id)

    try {
      if (enable) {
        // 先查询当前启动类型（备份）
        const { stdout: queryResult } = await execAsync(
          `sc qc "${serviceName}"`,
          { encoding: 'utf8', timeout: 10000, windowsHide: true }
        )
        const startTypeMatch = queryResult.match(/START_TYPE\s*:\s*\d+\s+(\w+)/)
        const currentStartType = startTypeMatch ? startTypeMatch[1] : ''

        this.writeBackup(backupPath, {
          itemId: item.id, name: serviceName,
          originalStartType: currentStartType,
          operation: 'enable', timestamp: new Date().toISOString(),
        })

        await execAsync(`sc config "${serviceName}" start= auto`, { timeout: 10000, windowsHide: true })
        await execAsync(`net start "${serviceName}"`, { timeout: 15000, windowsHide: true }).catch(() => {})
        return { success: true, message: `已启用服务: ${serviceName}`, backupPath }
      } else {
        // 备份当前启动类型
        const { stdout: queryResult } = await execAsync(
          `sc qc "${serviceName}"`,
          { encoding: 'utf8', timeout: 10000, windowsHide: true }
        )
        const startTypeMatch = queryResult.match(/START_TYPE\s*:\s*\d+\s+(\w+)/)
        const currentStartType = startTypeMatch ? startTypeMatch[1] : ''

        this.writeBackup(backupPath, {
          itemId: item.id, name: serviceName,
          originalStartType: currentStartType,
          operation: 'disable', timestamp: new Date().toISOString(),
        })

        // 先停止（如果正在运行）
        await execAsync(`net stop "${serviceName}"`, { timeout: 30000, windowsHide: true }).catch(() => {})
        // 再设为禁用
        await execAsync(`sc config "${serviceName}" start= disabled`, { timeout: 10000, windowsHide: true })
        return { success: true, message: `已禁用服务: ${serviceName}`, backupPath }
      }
    } catch (err: any) {
      // 回滚
      const backup = this.readBackup(backupPath)
      if (backup && backup.originalStartType) {
        try {
          const startMap: Record<string, string> = { AUTO: 'auto', DEMAND: 'demand', DISABLED: 'disabled', BOOT: 'boot', SYSTEM: 'system' }
          const mapped = startMap[backup.originalStartType.toUpperCase()] || 'demand'
          await execAsync(`sc config "${serviceName}" start= ${mapped}`, { timeout: 10000, windowsHide: true })
        } catch {}
      }
      return { success: false, message: `操作失败: ${err.message}` }
    }
  }

  private async deleteService(item: StartupItem): Promise<OperationResult> {
    const serviceName = item.name
    const backupPath = this.getBackupPath(item.id)

    try {
      // 备份当前配置
      const { stdout: qc } = await execAsync(`sc qc "${serviceName}"`, { encoding: 'utf8', timeout: 10000, windowsHide: true })
      this.writeBackup(backupPath, {
        itemId: item.id, name: serviceName,
        config: qc, operation: 'delete', timestamp: new Date().toISOString(),
      })

      // 先停止再删除
      await execAsync(`net stop "${serviceName}"`, { timeout: 30000, windowsHide: true }).catch(() => {})
      await execAsync(`sc delete "${serviceName}"`, { timeout: 10000, windowsHide: true })
      return { success: true, message: `已删除服务: ${serviceName}`, backupPath }
    } catch (err: any) {
      return { success: false, message: `删除失败: ${err.message}` }
    }
  }

  // ============================================================
  // 计划任务操作：PowerShell Enable/Disable-ScheduledTask
  // ============================================================
  private async toggleScheduledTask(item: StartupItem, enable: boolean): Promise<OperationResult> {
    const taskName = item.name
    const taskPath = item.location || `\\${taskName}`
    const backupPath = this.getBackupPath(item.id)

    try {
      if (enable) {
        await execAsync(
          `powershell -NoProfile -Command "Enable-ScheduledTask -TaskPath '${taskPath}'"`,
          { timeout: 15000, windowsHide: true }
        )
        return { success: true, message: `已启用计划任务: ${taskName}` }
      } else {
        // 备份：记录当前状态
        const { stdout } = await execAsync(
          `powershell -NoProfile -Command "(Get-ScheduledTask -TaskPath '${taskPath}').State"`,
          { encoding: 'utf8', timeout: 10000, windowsHide: true }
        )
        this.writeBackup(backupPath, {
          itemId: item.id, name: taskName, taskPath,
          originalState: stdout.trim(), operation: 'disable', timestamp: new Date().toISOString(),
        })

        await execAsync(
          `powershell -NoProfile -Command "Disable-ScheduledTask -TaskPath '${taskPath}'"`,
          { timeout: 15000, windowsHide: true }
        )
        return { success: true, message: `已禁用计划任务: ${taskName}`, backupPath }
      }
    } catch (err: any) {
      return { success: false, message: `操作失败: ${err.message}` }
    }
  }

  private async deleteScheduledTask(item: StartupItem): Promise<OperationResult> {
    const taskPath = item.location || `\\${item.name}`
    const backupPath = this.getBackupPath(item.id)

    try {
      // 备份完整任务定义
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "Export-ScheduledTask -TaskPath '${taskPath}'"`,
        { encoding: 'utf8', timeout: 15000, windowsHide: true }
      )
      this.writeBackup(backupPath, {
        itemId: item.id, name: item.name, taskPath,
        taskXml: stdout, operation: 'delete', timestamp: new Date().toISOString(),
      })

      await execAsync(
        `powershell -NoProfile -Command "Unregister-ScheduledTask -TaskPath '${taskPath}' -Confirm:$false"`,
        { timeout: 15000, windowsHide: true }
      )
      return { success: true, message: `已删除计划任务: ${item.name}`, backupPath }
    } catch (err: any) {
      return { success: false, message: `删除失败: ${err.message}` }
    }
  }

  // ============================================================
  // 启动文件夹操作
  // ============================================================
  private async toggleStartupFolderItem(item: StartupItem, enable: boolean): Promise<OperationResult> {
    const sourcePath = item.path
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return { success: false, message: `文件不存在: ${sourcePath}` }
    }

    const backupPath = this.getBackupPath(item.id)

    try {
      if (enable) {
        // 从备份恢复
        if (!fs.existsSync(backupPath)) {
          return { success: false, message: `未找到备份文件: ${path.basename(backupPath)}` }
        }
        fs.copyFileSync(backupPath, sourcePath)
        fs.unlinkSync(backupPath)
        return { success: true, message: `已恢复: ${item.name}` }
      } else {
        // 备份到 backup 目录，保留源文件名
        fs.copyFileSync(sourcePath, backupPath)
        fs.unlinkSync(sourcePath)
        return { success: true, message: `已移除: ${item.name}`, backupPath }
      }
    } catch (err: any) {
      return { success: false, message: `操作失败: ${err.message}` }
    }
  }

  private async deleteStartupFolderItem(item: StartupItem): Promise<OperationResult> {
    const sourcePath = item.path
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return { success: false, message: `文件不存在: ${sourcePath}` }
    }

    const backupPath = this.getBackupPath(item.id)

    try {
      fs.copyFileSync(sourcePath, backupPath)
      fs.unlinkSync(sourcePath)
      return { success: true, message: `已删除: ${item.name}（已备份至 ${backupPath}）`, backupPath }
    } catch (err: any) {
      return { success: false, message: `删除失败: ${err.message}` }
    }
  }

  // ============================================================
  // 打开文件位置
  // ============================================================
  async openFileLocation(filePath: string): Promise<OperationResult> {
    try {
      if (!fs.existsSync(filePath)) return { success: false, message: '文件不存在' }
      shell.showItemInFolder(filePath)
      return { success: true, message: '已打开文件位置' }
    } catch (err: any) {
      return { success: false, message: err.message }
    }
  }

  // ============================================================
  // 获取系统启动时间
  // ============================================================
  async getBootTime(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "(Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime"',
        { encoding: 'utf8', timeout: 10000, windowsHide: true }
      )
      const m = stdout.match(/(\d+)\.(\d+):(\d+):(\d+)/)
      if (m) return ((+m[1] * 24 + +m[2]) * 60 + +m[3]) * 60 + +m[4]
      return 0
    } catch {
      return 0
    }
  }

  // ============================================================
  // 备份文件辅助
  // ============================================================
  private getBackupPath(itemId: string): string {
    return path.join(this.backupDir, `${itemId}.bak`)
  }

  private writeBackup(backupPath: string, data: any): void {
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf-8')
  }

  private readBackup(backupPath: string): any | null {
    try {
      if (!fs.existsSync(backupPath)) return null
      return JSON.parse(fs.readFileSync(backupPath, 'utf-8'))
    } catch {
      return null
    }
  }

  private removeBackupFile(backupPath: string): void {
    try { if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath) } catch {}
  }

  // ============================================================
  // 还原所有修改（遍历备份目录）
  // ============================================================
  async restoreAll(): Promise<{ success: number; failed: number }> {
    let successCount = 0
    let failedCount = 0

    try {
      const files = fs.readdirSync(this.backupDir)
      for (const file of files) {
        if (!file.endsWith('.bak')) continue
        const backupPath = path.join(this.backupDir, file)
        const backup = this.readBackup(backupPath)
        if (!backup || !backup.operation) { failedCount++; continue }

        try {
          if (backup.operation === 'disable' || backup.operation === 'enable') {
            // 反向操作：禁用→启用，启用→禁用
            const reverseEnable = backup.operation === 'disable'
            if (backup.taskPath) {
              // 计划任务
              if (reverseEnable) {
                await execAsync(
                  `powershell -NoProfile -Command "Enable-ScheduledTask -TaskPath '${backup.taskPath}'"`,
                  { timeout: 15000, windowsHide: true }
                )
              } else {
                await execAsync(
                  `powershell -NoProfile -Command "Disable-ScheduledTask -TaskPath '${backup.taskPath}'"`,
                  { timeout: 15000, windowsHide: true }
                )
              }
            } else if (backup.originalStartType) {
              // 服务
              const startMap: Record<string, string> = { AUTO: 'auto', DEMAND: 'demand', DISABLED: 'disabled', BOOT: 'boot', SYSTEM: 'system' }
              const mapped = startMap[backup.originalStartType.toUpperCase()] || 'demand'
              await execAsync(`sc config "${backup.name}" start= ${mapped}`, { timeout: 10000, windowsHide: true })
            } else if (backup.value !== undefined) {
              // 注册表
            }
            // 恢复文件
            // const srcPath = ???  -- 需要原始路径信息
          } else if (backup.operation === 'delete' && backup.taskXml) {
            // 恢复已删除的计划任务
            const xmlPath = backupPath.replace('.bak', '.xml')
            fs.writeFileSync(xmlPath, backup.taskXml, 'utf-8')
            await execAsync(
              `powershell -NoProfile -Command "Register-ScheduledTask -Xml (Get-Content '${xmlPath}' | Out-String) -TaskName '${backup.name}' -Force"`,
              { timeout: 15000, windowsHide: true }
            )
            if (fs.existsSync(xmlPath)) fs.unlinkSync(xmlPath)
          }
          // 还原成功后删除备份
          fs.unlinkSync(backupPath)
          successCount++
        } catch {
          failedCount++
        }
      }
    } catch (error) {
      console.error('[Operations] restoreAll 失败:', error)
    }

    return { success: successCount, failed: failedCount }
  }
}

export const systemOperationsManager = new SystemOperationsManager()
