import React, { useState } from 'react'
import { Table, Button, Space, Tag, Modal, App, Tooltip, Input, Select } from 'antd'
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  ClockCircleOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
  ExportOutlined,
  SettingOutlined
} from '@ant-design/icons'
import DetailPanel from '../../components/DetailPanel'
import type { ColumnsType } from 'antd/es/table'

interface ScheduledTask {
  id: string
  name: string
  path: string
  trigger: 'boot' | 'logon' | 'time' | 'event'
  nextRunTime?: string
  status: 'enabled' | 'disabled' | 'running'
  lastResult?: 'success' | 'failed' | 'not_run'
  description?: string
}

// 模拟数据
const mockTasks: ScheduledTask[] = [
  {
    id: '1',
    name: 'OneDrive Standalone Update Task',
    path: '\\Microsoft\\Windows\\OneDrive',
    trigger: 'logon',
    nextRunTime: '下次登录时',
    status: 'enabled',
    lastResult: 'success',
    description: 'OneDrive 更新任务'
  },
  {
    id: '2',
    name: 'Windows Defender Scheduled Scan',
    path: '\\Microsoft\\Windows\\Windows Defender',
    trigger: 'time',
    nextRunTime: '每天 02:00',
    status: 'enabled',
    lastResult: 'success',
    description: 'Windows Defender 定期扫描'
  },
  {
    id: '3',
    name: 'Adobe Acrobat Update Task',
    path: '\\Adobe\\Acrobat Update',
    trigger: 'boot',
    status: 'disabled',
    lastResult: 'not_run',
    description: 'Adobe Acrobat 更新检查'
  },
]

