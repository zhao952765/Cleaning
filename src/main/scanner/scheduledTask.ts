import { exec } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'
import { StartupItem, StartupType, StartupStatus, SecurityLevel } from '../../shared/types'
import { parseCommandLine } from '../system/pathParser'
import { isTaskPathProtected } from '../system/protectedItems'

const execAsync = promisify(exec)

// 简单内存缓存（30 分钟 TTL）
interface CacheEntry {
  items: StartupItem[]
  timestamp: number
}
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟
let scanCache: CacheEntry | null = null

/**
 * ScheduledTaskScanner - 计划任务扫描器
 *
 * PowerShell 查询:
 * Get-ScheduledTask | Where-Object { $_.State -eq 'Ready' -or $_.Enabled -eq $true }
 *
 * 提取字段: TaskName, TaskPath, State, Description, Triggers, Actions, Author
 * 内置 Microsoft 关键任务保护列表（Defender, UpdateOrchestrator, WindowsUpdate 等路径）
 * 30 分钟文件缓存
 */
export class ScheduledTaskScanner {
  async scan(): Promise<StartupItem[]> {
    // 检查缓存
    if (scanCache && Date.now() - scanCache.timestamp < CACHE_TTL) {
      console.log(`[ScheduledTaskScanner] 使用缓存 (${scanCache.items.length} 项, ${Math.round((Date.now() - scanCache.timestamp) / 1000)}s 前)`)
      return scanCache.items
    }

    const items: StartupItem[] = []

    try {
      const tasks = await this.getTasksWithPowerShell()
      for (const task of tasks) {
        const item = this.createTaskItem(task)
        if (item) items.push(item)
      }
      console.log(`[ScheduledTaskScanner] 扫描完成，共 ${items.length} 个计划任务`)

      // 更新缓存
      scanCache = { items, timestamp: Date.now() }
    } catch (error) {
      console.error('[ScheduledTaskScanner] 扫描失败:', error)
    }

    return items
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    scanCache = null
    console.log('[ScheduledTaskScanner] 缓存已清除')
  }

  /**
   * PowerShell 查询脚本
   * Get-ScheduledTask 获取所有任务
   * 过滤: State == 'Ready' 或 Enabled == true
   */
  private async getTasksWithPowerShell(): Promise<any[]> {
    try {
      const psScript = `
        $tasks = Get-ScheduledTask -ErrorAction SilentlyContinue |
          Where-Object { $_.State -eq 'Ready' -or $_.Enabled -eq $true };
        $result = @();
        foreach ($task in $tasks) {
          $triggerTypes = @();
          $triggerDescs = @();
          foreach ($trigger in $task.Triggers) {
            $typeName = $trigger.CimClass.CimClassName -replace 'MSFT_Task','';
            $triggerTypes += $typeName;
            if ($trigger.StartBoundary) {
              $triggerDescs += ($typeName + ' ' + $trigger.StartBoundary.Substring(0,16));
            } elseif ($trigger.Repetition.Interval) {
              $triggerDescs += ($typeName + ' 每' + $trigger.Repetition.Interval);
            } else {
              $triggerDescs += $typeName;
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
            Triggers = ($triggerTypes -join '; ')
            TriggerDescs = ($triggerDescs -join '; ')
            Actions = ($actions | ConvertTo-Json -Compress)
            Enabled = $task.Enabled
          }
        }
        ConvertTo-Json $result -Depth 5 -Compress
      `

      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "${psScript}"`,
        { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 60000, windowsHide: true }
      )

      if (!stdout || stdout.trim().length === 0) return []

      const parsed = JSON.parse(stdout)
      return Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
    } catch (error) {
      console.error('[ScheduledTaskScanner] PowerShell 失败:', error)
      return []
    }
  }

  private createTaskItem(task: any): StartupItem | null {
    const taskName = task.TaskName || ''
    const taskPath = task.TaskPath || '\\'
    const fullPath = taskPath + taskName

    if (!taskName) return null

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

    // 处理常见情况：powershell.exe -Command "..." / cmd.exe /c
    if (executablePath) {
      const parsed = parseCommandLine(`${executablePath} ${args}`.trim())
      executablePath = parsed.executable || executablePath
      if (!parsed.executable) {
        // 如果解析失败，保留原始路径
      }
    } else {
      executablePath = 'Task Scheduler'
    }

    // 构建触发器摘要
    const triggerSummary = this.buildTriggerSummary(task.Triggers, task.TriggerDescs)

    // 检查保护列表
    const protectedCheck = isTaskPathProtected(fullPath)

    const isEnabled = task.Enabled !== false

    return {
      id: `task_${this.hashString(fullPath)}`,
      name: taskName,
      description: task.Description || `计划任务 (${triggerSummary || '系统任务'})`,
      type: StartupType.ScheduledTask,
      source: 'task',
      status: isEnabled ? StartupStatus.Enabled : StartupStatus.Disabled,
      path: executablePath,
      arguments: args || undefined,
      publisher: task.Author || undefined,
      version: undefined,
      securityLevel: SecurityLevel.Safe,
      impact: protectedCheck.protected ? 'high' : 'medium',
      enabled: isEnabled,
      isSystem: protectedCheck.protected,
      isProtected: protectedCheck.protected,
      protectedReason: protectedCheck.reason,
      triggerSummary: triggerSummary || undefined,
      location: fullPath,
      hash: executablePath ? this.hashString(executablePath.toLowerCase()) : undefined,
    }
  }

  /**
   * 构建阅读友好的触发器摘要
   * 例如: "每日 10:00 触发", "登录时触发", "系统启动时触发"
   */
  private buildTriggerSummary(triggers: string, triggerDescs: string): string {
    if (triggerDescs && triggerDescs.trim()) return triggerDescs.trim()

    if (!triggers || triggers.trim() === '') return ''

    const types = triggers.split('; ').filter(Boolean)
    const typeLabels: Record<string, string> = {
      TimeTrigger: '定时触发',
      BootTrigger: '系统启动时触发',
      LogonTrigger: '登录时触发',
      SessionStateChangeTrigger: '会话状态变更时触发',
      RegistrationTrigger: '注册时触发',
      DailyTrigger: '每日触发',
      WeeklyTrigger: '每周触发',
      MonthlyTrigger: '每月触发',
      EventTrigger: '事件触发',
      IdleTrigger: '空闲时触发',
    }

    return types.map(t => typeLabels[t] || t).join('; ')
  }

  private hashString(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 16)
  }
}

export const scheduledTaskScanner = new ScheduledTaskScanner()
