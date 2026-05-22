import Winreg from 'winreg'
import crypto from 'crypto'
import { StartupItem, StartupType, StartupStatus, SecurityLevel } from '../../shared/types'
import { fileInfoExtractor } from './fileInfo'

/**
 * 注册表启动项扫描器
 * 扫描 HKCU/HKLM 下 Run、RunOnce、RunServices、Policies、Winlogon 等路径
 */
export class RegistryScanner {
  // 完整的注册表路径列表（按来源分组注释）
  private static readonly REGISTRY_PATHS: Array<{
    hive: string
    key: string
    name: string
    isSystem: boolean
    enabled: boolean
  }> = [
    // ========== HKCU - 当前用户 ==========
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', name: 'HKCU-Run', isSystem: false, enabled: true },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce', name: 'HKCU-RunOnce', isSystem: false, enabled: true },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunServices', name: 'HKCU-RunServices', isSystem: false, enabled: true },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run-', name: 'HKCU-Run-Disabled', isSystem: false, enabled: false },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\Run', name: 'HKCU-Policies', isSystem: false, enabled: true },

    // ========== HKLM - 所有用户 ==========
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', name: 'HKLM-Run', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce', name: 'HKLM-RunOnce', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunServices', name: 'HKLM-RunServices', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run-', name: 'HKLM-Run-Disabled', isSystem: true, enabled: false },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\Run', name: 'HKLM-Policies', isSystem: true, enabled: true },

    // ========== HKLM Wow6432Node - 32 位兼容 ==========
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run', name: 'HKLM-WOW64-Run', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunOnce', name: 'HKLM-WOW64-RunOnce', isSystem: true, enabled: true },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunServices', name: 'HKLM-WOW64-RunServices', isSystem: true, enabled: true },

    // ========== Winlogon - 系统登录相关 ==========
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon', name: 'HKLM-Winlogon', isSystem: true, enabled: true },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon', name: 'HKCU-Winlogon', isSystem: false, enabled: true },
  ]

  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      const promises = RegistryScanner.REGISTRY_PATHS.map(p => this.scanRegistryPath(p))
      const results = await Promise.all(promises)
      results.forEach(r => items.push(...r))

      // 异步填充 fileInfo（不阻塞主扫描流程）
      this.enrichWithFileInfo(items)

      console.log(`[RegistryScanner] 扫描完成，共 ${items.length} 个注册表启动项`)
    } catch (error) {
      console.error('[RegistryScanner] 扫描失败:', error)
    }

    return items
  }

  private async scanRegistryPath(regPath: {
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

              // Winlogon 只保留 Shell / Userinit / Taskman / System
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

  /**
   * 解析注册表值 → StartupItem
   * 正确处理带引号路径、空格、参数
   * 例如 "C:\Program Files\xx.exe" -silent → path="C:\Program Files\xx.exe", args="-silent"
   */
  private parseRegistryValue(
    value: Winreg.RegistryItem,
    regPath: { hive: string; key: string; name: string; isSystem: boolean; enabled: boolean }
  ): StartupItem | null {
    const { executablePath, args } = this.parseCommandLine(value.value)
    if (!executablePath) return null

    const hiveName = regPath.hive === Winreg.HKLM ? 'HKLM' : 'HKCU'
    const location = `${hiveName}${regPath.key}\\${value.name}`

    return {
      id: `registry_${this.hashString(location)}`,
      name: value.name,
      description: undefined,
      type: StartupType.Registry,
      source: 'registry',
      status: regPath.enabled ? StartupStatus.Enabled : StartupStatus.Disabled,
      path: executablePath,
      arguments: args || undefined,
      publisher: undefined,
      version: undefined,
      securityLevel: SecurityLevel.Safe,
      impact: 'medium',
      enabled: regPath.enabled,
      location,
      isSystem: regPath.isSystem,
      hash: executablePath ? this.hashString(executablePath.toLowerCase()) : undefined,
      lastModified: undefined,
    }
  }

  /**
   * 解析命令行字符串，正确处理三种情况：
   * 1. "C:\Program Files\xx.exe" -silent
   * 2. C:\tools\xx.exe --flag
   * 3. C:\simple.exe
   */
  private parseCommandLine(commandLine: string): { executablePath: string; args: string } {
    const trimmed = commandLine.trim()
    if (!trimmed) return { executablePath: '', args: '' }

    // 情况1：被引号包裹
    if (trimmed.startsWith('"')) {
      const end = trimmed.indexOf('"', 1)
      if (end !== -1) {
        return {
          executablePath: trimmed.substring(1, end),
          args: trimmed.substring(end + 1).trim(),
        }
      }
    }

    // 情况2：未被引号包裹，查找第一个空格分割路径和参数
    const spaceIdx = trimmed.indexOf(' ')
    if (spaceIdx !== -1) {
      // 检查第一个空格前是否为有效路径扩展名
      const potentialPath = trimmed.substring(0, spaceIdx)
      if (/\.(exe|com|bat|cmd|vbs|ps1|js|dll)$/i.test(potentialPath)) {
        return {
          executablePath: potentialPath,
          args: trimmed.substring(spaceIdx + 1).trim(),
        }
      }
    }

    // 情况3：整个字符串就是路径
    return { executablePath: trimmed, args: '' }
  }

  /**
   * 异步填充 fileInfo（不阻塞扫描）
   */
  private enrichWithFileInfo(items: StartupItem[]): void {
    for (const item of items) {
      if (item.path) {
        fileInfoExtractor.getFileInfo(item.path).then(info => {
          if (info) {
            item.fileInfo = info
            if (info.version) item.version = info.version
            if (info.company) item.publisher = info.company
            if (info.description) item.description = info.description
          }
        }).catch(() => { /* 静默失败 */ })
      }
    }
  }

  private hashString(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 16)
  }
}

export const registryScanner = new RegistryScanner()
