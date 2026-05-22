import Winreg from 'winreg'
import path from 'path'
import { StartupItem } from '../../shared/types'

/**
 * 注册表启动项扫描器
 * 扫描 Windows 注册表中的启动项配置
 */
export class RegistryScanner {
  // 需要扫描的注册表路径（静态常量）
  private static readonly REGISTRY_PATHS = [
    {
      hive: Winreg.HKLM,
      key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
      name: 'HKLM - CurrentVersion Run'
    },
    {
      hive: Winreg.HKLM,
      key: '\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run',
      name: 'HKLM - WOW6432Node Run'
    },
    {
      hive: Winreg.HKCU,
      key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
      name: 'HKCU - CurrentVersion Run'
    }
  ]

  /**
   * 扫描所有注册表启动项
   */
  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      // 并行扫描所有注册表路径
      const promises = RegistryScanner.REGISTRY_PATHS.map((regPath: {
        hive: string
        key: string
        name: string
      }) => this.scanRegistryPath(regPath))
      const results = await Promise.all(promises)

      // 合并结果
      results.forEach((result: StartupItem[]) => items.push(...result))

      console.log(`[RegistryScanner] 扫描完成，共找到 ${items.length} 个启动项`)
    } catch (error) {
      console.error('[RegistryScanner] 扫描失败:', error)
    }

    return items
  }

  /**
   * 扫描单个注册表路径
   */
  private async scanRegistryPath(regPath: {
    hive: string
    key: string
    name: string
  }): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    return new Promise((resolve) => {
      const registry = new Winreg({
        hive: regPath.hive,
        key: regPath.key
      })

      registry.values((err, values) => {
        if (err) {
          console.warn(`[RegistryScanner] 读取注册表失败 [${regPath.name}]:`, err.message)
          resolve([])
          return
        }

        if (!values || values.length === 0) {
          resolve([])
          return
        }

        values.forEach(value => {
          try {
            const item = this.parseRegistryValue(value, regPath)
            if (item) {
              items.push(item)
            }
          } catch (parseError) {
            console.warn(`[RegistryScanner] 解析注册表值失败:`, parseError)
          }
        })

        resolve(items)
      })
    })
  }

  /**
   * 解析注册表值
   */
  private parseRegistryValue(
    value: Winreg.RegistryItem,
    regPath: { hive: string; key: string; name: string }
  ): StartupItem | null {
    if (!value.value || value.value.trim().length === 0) {
      return null
    }

    // 解析命令行字符串，分离路径和参数
    const { executablePath, args } = this.parseCommandLine(value.value)

    // 生成唯一 ID
    const id = this.generateId(regPath.key, value.name)

    // 检查是否为有效的可执行文件路径
    if (!this.isValidExecutablePath(executablePath)) {
      return null
    }

    return {
      id,
      name: value.name,
      description: undefined,
      type: 'registry' as any,
      status: 'enabled' as any,
      path: executablePath,
      arguments: args,
      publisher: undefined,
      version: undefined,
      securityLevel: 'safe' as any,
      impact: 'medium',
      enabled: true,
      lastModified: undefined,
      icon: undefined,
      iconColor: undefined,
      banRateValue: undefined
    }
  }

  /**
   * 解析命令行字符串，分离可执行文件路径和参数
   * 处理以下情况：
   * - "C:\Program Files\App\app.exe" --arg1 --arg2
   * - C:\Windows\System32\notepad.exe
   * - "C:\Program Files\App\launcher.exe" /start "C:\Games\game.exe"
   */
  private parseCommandLine(commandLine: string): {
    executablePath: string
    args: string
  } {
    const trimmed = commandLine.trim()

    // 情况1: 路径被引号包裹
    if (trimmed.startsWith('"')) {
      const endQuoteIndex = trimmed.indexOf('"', 1)
      if (endQuoteIndex !== -1) {
        const executablePath = trimmed.substring(1, endQuoteIndex)
        const args = trimmed.substring(endQuoteIndex + 1).trim()
        return { executablePath, args }
      }
    }

    // 情况2: 路径未被引号包裹，需要找到第一个空格分割
    const spaceIndex = trimmed.indexOf(' ')
    if (spaceIndex !== -1) {
      const executablePath = trimmed.substring(0, spaceIndex)
      const args = trimmed.substring(spaceIndex + 1).trim()
      return { executablePath, args }
    }

    // 情况3: 整个字符串就是路径，没有参数
    return { executablePath: trimmed, args: '' }
  }

  /**
   * 验证是否为有效的可执行文件路径
   */
  private isValidExecutablePath(pathStr: string): boolean {
    if (!pathStr || pathStr.trim().length === 0) {
      return false
    }

    // 检查是否包含常见的可执行文件扩展名
    const validExtensions = ['.exe', '.bat', '.cmd', '.com', '.vbs', '.js', '.msi']
    const lowerPath = pathStr.toLowerCase()

    return validExtensions.some(ext => lowerPath.endsWith(ext))
  }

  /**
   * 生成唯一 ID
   */
  private generateId(registryKey: string, itemName: string): string {
    const combined = `${registryKey}|${itemName}`
    // 使用简单的哈希算法生成唯一 ID
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return `registry_${Math.abs(hash).toString(16)}`
  }

  /**
   * 获取注册表位置的可读名称
   */
  private getRegistryLocationName(hive: string, key: string): string {
    const hiveNames: Record<string, string> = {
      [Winreg.HKLM]: 'HKEY_LOCAL_MACHINE',
      [Winreg.HKCU]: 'HKEY_CURRENT_USER',
      [Winreg.HKCR]: 'HKEY_CLASSES_ROOT',
      [Winreg.HKU]: 'HKEY_USERS'
    }

    const hiveName = hiveNames[hive] || hive
    return `${hiveName}${key}`
  }
}

/**
 * 导出单例实例
 */
export const registryScanner = new RegistryScanner()
