import { exec } from 'child_process'
import { promisify } from 'util'
import { StartupItem, StartupType, StartupStatus, SecurityLevel } from '../../shared/types'

const execAsync = promisify(exec)

/**
 * Windows 服务扫描器（增强版）
 * 使用 PowerShell 获取更详细的服务信息
 */
export class ServiceScanner {
  /**
   * 扫描所有自动启动的服务
   */
  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      // 使用 PowerShell 获取服务详情
      const services = await this.getServicesWithPowerShell()
      
      for (const service of services) {
        if (this.isAutoStartService(service)) {
          items.push(this.createServiceItem(service))
        }
      }

      console.log(`[ServiceScanner] 扫描完成，共找到 ${items.length} 个服务启动项`)
    } catch (error) {
      console.error('[ServiceScanner] 扫描失败:', error)
    }

    return items
  }

  /**
   * 使用 PowerShell 获取服务详情
   */
  private async getServicesWithPowerShell(): Promise<any[]> {
    try {
      const psScript = `
        Get-WmiObject Win32_Service | 
        Where-Object { $_.StartMode -eq 'Auto' -or $_.State -eq 'Running' } |
        Select-Object Name, DisplayName, Description, State, StartMode, PathName, 
                      StartName, ProcessId, @{Name='Dependencies';Expression={$_.DependOnServices -join ';'}} |
        ConvertTo-Json -Depth 3
      `
      
      const { stdout } = await execAsync(`powershell -Command "${psScript}"`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      })

      if (!stdout || stdout.trim().length === 0) {
        return []
      }

      const parsed = JSON.parse(stdout)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch (error) {
      console.warn('[ServiceScanner] PowerShell 执行失败，回退到 sc 命令:', error)
      return this.getServicesWithSc()
    }
  }

  /**
   * 回退方案：使用 sc 命令
   */
  private async getServicesWithSc(): Promise<any[]> {
    try {
      const { stdout } = await execAsync('sc queryex type= service state= all', {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      })

      return this.parseScOutput(stdout)
    } catch (error) {
      console.error('[ServiceScanner] sc 命令执行失败:', error)
      return []
    }
  }

  /**
   * 解析 sc 命令输出
   */
  private parseScOutput(output: string): any[] {
    const services: any[] = []
    const lines = output.split('\n')
    let currentService: any = null

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('SERVICE_NAME:')) {
        if (currentService) {
          services.push(currentService)
        }
        currentService = {
          Name: trimmed.substring('SERVICE_NAME:'.length).trim(),
          DisplayName: '',
          Description: '',
          State: '',
          StartMode: '',
          PathName: ''
        }
      } else if (currentService) {
        if (trimmed.startsWith('DISPLAY_NAME:')) {
          currentService.DisplayName = trimmed.substring('DISPLAY_NAME:'.length).trim()
        } else if (trimmed.startsWith('STATE')) {
          const match = trimmed.match(/STATE\s*:\s*(\d+)\s+(\w+)/)
          if (match) {
            currentService.State = match[2]
          }
        } else if (trimmed.startsWith('BINARY_PATH_NAME')) {
          const pathStart = trimmed.indexOf(':') + 1
          currentService.PathName = trimmed.substring(pathStart).trim()
        }
      }
    }

    if (currentService) {
      services.push(currentService)
    }

    return services
  }

  /**
   * 判断是否为自动启动服务
   */
  private isAutoStartService(service: any): boolean {
    // 检查启动模式
    const startMode = service.StartMode || service.StartType || ''
    const state = service.State || ''
    
    // 自动启动或正在运行的服务
    return startMode.toLowerCase() === 'auto' || 
           startMode.toLowerCase() === 'automatic' ||
           state === 'Running'
  }

  /**
   * 创建服务启动项对象
   */
  private createServiceItem(service: any): StartupItem {
    const serviceName = service.DisplayName || service.Name || 'Unknown Service'
    const description = service.Description || undefined
    
    // 解析路径和参数
    const { executablePath, args } = this.parseServicePath(service.PathName || '')
    
    return {
      id: `service_${this.generateId(service.Name)}`,
      name: serviceName,
      description,
      type: StartupType.Service,
      source: 'service',
      status: service.State === 'Running' ? StartupStatus.Enabled : StartupStatus.Disabled,
      path: executablePath,
      arguments: args,
      publisher: service.StartName || undefined,
      version: undefined,
      securityLevel: SecurityLevel.Safe,
      impact: 'high',
      enabled: service.State === 'Running',
      lastModified: undefined,
      icon: undefined,
      iconColor: undefined,
      banRateValue: undefined
    }
  }

  /**
   * 解析服务路径
   */
  private parseServicePath(binaryPath: string): {
    executablePath: string
    args: string
  } {
    const trimmed = binaryPath.trim()

    if (trimmed.startsWith('"')) {
      const endQuoteIndex = trimmed.indexOf('"', 1)
      if (endQuoteIndex !== -1) {
        const executablePath = trimmed.substring(1, endQuoteIndex)
        const args = trimmed.substring(endQuoteIndex + 1).trim()
        return { executablePath, args }
      }
    }

    const spaceIndex = trimmed.indexOf(' ')
    if (spaceIndex !== -1) {
      const executablePath = trimmed.substring(0, spaceIndex)
      const args = trimmed.substring(spaceIndex + 1).trim()
      return { executablePath, args }
    }

    return { executablePath: trimmed, args: '' }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(serviceName: string): string {
    let hash = 0
    for (let i = 0; i < serviceName.length; i++) {
      const char = serviceName.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }
}

/**
 * 导出单例实例
 */
export const serviceScanner = new ServiceScanner()
