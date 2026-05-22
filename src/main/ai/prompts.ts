import { StartupItem, FileInfo } from '../../shared/types'
import { SystemInfo } from '../../shared/types'

/**
 * AI 提示词模板系统
 * 支持变量插值和国际化
 */

// 提示词模板接口
export interface PromptTemplate {
  zh: string  // 中文
  en: string  // 英文
}

// ============================================================
// 增强的 System Prompt —— 启动项综合分析系统提示词
// 要求 AI：评估风险、判断是否可禁用、给出中文理由、识别常见软件
// 输出严格 JSON 格式
// ============================================================
export const STARTUP_ANALYSIS_SYSTEM_PROMPT = `你是一位专业的 Windows 系统启动项分析专家。你的任务是为每个 Windows 启动项提供安全、实用、精准的分析评估。

## 核心能力
1. **安全风险评估**：评估启动项的安全风险等级（Low / Medium / High / Critical）
2. **可禁用性判断**：明确判断该启动项是否可以安全禁用
3. **常见软件识别**：识别常见软件（如 WeChat、QQ、NVIDIA、Steam、Adobe、Microsoft Office、百度网盘、迅雷、钉钉、企业微信 等），基于其真实功能给出建议
4. **中文建议**：用简洁的中文提供禁用理由和操作建议

## 分析维度

### 1. 风险评估 (risk_level)
- **Critical**: 系统核心组件、安全软件、驱动程序，禁用可能导致系统崩溃或安全风险
- **High**: 系统服务、硬件驱动相关，禁用可能影响部分功能
- **Medium**: 第三方软件的自动更新、后台服务等，禁用通常安全但可能失去某些功能
- **Low**: 用户软件的自启项、不需要的后台进程，可以安全禁用

### 2. 可禁用性 (can_disable)
- 系统关键进程（explorer.exe、svchost.exe 等）→ false
- 杀毒软件、安全中心 → false
- 硬件驱动相关 → false
- 用户软件自启 → true（建议保留常用软件）
- 更新程序 → true（建议手动更新）
- 广告/推广软件 → true（强烈建议禁用）

### 3. 常见软件处理参考
- WeChat/微信: 保留自启较为方便，但禁用不影响使用
- NVIDIA: 驱动面板建议保留，游戏优化可禁用
- Steam: 游戏平台，建议禁用自启，按需启动
- Adobe: Creative Cloud 可禁用，更新服务可保留
- 百度网盘/迅雷: 建议禁用自启
- 钉钉/企业微信: 建议禁用自启，按需启动
- 输入法（搜狗/百度等）: 建议保留，但如不需要可禁用

## 输出格式
你必须严格按照以下 JSON 格式返回，不要添加任何其他内容：

{
  "item_name": "启动项名称",
  "risk_level": "low|medium|high|critical",
  "can_disable": true/false,
  "disable_warning": "如果 can_disable 为 false，这里写明为什么不能禁用；否则为 null",
  "reason": "用一段中文说明分析理由，指出这是哪类软件（如果识别出具体软件，直接说名称和功能）",
  "suggestion": "用一段中文给出明确的操作建议",
  "risk_score": 0-100 的数值评分（越高越危险）
}`

// ============================================================
// 批量分析提示词（10 项合并调用，节省 token）
// ============================================================
export const BATCH_ANALYSIS_SYSTEM_PROMPT = `你是一位专业的 Windows 系统启动项分析专家。我将给你一批启动项（最多 10 个），请对每个启动项逐一进行分析评估。

## 分析要求
对每个启动项，评估以下内容：
1. **安全风险等级** (riskLevel): Low / Medium / High / Critical
2. **是否可安全禁用** (canDisable): true / false
3. **禁用警告** (disableWarning): 如果不能禁用，写明原因
4. **分析理由** (reason): 用中文说明，识别出常见软件请直接说出名称和功能
5. **操作建议** (suggestion): 用中文给出明确建议
6. **风险评分** (riskScore): 0-100 的数值

## 输出格式
返回一个 JSON 对象，包含：

{
  "items": [
    {
      "itemId": "启动项唯一 ID",
      "name": "启动项名称",
      "riskLevel": "low|medium|high|critical",
      "canDisable": true/false,
      "disableWarning": "警告信息或 null",
      "reason": "分析理由",
      "suggestion": "操作建议",
      "riskScore": 0-100
    }
  ],
  "summary": "对整个批次的分析总结",
  "totalOptimizable": "建议优化的项目数量"
}

确保 items 数组的长度与输入的数量一致，不要遗漏任何项目。`

