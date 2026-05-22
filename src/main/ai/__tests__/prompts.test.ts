import { describe, it, expect } from 'vitest'
import { promptBuilder } from '../../ai/prompts'

describe('AI 提示词构建', () => {
  it('应该正确构建软件分析提示词', () => {
    const softwareInfo = {
      name: 'TestApp',
      path: 'C:\\Program Files\\TestApp\\app.exe',
      description: 'A test application',
      signature: 'Valid',
      fileSize: 1024000
    }

    const prompt = promptBuilder.buildAnalyzeSoftware(softwareInfo)

    expect(prompt).toContain('TestApp')
    expect(prompt).toContain('C:\\Program Files\\TestApp\\app.exe')
    expect(prompt).toContain('JSON')
    expect(prompt).toContain('trust_level')
    expect(prompt).toContain('necessity')
  })

  it('应该支持中文提示词', () => {
    const softwareInfo = {
      name: '测试应用',
      path: 'C:\\测试\\app.exe',
      description: '这是一个测试应用',
      signature: '有效',
      fileSize: 512000
    }

    const prompt = promptBuilder.buildAnalyzeSoftware(softwareInfo, 'zh')

    expect(prompt).toContain('测试应用')
    expect(prompt).toContain('可信度')
    expect(prompt).toContain('必要性')
  })

  it('应该正确处理缺失字段', () => {
    const softwareInfo = {
      name: 'UnknownApp',
      path: '',
      description: '',
      signature: '',
      fileSize: 0
    }

    const prompt = promptBuilder.buildAnalyzeSoftware(softwareInfo)

    expect(prompt).toContain('UnknownApp')
    // 应该能处理空值而不崩溃
    expect(prompt).toBeDefined()
  })
})

describe('安全威胁分析提示词', () => {
  it('应该构建安全分析提示词', () => {
    const suspiciousInfo = {
      name: 'SuspiciousApp',
      path: 'C:\\Temp\\unknown.exe',
      hash: 'abc123',
      noSignature: true
    }

    const prompt = promptBuilder.buildSecurityAnalysis(suspiciousInfo)

    expect(prompt).toContain('SuspiciousApp')
    expect(prompt).toContain('risk_level')
    expect(prompt).toContain('indicators')
  })
})

describe('性能优化提示词', () => {
  it('应该构建性能优化提示词', () => {
    const systemInfo = {
      totalItems: 50,
      enabledCount: 30,
      bootTimeSeconds: 45
    }

    const items = [
      { name: 'App1', impact: 'high' },
      { name: 'App2', impact: 'medium' }
    ]

    const prompt = promptBuilder.buildPerformanceOptimize(items as any, systemInfo as any)

    expect(prompt).toContain('boot_time_breakdown')
    expect(prompt).toContain('optimization_plan')
    expect(prompt).toContain('expected_result')
  })
})
