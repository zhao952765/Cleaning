import { exec } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import { StartupItem, StartupType, StartupStatus, SecurityLevel } from '../../shared/types'
import { fileInfoExtractor } from './fileInfo'

const execAsync = promisify(exec)

/**
 * 计划任务扫描器
 * 使用 PowerShell Get-ScheduledTask 获取 Ready 状态的任务
 * 提取 TaskName、Action、Trigger、Author 信息
 */
export class ScheduledTaskScanner {
  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      const tasks = await this.getTasksWithPowerShell()
      for (const task of tasks) {
        if (this.isValidTask(task)) {
          items.push(this.createTaskItem(task))
        }
      }

      this.enrichWithFileInfo(items)

      console.log(`[ScheduledTaskScanner] 扫描完成，共 ${items.length} 个计划任务`)
    } catch (error) {
      console.error('[ScheduledTaskScanner] 扫描失败:', error)
    }

    return items
  }

  private async getTasksWithPowerShell(): Promise<any[]> {
    try {
      // 只获取 Ready 状态（已启用就绪）的任务，提取 TaskName/Action/Trigger/Author
      const psScript = `
        $tasks = Get-ScheduledTask | Where-Object { $_.State -eq 'Ready' -and $_.Actions.Count -gt 0 };
        $result = @();
        foreach ($task in $tasks) {
          $taskInfo = $task | Get-ScheduledTaskInfo;
          $triggerTypes = @();
          foreach ($trigger in $task.Triggers) {
            $triggerTypes += @{
              Type = $trigger.CimClass.CimClassName
              Enabled = $trigger.Enabled
              StartBoundary = $trigger.StartBoundary
              Repetition = $trigger.Repetition.Interval
            }
          }
          $actions = @();
          foreach ($action in $task.Actions) {
            $actions += @{
              Execute = $action.Execute
              Arguments = $action.Arguments
              WorkingDirectory = $action.WorkingDirectory
            }
          }
          $result += [PSCustomObject]@{
            TaskName = $task.TaskName
            TaskPath = $task.TaskPath
            State = $task.State.ToString()
            Description = $task.Description
            Author = $task.Author
            Triggers = ($triggerTypes | ConvertTo-Json -Compress)
            Actions = ($actions | ConvertTo-Json -Compress)
            Enabled = $task.Enabled
            LastRunTime = $taskInfo.LastRunTime
            NextRunTime = $taskInfo.NextRunTime
            NumberOfMissedRuns = $taskInfo.NumberOfMissedRuns
          }
        }
        ConvertTo-Json $result -Depth 5 -Compress
      `

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`, {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        timeout: 60000,
        windowsHide: true,
      })

      if (!stdout || stdout.trim().length === 0) return []

      const parsed = JSON.parse(stdout)
      return Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
    } catch (error) {
      console.error('[ScheduledTaskScanner] PowerShell 执行失败:', error)
      return []
    }
  }

  private isValidTask(task: any): boolean {
    // 排除系统维护类空任务，保留有实际可执行动作的任务
    if (!task.Actions) return false

    try {
      const actions = typeof task.Actions === 'string' ? JSON.parse(task.Actions) : task.Actions
      return Array.isArray(actions) && actions.length > 0 && actions[0].Execute
    } catch {
      return false
    }
  }

  private createTaskItem(task: any): StartupItem {
    const taskName = task.TaskName || 'Unknown Task'
    const fullTaskPath = (task.TaskPath || '\\') + taskName

    // 解析动作
    let executablePath = ''
    let args = ''
    try {
      const actions = typeof task.Actions === 'string' ? JSON.parse(task.Actions) : task.Actions
      if (Array.isArray(actions) && actions.length > 0) {
        executablePath = actions[0].Execute || ''
        args = actions[0].Arguments || ''
      }
    } catch {
      executablePath = ''
    }

    if (!executablePath) {
      executablePath = 'Task Scheduler'
    }

    // 解析触发器摘要
    let triggerSummary = ''
    try {
      const triggers = typeof task.Triggers === 'string' ? JSON.parse(task.Triggers) : task.Triggers
      if (Array.isArray(triggers)) {
        triggerSummary = triggers
          .map((t: any) => t.Type?.replace('MSFT_Task', '') || 'Unknown')
          .join('; ')
      }
    } catch {
      triggerSummary = ''
    }

    const isSystem = (task.TaskPath || '').startsWith('\\Microsoft\\Windows\\')

    return {
      id: `task_${this.hashString(fullTaskPath)}`,
      name: taskName,
      description: task.Description || `计划任务 (${triggerSummary || '未指定触发器'})`,
      type: StartupType.ScheduledTask,
      source: 'task',
      status: task.Enabled ? StartupStatus.Enabled : StartupStatus.Disabled,
      path: executablePath,
      arguments: args || undefined,
      publisher: task.Author || undefined,
      version: undefined,
      securityLevel: SecurityLevel.Safe,
      impact: 'medium',
      enabled: task.Enabled !== false,
      isSystem,
      location: fullTaskPath,
      hash: executablePath ? this.hashString(executablePath.toLowerCase()) : undefined,
    }
  }

  private enrichWithFileInfo(items: StartupItem[]): void {
    for (const item of items) {
      const realPath = item.path && item.path !== 'Task Scheduler' ? item.path : null
      if (realPath) {
        fileInfoExtractor.getFileInfo(realPath).then(info => {
          if (info) {
            item.fileInfo = info
            if (info.version) item.version = info.version
            if (info.company) item.publisher = info.company
            if (info.description && !item.description) item.description = info.description
          }
        }).catch(() => {})
      }
    }
  }

  private hashString(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 16)
  }
}

export const scheduledTaskScanner = new ScheduledTaskScanner()
