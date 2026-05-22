import { exec } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import { StartupItem, StartupType, StartupStatus, SecurityLevel } from '../../shared/types'
import { parseServicePath } from '../system/pathParser'
import { isServiceProtected, isCriticalByPattern } from '../system/protectedItems'
import { fileInfoExtractor } from './fileInfo'

const execAsync = promisify(exec)

/**
 * ServiceScanner - 系统服务扫描器
 *
 * 主查询: Get-CimInstance -ClassName Win32_Service
 * 只扫描 StartMode === 'Auto' 的服务
 * 内置 20+ 关键服务保护列表
 * svchost.exe 路径从注册表读取真实路径
 */
export class ServiceScanner {
  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      const services = await this.getServicesWithPowerShell()
      for (const svc of services) {
        if (!this.shouldInclude(svc)) continue
        items.push(this.createServiceItem(svc))
      }
      this.enrichWithFileInfo(items)
      console.log(`[ServiceScanner] 扫描完成，共 ${items.length} 个自动启动服务`)
    } catch (error) {
      console.error('[ServiceScanner] 扫描失败:', error)
    }

    return items
  }

  /**
   * 只包含 StartMode === 'Auto' 的服务
   */
  private shouldInclude(svc: any): boolean {
    const startMode = (svc.StartMode || '').toLowerCase()
    return startMode === 'auto'
  }

  private async getServicesWithPowerShell(): Promise<any[]> {
    try {
      const psScript = `
        $services = Get-CimInstance -ClassName Win32_Service -ErrorAction SilentlyContinue;
        $result = @();
        foreach ($svc in $services) {
          $result += [PSCustomObject]@{
            Name = $svc.Name
            DisplayName = $svc.DisplayName
            Description = $svc.Description
            State = $svc.State
            StartMode = $svc.StartMode
            PathName = $svc.PathName
            StartName = $svc.StartName
            ProcessId = $svc.ProcessId
            ServiceType = $svc.ServiceType
          }
        }
        ConvertTo-Json $result -Depth 3 -Compress
      `

      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "${psScript}"`,
        { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 30000, windowsHide: true }
      )

      if (!stdout || stdout.trim().length === 0) return []

      const parsed = JSON.parse(stdout)
      return Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
    } catch (error) {
      console.warn('[ServiceScanner] PowerShell 失败，回退 sc query:', error)
      return this.getServicesWithSc()
    }
  }

  /**
   * 回退方案：sc query
   */
  private async getServicesWithSc(): Promise<any[]> {
    try {
      const { stdout } = await execAsync(
        'sc queryex type= service state= all',
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 15000 }
      )
      return this.parseScOutput(stdout)
    } catch (error) {
      console.error('[ServiceScanner] sc query 失败:', error)
      return []
    }
  }

  private parseScOutput(output: string): any[] {
    const services: any[] = []
    const lines = output.split('\n')
    let current: any = null

    for (const line of lines) {
      const t = line.trim()
      if (t.startsWith('SERVICE_NAME:')) {
        if (current) services.push(current)
        current = { Name: t.substring('SERVICE_NAME:'.length).trim(), DisplayName: '', State: '', StartMode: '', PathName: '' }
      } else if (current) {
        if (t.startsWith('DISPLAY_NAME:')) current.DisplayName = t.substring('DISPLAY_NAME:'.length).trim()
        else if (t.startsWith('STATE')) {
          const m = t.match(/STATE\s*:\s*\d+\s+(\w+)/)
          if (m) current.State = m[1]
        } else if (t.startsWith('START_TYPE')) {
          const m = t.match(/START_TYPE\s*:\s*\d+\s+(\w+)/)
          if (m) current.StartMode = m[1].toLowerCase()
        } else if (t.startsWith('BINARY_PATH_NAME')) {
          current.PathName = t.substring(t.indexOf(':') + 1).trim()
        }
      }
    }
    if (current) services.push(current)
    return services
  }

  private createServiceItem(service: any): StartupItem {
    const displayName = service.DisplayName || service.Name || 'Unknown Service'
    const state = (service.State || '').toLowerCase()
    const serviceName = service.Name || ''
    const isEnabled = state === 'running'

    // 检查保护列表
    const protectedCheck = isServiceProtected(serviceName) || isCriticalByPattern(displayName, service.PathName || '')

    // 解析路径（含 svchost 特殊处理）
    const { executable, description } = parseServicePath(service.PathName || '', serviceName)

    return {
      id: `service_${this.hashString(serviceName)}`,
      name: displayName,
      description: service.Description || description || undefined,
      type: StartupType.Service,
      source: 'service',
      status: isEnabled ? StartupStatus.Enabled : StartupStatus.Disabled,
      path: executable || serviceName,
      arguments: undefined,
      publisher: service.StartName || undefined,
      version: undefined,
      securityLevel: SecurityLevel.Safe,
      impact: protectedCheck.protected ? 'high' : 'medium',
      enabled: isEnabled,
      isSystem: protectedCheck.protected,
      isProtected: protectedCheck.protected,
      protectedReason: protectedCheck.reason,
      location: service.PathName || undefined,
      hash: executable ? this.hashString(executable.toLowerCase()) : undefined,
    }
  }

  private enrichWithFileInfo(items: StartupItem[]): void {
    for (const item of items) {
      const realPath = item.path && !item.path.includes('svchost.exe') ? item.path : null
      if (realPath) {
        fileInfoExtractor.getFileInfo(realPath).then(info => {
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

export const serviceScanner = new ServiceScanner()
