import fs from 'fs'
import path from 'path'
import os from 'os'
import { StartupItem, StartupType, StartupStatus, SecurityLevel } from '../../shared/types'

/**
 * 启动文件夹扫描器
 * 扫描用户和公共启动文件夹中的快捷方式
 */
export class StartupFolderScanner {
  // 启动文件夹路径
  private readonly STARTUP_FOLDERS = [
    {
      name: 'User Startup',
      path: path.join(
        os.homedir(),
        'AppData',
        'Roaming',
        'Microsoft',
        'Windows',
        'Start Menu',
        'Programs',
        'Startup'
      )
    },
    {
      name: 'Common Startup',
      path: path.join(
        'C:',
        'ProgramData',
        'Microsoft',
        'Windows',
        'Start Menu',
        'Programs',
        'StartUp'
      )
    }
  ]

  /**
   * 扫描启动文件夹
   */
  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      for (const folder of this.STARTUP_FOLDERS) {
        const folderItems = await this.scanFolder(folder)
        items.push(...folderItems)
      }

      console.log(`[StartupFolderScanner] 扫描完成，共找到 ${items.length} 个启动文件夹项`)
    } catch (error) {
      console.error('[StartupFolderScanner] 扫描失败:', error)
    }

    return items
  }

  /**
   * 扫描单个文件夹
   */
  private async scanFolder(folderInfo: { name: string; path: string }): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      // 检查文件夹是否存在
      if (!fs.existsSync(folderInfo.path)) {
        console.warn(`[StartupFolderScanner] 文件夹不存在: ${folderInfo.path}`)
        return []
      }

      // 读取文件夹内容
      const files = fs.readdirSync(folderInfo.path)

      for (const file of files) {
        const filePath = path.join(folderInfo.path, file)
        
        try {
          const stat = fs.statSync(filePath)
          
          // 只处理文件（不递归子目录）
          if (stat.isFile()) {
            const item = this.createStartupItem(file, filePath, folderInfo.name)
            if (item) {
              items.push(item)
            }
          }
        } catch (fileError) {
          console.warn(`[StartupFolderScanner] 处理文件失败 [${file}]:`, fileError)
        }
      }
    } catch (error) {
      console.error(`[StartupFolderScanner] 扫描文件夹失败 [${folderInfo.path}]:`, error)
    }

    return items
  }

  /**
   * 创建启动项对象
   */
  private createStartupItem(
    fileName: string,
    filePath: string,
    folderName: string
  ): StartupItem | null {
    try {
      // 获取文件信息
      const stat = fs.statSync(filePath)
      
      // 解析文件扩展名
      const ext = path.extname(fileName).toLowerCase()
      
      // 只处理可执行文件和快捷方式
      const validExtensions = ['.exe', '.bat', '.cmd', '.com', '.vbs', '.js', '.lnk']
      if (!validExtensions.includes(ext)) {
        return null
      }

      let targetPath = filePath
      let description = undefined

      // 如果是快捷方式，尝试解析目标
      if (ext === '.lnk') {
        targetPath = this.resolveShortcut(filePath) || filePath
        description = `快捷方式: ${fileName}`
      }

      return {
        id: `folder_${this.generateId(filePath)}`,
        name: path.basename(fileName, ext),
        description,
        type: StartupType.StartupFolder,
        source: 'folder',
        status: StartupStatus.Enabled,
        path: targetPath,
        arguments: undefined,
        publisher: undefined,
        version: undefined,
        securityLevel: SecurityLevel.Safe,
        impact: 'low',
        enabled: true,
        lastModified: stat.mtime,
        icon: undefined,
        iconColor: undefined,
        banRateValue: undefined
      }
    } catch (error) {
      console.error(`[StartupFolderScanner] 创建启动项失败 [${fileName}]:`, error)
      return null
    }
  }

  /**
   * 解析快捷方式（简化版）
   * 注意：Node.js 原生不支持 .lnk 解析，需要使用第三方库或 PowerShell
   */
  private resolveShortcut(lnkPath: string): string | null {
    try {
      // TODO: 使用 PowerShell 或其他方法解析 .lnk 文件
      // 这里返回原始路径作为占位符
      return lnkPath
    } catch (error) {
      console.warn(`[StartupFolderScanner] 解析快捷方式失败:`, error)
      return null
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(filePath: string): string {
    let hash = 0
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }
}

/**
 * 导出单例实例
 */
export const startupFolderScanner = new StartupFolderScanner()
