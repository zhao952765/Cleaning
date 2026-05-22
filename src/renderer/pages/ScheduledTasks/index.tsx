import React, { useState, useMemo } from 'react'
import { Table, Button, Space, Tag, App, Input, Select, Empty } from 'antd'
import { ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'
import type { ColumnsType } from 'antd/es/table'
import { StartupItem } from '../../../shared/types'

const ScheduledTasksPage: React.FC = () => {
  const { message } = App.useApp()
  const { scanItems, setScanItems } = useAppStore()
  const [searchText, setSearchText] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // 从 scanItems 中筛选出计划任务
  const tasks = useMemo(() => {
    let items = scanItems.filter(i => i.source === 'task')
    if (searchText) {
      const ls = searchText.toLowerCase()
      items = items.filter(i => i.name.toLowerCase().includes(ls) || (i.description || '').toLowerCase().includes(ls))
    }
    if (filterStatus === 'enabled') items = items.filter(i => i.enabled)
    else if (filterStatus === 'disabled') items = items.filter(i => !i.enabled)
    return items
  }, [scanItems, searchText, filterStatus])

  const handleToggle = async (record: StartupItem) => {
    try {
      const r = await window.electronAPI.toggleStartupItem(record, !record.enabled)
      if (r.success) {
        const updated = scanItems.map(i => i.id === record.id ? { ...i, enabled: !record.enabled } : i)
        setScanItems(updated)
        message.success(`已${record.enabled ? '禁用' : '启用'}: ${record.name}`)
      } else message.error(r.error || '操作失败')
    } catch (e: any) { message.error('操作失败: ' + e.message) }
  }

  const columns: ColumnsType<StartupItem> = [
    { title: '任务名称', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
    {
      title: '触发器', dataIndex: 'triggerSummary', key: 'trigger', width: 180,
      render: (v: string) => v ? <span><ClockCircleOutlined style={{ marginRight: 4 }} />{v}</span> : <span style={{ color: '#999' }}>-</span>
    },
    { title: '描述', dataIndex: 'description', key: 'desc', ellipsis: true },
    { title: '路径', dataIndex: 'path', key: 'path', ellipsis: true, render: (p: string) => <span style={{ fontSize: 12, color: '#666' }}>{p}</span> },
    {
      title: '状态', dataIndex: 'enabled', key: 'status', width: 80,
      render: (e: boolean, r: StartupItem) => (
        r.isProtected
          ? <Tag color="red">保护</Tag>
          : <Tag color={e ? 'success' : 'default'}>{e ? '已启用' : '已禁用'}</Tag>
      )
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_, r) => (
        <Space>
          {r.isProtected
            ? <Tag color="red" style={{ cursor: 'pointer' }} title={r.protectedReason}>系统保护</Tag>
            : <Button size="small" type={r.enabled ? 'default' : 'primary'} onClick={() => handleToggle(r)}>
                {r.enabled ? '禁用' : '启用'}
              </Button>
          }
        </Space>
      )
    }
  ]

  if (tasks.length === 0 && scanItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Empty description="暂无计划任务数据" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <p style={{ color: '#999' }}>请先在首页或启动项页面执行扫描</p>
        </Empty>
      </div>
    )
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search placeholder="搜索任务名称、描述..." allowClear
          value={searchText} onChange={(e) => setSearchText((e as any).target?.value || '')} style={{ width: 280 }} />
        <Select value={filterStatus} onChange={v => setFilterStatus(v)} style={{ width: 110 }}>
          <Select.Option value="all">全部状态</Select.Option>
          <Select.Option value="enabled">已启用</Select.Option>
          <Select.Option value="disabled">已禁用</Select.Option>
        </Select>
        <Button type="primary" icon={<ReloadOutlined />} onClick={() => window.location.hash = '#/startup-items'}>
          执行扫描
        </Button>
        <Tag>{tasks.length} 个计划任务</Tag>
      </Space>

      <Table columns={columns} dataSource={tasks} rowKey="id" pagination={{ pageSize: 50, showTotal: t => `共 ${t} 项` }}
        scroll={{ x: 900 }} size="middle" />
    </div>
  )
}

export default ScheduledTasksPage
