import { exec } from 'child_process'
import { promisify } from 'util'
import { StartupItem, StartupType, StartupStatus, SecurityLevel } from '../../shared/types'

const execAsync = promisify(exec)

/**
 * 计划任务启动项扫描器（增强版）
 * 使用 PowerShell 获取更详细的任务信息
 */
export class ScheduledTaskScanner {
  /**
   * 扫描所有计划任务
   */
  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      // 使用 PowerShell 获取详细信息
      const tasks = await this.getTasksWithPowerShell()
      
      for (const task of tasks) {
        if (this.isStartupTask(task)) {
          items.push(this.createTaskItem(task))
        }
      }

      console.log(`[ScheduledTaskScanner] 扫描完成，共找到 ${items.length} 个计划任务启动项`)
    } catch (error) {
      console.error('[ScheduledTaskScanner] 扫描失败:', error)
    }

    return items
  }

  /**
   * 使用 PowerShell 获取计划任务详情
   */
  private async getTasksWithPowerShell(): Promise<any[]> {
    try {
      const psScript = `
        Get-ScheduledTask | 
        Where-Object { $_.State -eq 'Ready' -or $_.State -eq 'Running' } |
        ForEach-Object {
          $triggers = ($_ | Get-ScheduledTaskInfo).NumberOfMissedRuns
          $actions = $_.Actions.Execute
          [PSCustomObject]@{
            TaskName = $_.TaskName
            State = $_.State
            Description = $_.Description
            Actions = ($actions -join '; ')
            Enabled = $_.State -eq 'Ready'
            LastRunTime = ($_. | Get-ScheduledTaskInfo).LastRunTime
            NextRunTime = ($_. | Get-ScheduledTaskInfo).NextRunTime
          }
        } | ConvertTo-Json -Depth 3
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
      console.warn('[ScheduledTaskScanner] PowerShell 执行失败，回退到 schtasks:', error)
      return this.getTasksWithSchTasks()
    }
  }

  /**
   * 回退方案：使用 schtasks 命令
   */
  private async getTasksWithSchTasks(): Promise<any[]> {
    try {
      const { stdout } = await execAsync('schtasks /query /fo csv /nh /v', {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
      })

      const tasks: any[] = []
      const lines = stdout.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.startsWith('"TaskName"')) continue
        
        const fields = this.parseCsvLine(line)
        if (fields.length >= 8) {
          tasks.push({
            TaskName: fields[0]?.replace(/^"|"$/g, ''),
            State: fields[1]?.replace(/^"|"$/g, ''),
            Description: fields[2]?.replace(/^"|"$/g, ''),
            Actions: fields[7]?.replace(/^"|"$/g, ''),
            Enabled: fields[1]?.includes('Ready'),
            LastRunTime: fields[3]?.replace(/^"|"$/g, ''),
            NextRunTime: fields[4]?.replace(/^"|"$/g, '')
          })
        }
      }

      return tasks
    } catch (error) {
      console.error('[ScheduledTaskScanner] schtasks 执行失败:', error)
      return []
    }
  }

  /**
   * 解析 CSV 行
   */
  private parseCsvLine(line: string): string[] {
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    if (current) {
      fields.push(current.trim())
    }

    return fields
  }

  /**
   * 判断是否为启动相关任务
   */
  private isStartupTask(task: any): boolean {
    // 检查任务状态
    const isReady = task.State === 'Ready' || task.State === 'Running'
    
    // 检查描述或名称是否包含启动相关关键词
    const startupKeywords = ['boot', 'start', 'startup', 'login', 'logon', 'system']
    const hasKeyword = startupKeywords.some(keyword => 
      (task.TaskName && task.TaskName.toLowerCase().includes(keyword)) ||
      (task.Description && task.Description.toLowerCase().includes(keyword))
    )

    return isReady && (hasKeyword || true) // 暂时返回所有就绪任务
  }

  /**
   * 创建任务启动项对象
   */
  private createTaskItem(task: any): StartupItem {
    const taskName = task.TaskName || 'Unknown Task'
    const description = task.Description || undefined
    
    return {
      id: `task_${this.generateId(taskName)}`,
      name: taskName,
      description,
      type: StartupType.ScheduledTask,
      source: 'task',
      status: task.Enabled ? StartupStatus.Enabled : StartupStatus.Disabled,
      path: task.Actions || 'Task Scheduler',
      arguments: undefined,
      publisher: undefined,
      version: undefined,
      securityLevel: SecurityLevel.Safe,
      impact: 'medium',
      enabled: task.Enabled,
      lastModified: task.LastRunTime ? new Date(task.LastRunTime) : undefined,
      icon: undefined,
      iconColor: undefined,
      banRateValue: undefined
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(taskName: string): string {
    let hash = 0
    for (let i = 0; i < taskName.length; i++) {
      const char = taskName.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }
}

/**
 * 导出单例实例
 */
export const scheduledTaskScanner = new ScheduledTaskScanner()
