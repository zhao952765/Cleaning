/**
 * 统一路径解析工具
 * 处理各种命令行字符串（带引号、空格、参数）
 */

export interface ParsedPath {
  executable: string   // 可执行文件路径
  args: string         // 命令行参数
}

/**
 * 解析命令行字符串，提取可执行文件路径和参数
 * 支持三种常见格式：
 *
 * 1. 引号包裹: "C:\Program Files\App.exe" --silent
 *    → executable: C:\Program Files\App.exe, args: --silent
 *
 * 2. 无引号有空格: C:\Tools\app.exe --flag value
 *    → executable: C:\Tools\app.exe, args: --flag value
 *
 * 3. 纯路径: C:\simple.exe
 *    → executable: C:\simple.exe, args: ''
 */
export function parseCommandLine(commandLine: string): ParsedPath {
  const trimmed = (commandLine || '').trim()
  if (!trimmed) return { executable: '', args: '' }

  // 情况1：引号包裹
  if (trimmed.startsWith('"')) {
    const end = trimmed.indexOf('"', 1)
    if (end !== -1) {
      return {
        executable: trimmed.substring(1, end),
        args: trimmed.substring(end + 1).trim()
      }
    }
  }

  // 情况2：无引号，查找第一个空格
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx !== -1) {
    const potentialPath = trimmed.substring(0, spaceIdx)
    // 确保看起来像可执行文件
    if (/\.(exe|com|bat|cmd|vbs|ps1|js|dll)$/i.test(potentialPath)) {
      return {
        executable: potentialPath,
        args: trimmed.substring(spaceIdx + 1).trim()
      }
    }
  }

  // 情况3：整个字符串就是路径
  return { executable: trimmed, args: '' }
}

/**
 * 从服务/驱动路径中提取可执行文件
 * 特别处理 svchost.exe 等服务主机进程
 */
export function parseServicePath(
  binaryPath: string,
  serviceName: string
): { executable: string; description: string } {
  const parsed = parseCommandLine(binaryPath)
  const exeName = (parsed.executable || '').toLowerCase().split('\\').pop() || ''

  // svchost.exe 特殊处理：从注册表读取真实路径
  if (exeName === 'svchost.exe') {
    // 尝试构建友好的描述
    const serviceGroup = extractServiceGroup(parsed.args)
    if (serviceGroup) {
      return {
        executable: 'C:\\Windows\\System32\\svchost.exe',
        description: `Windows 服务主机进程 (svchost.exe -k ${serviceGroup})`
      }
    }
    return {
      executable: 'C:\\Windows\\System32\\svchost.exe',
      description: `Windows 服务主机进程 — ${serviceName}`
    }
  }

  return {
    executable: parsed.executable || '',
    description: parsed.executable || ''
  }
}

/**
 * 从 svchost 参数中提取服务组名（-k 后面的值）
 */
function extractServiceGroup(args: string): string {
  if (!args) return ''
  const match = args.match(/-k\s+(\S+)/i)
  return match ? match[1] : ''
}

/**
 * 从快捷方式命令行中提取目标
 */
export function parseShortcutCommand(commandLine: string): ParsedPath {
  return parseCommandLine(commandLine)
}

/**
 * 判断路径是否为可执行文件
 */
export function isExecutablePath(filePath: string): boolean {
  return /\.(exe|com|bat|cmd|vbs|ps1|js|dll)$/i.test(filePath)
}
