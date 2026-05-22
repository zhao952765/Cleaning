import { exec } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import { StartupItem, StartupType, StartupStatus, SecurityLevel } from '../../shared/types'
import { fileInfoExtractor } from './fileInfo'

const execAsync = promisify(exec)

/**
 * 系统驱动程序扫描器
 */
export class DriverScanner {
  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      const drivers = await this.getDriversWithPowerShell()
      for (const driver of drivers) {
        items.push(this.createDriverItem(driver))
      }

      this.enrichWithFileInfo(items)

      console.log(`[DriverScanner] 扫描完成，共 ${items.length} 个驱动程序`)
    } catch (error) {
      console.error('[DriverScanner] 扫描失败:', error)
    }

    return items
  }

  private async getDriversWithPowerShell(): Promise<any[]> {
    try {
      const psScript = `
        $drivers = Get-CimInstance Win32_SystemDriver | Where-Object { $_.State -eq 'Running' };
        $result = @();
        foreach ($drv in $drivers) {
          $result += [PSCustomObject]@{
            Name = $drv.Name
            DisplayName = $drv.DisplayName
            Description = $drv.Description
            State = $drv.State
            PathName = $drv.PathName
            ServiceType = $drv.ServiceType
            Started = $drv.Started
            StartMode = $drv.StartMode
          }
        }
        ConvertTo-Json $result -Depth 3 -Compress
      `

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`, {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        timeout: 30000,
        windowsHide: true,
      })

      if (!stdout || stdout.trim().length === 0) return []

      const parsed = JSON.parse(stdout)
      return Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
    } catch (error) {
      console.error('[DriverScanner] PowerShell 执行失败:', error)
      return []
    }
  }

  private createDriverItem(driver: any): StartupItem {
    const displayName = driver.DisplayName || driver.Name || 'Unknown Driver'
    const { executablePath, args } = this.parseDriverPath(driver.PathName || '')

    return {
      id: `driver_${this.hashString(driver.Name)}`,
      name: displayName,
      description: driver.Description || undefined,
      type: StartupType.Driver,
      source: 'driver',
      status: driver.State === 'Running' ? StartupStatus.Enabled : StartupStatus.Disabled,
      path: executablePath || driver.Name,
      arguments: args || undefined,
      publisher: undefined,
      version: undefined,
      securityLevel: SecurityLevel.Safe,
      impact: 'high',
      enabled: driver.State === 'Running',
      hash: executablePath ? this.hashString(executablePath.toLowerCase()) : undefined,
    }
  }

  private parseDriverPath(binaryPath: string): { executablePath: string; args: string } {
    const t = binaryPath.trim()
    if (!t) return { executablePath: '', args: '' }

    if (t.startsWith('"')) {
      const e = t.indexOf('"', 1)
      if (e !== -1) return { executablePath: t.substring(1, e), args: t.substring(e + 1).trim() }
    }

    const s = t.indexOf(' ')
    if (s !== -1) return { executablePath: t.substring(0, s), args: t.substring(s + 1).trim() }

    return { executablePath: t, args: '' }
  }

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
        }).catch(() => {})
      }
    }
  }

  private hashString(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 16)
  }
}

export const driverScanner = new DriverScanner()