const ScheduledTasksPage: React.FC = () => {
  const { message } = App.useApp()
  const [tasks, setTasks] = useState<ScheduledTask[]>(mockTasks)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null)
  const [searchText, setSearchText] = useState('')
  const [filterTrigger, setFilterTrigger] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // 触发器图标映射
  const triggerIcons = {
    boot: <ThunderboltOutlined />,
    logon: <CalendarOutlined />,
    time: <ClockCircleOutlined />,
    event: <SettingOutlined />
  }

  // 状态标签颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'enabled': return 'green'
      case 'disabled': return 'default'
      case 'running': return 'processing'
      default: return 'default'
    }
  }

  // 最后结果标签
  const getResultTag = (result?: string) => {
    if (!result) return null
    const config = {
      success: { color: 'success', text: '成功' },
      failed: { color: 'error', text: '失败' },
      not_run: { color: 'default', text: '未运行' }
    }
    const c = config[result as keyof typeof config]
    return <Tag color={c.color}>{c.text}</Tag>
  }

  // 表格列定义
  const columns: ColumnsType<ScheduledTask> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Tooltip>
      )
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 200,
      ellipsis: true
    },
    {
      title: '触发器',
      dataIndex: 'trigger',
      key: 'trigger',
      width: 120,
      render: (trigger: string) => (
        <Space>
          {triggerIcons[trigger as keyof typeof triggerIcons]}
          <span>
            {trigger === 'boot' && '开机时'}
            {trigger === 'logon' && '登录时'}
            {trigger === 'time' && '定时'}
            {trigger === 'event' && '事件'}
          </span>
        </Space>
      )
    },
    {
      title: '下次运行',
      dataIndex: 'nextRunTime',
      key: 'nextRunTime',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status === 'enabled' && '已启用'}
          {status === 'disabled' && '已禁用'}
          {status === 'running' && '运行中'}
        </Tag>
      )
    },
    {
      title: '最后结果',
      dataIndex: 'lastResult',
      key: 'lastResult',
      width: 100,
      render: getResultTag
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button 
            size="small" 
            onClick={() => handleToggle(record)}
          >
            {record.status === 'enabled' ? '禁用' : '启用'}
          </Button>
          <Button 
            size="small" 
            onClick={() => handleShowDetail(record)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ]

  // 切换任务状态
  const handleToggle = async (task: ScheduledTask) => {
    try {
      const newStatus = task.status === 'enabled' ? 'disabled' : 'enabled'
      
      // TODO: 调用实际 API
      // await window.electronAPI.toggleTask(task.id, newStatus === 'enabled')
      
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: newStatus as any } : t
      ))
      
      message.success(`已${newStatus === 'enabled' ? '启用' : '禁用'}任务`)
    } catch (error) {
      message.error('操作失败')
    }
  }

  // 显示详情
  const handleShowDetail = (task: ScheduledTask) => {
    setSelectedTask(task)
    setDetailVisible(true)
  }

  // 批量操作
  const handleBatchToggle = async (enable: boolean) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择任务')
      return
    }

    Modal.confirm({
      title: '确认批量操作',
      content: `确定要${enable ? '启用' : '禁用'}选中的 ${selectedRowKeys.length} 个任务吗？`,
      onOk: async () => {
        try {
          // TODO: 调用批量 API
          setTasks(prev => prev.map(t => 
            selectedRowKeys.includes(t.id) ? { ...t, status: enable ? 'enabled' : 'disabled' as any } : t
          ))
          message.success('批量操作成功')
          setSelectedRowKeys([])
        } catch (error) {
          message.error('批量操作失败')
        }
      }
    })
  }

  // 导出数据
  const handleExport = () => {
    const dataStr = JSON.stringify(tasks, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'scheduled-tasks.json'
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }

  // 筛选后的数据
  const filteredTasks = tasks.filter(task => {
    const matchSearch = !searchText || 
      task.name.toLowerCase().includes(searchText.toLowerCase()) ||
      task.path.toLowerCase().includes(searchText.toLowerCase())
    
    const matchTrigger = filterTrigger === 'all' || task.trigger === filterTrigger
    const matchStatus = filterStatus === 'all' || task.status === filterStatus
    
    return matchSearch && matchTrigger && matchStatus
  })

  return (
    <div style={{ padding: '24px' }}>
      {/* 工具栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Input.Search
            placeholder="搜索任务名称或路径"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            value={filterTrigger}
            onChange={setFilterTrigger}
            style={{ width: 120 }}
          >
            <Select.Option value="all">所有触发器</Select.Option>
            <Select.Option value="boot">开机时</Select.Option>
            <Select.Option value="logon">登录时</Select.Option>
            <Select.Option value="time">定时</Select.Option>
            <Select.Option value="event">事件</Select.Option>
          </Select>
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 120 }}
          >
            <Select.Option value="all">所有状态</Select.Option>
            <Select.Option value="enabled">已启用</Select.Option>
            <Select.Option value="disabled">已禁用</Select.Option>
            <Select.Option value="running">运行中</Select.Option>
          </Select>
        </Space>
        
        <Space>
          {selectedRowKeys.length > 0 && (
            <>
              <Button onClick={() => handleBatchToggle(true)}>
                批量启用 ({selectedRowKeys.length})
              </Button>
              <Button onClick={() => handleBatchToggle(false)}>
                批量禁用
              </Button>
            </>
          )}
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      </div>

      {/* 数据表格 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredTasks}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys
        }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个任务`
        }}
        scroll={{ x: 1200 }}
      />

      {/* 详情面板 */}
      {selectedTask && (
        <DetailPanel
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          title={selectedTask.name}
          subtitle={selectedTask.path}
        >
          <div style={{ padding: '0 16px' }}>
            <h4>任务信息</h4>
            <p><strong>名称：</strong>{selectedTask.name}</p>
            <p><strong>路径：</strong>{selectedTask.path}</p>
            <p><strong>描述：</strong>{selectedTask.description || '无'}</p>
            
            <h4>触发器</h4>
            <p>类型：{selectedTask.trigger}</p>
            <p>下次运行：{selectedTask.nextRunTime || '未设置'}</p>
            
            <h4>状态</h4>
            <p>当前状态：{selectedTask.status}</p>
            <p>最后结果：{selectedTask.lastResult || '未知'}</p>
            
            <div style={{ marginTop: 24 }}>
              <Space>
                <Button 
                  type="primary"
                  onClick={() => handleToggle(selectedTask)}
                >
                  {selectedTask.status === 'enabled' ? '禁用任务' : '启用任务'}
                </Button>
                <Button icon={<PlayCircleOutlined />}>
                  立即运行
                </Button>
                <Button icon={<SettingOutlined />}>
                  打开任务计划程序
                </Button>
              </Space>
            </div>
          </div>
        </DetailPanel>
      )}
    </div>
  )
}

export default ScheduledTasksPage
