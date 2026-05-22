import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'
import { StartupItem, StartupType, StartupStatus, SecurityLevel } from '../../shared/types'
import { fileInfoExtractor } from './fileInfo'

const execAsync = promisify(exec)

/**
 * StartupFolderScanner - 启动文件夹扫描器
 *
 * 扫描两个标准位置：
 * - %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
 * - C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup
 *
 * 使用 PowerShell WScript.Shell 解析 .lnk 快捷方式
 * 处理文件夹不存在/无权限的情况
 */
export class StartupFolderScanner {
  private readonly STARTUP_FOLDERS = [
    {
      name: 'User Startup',
      path: path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'),
    },
    {
      name: 'Common Startup',
      path: 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp',
    },
  ]

  private readonly VALID_EXTENSIONS = ['.exe', '.bat', '.cmd', '.com', '.vbs', '.ps1', '.js', '.lnk']

  async scan(): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    for (const folder of this.STARTUP_FOLDERS) {
      const enabledItems = await this.scanFolder(folder, true)
      items.push(...enabledItems)

      // 扫描 Disabled 子文件夹
      const disabledFolder = path.join(folder.path, 'Disabled')
      try {
        if (fs.existsSync(disabledFolder)) {
          const disabledItems = await this.scanFolder(
            { name: folder.name + '-Disabled', path: disabledFolder },
            false,
          )
          items.push(...disabledItems)
        }
      } catch {
        // 无权限读取 Disabled 文件夹时静默跳过
      }
    }

    // 异步填充 fileInfo
    for (const item of items) {
      if (item.path && fs.existsSync(item.path)) {
        fileInfoExtractor.getFileInfo(item.path).then(info => {
          if (info) {
            item.fileInfo = info
            if (info.version) item.version = info.version
            if (info.company) item.publisher = info.company
            if (info.description && !item.description) item.description = info.description
          }
        }).catch(() => {})
      }
    }

    console.log(`[StartupFolderScanner] 扫描完成，共 ${items.length} 个启动项`)
    return items
  }

  private async scanFolder(folderInfo: { name: string; path: string }, enabled: boolean): Promise<StartupItem[]> {
    const items: StartupItem[] = []

    try {
      if (!fs.existsSync(folderInfo.path)) return []

      const files = fs.readdirSync(folderInfo.path)
      for (const file of files) {
        const filePath = path.join(folderInfo.path, file)
        try {
          const stat = fs.statSync(filePath)
          if (!stat.isFile()) continue

          const ext = path.extname(file).toLowerCase()
          if (!this.VALID_EXTENSIONS.includes(ext)) continue

      const item = await this.createStartupItem(file, filePath, enabled, stat)
      if (item) items.push(item)
        } catch {
          // 无权限或文件被占用时跳过单个文件
        }
      }
    } catch (error) {
      console.warn(`[StartupFolderScanner] 扫描文件夹失败 [${folderInfo.path}]:`, (error as Error).message)
    }

    return items
  }

  private async createStartupItem(
    fileName: string,
    filePath: string,
    enabled: boolean,
    stat: fs.Stats,
  ): Promise<StartupItem | null> {
    try {
      const ext = path.extname(fileName).toLowerCase()
      let targetPath = filePath
      let args = ''
      let description: string | undefined

      // .lnk 快捷方式解析
      if (ext === '.lnk') {
        const resolved = await this.resolveShortcut(filePath)
        if (resolved && resolved.executablePath) {
          targetPath = resolved.executablePath
          args = resolved.arguments
          description = `快捷方式: ${fileName}`
        } else {
          description = `未解析的快捷方式: ${fileName}`
        }
      }

      const baseName = path.basename(fileName, ext)

      return {
        id: `folder_${this.hashString(filePath)}`,
        name: baseName,
        description,
        type: StartupType.Folder,
        source: 'folder',
        status: enabled ? StartupStatus.Enabled : StartupStatus.Disabled,
        path: targetPath,
        arguments: args || undefined,
        publisher: undefined,
        version: undefined,
        securityLevel: SecurityLevel.Safe,
        impact: 'low',
        enabled,
        isProtected: false,
        lastModified: stat.mtime,
        location: filePath,
        hash: targetPath ? this.hashString(targetPath.toLowerCase()) : undefined,
      }
    } catch {
      return null
    }
  }

  /**
   * PowerShell WScript.Shell 解析 .lnk 快捷方式
   */
  private async resolveShortcut(lnkPath: string): Promise<{ executablePath: string; arguments: string } | null> {
    try {
      const escapedPath = lnkPath.replace(/'/g, "''")
      const psScript = `
        try {
          $shell = New-Object -ComObject WScript.Shell -ErrorAction Stop;
          $shortcut = $shell.CreateShortcut('${escapedPath}');
          [PSCustomObject]@{
            TargetPath = $shortcut.TargetPath
            Arguments = $shortcut.Arguments
            WorkingDirectory = $shortcut.WorkingDirectory
          } | ConvertTo-Json -Compress
        } catch {
          '{}'
        }
      `

      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "${psScript}"`,
        { encoding: 'utf8', timeout: 10000, windowsHide: true }
      )

      if (!stdout || stdout.trim().length === 0 || stdout.trim() === '{}') return null

      const result = JSON.parse(stdout)
      return {
        executablePath: result.TargetPath || '',
        arguments: result.Arguments || '',
      }
    } catch {
      return null
    }
  }

  private hashString(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 16)
  }
}

export const startupFolderScanner = new StartupFolderScanner()
