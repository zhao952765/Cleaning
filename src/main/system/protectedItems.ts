/**
 * 系统关键/受保护启动项定义
 * 这些是 Windows 系统运行所必需的，禁止随意禁用/删除
 */

// ========== 关键服务保护列表 ==========
export interface ProtectedService {
  name: string
  displayName: string
  reason: string
}

export const PROTECTED_SERVICES: ProtectedService[] = [
  { name: 'WinDefend', displayName: 'Microsoft Defender 防病毒', reason: '系统安全核心组件，禁用后系统将失去实时病毒防护' },
  { name: 'wuauserv', displayName: 'Windows Update', reason: 'Windows 更新服务，禁用后将无法接收安全更新' },
  { name: 'EventLog', displayName: 'Windows 事件日志', reason: '系统事件记录服务，禁用后无法记录和查看系统日志' },
  { name: 'SamSs', displayName: '安全帐户管理器', reason: '用户账户安全核心服务，禁用可能导致登录失败' },
  { name: 'Spooler', displayName: '打印后台处理程序', reason: '打印服务，禁用后将无法打印' },
  { name: 'SecurityHealthService', displayName: 'Windows 安全中心', reason: '安全中心服务，禁用后安全中心无法显示状态' },
  { name: 'lsass', displayName: '本地安全机构进程', reason: '系统安全认证核心进程，禁用会导致系统无法登录' },
  { name: 'DiagTrack', displayName: '连接的用户体验和诊断', reason: '诊断跟踪服务，虽然可禁用但属于系统组件' },
  { name: 'DcomLaunch', displayName: 'DCOM 服务器进程启动器', reason: 'COM 基础架构服务，禁用会导致大量应用崩溃' },
  { name: 'RpcSs', displayName: '远程过程调用 (RPC)', reason: '系统通信核心服务，几乎所有服务都依赖 RPC' },
  { name: 'PlugPlay', displayName: '即插即用', reason: '硬件检测核心服务，禁用后无法识别新硬件' },
  { name: 'Power', displayName: '电源策略', reason: '电源管理服务，禁用后无法管理电源计划' },
  { name: 'WpnService', displayName: 'Windows 推送通知', reason: '系统通知服务，禁用后无法收到系统通知' },
  { name: 'BFE', displayName: '基础过滤引擎', reason: '防火墙和网络策略核心，禁用后防火墙失效' },
  { name: 'MpsSvc', displayName: 'Windows 防火墙', reason: '系统防火墙服务，禁用后系统暴露在网络威胁中' },
  { name: 'BrokerInfrastructure', displayName: '后台任务基础结构', reason: '系统后台任务管理，禁用影响多任务运行' },
  { name: 'SystemEventsBroker', displayName: '系统事件代理', reason: '系统事件分发服务，禁用影响后台任务' },
  { name: 'ProfSvc', displayName: '用户配置文件服务', reason: '用户配置文件管理，禁用可能导致用户配置异常' },
  { name: 'Schedule', displayName: '任务计划程序', reason: '任务计划引擎，禁用后所有计划任务无法运行' },
]

// ========== 关键计划任务路径保护列表 ==========
export const PROTECTED_TASK_PATHS: string[] = [
  '\\Microsoft\\Windows\\Defender\\',
  '\\Microsoft\\Windows\\UpdateOrchestrator\\',
  '\\Microsoft\\Windows\\WindowsUpdate\\',
  '\\Microsoft\\Windows\\Autochk\\',
  '\\Microsoft\\Windows\\MemoryDiagnostic\\',
  '\\Microsoft\\Windows\\TaskScheduler\\',
  '\\Microsoft\\Windows\\Time Synchronization\\',
  '\\Microsoft\\Windows\\User Profile Service\\',
  '\\Microsoft\\Windows\\Shell\\',
  '\\Microsoft\\Windows\\SoftwareProtectionPlatform\\',
  '\\Microsoft\\Windows\\AppID\\',
  '\\Microsoft\\Windows\\Application Experience\\',
  '\\Microsoft\\Windows\\Bluetooth\\',
  '\\Microsoft\\Windows\\CloudExperienceHost\\',
  '\\Microsoft\\Windows\\Device Information\\',
]

// ========== 关键注册表启动项保护列表 ==========
export const PROTECTED_REGISTRY_NAMES: string[] = [
  'Userinit',
  'Shell',
  'Taskman',
  'System',
]

// ========== 关键路径模式 ==========
export const CRITICAL_PATH_PATTERNS: RegExp[] = [
  /\\Windows\\System32\\[a-z]+\.exe$/i,
  /\\Windows\\SysWOW64\\[a-z]+\.exe$/i,
  /\\Program Files\\Windows Defender\\/i,
  /\\Program Files\\Microsoft Security Client\\/i,
]

// ========== 关键名称模式 ==========
export const CRITICAL_NAME_PATTERNS: string[] = [
  'explorer.exe', 'svchost.exe', 'csrss.exe', 'wininit.exe',
  'services.exe', 'lsass.exe', 'winlogon.exe', 'smss.exe',
  'taskmgr.exe', 'runtimebroker.exe', 'sihost.exe', 'taskhostw.exe',
  'MsMpEng.exe', 'MsSense.exe', 'SecurityHealthService',
  'MpCmdRun.exe', 'NisSrv.exe',
]

/**
 * 检查服务名是否受保护
 */
export function isServiceProtected(serviceName: string): { protected: boolean; reason?: string } {
  const lower = serviceName.toLowerCase()
  for (const ps of PROTECTED_SERVICES) {
    if (ps.name.toLowerCase() === lower || ps.displayName.toLowerCase() === lower) {
      return { protected: true, reason: ps.reason }
    }
  }
  return { protected: false }
}

/**
 * 检查任务路径是否受保护
 */
export function isTaskPathProtected(taskPath: string): { protected: boolean; reason?: string } {
  for (const tp of PROTECTED_TASK_PATHS) {
    if (taskPath.includes(tp)) {
      return { protected: true, reason: `${tp} 属于 Microsoft 系统关键任务，禁用可能影响系统正常运行` }
    }
  }
  return { protected: false }
}

/**
 * 检查注册表名称是否受保护（Winlogon 项等）
 */
export function isRegistryNameProtected(name: string): { protected: boolean; reason?: string } {
  if (PROTECTED_REGISTRY_NAMES.includes(name)) {
    return { protected: true, reason: `${name} 是 Windows 登录核心组件，禁用会导致系统无法正常启动` }
  }
  return { protected: false }
}

/**
 * 检查路径或名称是否匹配关键项模式
 */
export function isCriticalByPattern(name: string, path: string): { protected: boolean; reason?: string } {
  const nameLower = name.toLowerCase()
  const pathLower = path.toLowerCase()

  // 检查名称模式
  for (const pattern of CRITICAL_NAME_PATTERNS) {
    if (nameLower.includes(pattern)) {
      return { protected: true, reason: `${name} 是 Windows 系统核心进程，不可禁用` }
    }
  }

  // 检查路径模式
  for (const regex of CRITICAL_PATH_PATTERNS) {
    if (regex.test(pathLower)) {
      return { protected: true, reason: `${path} 是系统关键路径文件` }
    }
  }

  return { protected: false }
}
