import React, { useState } from 'react'
import { Table, Button, Space, Tag, Modal, App, Input, Select, Tooltip, Popconfirm, Drawer } from 'antd'
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  StopOutlined,
  LockOutlined,
  SettingOutlined
} from '@ant-design/icons'
import DetailPanel from '../../components/DetailPanel'
import type { ColumnsType } from 'antd/es/table'

interface Service {
  id: string
  name: string
  displayName: string
  description?: string
  startType: 'auto' | 'auto_delayed' | 'manual' | 'disabled'
  status: 'running' | 'stopped' | 'paused'
  path?: string
  isSystemCritical?: boolean
  memoryUsage?: number
}

// 模拟数据
const mockServices: Service[] = [
  {
    id: '1',
    name: 'Windows Update',
    displayName: 'Windows Update',
    description: '启用检测、下载和安装 Windows 和其他程序的更新',
    startType: 'auto',
    status: 'running',
    isSystemCritical: true,
    memoryUsage: 45
  },
  {
    id: '2',
    name: 'Spooler',
    displayName: 'Print Spooler',
    description: '将文件加载到内存中以便稍后打印',
    startType: 'auto',
    status: 'running',
    memoryUsage: 12
  },
  {
    id: '3',
    name: 'WSearch',
    displayName: 'Windows Search',
    description: '为文件、电子邮件和其他内容提供内容索引、属性缓存和搜索结果',
    startType: 'auto_delayed',
    status: 'running',
    memoryUsage: 89
  },
  {
    id: '4',
    name: 'AdobeARMservice',
    displayName: 'Adobe Acrobat Update Service',
    description: 'Adobe Acrobat Reader 更新服务',
    startType: 'auto',
    status: 'stopped',
    memoryUsage: 0
  },
]