// ============================================================
// 所有提示词模板
// ============================================================
export const PROMPTS: Record<string, PromptTemplate> = {
  // 软件分析提示词
  analyzeSoftware: {
    zh: `请分析以下 Windows 启动项软件，并以 JSON 格式返回结果：

软件信息：
- 名称：{software_name}
- 路径：{file_path}
- 描述：{description}
- 公司：{company}
- 版本：{version}
- 文件大小：{file_size} bytes
- 签名状态：{signature_status}
- 签名者：{signer_name}

请严格按照以下 JSON 格式返回（不要添加其他内容）：
{{
  "software_name": "软件名称",
  "vendor": "开发商/发布者",
  "category": "类别（如：系统工具/云存储/游戏平台/驱动程序等）",
  "description": "用1-2句话通俗易懂地说明这个软件的功能",
  "features": ["功能点1", "功能点2"],
  "trust_level": "trusted|mostly_trusted|unknown|suspicious|malicious",
  "trust_reason": "评级的具体依据",
  "necessity": "required|recommended|optional|not_recommended|must_disable",
  "necessity_reason": "判断依据和理由",
  "disable_impact": "禁用后会产生什么具体影响",
  "performance_impact": {{
    "boot_time_ms": 500,
    "memory_mb": 50,
    "cpu_percent": 1.5
  }},
  "recommendation": "keep|disable|delay|uninstall",
  "recommendation_reason": "操作建议的详细理由",
  "related_hardware": ["关联硬件1"],
  "alternatives": ["替代方案1"],
  "warnings": ["注意事项1"],
  "tags": ["标签1", "标签2"]
}}`,

    en: `Please analyze the following Windows startup item and return results in JSON format:

Software Information:
- Name: {software_name}
- Path: {file_path}
- Description: {description}
- Company: {company}
- Version: {version}
- File Size: {file_size} bytes
- Signature Status: {signature_status}
- Signer: {signer_name}

Return strictly in the following JSON format (no additional content):
{{
  "software_name": "Software name",
  "vendor": "Developer/Publisher",
  "category": "Category (e.g., System Tool/Cloud Storage/Game Platform/Driver)",
  "description": "Briefly describe the software's function in 1-2 sentences",
  "features": ["Feature 1", "Feature 2"],
  "trust_level": "trusted|mostly_trusted|unknown|suspicious|malicious",
  "trust_reason": "Reason for trust rating",
  "necessity": "required|recommended|optional|not_recommended|must_disable",
  "necessity_reason": "Basis for necessity judgment",
  "disable_impact": "Specific impact after disabling",
  "performance_impact": {{
    "boot_time_ms": 500,
    "memory_mb": 50,
    "cpu_percent": 1.5
  }},
  "recommendation": "keep|disable|delay|uninstall",
  "recommendation_reason": "Detailed reason for recommendation",
  "related_hardware": ["Related hardware 1"],
  "alternatives": ["Alternative 1"],
  "warnings": ["Warning 1"],
  "tags": ["Tag 1", "Tag 2"]
}}`
  },

  // 安全威胁分析提示词
  securityAnalysis: {
    zh: `请对以下可疑软件进行安全威胁分析，并以 JSON 格式返回结果：

软件信息：
- 名称：{software_name}
- 路径：{file_path}
- 公司：{company}
- 签名状态：{signature_status}
- 文件大小：{file_size} bytes
- 哈希值（MD5）：{md5}
- 哈希值（SHA256）：{sha256}

请严格按照以下 JSON 格式返回：
{{
  "risk_level": "low|medium|high|critical",
  "risk_score": 0-100,
  "file_path_risk": "文件路径的安全性分析",
  "behavior_analysis": "基于特征的行为分析",
  "network_analysis": "可能的网络行为分析",
  "indicators": ["异常指标1", "异常指标2"],
  "recommendation": {{
    "immediate_action": true/false,
    "action_options": ["建议操作1", "建议操作2"]
  }}
}}`,

    en: `Please perform a security threat analysis on the following suspicious software and return results in JSON format:

Software Information:
- Name: {software_name}
- Path: {file_path}
- Company: {company}
- Signature Status: {signature_status}
- File Size: {file_size} bytes
- Hash (MD5): {md5}
- Hash (SHA256): {sha256}

Return strictly in the following JSON format:
{{
  "risk_level": "low|medium|high|critical",
  "risk_score": 0-100,
  "file_path_risk": "Security analysis of file path",
  "behavior_analysis": "Behavioral analysis based on characteristics",
  "network_analysis": "Possible network behavior analysis",
  "indicators": ["Anomaly indicator 1", "Anomaly indicator 2"],
  "recommendation": {{
    "immediate_action": true/false,
    "action_options": ["Suggested action 1", "Suggested action 2"]
  }}
}}`
  },

  // 性能优化提示词
  performanceOptimize: {
    zh: `请分析以下 Windows 系统启动项并提供优化建议，以 JSON 格式返回：

系统信息：
- 操作系统：{os_version}
- 架构：{architecture}
- CPU：{cpu_model}
- 内存：{total_memory_mb} MB
- 当前开机时间：{current_boot_time_ms} ms

启动项列表（共 {total_items} 项）：
{startup_items_list}

请严格按照以下 JSON 格式返回：
{{
  "boot_time_breakdown": {{
    "total_ms": {current_boot_time_ms},
    "registry_ms": 3000,
    "services_ms": 5000,
    "tasks_ms": 2000,
    "folders_ms": 1000
  }},
  "slow_items": [
    {{
      "name": "启动项名称",
      "path": "路径",
      "impact_ms": 1500
    }}
  ],
  "optimization_plan": {{
    "quick_wins": ["可以快速优化的项目1"],
    "recommended_settings": ["推荐设置1"]
  }},
  "expected_result": {{
    "estimated_boot_reduction_ms": 5000,
    "estimated_boot_reduction_percent": 25
  }}
}}`,

    en: `Please analyze the following Windows system startup items and provide optimization suggestions in JSON format:

System Information:
- OS: {os_version}
- Architecture: {architecture}
- CPU: {cpu_model}
- Memory: {total_memory_mb} MB
- Current Boot Time: {current_boot_time_ms} ms

Startup Items List (Total: {total_items} items):
{startup_items_list}

Return strictly in the following JSON format:
{{
  "boot_time_breakdown": {{
    "total_ms": {current_boot_time_ms},
    "registry_ms": 3000,
    "services_ms": 5000,
    "tasks_ms": 2000,
    "folders_ms": 1000
  }},
  "slow_items": [
    {{
      "name": "Item name",
      "path": "Path",
      "impact_ms": 1500
    }}
  ],
  "optimization_plan": {{
    "quick_wins": ["Quick win 1"],
    "recommended_settings": ["Recommended setting 1"]
  }},
  "expected_result": {{
    "estimated_boot_reduction_ms": 5000,
    "estimated_boot_reduction_percent": 25
  }}
}}`
  },

  // 自然语言对话提示词
  chat: {
    zh: `你是一个专业的 Windows 启动项管理助手。请用简洁易懂的中文回答用户问题。

当前系统上下文：
- 操作系统：{os_version}
- 启动项总数：{total_items}
- 已启用：{enabled_count}
- 已禁用：{disabled_count}

用户问题：{user_query}

请直接回答问题，并引用相关的启动项信息。如果可能，提供 2-3 个相关的后续问题建议。`,

    en: `You are a professional Windows startup item management assistant. Please answer user questions in concise and easy-to-understand English.

Current system context:
- OS: {os_version}
- Total startup items: {total_items}
- Enabled: {enabled_count}
- Disabled: {disabled_count}

User question: {user_query}

Please answer the question directly and cite relevant startup item information. If possible, provide 2-3 related follow-up question suggestions.`
  }
}

