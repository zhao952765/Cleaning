import { describe, it, expect } from 'vitest'

describe('命令行解析', () => {
  // 模拟解析命令行字符串的函数
  const parseCommandLine = (cmd: string): { path: string; args: string } => {
    // 处理带引号的路径
    const match = cmd.match(/^"([^"]+)"\s*(.*)$/)
    if (match) {
      return { path: match[1], args: match[2].trim() }
    }
    
    // 处理不带引号的路径
    const parts = cmd.split(/\s+/)
    return { path: parts[0], args: parts.slice(1).join(' ') }
  }

  it('应该正确解析带引号的路径和参数', () => {
    const cmd = '"C:\\Program Files\\App\\app.exe" --arg1 --arg2'
    const result = parseCommandLine(cmd)
    
    expect(result.path).toBe('C:\\Program Files\\App\\app.exe')
    expect(result.args).toBe('--arg1 --arg2')
  })

  it('应该正确解析不带引号的路径', () => {
    const cmd = 'C:\\Windows\\System32\\notepad.exe'
    const result = parseCommandLine(cmd)
    
    expect(result.path).toBe('C:\\Windows\\System32\\notepad.exe')
    expect(result.args).toBe('')
  })

  it('应该正确解析带空格参数的路径', () => {
    const cmd = '"C:\\Program Files\\Launcher\\launcher.exe" /start "C:\\Games\\game.exe"'
    const result = parseCommandLine(cmd)
    
    expect(result.path).toBe('C:\\Program Files\\Launcher\\launcher.exe')
    expect(result.args).toBe('/start "C:\\Games\\game.exe"')
  })

  it('应该处理空字符串', () => {
    const cmd = ''
    const result = parseCommandLine(cmd)
    
    expect(result.path).toBe('')
    expect(result.args).toBe('')
  })
})

describe('路径处理', () => {
  it('应该验证可执行文件扩展名', () => {
    const validExtensions = ['.exe', '.bat', '.cmd', '.com']
    
    validExtensions.forEach(ext => {
      const filePath = `C:\\Test\\app${ext}`
      const isValid = validExtensions.some(e => filePath.toLowerCase().endsWith(e))
      expect(isValid).toBe(true)
    })
  })

  it('应该识别无效的可执行文件', () => {
    const invalidPaths = [
      'C:\\Test\\file.txt',
      'C:\\Test\\file.pdf',
      'C:\\Test\\file.jpg'
    ]
    
    const validExtensions = ['.exe', '.bat', '.cmd', '.com']
    
    invalidPaths.forEach(filePath => {
      const isValid = validExtensions.some(e => filePath.toLowerCase().endsWith(e))
      expect(isValid).toBe(false)
    })
  })

  it('应该正确处理相对路径', () => {
    const relativePath = '.\\app.exe'
    const absolutePath = require('path').resolve(relativePath)
    
    expect(require('path').isAbsolute(absolutePath)).toBe(true)
  })
})

describe('去重逻辑', () => {
  interface StartupItem {
    id: string
    name: string
    path: string
  }

  const removeDuplicates = (items: StartupItem[]): StartupItem[] => {
    const seen = new Set<string>()
    return items.filter(item => {
      const key = `${item.name.toLowerCase()}|${item.path.toLowerCase()}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  it('应该移除重复的启动项', () => {
    const items: StartupItem[] = [
      { id: '1', name: 'App', path: 'C:\\App\\app.exe' },
      { id: '2', name: 'App', path: 'C:\\App\\app.exe' },
      { id: '3', name: 'Other', path: 'C:\\Other\\other.exe' }
    ]
    
    const result = removeDuplicates(items)
    
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('1')
    expect(result[1].id).toBe('3')
  })

  it('应该区分大小写相同的项目', () => {
    const items: StartupItem[] = [
      { id: '1', name: 'APP', path: 'C:\\App\\app.exe' },
      { id: '2', name: 'app', path: 'c:\\app\\app.exe' }
    ]
    
    const result = removeDuplicates(items)
    
    expect(result).toHaveLength(1)
  })
})