const ServicesPage: React.FC = () => {
  const { message } = App.useApp()
  const [services, setServices] = useState<Service[]>(mockServices)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [searchText, setSearchText] = useState('')
  const [filterStartType, setFilterStartType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // 启动类型标签配置
  const getStartTypeTag = (type: string) => {
    const config = {
      auto: { color: 'red', text: '自动' },
      auto_delayed: { color: 'orange', text: '自动(延迟)' },
      manual: { color: 'blue', text: '手动' },
      disabled: { color: 'default', text: '禁用' }
    }
    const c = config[type as keyof typeof config]
    return <Tag color={c.color}>{c.text}</Tag>
  }

  // 状态标签配置
  const getStatusTag = (status: string) => {
    const config = {
      running: { color: 'success', text: '运行中', dot: true },
      stopped: { color: 'default', text: '已停止' },
      paused: { color: 'warning', text: '已暂停' }
    }
    const c = config[status as keyof typeof config]
    return (
      <Tag color={c.color}>
        {c.dot && <span style={{ marginRight: 4 }}>●</span>}
        {c.text}
      </Tag>
    )
  }

  // 表格列定义
  const columns: ColumnsType<Service> = [
    {
      title: '名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 200,
      ellipsis: true,
      render: (text, record) => (
        <Space>
          {record.isSystemCritical && <LockOutlined style={{ color: '#f5222d' }} />}
          <Tooltip title={text}>
            <span style={{ fontWeight: 500 }}>{text}</span>
          </Tooltip>
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true
    },
    {
      title: '启动类型',
      dataIndex: 'startType',
      key: 'startType',
      width: 120,
      render: getStartTypeTag
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: getStatusTag
    },
    {
      title: '内存占用',
      dataIndex: 'memoryUsage',
      key: 'memoryUsage',
      width: 100,
      render: (mb?: number) => mb ? `${mb} MB` : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === 'running' ? (
            <Popconfirm
              title="确定要停止此服务吗？"
              onConfirm={() => handleStopService(record)}
            >
              <Button size="small" danger icon={<StopOutlined />}>
                停止
              </Button>
            </Popconfirm>
          ) : (
            <Button 
              size="small" 
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartService(record)}
            >
              启动
            </Button>
          )}
          <Button 
            size="small" 
            onClick={() => handleShowDetail(record)}
          >
            详情
          </Button>
          {!record.isSystemCritical && (
            <Select
              size="small"
              value={record.startType}
              style={{ width: 100 }}
              onChange={(value) => handleChangeStartType(record, value)}
            >
              <Select.Option value="auto">自动</Select.Option>
              <Select.Option value="manual">手动</Select.Option>
              <Select.Option value="disabled">禁用</Select.Option>
            </Select>
          )}
        </Space>
      )
    }
  ]

  // 启动服务
  const handleStartService = async (service: Service) => {
    try {
      // TODO: 调用实际 API
      // await window.electronAPI.startService(service.id)
      
      setServices(prev => prev.map(s => 
        s.id === service.id ? { ...s, status: 'running' } : s
      ))
      
      message.success(`已启动服务: ${service.displayName}`)
    } catch (error) {
      message.error('启动失败')
    }
  }

  // 停止服务
  const handleStopService = async (service: Service) => {
    try {
      // TODO: 调用实际 API
      // await window.electronAPI.stopService(service.id)
      
      setServices(prev => prev.map(s => 
        s.id === service.id ? { ...s, status: 'stopped' } : s
      ))
      
      message.success(`已停止服务: ${service.displayName}`)
    } catch (error) {
      message.error('停止失败')
    }
  }

  // 修改启动类型
  const handleChangeStartType = async (service: Service, newType: string) => {
    if (service.isSystemCritical) {
      message.warning('系统关键服务不能修改启动类型')
      return
    }

    Modal.confirm({
      title: '确认修改',
      content: `确定要将 "${service.displayName}" 的启动类型改为${
        newType === 'auto' ? '自动' : newType === 'manual' ? '手动' : '禁用'
      }吗？`,
      onOk: async () => {
        try {
          // TODO: 调用实际 API
          // await window.electronAPI.changeServiceStartType(service.id, newType)
          
          setServices(prev => prev.map(s => 
            s.id === service.id ? { ...s, startType: newType as any } : s
          ))
          
          message.success('修改成功')
        } catch (error) {
          message.error('修改失败')
        }
      }
    })
  }

  // 显示详情
  const handleShowDetail = (service: Service) => {
    setSelectedService(service)
    setDetailVisible(true)
  }

  // 打开服务管理器
  const handleOpenServicesManager = async () => {
    try {
      // 使用 Windows 命令打开服务管理器
      await window.electronAPI.openFileLocation('services.msc')
      message.success('正在打开服务管理器...')
    } catch (error: any) {
      console.error('打开服务管理器失败:', error)
      message.error('打开服务管理器失败: ' + error.message)
    }
  }

  // 筛选后的数据
  const filteredServices = services.filter(service => {
    const matchSearch = !searchText || 
      service.displayName.toLowerCase().includes(searchText.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchText.toLowerCase()) ||
      service.path?.toLowerCase().includes(searchText.toLowerCase())
    
    const matchStartType = filterStartType === 'all' || service.startType === filterStartType
    const matchStatus = filterStatus === 'all' || service.status === filterStatus
    
    return matchSearch && matchStartType && matchStatus
  })

  return (
    <div style={{ padding: '24px' }}>
      {/* 工具栏 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Input.Search
            placeholder="搜索服务名称、描述或路径"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            value={filterStartType}
            onChange={setFilterStartType}
            style={{ width: 130 }}
          >
            <Select.Option value="all">所有启动类型</Select.Option>
            <Select.Option value="auto">自动</Select.Option>
            <Select.Option value="auto_delayed">自动(延迟)</Select.Option>
            <Select.Option value="manual">手动</Select.Option>
            <Select.Option value="disabled">禁用</Select.Option>
          </Select>
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 120 }}
          >
            <Select.Option value="all">所有状态</Select.Option>
            <Select.Option value="running">运行中</Select.Option>
            <Select.Option value="stopped">已停止</Select.Option>
            <Select.Option value="paused">已暂停</Select.Option>
          </Select>
        </Space>
        
        <Space>
          <Button icon={<SettingOutlined />}>
            打开服务管理器
          </Button>
        </Space>
      </div>

      {/* 优化建议横幅 */}
      <div style={{ marginBottom: 16 }}>
        <Tag color="blue" style={{ fontSize: 14, padding: '8px 16px' }}>
          💡 发现 3 个可安全改为手动启动的服务，点击查看详情
        </Tag>
      </div>

      {/* 数据表格 */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredServices}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys
        }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个服务`
        }}
        scroll={{ x: 1200 }}
      />

      {/* 详情面板 */}
      {selectedService && (
        <Drawer
          title="服务详情"
          placement="right"
          width={600}
          onClose={() => setDetailVisible(false)}
          open={detailVisible}
        >
          <div style={{ padding: '0 16px' }}>
            <h4>基本信息</h4>
            <p><strong>显示名称：</strong>{selectedService.displayName}</p>
            <p><strong>服务名称：</strong>{selectedService.name}</p>
            <p><strong>描述：</strong>{selectedService.description || '无'}</p>
            <p><strong>可执行文件：</strong>{selectedService.path || '未知'}</p>
            
            <h4>状态信息</h4>
            <p><strong>启动类型：</strong>{getStartTypeTag(selectedService.startType)}</p>
            <p><strong>当前状态：</strong>{getStatusTag(selectedService.status)}</p>
            <p><strong>内存占用：</strong>{selectedService.memoryUsage ? `${selectedService.memoryUsage} MB` : '未知'}</p>
            
            <h4>依赖关系</h4>
            <p>依赖服务：无</p>
            <p>被依赖服务：无</p>
            
            <div style={{ marginTop: 24 }}>
              <Space>
                {selectedService.status === 'running' ? (
                  <Button danger onClick={() => handleStopService(selectedService)}>
                    停止服务
                  </Button>
                ) : (
                  <Button type="primary" onClick={() => handleStartService(selectedService)}>
                    启动服务
                  </Button>
                )}
                <Button icon={<SettingOutlined />} onClick={handleOpenServicesManager}>
                  打开服务管理器
                </Button>
              </Space>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  )
}

export default ServicesPage