/**
 * 构建批量分析用户消息内容
 * 将多个启动项信息格式化为表格文本
 */
function buildBatchAnalysisContent(items: Array<{
  id: string; name: string; path: string; description?: string;
  publisher?: string; source: string; enabled: boolean
}>): string {
  const header = '以下是需要分析的启动项列表：\n\n'
  const rows = items.map((item, i) =>
    `[${i + 1}]
  ID: ${item.id}
  名称: ${item.name}
  路径: ${item.path}
  描述: ${item.description || '无'}
  发布者: ${item.publisher || '未知'}
  来源: ${item.source}
  当前状态: ${item.enabled ? '已启用' : '已禁用'}
---`
  )
  return header + rows.join('\n')
}

/**
 * 提示词构建函数
 */
export class PromptBuilder {
  private language: 'zh' | 'en' = 'zh'

  constructor(language: 'zh' | 'en' = 'zh') {
    this.language = language
  }

  /**
   * 构建批量分析所需的内容
   */
  buildBatchAnalysisPrompt(items: Array<{
    id: string; name: string; path: string; description?: string;
    publisher?: string; source: string; enabled: boolean
  }>): { systemPrompt: string; userContent: string } {
    return {
      systemPrompt: BATCH_ANALYSIS_SYSTEM_PROMPT,
      userContent: buildBatchAnalysisContent(items)
    }
  }

