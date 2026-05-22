import Winreg from 'winreg'
import crypto from 'crypto'
import { StartupItem, StartupType, StartupStatus, SecurityLevel } from '../../shared/types'
import { parseCommandLine } from '../system/pathParser'
import { isRegistryNameProtected } from '../system/protectedItems'
import { fileInfoExtractor } from './fileInfo'

/**
 * RegistryScanner - 注册表启动项扫描器
 *
 * 扫描完整路径列表：
 * HKCU + HKLM (Run, RunOnce, RunOnceEx, RunServices, Policies\Explorer\Run)
 * WOW6432Node (32位兼容)
 * Winlogon (Shell, Userinit, Taskman, System)
 */
export class RegistryScanner {
  private static readonly REGISTRY_PATHS: Array<{
    hive: string; key: string; name: string; isSystem: boolean; enabled: boolean
  }> = [
    // ========== HKCU ==========
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', name: 'HKCU-Run', isSystem: false, enabled: true },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce', name: 'HKCU-RunOnce', isSystem: false, enabled: true },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnceEx', name: 'HKCU-RunOnceEx', isSystem: false, enabled: true },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunServices', name: 'HKCU-RunServices', isSystem: false, enabled: true },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run-', name: 'HKCU-Run-Disabled', isSystem: false, enabled: false },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\Run', name: 'HKCU-Policies', isSystem: false, enabled: true },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon', name: 'HKCU-Winlogon', isSystem: false, enabled: true },

    // ========== HKLM ==========
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', name: 'HKLM-Run', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce', name: 'HKLM-RunOnce', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnceEx', name: 'HKLM-RunOnceEx', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunServices', name: 'HKLM-RunServices', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run-', name: 'HKLM-Run-Disabled', isSystem: true, enabled: false },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\Run', name: 'HKLM-Policies', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon', name: 'HKLM-Winlogon', isSystem: true, enabled: true },

    // ========== WOW6432Node ==========
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run', name: 'HKLM-WOW64-Run', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunOnce', name: 'HKLM-WOW64-RunOnce', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunServices', name: 'HKLM-WOW64-RunServices', isSystem: true, enabled: true },
  ]

  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      const promises = RegistryScanner.REGISTRY_PATHS.map(p => this.scanRegistryPath(p))
      const results = await Promise.all(promises)
      results.forEach(r => items.push(...r))

      // 异步填充 fileInfo
      for (const item of items) {
        if (item.path) {
          fileInfoExtractor.getFileInfo(item.path).then(info => {
            if (info) {
              item.fileInfo = info
              if (info.version) item.version = info.version
              if (info.company) item.publisher = info.company
              if (info.description) item.description = info.description
            }
          }).catch(() => {})
        }
      }

      console.log(`[RegistryScanner] 扫描完成，共 ${items.length} 个注册表启动项`)
    } catch (error) {
      console.error('[RegistryScanner] 扫描失败:', error)
    }

    return items
  }

  private scanRegistryPath(regPath: {
    hive: string; key: string; name: string; isSystem: boolean; enabled: boolean
  }): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    return new Promise((resolve) => {
      const registry = new Winreg({ hive: regPath.hive, key: regPath.key })

      registry.keyExists((err, exists) => {
        if (err || !exists) { resolve([]); return }

        registry.values((err, values) => {
          if (err || !values || values.length === 0) {
            if (err) console.warn(`[RegistryScanner] 读取失败 [${regPath.name}]:`, err.message)
            resolve([]); return
          }

          for (const value of values) {
            try {
              // 跳过 PowerShell 内部属性
              if (['PSPath', 'PSParentPath', 'PSChildName', 'PSDrive', 'PSProvider'].includes(value.name)) continue

              // Winlogon 只保留指定值
              if (regPath.key.includes('Winlogon')) {
                if (!['Shell', 'Userinit', 'Taskman', 'System'].includes(value.name)) continue
              }

              if (!value.value || value.value.trim().length === 0) continue

              const item = this.parseRegistryValue(value, regPath)
              if (item) items.push(item)
            } catch (parseError) {
              console.warn(`[RegistryScanner] 解析值失败:`, parseError)
            }
          }

          resolve(items)
        })
      })
    })
  }

  private parseRegistryValue(
    value: Winreg.RegistryItem,
    regPath: { hive: string; key: string; name: string; isSystem: boolean; enabled: boolean }
  ): StartupItem | null {
    const { executable } = parseCommandLine(value.value)
    if (!executable) return null

    const hiveName = regPath.hive === Winreg.HKLM ? 'HKLM' : 'HKCU'
    const location = `${hiveName}${regPath.key}\\${value.name}`

    // 检查保护列表（Winlogon 项）
    const protectedCheck = isRegistryNameProtected(value.name)

    return {
      id: `registry_${this.hashString(location)}`,
      name: value.name,
      description: undefined,
      type: StartupType.Registry,
      source: 'registry',
      status: regPath.enabled ? StartupStatus.Enabled : StartupStatus.Disabled,
      path: executable,
      arguments: undefined,
      publisher: undefined,
      version: undefined,
      securityLevel: SecurityLevel.Safe,
      impact: protectedCheck.protected ? 'high' : 'medium',
      enabled: regPath.enabled,
      location,
      isSystem: regPath.isSystem || protectedCheck.protected,
      isProtected: protectedCheck.protected,
      protectedReason: protectedCheck.reason,
      hash: executable ? this.hashString(executable.toLowerCase()) : undefined,
    }
  }

  private hashString(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 16)
  }
}

export const registryScanner = new RegistryScanner()
