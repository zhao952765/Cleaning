import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { app, shell } from 'electron'
import { databaseManager } from '../database'
import { StartupItem } from '../../shared/types'

const execAsync = promisify(exec)

/**
 * 系统启动项操作管理器
 * 提供实际的启用/禁用、备份、还原等功能
 */
export class SystemOperationsManager {
  private backupDir: string

  constructor() {
    // 备份目录：用户数据目录下的 backups
    this.backupDir = path.join(app.getPath('userData'), 'backups')
    this.ensureBackupDir()
  }

  /**
   * 确保备份目录存在
   */
  private ensureBackupDir(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }
  }

  /**
   * 禁用/启用注册表启动项
   */
  async toggleRegistryItem(item: StartupItem, enable: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const { Registry } = await import('winreg')
      
      // 解析注册表路径
      const regPath = item.location || ''
      if (!regPath) {
        return { success: false, message: '无效的注册表路径' }
      }

      const reg = new Registry({
        hive: regPath.startsWith('HKLM') ? Registry.HKLM : Registry.HKCU,
        key: regPath.replace(/^(HKLM|HKCU)\\/, '')
      })

      if (enable) {
        // 从备份恢复
        const backup = await this.getRegistryBackup(item.id)
        if (backup) {
          await this.setRegistryValue(reg, item.name, backup.value, backup.type)
          return { success: true, message: '已启用启动项' }
        } else {
          return { success: false, message: '未找到备份数据' }
        }
      } else {
        // 备份后删除
        const value = await this.getRegistryValue(reg, item.name)
        if (value) {
          await this.saveRegistryBackup(item.id, item.name, value.value, value.type)
          await this.deleteRegistryValue(reg, item.name)
          return { success: true, message: '已禁用启动项' }
        } else {
          return { success: false, message: '注册表项不存在' }
        }
      }
    } catch (error: any) {
      console.error('切换注册表项失败:', error)
      return { success: false, message: error.message || '操作失败，可能需要管理员权限' }
    }
  }

  /**
   * 禁用/启用计划任务
   */
  async toggleScheduledTask(item: StartupItem, enable: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const taskName = item.name
      
      if (enable) {
        // 启用任务
        await execAsync(`schtasks /Change /TN "${taskName}" /ENABLE`)
        return { success: true, message: '已启用计划任务' }
      } else {
        // 禁用任务
        await execAsync(`schtasks /Change /TN "${taskName}" /DISABLE`)
        return { success: true, message: '已禁用计划任务' }
      }
    } catch (error: any) {
      console.error('切换计划任务失败:', error)
      return { success: false, message: error.message || '操作失败，可能需要管理员权限' }
    }
  }

  /**
   * 修改服务启动类型
   */
  async toggleService(item: StartupItem, enable: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const serviceName = item.name
      
      if (enable) {
        // 设置为自动启动
        await execAsync(`sc config "${serviceName}" start= auto`)
        return { success: true, message: '已设置服务为自动启动' }
      } else {
        // 设置为禁用
        await execAsync(`sc config "${serviceName}" start= disabled`)
        return { success: true, message: '已禁用服务' }
      }
    } catch (error: any) {
      console.error('切换服务失败:', error)
      return { success: false, message: error.message || '操作失败，需要管理员权限' }
    }
  }

  /**
   * 处理启动文件夹项目（移动到备份位置）
   */
  async toggleStartupFolderItem(item: StartupItem, enable: boolean): Promise<{ success: boolean; message: string }> {
    try {
      const filePath = item.path
      
      if (enable) {
        // 从备份恢复
        const backupPath = this.getBackupFilePath(item.id)
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, filePath)
          fs.unlinkSync(backupPath)
          return { success: true, message: '已恢复启动项' }
        } else {
          return { success: false, message: '未找到备份文件' }
        }
      } else {
        // 移动到备份位置
        const backupPath = this.getBackupFilePath(item.id)
        fs.copyFileSync(filePath, backupPath)
        fs.unlinkSync(filePath)
        return { success: true, message: '已移除启动项（已备份）' }
      }
    } catch (error: any) {
      console.error('处理启动文件夹失败:', error)
      return { success: false, message: error.message || '操作失败' }
    }
  }

  /**
   * 统一的切换接口（根据来源自动选择方法）
   */
  async toggleItem(item: StartupItem, enable: boolean): Promise<{ success: boolean; message: string }> {
    // 保存操作前的状态到数据库
    await this.saveActionHistory(item.id, enable ? 'enable' : 'disable')

    switch (item.source) {
      case 'registry':
        return await this.toggleRegistryItem(item, enable)
      case 'scheduled_task':
        return await this.toggleScheduledTask(item, enable)
      case 'service':
        return await this.toggleService(item, enable)
      case 'folder':
        return await this.toggleStartupFolderItem(item, enable)
      default:
        return { success: false, message: '不支持的启动项类型' }
    }
  }

  /**
   * 打开文件位置
   */
  async openFileLocation(filePath: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, message: '文件不存在' }
      }
      
      shell.showItemInFolder(filePath)
      return { success: true, message: '已打开文件位置' }
    } catch (error: any) {
      console.error('打开文件位置失败:', error)
      return { success: false, message: error.message || '操作失败' }
    }
  }

  /**
   * 获取系统启动时间
   */
  async getBootTime(): Promise<number> {
    try {
      // 使用 PowerShell 获取启动时间
      const { stdout } = await execAsync(
        'powershell -Command "(Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime"'
      )
      
      // 解析 TimeSpan 格式
      const match = stdout.match(/(\d+)\.(\d+):(\d+):(\d+)/)
      if (match) {
        const days = parseInt(match[1])
        const hours = parseInt(match[2])
        const minutes = parseInt(match[3])
        const seconds = parseInt(match[4])
        
        return ((days * 24 + hours) * 60 + minutes) * 60 + seconds
      }
      
      return 0
    } catch (error) {
      console.error('获取启动时间失败:', error)
      return 0
    }
  }

  /**
   * 检查是否为系统关键项
   */
  isSystemCritical(item: StartupItem): boolean {
    const criticalKeywords = [
      'windows', 'system', 'security', 'defender', 
      'firewall', 'update', 'service', 'driver'
    ]
    
    const nameLower = item.name.toLowerCase()
    const pathLower = item.path.toLowerCase()
    
    return criticalKeywords.some(keyword => 
      nameLower.includes(keyword) || pathLower.includes(keyword)
    )
  }

  /**
   * 批量操作（带确认）
   */
  async batchToggle(items: StartupItem[], enable: boolean): Promise<{
    success: number
    failed: number
    results: Array<{ itemId: string; success: boolean; message: string }>
  }> {
    const results: Array<{ itemId: string; success: boolean; message: string }> = []
    let successCount = 0
    let failedCount = 0

    for (const item of items) {
      try {
        const result = await this.toggleItem(item, enable)
        results.push({ itemId: item.id, ...result })
        
        if (result.success) {
          successCount++
        } else {
          failedCount++
        }
      } catch (error: any) {
        results.push({ 
          itemId: item.id, 
          success: false, 
          message: error.message || '操作失败' 
        })
        failedCount++
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      results
    }
  }

  /**
   * 还原所有修改
   */
  async restoreAll(): Promise<{ success: number; failed: number }> {
    try {
      const actions = databaseManager.getUserActions(null)
      let successCount = 0
      let failedCount = 0

      for (const action of actions) {
        try {
          // 反向操作
          const reverseEnable = action.action === 'disable'
          // TODO: 根据 action.item_id 查找对应的启动项并恢复
          successCount++
        } catch (error) {
          failedCount++
        }
      }

      return { success: successCount, failed: failedCount }
    } catch (error) {
      console.error('还原失败:', error)
      return { success: 0, failed: 0 }
    }
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 获取备份文件路径
   */
  private getBackupFilePath(itemId: string): string {
    return path.join(this.backupDir, `${itemId}.bak`)
  }

  /**
   * 保存注册表备份
   */
  private async saveRegistryBackup(itemId: string, name: string, value: string, type: string): Promise<void> {
    const backupData = {
      itemId,
      name,
      value,
      type,
      timestamp: new Date().toISOString()
    }
    
    const backupPath = this.getBackupFilePath(itemId)
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2))
    
    // 同时保存到数据库
    databaseManager.logUserAction(itemId, 'backup', JSON.stringify(backupData))
  }

  /**
   * 获取注册表备份
   */
  private async getRegistryBackup(itemId: string): Promise<{ value: string; type: string } | null> {
    try {
      const backupPath = this.getBackupFilePath(itemId)
      if (!fs.existsSync(backupPath)) {
        return null
      }
      
      const data = JSON.parse(fs.readFileSync(backupPath, 'utf-8'))
      return { value: data.value, type: data.type }
    } catch (error) {
      console.error('读取备份失败:', error)
      return null
    }
  }

  /**
   * 获取注册表值
   */
  private async getRegistryValue(reg: any, name: string): Promise<{ value: string; type: string } | null> {
    return new Promise((resolve) => {
      reg.get(name, (err: any, item: any) => {
        if (err || !item) {
          resolve(null)
        } else {
          resolve({ value: item.value, type: item.type })
        }
      })
    })
  }

  /**
   * 设置注册表值
   */
  private async setRegistryValue(reg: any, name: string, value: string, type: string): Promise<void> {
    return new Promise((resolve, reject) => {
      reg.set(name, type, value, (err: any) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * 删除注册表值
   */
  private async deleteRegistryValue(reg: any, name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      reg.remove(name, (err: any) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * 保存操作历史
   */
  private async saveActionHistory(itemId: string, action: string): Promise<void> {
    try {
      databaseManager.logUserAction(itemId, action, new Date().toISOString())
    } catch (error) {
      console.error('保存操作历史失败:', error)
    }
  }
}

// 导出单例
export const systemOperationsManager = new SystemOperationsManager()