  /**
   * 获取单个分析的 System Prompt
   */
  getSingleAnalysisSystemPrompt(): string {
    return STARTUP_ANALYSIS_SYSTEM_PROMPT
  }

  /**
   * 构建软件分析提示词
   */
  buildAnalyzePrompt(
    item: StartupItem,
    fileInfo?: FileInfo | null
  ): string {
    const template = PROMPTS.analyzeSoftware[this.language]
    
    const variables: Record<string, string> = {
      software_name: item.name,
      file_path: item.path,
      description: item.description || '未知',
      company: item.publisher || '未知',
      version: item.version || '未知',
      file_size: fileInfo ? fileInfo.fileSize.toString() : '未知',
      signature_status: fileInfo?.signature.status || 'unsigned',
      signer_name: fileInfo?.signature.signerName || '无'
    }

    return this.interpolate(template, variables)
  }

  /**
   * 构建安全分析提示词
   */
  buildSecurityPrompt(
    item: StartupItem,
    fileInfo?: FileInfo | null
  ): string {
    const template = PROMPTS.securityAnalysis[this.language]
    
    const variables: Record<string, string> = {
      software_name: item.name,
      file_path: item.path,
      company: item.publisher || '未知',
      signature_status: fileInfo?.signature.status || 'unsigned',
      file_size: fileInfo ? fileInfo.fileSize.toString() : '未知',
      md5: fileInfo?.md5 || '未知',
      sha256: fileInfo?.sha256 || '未知'
    }

    return this.interpolate(template, variables)
  }

  /**
   * 构建性能优化提示词
   */
  buildOptimizePrompt(
    items: StartupItem[],
    systemInfo: SystemInfo,
    currentBootTimeMs: number
  ): string {
    const template = PROMPTS.performanceOptimize[this.language]
    
    // 构建启动项列表字符串
    const itemsList = items
      .slice(0, 50) // 限制最多 50 项
      .map((item, index) => 
        `${index + 1}. ${item.name} (${item.path}) - ${item.enabled ? '启用' : '禁用'}`
      )
      .join('\n')

    const variables: Record<string, string> = {
      os_version: systemInfo.osVersion,
      architecture: systemInfo.architecture,
      cpu_model: systemInfo.cpuModel,
      total_memory_mb: (systemInfo.totalMemory / 1024 / 1024).toFixed(0),
      current_boot_time_ms: currentBootTimeMs.toString(),
      total_items: items.length.toString(),
      startup_items_list: itemsList
    }

    return this.interpolate(template, variables)
  }

  /**
   * 构建对话提示词
   */
  buildChatPrompt(
    query: string,
    systemInfo: SystemInfo,
    totalItems: number,
    enabledCount: number,
    disabledCount: number
  ): string {
    const template = PROMPTS.chat[this.language]
    
    const variables: Record<string, string> = {
      os_version: systemInfo.osVersion,
      total_items: totalItems.toString(),
      enabled_count: enabledCount.toString(),
      disabled_count: disabledCount.toString(),
      user_query: query
    }

    return this.interpolate(template, variables)
  }

  /**
   * 变量插值
   */
  private interpolate(template: string, variables: Record<string, string>): string {
    let result = template
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
    }
    return result
  }

  /**
   * 切换语言
   */
  setLanguage(language: 'zh' | 'en'): void {
    this.language = language
  }
}

/**
 * 导出单例实例
 */
export const promptBuilder = new PromptBuilder('zh')
