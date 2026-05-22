/// <reference types="../types/electron" />

import React, { useState } from 'react'
import { Card, Button, Table, Tag, App, Spin, Alert, Space } from 'antd'
import { ReloadOutlined, ThunderboltOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface StartupItem {
  id: string
  name: string
  path: string
  arguments?: string
  type: string
  enabled: boolean
  impact: string
}

const RegistryScannerDemo: React.FC = () => {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<StartupItem[]>([])
  const [scanResult, setScanResult] = useState<{
    count: number
    duration?: number
  } | null>(null)

  /**
   * 扫描注册表启动项
   */
  const handleScanRegistry = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.scanRegistry()
      
      if (result.success && Array.isArray(result.data)) {
        setItems(result.data)
        setScanResult({ count: result.count })
        message.success(`扫描完成，找到 ${result.count} 个注册表启动项`)
      } else {
        message.error(result.error || '扫描失败')
      }
    } catch (error) {
      console.error('扫描失败:', error)
      message.error('扫描过程中发生错误')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 执行完整扫描
   */
  const handleScanAll = async () => {
    setLoading(true)
    const startTime = Date.now()
    
    try {
      const result = await window.electronAPI.scanAll({
        scanRegistry: true,
        scanServices: true,
        scanScheduledTasks: true
      })
      
      const duration = Date.now() - startTime
      
      if (result.success && result.data) {
        // result.data 结构为 { items, count, duration }
        const items = Array.isArray(result.data.items) ? result.data.items : []
        setItems(items)
        setScanResult({ count: result.data.count || items.length, duration })
        message.success(
          `扫描完成，找到 ${result.data.count || items.length} 个启动项（耗时 ${duration}ms）`
        )
      } else {
        message.error(result.error || '扫描失败')
      }
    } catch (error) {
      console.error('扫描失败:', error)
      message.error('扫描过程中发生错误')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 切换启动项状态
   */
  const handleToggleItem = async (itemId: string, enabled: boolean) => {
    try {
      const result = await window.electronAPI.toggleStartupItem(itemId, !enabled)
      
      if (result.success) {
        // 更新本地状态
        setItems(prevItems =>
          prevItems.map(item =>
            item.id === itemId ? { ...item, enabled: !enabled } : item
          )
        )
        message.success(result.message || '操作成功')
      } else {
        message.error(result.error || '操作失败')
      }
    } catch (error) {
      console.error('切换状态失败:', error)
      message.error('操作失败')
    }
  }

  // 表格列定义
  const columns: ColumnsType<StartupItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      ellipsis: true
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          registry: 'blue',
          service: 'green',
          scheduled_task: 'orange'
        }
        return <Tag color={colorMap[type] || 'default'}>{type}</Tag>
      }
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (path: string) => (
        <span style={{ fontSize: '12px', color: '#666' }}>{path}</span>
      )
    },
    {
      title: '参数',
      dataIndex: 'arguments',
      key: 'arguments',
      width: 200,
      ellipsis: true,
      render: (args?: string) => (
        <span style={{ fontSize: '12px', color: '#999' }}>
          {args || '-'}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean) => (
        <Tag icon={enabled ? <ThunderboltOutlined /> : <CloseCircleOutlined />} color={enabled ? 'success' : 'error'}>
          {enabled ? '已启用' : '已禁用'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          size="small"
          type={record.enabled ? 'default' : 'primary'}
          onClick={() => handleToggleItem(record.id, record.enabled)}
        >
          {record.enabled ? '禁用' : '启用'}
        </Button>
      )
    }
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <ReloadOutlined />
            <span>Windows 启动项扫描器</span>
          </Space>
        }
        extra={
          <Space>
            <Button onClick={handleScanRegistry} loading={loading}>
              仅扫描注册表
            </Button>
            <Button type="primary" onClick={handleScanAll} loading={loading}>
              完整扫描
            </Button>
          </Space>
        }
      >
        {scanResult && (
          <Alert
            message={`扫描结果: 共找到 ${scanResult.count} 个启动项`}
            description={
              scanResult.duration 
                ? `扫描耗时: ${scanResult.duration}ms`
                : undefined
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={Array.isArray(items) ? items : []}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
            locale={{
              emptyText: loading ? '正在扫描...' : '暂无数据，请点击扫描按钮开始扫描'
            }}
          />
        </Spin>
      </Card>
    </div>
  )
}

export default RegistryScannerDemo
