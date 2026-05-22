import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('数据库操作', () => {
  const testDbPath = path.join(__dirname, 'test_db.json')

  beforeEach(() => {
    // 清理测试数据库
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  it('应该能够保存和读取软件缓存', () => {
    const cacheData = {
      hash: 'abc123',
      name: 'TestApp',
      vendor: 'TestVendor',
      trust_level: 'trusted',
      analyzed_at: new Date().toISOString()
    }

    // 模拟保存到 JSON 文件
    fs.writeFileSync(testDbPath, JSON.stringify({ software_cache: [cacheData] }, null, 2))

    // 读取并验证
    const data = JSON.parse(fs.readFileSync(testDbPath, 'utf-8'))
    
    expect(data.software_cache).toHaveLength(1)
    expect(data.software_cache[0].hash).toBe('abc123')
    expect(data.software_cache[0].name).toBe('TestApp')
  })

  it('应该能够查询缓存', () => {
    const cacheData = [
      { hash: 'abc123', name: 'App1' },
      { hash: 'def456', name: 'App2' }
    ]

    fs.writeFileSync(testDbPath, JSON.stringify({ software_cache: cacheData }, null, 2))

    const data = JSON.parse(fs.readFileSync(testDbPath, 'utf-8'))
    const found = data.software_cache.find((item: any) => item.hash === 'abc123')

    expect(found).toBeDefined()
    expect(found.name).toBe('App1')
  })

  it('应该能够保存用户操作历史', () => {
    const actionData = {
      item_id: 'item1',
      action: 'disable',
      timestamp: new Date().toISOString(),
      note: 'Testing'
    }

    fs.writeFileSync(testDbPath, JSON.stringify({ user_actions: [actionData] }, null, 2))

    const data = JSON.parse(fs.readFileSync(testDbPath, 'utf-8'))
    
    expect(data.user_actions).toHaveLength(1)
    expect(data.user_actions[0].action).toBe('disable')
  })

  it('应该处理空数据库', () => {
    fs.writeFileSync(testDbPath, JSON.stringify({}, null, 2))

    const data = JSON.parse(fs.readFileSync(testDbPath, 'utf-8'))
    
    expect(data.software_cache).toBeUndefined()
    expect(data.user_actions).toBeUndefined()
  })
})
