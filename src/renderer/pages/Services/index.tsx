import React, { useState, useMemo } from 'react'
import { Table, Button, Space, Tag, App, Input, Select, Empty, Tooltip } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined, LockOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import type { ColumnsType } from 'antd/es/table'
import { StartupItem } from '../../../shared/types'

const ServicesPage: React.FC = () => {
  const { message } = App.useApp()
  const { scanItems, setScanItems } = useAppStore()
  const [searchText, setSearchText] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // 从 scanItems 中筛选出服务
  const services = useMemo(() => {
    let items = scanItems.filter(i => i.source === 'service')
    if (searchText) {
      const ls = searchText.toLowerCase()
      items = items.filter(i => i.name.toLowerCase().includes(ls) || (i.description || '').toLowerCase().includes(ls))
    }
    if (filterStatus === 'running') items = items.filter(i => i.enabled)
    else if (filterStatus === 'stopped') items = items.filter(i => !i.enabled)
    return items
  }, [scanItems, searchText, filterStatus])

  const handleToggle = async (record: StartupItem) => {
    try {
      const r = await window.electronAPI.toggleStartupItem(record, !record.enabled)
      if (r.success) {
        const updated = scanItems.map(i => i.id === record.id ? { ...i, enabled: !record.enabled } : i)
        setScanItems(updated)
        message.success(`已${record.enabled ? '停止' : '启动'}: ${record.name}`)
      } else message.error(r.error || '操作失败')
    } catch (e: any) { message.error('操作失败: ' + e.message) }
  }

  const columns: ColumnsType<StartupItem> = [
    { title: '显示名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
    { title: '描述', dataIndex: 'description', key: 'desc', ellipsis: true },
    {
      title: '状态', dataIndex: 'enabled', key: 'status', width: 80,
      render: (e: boolean, r: StartupItem) => (
        r.isProtected
          ? <Tag color="red" icon={<LockOutlined />}>保护</Tag>
          : <Tag color={e ? 'success' : 'default'} icon={e ? <PlayCircleOutlined /> : <PauseCircleOutlined />}>
              {e ? '运行中' : '已停止'}
            </Tag>
      )
    },
    {
      title: '影响', dataIndex: 'impact', key: 'impact', width: 80,
      render: (v: string) => {
        const c: Record<string, string> = { high: 'red', medium: 'orange', low: 'green' }
        return <Tag color={c[v] || 'default'}>{v === 'high' ? '高' : v === 'medium' ? '中' : '低'}</Tag>
      }
    },
    { title: '路径', dataIndex: 'path', key: 'path', ellipsis: true, render: (p: string) => <span style={{ fontSize: 12, color: '#666' }}>{p}</span> },
    {
      title: '操作', key: 'action', width: 120,
      render: (_, r) => (
        r.isProtected
          ? <Tooltip title={r.protectedReason}><Tag color="red" style={{ cursor: 'pointer' }}>系统保护</Tag></Tooltip>
          : <Button size="small" type={r.enabled ? 'default' : 'primary'} onClick={() => handleToggle(r)}>
              {r.enabled ? '停止' : '启动'}
            </Button>
      )
    }
  ]

  if (services.length === 0 && scanItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Empty description="暂无服务数据" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <p style={{ color: '#999' }}>请先在首页或启动项页面执行扫描</p>
        </Empty>
      </div>
    )
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search placeholder="搜索服务名称、描述..." allowClear
          value={searchText} onChange={(e) => setSearchText((e as any).target?.value || '')} style={{ width: 280 }} />
        <Select value={filterStatus} onChange={v => setFilterStatus(v)} style={{ width: 110 }}>
          <Select.Option value="all">全部状态</Select.Option>
          <Select.Option value="running">运行中</Select.Option>
          <Select.Option value="stopped">已停止</Select.Option>
        </Select>
        <Button type="primary" icon={<ReloadOutlined />} onClick={() => window.location.hash = '#/startup-items'}>
          执行扫描
        </Button>
        <Tag>{services.length} 个服务</Tag>
      </Space>

      <Table columns={columns} dataSource={services} rowKey="id" pagination={{ pageSize: 50, showTotal: t => `共 ${t} 项` }}
        scroll={{ x: 900 }} size="middle" />
    </div>
  )
}

export default ServicesPage
