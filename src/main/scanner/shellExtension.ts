import Winreg from 'winreg'
import crypto from 'crypto'
import { StartupItem } from '../../shared/types'

/**
 * Shell 扩展扫描器
 * 扫描右键菜单、图标覆盖等 Shell 扩展
 */
export class ShellExtensionScanner {
  private static readonly SHELL_PATHS = [
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\ShellIconOverlayIdentifiers', name: '图标覆盖(HKLM)', isSystem: true },
    { hive: Winreg.HKCU, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\ShellIconOverlayIdentifiers', name: '图标覆盖(HKCU)', isSystem: false },
    { hive: Winreg.HKLM, key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CopyHookHandlers', name: '复制钩子', isSystem: true },
  ]

  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      for (const shellPath of ShellExtensionScanner.SHELL_PATHS) {
        const pathItems = await this.scanShellPath(shellPath)
        items.push(...pathItems)
      }

      console.log(`[ShellExtensionScanner] 扫描完成，共 ${items.length} 个 Shell 扩展`)
    } catch (error) {
      console.error('[ShellExtensionScanner] 扫描失败:', error)
    }

    return items
  }

  private scanShellPath(shellPath: { hive: string; key: string; name: string; isSystem: boolean }): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    return new Promise((resolve) => {
      const registry = new Winreg({ hive: shellPath.hive, key: shellPath.key })

      registry.keyExists((err, exists) => {
        if (err || !exists) { resolve([]); return }

        registry.keys((err, keys) => {
          if (err || !keys || keys.length === 0) { resolve([]); return }

          for (const key of keys) {
            const keyName = key.key.split('\\').pop() || 'Unknown'
            items.push({
              id: `shell_${this.hashString(shellPath.key + '|' + keyName)}`,
              name: keyName,
              description: `${shellPath.name} - Shell 扩展`,
              type: 'shell' as any,
              source: 'shell',
              status: 'enabled' as any,
              path: key.key,
              arguments: undefined,
              publisher: undefined,
              version: undefined,
              securityLevel: 'safe' as any,
              impact: 'low',
              enabled: true,
              isSystem: shellPath.isSystem,
              hash: this.hashString(key.key.toLowerCase()),
            })
          }

          resolve(items)
        })
      })
    })
  }

  private hashString(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 16)
  }
}

export const shellExtensionScanner = new ShellExtensionScanner()
