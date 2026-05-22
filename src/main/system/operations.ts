import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { app, shell } from 'electron'
import Winreg from 'winreg'
import { databaseManager } from '../database'
import { StartupItem, OperationResult } from '../../shared/types'
import { isServiceProtected, isTaskPathProtected, isCriticalByPattern } from './protectedItems'

const execAsync = promisify(exec)

/**
 * 系统启动项操作管理器
 * 所有操作前检查 isProtected
 * 操作前自动备份，失败时回滚
 * 支持：注册表、服务、计划任务、启动文件夹
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

  /**
   * 统一禁止操作检查
   */
  private checkProtected(item: StartupItem): OperationResult | null {
    if (item.isProtected) {
      return {
        success: false,
        message: item.protectedReason || `${item.name} 是受保护的系统关键项，禁止操作`
      }
    }
    return null
  }

  // ============================================================
  // toggleItem - 启用/禁用启动项
  // ============================================================
  async toggleItem(item: StartupItem, enable: boolean): Promise<OperationResult> {
    const blocked = this.checkProtected(item)
    if (blocked) return blocked

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
        default:
          result = { success: false, message: `不支持的来源类型: ${item.source}` }
      }

      if (result.success) {
        databaseManager.logUserAction(item.id, enable ? 'enable' : 'disable',
          JSON.stringify({ name: item.name, source: item.source, backupPath: result.backupPath }))
      }

      return result
    } catch (error: any) {
      return { success: false, message: error.message || '操作失败' }
    }
  }

  // ============================================================
  // deleteItem - 删除启动项
  // ============================================================
  async deleteItem(item: StartupItem): Promise<OperationResult> {
    const blocked = this.checkProtected(item)
    if (blocked) return blocked

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
          result = await this.deleteStartupFolderItem(item)
          break
        default:
          result = { success: false, message: `不支持的来源类型: ${item.source}` }
      }

      if (result.success) {
        databaseManager.logUserAction(item.id, 'delete',
          JSON.stringify({ name: item.name, source: item.source, backupPath: result.backupPath }))
      }

      return result
    } catch (error: any) {
      return { success: false, message: error.message || '删除失败' }
    }
  }

  // ============================================================
  // batchToggle - 批量操作
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
      const backup = this.readBackup(backupPath)
      if (!backup) return { success: false, message: `未找到 ${item.name} 的备份数据` }
      try {
        await this.setRegistryValue(reg, item.name, backup.value, backup.type)
        this.removeBackup(backupPath)
        return { success: true, message: `已启用: ${item.name}` }
      } catch (err: any) {
        return { success: false, message: `启用失败: ${err.message}` }
      }
    } else {
      try {
        const current = await this.getRegistryValue(reg, item.name)
        if (!current) return { success: false, message: '注册表值不存在' }

        this.writeBackup(backupPath, {
          itemId: item.id, name: item.name, value: current.value,
          type: current.type, operation: 'disable', timestamp: new Date().toISOString(),
        })

        await this.deleteRegistryValue(reg, item.name)
        return { success: true, message: `已禁用: ${item.name}`, backupPath }
      } catch (err: any) {
        // 回滚
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
    const keyPart = loc.replace(/^(HKLM|HKCU)/, '')
    const lastBS = keyPart.lastIndexOf('\\')
    return { hive, key: lastBS > 0 ? keyPart.substring(0, lastBS) : keyPart }
  }

  // ============================================================
  // 服务操作
  // ============================================================
  private async toggleService(item: StartupItem, enable: boolean): Promise<OperationResult> {
    const svcName = item.name
    const backupPath = this.getBackupPath(item.id)

    try {
      const { stdout } = await execAsync(`sc qc "${svcName}"`, { encoding: 'utf8', timeout: 10000, windowsHide: true })
      const m = stdout.match(/START_TYPE\s*:\s*\d+\s+(\w+)/)
      const currentType = m ? m[1] : ''

      this.writeBackup(backupPath, {
        itemId: item.id, name: svcName, originalStartType: currentType,
        operation: enable ? 'enable' : 'disable', timestamp: new Date().toISOString(),
      })

      if (enable) {
        await execAsync(`sc config "${svcName}" start= auto`, { timeout: 10000, windowsHide: true })
        // 尝试启动但不阻塞
        execAsync(`net start "${svcName}"`, { timeout: 15000, windowsHide: true }).catch(() => {})
        return { success: true, message: `已启用服务: ${svcName}`, backupPath }
      } else {
        await execAsync(`net stop "${svcName}"`, { timeout: 30000, windowsHide: true }).catch(() => {})
        await execAsync(`sc config "${svcName}" start= disabled`, { timeout: 10000, windowsHide: true })
        return { success: true, message: `已禁用服务: ${svcName}`, backupPath }
      }
    } catch (err: any) {
      // 回滚
      const backup = this.readBackup(backupPath)
      if (backup && backup.originalStartType) {
        const map: Record<string, string> = { AUTO: 'auto', DEMAND: 'demand', DISABLED: 'disabled', BOOT: 'boot', SYSTEM: 'system' }
        try {
          await execAsync(`sc config "${svcName}" start= ${map[backup.originalStartType.toUpperCase()] || 'demand'}`, { timeout: 10000, windowsHide: true })
        } catch {}
      }
      return { success: false, message: `操作失败: ${err.message}` }
    }
  }

  private async deleteService(item: StartupItem): Promise<OperationResult> {
    const svcName = item.name
    const backupPath = this.getBackupPath(item.id)
    try {
      const { stdout } = await execAsync(`sc qc "${svcName}"`, { encoding: 'utf8', timeout: 10000, windowsHide: true })
      this.writeBackup(backupPath, { itemId: item.id, name: svcName, config: stdout, operation: 'delete', timestamp: new Date().toISOString() })
      await execAsync(`net stop "${svcName}"`, { timeout: 30000, windowsHide: true }).catch(() => {})
      await execAsync(`sc delete "${svcName}"`, { timeout: 10000, windowsHide: true })
      return { success: true, message: `已删除服务: ${svcName}`, backupPath }
    } catch (err: any) {
      return { success: false, message: `删除失败: ${err.message}` }
    }
  }

  // ============================================================
  // 计划任务操作
  // ============================================================
  private async toggleScheduledTask(item: StartupItem, enable: boolean): Promise<OperationResult> {
    const taskPath = item.location || `\\${item.name}`
    const backupPath = this.getBackupPath(item.id)

    try {
      if (enable) {
        await execAsync(`powershell -NoProfile -Command "Enable-ScheduledTask -TaskPath '${taskPath}'"`, { timeout: 15000, windowsHide: true })
        return { success: true, message: `已启用计划任务: ${item.name}` }
      } else {
        const { stdout } = await execAsync(
          `powershell -NoProfile -Command "(Get-ScheduledTask -TaskPath '${taskPath}').State"`,
          { encoding: 'utf8', timeout: 10000, windowsHide: true }
        )
        this.writeBackup(backupPath, { itemId: item.id, name: item.name, taskPath, originalState: stdout.trim(), operation: 'disable', timestamp: new Date().toISOString() })

        await execAsync(`powershell -NoProfile -Command "Disable-ScheduledTask -TaskPath '${taskPath}'"`, { timeout: 15000, windowsHide: true })
        return { success: true, message: `已禁用计划任务: ${item.name}`, backupPath }
      }
    } catch (err: any) {
      return { success: false, message: `操作失败: ${err.message}` }
    }
  }

  private async deleteScheduledTask(item: StartupItem): Promise<OperationResult> {
    const taskPath = item.location || `\\${item.name}`
    const backupPath = this.getBackupPath(item.id)
    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "Export-ScheduledTask -TaskPath '${taskPath}'"`,
        { encoding: 'utf8', timeout: 15000, windowsHide: true }
      )
      this.writeBackup(backupPath, { itemId: item.id, name: item.name, taskPath, taskXml: stdout, operation: 'delete', timestamp: new Date().toISOString() })
      await execAsync(`powershell -NoProfile -Command "Unregister-ScheduledTask -TaskPath '${taskPath}' -Confirm:\\$false"`, { timeout: 15000, windowsHide: true })
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
    if (!sourcePath || !fs.existsSync(sourcePath)) return { success: false, message: `文件不存在: ${sourcePath}` }
    const backupPath = this.getBackupPath(item.id)

    try {
      if (enable) {
        if (!fs.existsSync(backupPath)) return { success: false, message: '未找到备份文件' }
        fs.copyFileSync(backupPath, sourcePath)
        fs.unlinkSync(backupPath)
        return { success: true, message: `已恢复: ${item.name}` }
      } else {
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
    if (!sourcePath || !fs.existsSync(sourcePath)) return { success: false, message: `文件不存在: ${sourcePath}` }
    const backupPath = this.getBackupPath(item.id)
    try {
      fs.copyFileSync(sourcePath, backupPath)
      fs.unlinkSync(sourcePath)
      return { success: true, message: `已删除: ${item.name}`, backupPath }
    } catch (err: any) {
      return { success: false, message: `删除失败: ${err.message}` }
    }
  }

  // ============================================================
  // 辅助方法
  // ============================================================
  private getBackupPath(itemId: string): string { return path.join(this.backupDir, `${itemId}.bak`) }
  private writeBackup(p: string, d: any): void { fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf-8') }
  private readBackup(p: string): any | null {
    try { if (!fs.existsSync(p)) return null; return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return null }
  }
  private removeBackup(p: string): void { try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch {} }

  private getRegistryValue(reg: Winreg.Registry, name: string): Promise<{ value: string; type: string } | null> {
    return new Promise(r => reg.get(name, (err, item) => r(err || !item ? null : { value: item.value, type: item.type })))
  }
  private setRegistryValue(reg: Winreg.Registry, name: string, value: string, type: string): Promise<void> {
    return new Promise((resolve, reject) => reg.set(name, type, value, err => err ? reject(err) : resolve()))
  }
  private deleteRegistryValue(reg: Winreg.Registry, name: string): Promise<void> {
    return new Promise((resolve, reject) => reg.remove(name, err => err ? reject(err) : resolve()))
  }

  // ============================================================
  // 系统关键项检查
  // ============================================================
  isSystemCritical(item: StartupItem): boolean {
    if (item.isProtected) return true
    const check = isCriticalByPattern(item.name, item.path || '')
    return check.protected
  }

  getCriticalWarning(item: StartupItem): string | null {
    if (!this.isSystemCritical(item)) return null

    // 优先使用已存储的保护原因
    if (item.protectedReason) {
      return `"${item.name}" 是系统关键项：${item.protectedReason}\n确定要继续操作吗？`
    }

    // 按来源类型检查
    if (item.source === 'service') {
      const check = isServiceProtected(item.name)
      if (check.protected) return `"${item.name}" ${check.reason}\n确定要禁用吗？`
    }
    if (item.source === 'task') {
      const check = isTaskPathProtected(item.location || `\\${item.name}`)
      if (check.protected) return `"${item.name}" ${check.reason}\n确定要禁用吗？`
    }

    return `"${item.name}" 被识别为系统关键项，禁用可能导致系统不稳定。\n确定要继续操作吗？`
  }

  // ============================================================
  // 其他
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

  async getBootTime(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "(Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime"',
        { encoding: 'utf8', timeout: 10000, windowsHide: true }
      )
      const m = stdout.match(/(\d+)\.(\d+):(\d+):(\d+)/)
      if (m) return ((+m[1] * 24 + +m[2]) * 60 + +m[3]) * 60 + +m[4]
      return 0
    } catch { return 0 }
  }

  // ============================================================
  // restoreAll - 还原所有修改
  // ============================================================
  async restoreAll(): Promise<{ success: number; failed: number }> {
    let sc = 0, fc = 0
    try {
      const files = fs.readdirSync(this.backupDir)
      for (const file of files) {
        if (!file.endsWith('.bak')) continue
        const bp = path.join(this.backupDir, file)
        const backup = this.readBackup(bp)
        if (!backup || !backup.operation) { fc++; continue }
        try {
          if (backup.taskPath) {
            if (backup.operation === 'disable') {
              await execAsync(`powershell -NoProfile -Command "Enable-ScheduledTask -TaskPath '${backup.taskPath}'"`, { timeout: 15000, windowsHide: true })
            } else if (backup.taskXml) {
              const xmlPath = bp.replace('.bak', '.xml')
              fs.writeFileSync(xmlPath, backup.taskXml, 'utf-8')
              await execAsync(`powershell -NoProfile -Command "Register-ScheduledTask -Xml (Get-Content '${xmlPath}' | Out-String) -TaskName '${backup.name}' -Force"`, { timeout: 15000, windowsHide: true })
              if (fs.existsSync(xmlPath)) fs.unlinkSync(xmlPath)
            }
          } else if (backup.originalStartType) {
            const map: Record<string, string> = { AUTO: 'auto', DEMAND: 'demand', DISABLED: 'disabled', BOOT: 'boot', SYSTEM: 'system' }
            await execAsync(`sc config "${backup.name}" start= ${map[backup.originalStartType.toUpperCase()] || 'demand'}`, { timeout: 10000, windowsHide: true })
          }
          fs.unlinkSync(bp)
          sc++
        } catch { fc++ }
      }
    } catch { /* empty */ }
    return { success: sc, failed: fc }
  }
}

export const systemOperationsManager = new SystemOperationsManager()
