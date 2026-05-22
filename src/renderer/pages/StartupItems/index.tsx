import React, { useState, useEffect } from 'react'
import { Table, Tag, Switch, Button, Space, Input, Select, Empty, App, Tooltip, Drawer, Descriptions, Divider } from 'antd'
import { SearchOutlined, ReloadOutlined, DeleteOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAppStore } from '../../stores/appStore'
import { StartupItem } from '../../../shared/types'

const { Search } = Input
const { Option } = Select

const StartupItemsPage: React.FC = () => {
  const { message } = App.useApp()
  const { scanItems, setScanItems, isScanning, setIsScanning } = useAppStore()
  const [filteredItems, setFilteredItems] = useState<StartupItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StartupItem | null>(null)

  // 当扫描数据变化时更新过滤结果
  useEffect(() => {
    applyFilters()
  }, [scanItems, searchText, filterSource, filterStatus])

  // 应用筛选
  const applyFilters = () => {
    let result = [...scanItems]

    // 搜索过滤
    if (searchText) {
      const lowerSearch = searchText.toLowerCase()
      result = result.filter(item =>
        item.name.toLowerCase().includes(lowerSearch) ||
        item.path.toLowerCase().includes(lowerSearch) ||
        (item.description && item.description.toLowerCase().includes(lowerSearch))
      )
    }

    // 来源过滤
    if (filterSource !== 'all') {
      result = result.filter(item => item.source === filterSource)
    }

    // 状态过滤
    if (filterStatus !== 'all') {
      const enabled = filterStatus === 'enabled'
      result = result.filter(item => item.enabled === enabled)
    }

    setFilteredItems(result)
  }

  // 执行扫描
  const handleScan = async () => {
    setIsScanning(true)
    try {
      const result = await window.electronAPI.scanAll({
        scanRegistry: true,
        scanServices: true,
        scanScheduledTasks: true,
        scanStartupFolder: true
      })

      if (result.success && result.data) {
        // result.data 结构为 { items, count, duration }
        const items = Array.isArray(result.data.items) ? result.data.items : []
        setScanItems(items)
        message.success(`扫描完成，找到 ${result.data.count || items.length} 个启动项`)
      } else {
        message.error(result.error || '扫描失败')
      }
    } catch (error: any) {
      console.error('扫描失败:', error)
      message.error('扫描过程中发生错误: ' + error.message)
    } finally {
      setIsScanning(false)
    }
  }

  // 切换启动项状态
  const handleToggle = async (itemId: string, enabled: boolean) => {
    try {
      const result = await window.electronAPI.toggleStartupItem(itemId, !enabled)
      if (result.success) {
        setScanItems(prev =>
          prev.map(item =>
            item.id === itemId ? { ...item, enabled: !enabled } : item
          )
        )
        message.success(result.message || '操作成功')
      } else {
        message.error(result.error || '操作失败')
      }
    } catch (error: any) {
      message.error('操作失败: ' + error.message)
    }
  }

  // 查看详情
  const handleViewDetail = (record: StartupItem) => {
    setSelectedItem(record)
    setDetailVisible(true)
  }

  // 批量操作
  const handleBatchDisable = async () => {
    try {
      const itemsToDisable = filteredItems.filter(item => 
        selectedRowKeys.includes(item.id) && item.enabled
      )
      
      for (const item of itemsToDisable) {
        await window.electronAPI.toggleStartupItem(item.id, false)
      }
      
      setScanItems(prev =>
        prev.map(item =>
          selectedRowKeys.includes(item.id) ? { ...item, enabled: false } : item
        )
      )
      
      message.success(`已禁用 ${itemsToDisable.length} 个启动项`)
      setSelectedRowKeys([])
    } catch (error: any) {
      message.error('批量操作失败: ' + error.message)
    }
  }

  // 表格列定义
  const columns: ColumnsType<StartupItem> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
      sorter: (a, b) => a.name.localeCompare(b.name)
    },
    {
      title: '分类',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          registry: 'blue',
          service: 'green',
          scheduled_task: 'orange',
          startup_folder: 'purple',
          plugin: 'cyan'
        }
        const textMap: Record<string, string> = {
          registry: '注册表',
          service: '服务',
          scheduled_task: '计划任务',
          startup_folder: '启动文件夹',
          plugin: '插件'
        }
        return <Tag color={colorMap[type] || 'default'}>{textMap[type] || type}</Tag>
      },
      filters: [
        { text: '注册表', value: 'registry' },
        { text: '服务', value: 'service' },
        { text: '计划任务', value: 'scheduled_task' },
        { text: '启动文件夹', value: 'startup_folder' },
        { text: '插件', value: 'plugin' }
      ],
      onFilter: (value, record) => record.type === value
    },
    {
      title: '安全等级',
      dataIndex: 'securityLevel',
      key: 'securityLevel',
      width: 100,
      render: (level: string) => {
        const config: Record<string, { icon: any; color: string; text: string }> = {
          safe: { icon: CheckCircleOutlined, color: 'success', text: '可信' },
          caution: { icon: WarningOutlined, color: 'warning', text: '可疑' },
          dangerous: { icon: CloseCircleOutlined, color: 'error', text: '恶意' }
        }
        const { icon: Icon, color, text } = config[level] || config.safe
        return (
          <Tooltip title={text}>
            <Tag icon={<Icon />} color={color}>{text}</Tag>
          </Tooltip>
        )
      }
    },
    {
      title: '建议',
      dataIndex: 'impact',
      key: 'impact',
      width: 100,
      render: (impact: string) => {
        const colorMap: Record<string, string> = {
          low: 'green',
          medium: 'orange',
          high: 'red'
        }
        const textMap: Record<string, string> = {
          low: '低影响',
          medium: '中影响',
          high: '高影响'
        }
        return <Tag color={colorMap[impact] || 'default'}>{textMap[impact] || impact}</Tag>
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
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: StartupItem) => (
        <Switch
          checked={enabled}
          onChange={() => handleToggle(record.id, enabled)}
          size="small"
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" type="link" icon={<InfoCircleOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button 
            size="small" 
            type="link" 
            danger
            onClick={() => handleToggle(record.id, record.enabled)}
            disabled={!record.enabled}
          >
            禁用
          </Button>
        </Space>
      )
    }
  ]

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    }
  }

  // 空状态
  if (scanItems.length === 0 && !isScanning) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Empty
          description="暂无扫描数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" icon={<ReloadOutlined />} onClick={handleScan} loading={isScanning}>
            开始扫描
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <div>
      {/* 工具栏 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Search
          placeholder="搜索名称、路径、描述..."
          prefix={<SearchOutlined />}
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
        
        <Select
          value={filterSource}
          onChange={setFilterSource}
          style={{ width: 120 }}
        >
          <Option value="all">全部来源</Option>
          <Option value="registry">注册表</Option>
          <Option value="service">服务</Option>
          <Option value="scheduled_task">计划任务</Option>
          <Option value="startup_folder">启动文件夹</Option>
          <Option value="plugin">插件</Option>
        </Select>

        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          style={{ width: 120 }}
        >
          <Option value="all">全部状态</Option>
          <Option value="enabled">已启用</Option>
          <Option value="disabled">已禁用</Option>
        </Select>

        <Button icon={<ReloadOutlined />} onClick={handleScan} loading={isScanning}>
          重新扫描
        </Button>

        {selectedRowKeys.length > 0 && (
          <Button danger icon={<DeleteOutlined />} onClick={handleBatchDisable}>
            批量禁用 ({selectedRowKeys.length})
          </Button>
        )}
      </Space>

      {/* 数据表格 */}
      <Table
        columns={columns}
        dataSource={filteredItems}
        rowKey="id"
        rowSelection={rowSelection}
        pagination={{ 
          pageSize: 50,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 项`
        }}
        scroll={{ x: 1200 }}
        loading={isScanning}
      />

      {/* 详情抽屉 */}
      <Drawer
        title="启动项详情"
        placement="right"
        width={600}
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
      >
        {selectedItem && (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="名称">{selectedItem.name}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag color="blue">{selectedItem.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="安全等级">
                <Tag color={
                  selectedItem.securityLevel === 'safe' ? 'success' :
                  selectedItem.securityLevel === 'caution' ? 'warning' : 'error'
                }>
                  {selectedItem.securityLevel}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedItem.enabled ? 'success' : 'default'}>
                  {selectedItem.enabled ? '已启用' : '已禁用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="路径">{selectedItem.path}</Descriptions.Item>
              <Descriptions.Item label="描述">{selectedItem.description || '无'}</Descriptions.Item>
              <Descriptions.Item label="发布者">{selectedItem.publisher || '未知'}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedItem.version || '未知'}</Descriptions.Item>
              <Descriptions.Item label="影响程度">
                <Tag color={
                  selectedItem.impact === 'low' ? 'success' :
                  selectedItem.impact === 'medium' ? 'warning' : 'error'
                }>
                  {selectedItem.impact}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="来源">{selectedItem.source || '未知'}</Descriptions.Item>
            </Descriptions>

            <Divider />

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                type="primary" 
                block 
                onClick={() => {
                  handleToggle(selectedItem.id, selectedItem.enabled)
                  setDetailVisible(false)
                }}
              >
                {selectedItem.enabled ? '禁用此启动项' : '启用此启动项'}
              </Button>
              <Button 
                block 
                onClick={() => {
                  if (selectedItem.path) {
                    window.electronAPI.openFileLocation(selectedItem.path)
                  }
                }}
              >
                打开文件位置
              </Button>
            </Space>
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default StartupItemsPage
