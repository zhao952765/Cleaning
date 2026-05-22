import { exec } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import { StartupItem, StartupType, StartupStatus, SecurityLevel } from '../../shared/types'
import { fileInfoExtractor } from './fileInfo'

const execAsync = promisify(exec)

/**
 * 系统服务扫描器
 * 优先使用 PowerShell Get-CimInstance Win32_Service
 * 回退方案使用 sc query
 * 正确处理 svchost.exe -k netsvcs 等情况
 */
export class ServiceScanner {
  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      const services = await this.getServicesWithPowerShell()
      for (const svc of services) {
        items.push(this.createServiceItem(svc))
      }

      // 异步填充 fileInfo
      this.enrichWithFileInfo(items)

      console.log(`[ServiceScanner] 扫描完成，共 ${items.length} 个服务`)
    } catch (error) {
      console.error('[ServiceScanner] 扫描失败:', error)
    }

    return items
  }

  private async getServicesWithPowerShell(): Promise<any[]> {
    try {
      const psScript = `
        $services = Get-CimInstance Win32_Service;
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
      console.warn('[ServiceScanner] PowerShell 失败，回退 sc query:', error)
      return this.getServicesWithSc()
    }
  }

  /**
   * 回退方案：使用 sc query 命令
   */
  private async getServicesWithSc(): Promise<any[]> {
    const allServices: any[] = []
    try {
      // sc query 分页获取所有服务
      let lastBuffer = ''
      while (true) {
        const { stdout } = await execAsync(
          `sc queryex type= service state= all${lastBuffer ? ` bufsize= 5000` : ''}`,
          { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 15000 }
        )
        const parsed = this.parseScOutput(stdout)
        allServices.push(...parsed)

        // 检查是否有更多页
        const resumeMatch = stdout.match(/RESUME_TOKEN\s*:\s*(\d+)/)
        if (!resumeMatch || resumeMatch[1] === '0') break
        lastBuffer = ` resume= ${resumeMatch[1]}`
      }
    } catch (error) {
      console.error('[ServiceScanner] sc query 失败:', error)
    }
    return allServices
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
    const startMode = (service.StartMode || '').toLowerCase()
    const state = (service.State || '').toLowerCase()

    const isEnabled = state === 'running' || ['auto', 'boot', 'system'].includes(startMode)
    const isSystemService = ['boot', 'system'].includes(startMode) ||
      (service.ServiceType && typeof service.ServiceType === 'string' &&
       (service.ServiceType.includes('Kernel') || service.ServiceType.includes('File System')))

    // 解析服务可执行文件路径
    // 特殊处理 svchost.exe -k netsvcs → 提取真实服务名称
    const binaryPath = service.PathName || ''
    const { executablePath, args } = this.parseServicePath(binaryPath)

    // 对于 svchost 等共享进程，用服务名作为路径补充
    let finalPath = executablePath
    if (!finalPath || finalPath.toLowerCase().includes('svchost.exe')) {
      finalPath = `C:\\Windows\\System32\\svchost.exe -k ${service.Name}`
    }

    return {
      id: `service_${this.hashString(service.Name)}`,
      name: displayName,
      description: service.Description || undefined,
      type: StartupType.Service,
      source: 'service',
      status: isEnabled ? StartupStatus.Enabled : StartupStatus.Disabled,
      path: finalPath,
      arguments: args || undefined,
      publisher: service.StartName || undefined,
      version: undefined,
      securityLevel: SecurityLevel.Safe,
      impact: isSystemService ? 'high' : 'medium',
      enabled: isEnabled,
      isSystem: isSystemService,
      hash: finalPath ? this.hashString(finalPath.toLowerCase()) : undefined,
    }
  }

  private parseServicePath(binaryPath: string): { executablePath: string; args: string } {
    const trimmed = binaryPath.trim()
    if (!trimmed) return { executablePath: '', args: '' }

    if (trimmed.startsWith('"')) {
      const end = trimmed.indexOf('"', 1)
      if (end !== -1) return { executablePath: trimmed.substring(1, end), args: trimmed.substring(end + 1).trim() }
    }

    const spaceIdx = trimmed.indexOf(' ')
    if (spaceIdx !== -1) return { executablePath: trimmed.substring(0, spaceIdx), args: trimmed.substring(spaceIdx + 1).trim() }

    return { executablePath: trimmed, args: '' }
  }

  private enrichWithFileInfo(items: StartupItem[]): void {
    for (const item of items) {
      // 只对真实文件路径尝试获取 fileInfo
      const realPath = item.path && !item.path.includes('svchost.exe')
        ? item.path.split(' -k ')[0]
        : null
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
