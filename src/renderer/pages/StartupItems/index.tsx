import React, { useState, useEffect } from 'react'
import {
  Table, Tag, Switch, Button, Space, Input, Select, Empty, App,
  Tooltip, Drawer, Descriptions, Divider, Modal, Progress, Alert, Card, Row, Col, Statistic
} from 'antd'
import {
  SearchOutlined, ReloadOutlined, DeleteOutlined, CheckCircleOutlined,
  WarningOutlined, CloseCircleOutlined, InfoCircleOutlined,
  SafetyCertificateOutlined, RobotOutlined, StopOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAppStore } from '../../stores/appStore'
import { StartupItem } from '../../../shared/types'

const { Search } = Input
const { Option } = Select

// AI 分析结果缓存（可能存在）
interface AIResultCache {
  [itemId: string]: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    canDisable: boolean
    disableWarning?: string
    reason: string
    suggestion: string
  }
}

const riskLevelConfig: Record<string, { color: string; text: string; icon: any }> = {
  low: { color: 'green', text: '低风险', icon: CheckCircleOutlined },
  medium: { color: 'orange', text: '中风险', icon: WarningOutlined },
  high: { color: 'red', text: '高风险', icon: CloseCircleOutlined },
  critical: { color: 'purple', text: '严重风险', icon: StopOutlined },
}

const StartupItemsPage: React.FC = () => {
  const { message } = App.useApp()
  const { scanItems, setScanItems, isScanning, setIsScanning } = useAppStore()

  // 筛选
  const [filteredItems, setFilteredItems] = useState<StartupItem[]>([])
  const [searchText, setSearchText] = useState('')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  // 详情
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StartupItem | null>(null)
  const [singleAnalyzing, setSingleAnalyzing] = useState(false)
  const [singleResult, setSingleResult] = useState<any>(null)

  // 批量 AI 分析
  const [aiResults, setAiResults] = useState<AIResultCache>({})
  const [batchAnalyzing, setBatchAnalyzing] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, message: '' })
  const [showResults, setShowResults] = useState(false)

  useEffect(() => { applyFilters() }, [scanItems, searchText, filterSource, filterStatus])

  const applyFilters = () => {
    let result = [...scanItems]
    if (searchText) {
      const ls = searchText.toLowerCase()
      result = result.filter(i =>
        i.name.toLowerCase().includes(ls) ||
        i.path.toLowerCase().includes(ls) ||
        (i.description && i.description.toLowerCase().includes(ls))
      )
    }
    if (filterSource !== 'all') result = result.filter(i => i.source === filterSource)
    if (filterStatus !== 'all') result = result.filter(i => i.enabled === (filterStatus === 'enabled'))
    setFilteredItems(result)
  }

  // ========== 扫描（带进度监听）==========
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; stage: string; message: string } | null>(null)

  const handleScan = async () => {
    setIsScanning(true)
    setScanProgress({ current: 0, total: 100, stage: 'init', message: '开始扫描...' })
    setAiResults({})

    // 监听进度
    const cleanup = window.electronAPI.onScanProgress?.((progress: any) => {
      setScanProgress({
        current: progress.current,
        total: progress.total,
        stage: progress.stage || '',
        message: progress.message || '',
      })
    })

    try {
      const r = await window.electronAPI.scanAll({ scanRegistry: true, scanServices: true, scanScheduledTasks: true, scanStartupFolder: true })
      if (r.success && r.data) {
        const items = Array.isArray(r.data.items) ? r.data.items : []
        setScanItems(items)
        message.success(`扫描完成，找到 ${r.data.count || items.length} 个启动项`)
      } else message.error(r.error || '扫描失败')
    } catch (e: any) { message.error('扫描错误: ' + e.message) }
    finally {
      setIsScanning(false)
      setScanProgress(null)
      if (cleanup) cleanup()
    }
  }

  // ========== 切换状态 ==========
  const handleToggle = async (record: StartupItem, enabled: boolean) => {
    try {
      const r = await window.electronAPI.toggleStartupItem(record, !enabled)
      if (r.success) {
        if (r.requireConfirm) {
          // 关键项二次确认
          Modal.confirm({
            title: '⚠️ 系统关键项',
            content: r.warning,
            okText: '确认禁用',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
              const forceR = await window.electronAPI.toggleStartupItemForce(record, false)
              if (forceR.success) {
                const updated = scanItems.map(i => i.id === record.id ? { ...i, enabled: false } : i)
                setScanItems(updated)
                message.success(forceR.message || '已禁用')
              } else message.error(forceR.error || '禁用失败')
            }
          })
        } else {
          const updated = scanItems.map(i => i.id === record.id ? { ...i, enabled: !enabled } : i)
          setScanItems(updated)
          message.success(r.message || '操作成功')
        }
      } else message.error(r.error || '操作失败')
    } catch (e: any) { message.error('操作失败: ' + e.message) }
  }

  // ========== 查看详情 ==========
  const handleViewDetail = async (record: StartupItem) => {
    setSelectedItem(record)
    setSingleResult(null)
    setSingleAnalyzing(false)
    setDetailVisible(true)
  }

  // ========== 单个 AI 分析 ==========
  const handleSingleAnalyze = async () => {
    if (!selectedItem) return
    setSingleAnalyzing(true)
    setSingleResult(null)
    try {
      const r = await window.electronAPI.analyzeSingle(selectedItem)
      if (r.success && r.data) {
        setSingleResult(r.data)
        // 缓存结果
        setAiResults(prev => ({
          ...prev,
          [selectedItem.id]: {
            riskLevel: r.data.risk_level,
            canDisable: r.data.can_disable,
            reason: r.data.reason,
            suggestion: r.data.suggestion,
          }
        }))
      } else message.error(r.error || 'AI 分析失败')
    } catch (e: any) { message.error('AI 分析出错: ' + e.message) }
    finally { setSingleAnalyzing(false) }
  }

  // ========== 批量 AI 分析 ==========
  const handleBatchAnalyze = async () => {
    const itemsToAnalyze = filteredItems.filter(i => i.enabled)
    if (itemsToAnalyze.length === 0) {
      message.warning('没有已启用的启动项需要分析')
      return
    }

    setBatchAnalyzing(true)
    setBatchProgress({ current: 0, total: itemsToAnalyze.length, message: '准备分析...' })
    setShowResults(false)

    try {
      const r = await window.electronAPI.analyzeBatch(itemsToAnalyze)
      if (r.success && r.data) {
        // 缓存所有结果
        const newCache: AIResultCache = {}
        for (const item of r.data.items) {
          newCache[item.itemId] = {
            riskLevel: item.riskLevel,
            canDisable: item.canDisable,
            reason: item.reason,
            suggestion: item.suggestion,
          }
        }
        setAiResults(prev => ({ ...prev, ...newCache }))
        setShowResults(true)
        message.success(r.data.summary || 'AI 分析完成')
      } else message.error(r.error || '批量分析失败')
    } catch (e: any) { message.error('批量分析出错: ' + e.message) }
    finally { setBatchAnalyzing(false) }
  }

  // ========== 表格列 ==========
  const columns: ColumnsType<StartupItem> = [
    {
      title: '名称', dataIndex: 'name', key: 'name', width: 180, ellipsis: true,
      sorter: (a, b) => a.name.localeCompare(b.name)
    },
    {
      title: '分类', dataIndex: 'source', key: 'source', width: 110,
      render: (s: string) => {
        const m: Record<string, { t: string; c: string }> = {
          registry: { t: '注册表', c: 'blue' }, service: { t: '系统服务', c: 'red' },
          task: { t: '计划任务', c: 'green' }, folder: { t: '启动文件夹', c: 'orange' },
          driver: { t: '驱动程序', c: 'purple' }, shell: { t: 'Shell扩展', c: 'cyan' },
        }
        const c = m[s] || { t: s, c: 'default' }
        return <Tag color={c.c}>{c.t}</Tag>
      }
    },
    {
      title: 'AI 风险', key: 'risk', width: 120,
      render: (_, record) => {
        const result = aiResults[record.id]
        if (!result) return <Tag style={{ opacity: 0.6 }}>未分析</Tag>
        const cfg = riskLevelConfig[result.riskLevel] || riskLevelConfig.low
        const Icon = cfg.icon
        return (
          <Tooltip title={result.reason}>
            <Tag icon={<Icon />} color={cfg.color}>{cfg.text}</Tag>
          </Tooltip>
        )
      }
    },
    {
      title: '建议', key: 'suggestion', width: 140,
      render: (_, record) => {
        const result = aiResults[record.id]
        if (!result) return <span style={{ color: '#ccc' }}>-</span>
        return result.canDisable
          ? <Tag color="green">可禁用 ✓</Tag>
          : <Tooltip title={result.disableWarning || ''}><Tag color="red">保留</Tag></Tooltip>
      }
    },
    {
      title: '路径', dataIndex: 'path', key: 'path', ellipsis: true,
      render: (p: string) => <span style={{ fontSize: 12, color: '#666' }}>{p}</span>
    },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled', width: 70,
      render: (e: boolean, record: StartupItem) => (
        <Switch checked={e} onChange={() => handleToggle(record, e)} size="small" />
      )
    },
    {
      title: '操作', key: 'action', width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" type="link" icon={<InfoCircleOutlined />} onClick={() => handleViewDetail(record)}>详情</Button>
          <Button size="small" type="link" danger onClick={() => handleToggle(record, record.enabled)} disabled={!record.enabled}>禁用</Button>
        </Space>
      )
    }
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys)
  }

  // ========== 空状态 ==========
  if (scanItems.length === 0 && !isScanning) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Empty description="暂无扫描数据" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button type="primary" icon={<ReloadOutlined />} onClick={handleScan} loading={isScanning}>开始扫描</Button>
        </Empty>
      </div>
    )
  }

  const analyzedCount = Object.keys(aiResults).length
  const canDisableCount = Object.values(aiResults).filter(r => r.canDisable).length

  return (
    <div>
      {/* AI 分析结果概览 */}
      {showResults && (
        <Card size="small" style={{ marginBottom: 16, background: '#f6ffed' }}>
          <Row gutter={16} align="middle">
            <Col><SafetyCertificateOutlined style={{ fontSize: 24, color: '#52c41a' }} /></Col>
            <Col><Statistic title="已分析" value={analyzedCount} suffix={`/ ${filteredItems.length}`} /></Col>
            <Col><Statistic title="可安全禁用" value={canDisableCount} valueStyle={{ color: '#52c41a' }} /></Col>
            <Col>
              <Button type="link" onClick={() => setShowResults(false)}>收起</Button>
            </Col>
          </Row>
        </Card>
      )}

      {/* 工具条 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Search placeholder="搜索名称、路径、描述..." prefix={<SearchOutlined />} allowClear
          value={searchText} onChange={(e) => setSearchText((e as any).target?.value || '')} style={{ width: 280 }} />
        <Select value={filterSource} onChange={(v: string) => setFilterSource(v)} style={{ width: 110 }}>
          <Option value="all">全部来源</Option>
          <Option value="registry">注册表</Option>
          <Option value="service">服务</Option>
          <Option value="task">计划任务</Option>
          <Option value="folder">启动文件夹</Option>
        </Select>
        <Select value={filterStatus} onChange={(v: string) => setFilterStatus(v)} style={{ width: 110 }}>
          <Option value="all">全部状态</Option>
          <Option value="enabled">已启用</Option>
          <Option value="disabled">已禁用</Option>
        </Select>

        <Button icon={<ReloadOutlined />} onClick={handleScan} loading={isScanning}>扫描</Button>

        <Divider type="vertical" />

        {/* AI 分析按钮 */}
        <Button type="primary" icon={<RobotOutlined />} onClick={handleBatchAnalyze}
          loading={batchAnalyzing} disabled={filteredItems.length === 0}>
          AI 智能分析 {filteredItems.filter(i => i.enabled).length > 0 ? `(${filteredItems.filter(i => i.enabled).length}项)` : ''}
        </Button>

        {selectedRowKeys.length > 0 && (
          <Button danger icon={<DeleteOutlined />} onClick={async () => {
            for (const id of selectedRowKeys) {
              const item = scanItems.find(i => i.id === id)
              if (item && item.enabled) await handleToggle(item, true)
            }
            setSelectedRowKeys([])
            message.success(`已禁用 ${selectedRowKeys.length} 项`)
          }}>
            批量禁用 ({selectedRowKeys.length})
          </Button>
        )}
      </Space>

      {/* 扫描进度 */}
      {scanProgress && (
        <Card size="small" style={{ marginBottom: 12, background: '#e6f7ff' }}>
          <Progress
            percent={scanProgress.total > 0 ? Math.round((scanProgress.current / scanProgress.total) * 100) : 0}
            format={() => `${scanProgress.current}%`}
          />
          <div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>
            {scanProgress.stage && <Tag style={{ marginRight: 8 }}>{scanProgress.stage}</Tag>}
            {scanProgress.message}
          </div>
        </Card>
      )}

      {/* 批量 AI 分析进度 */}
      {batchAnalyzing && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Progress
            percent={batchProgress.total > 0 ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0}
            format={() => `${batchProgress.current}/${batchProgress.total}`}
          />
          <div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>{batchProgress.message}</div>
        </Card>
      )}

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={filteredItems}
        rowKey="id"
        rowSelection={rowSelection}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `共 ${t} 项` }}
        scroll={{ x: 1100 }}
        loading={isScanning}
      />

      {/* 详情抽屉 */}
      <Drawer title="启动项详情" placement="right" width={620} onClose={() => setDetailVisible(false)} open={detailVisible}>
        {selectedItem && (
          <div>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="名称">{selectedItem.name}</Descriptions.Item>
              <Descriptions.Item label="类型"><Tag color="blue">{selectedItem.type}</Tag></Descriptions.Item>
              <Descriptions.Item label="AI 风险">
                {aiResults[selectedItem.id] ? (
                  <Tag color={riskLevelConfig[aiResults[selectedItem.id].riskLevel]?.color}>
                    {riskLevelConfig[aiResults[selectedItem.id].riskLevel]?.text}
                  </Tag>
                ) : <span style={{ color: '#999' }}>未分析</span>}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={selectedItem.enabled ? 'success' : 'default'}>{selectedItem.enabled ? '已启用' : '已禁用'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="路径">{selectedItem.path}</Descriptions.Item>
              <Descriptions.Item label="描述">{selectedItem.description || '无'}</Descriptions.Item>
              <Descriptions.Item label="发布者">{selectedItem.publisher || '未知'}</Descriptions.Item>
              <Descriptions.Item label="版本">{selectedItem.version || '未知'}</Descriptions.Item>
              <Descriptions.Item label="来源">{selectedItem.source || '未知'}</Descriptions.Item>
              <Descriptions.Item label="位置">{selectedItem.location || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider />

            {/* 单个 AI 分析 */}
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" icon={<RobotOutlined />} onClick={handleSingleAnalyze}
                loading={singleAnalyzing} block>
                {singleAnalyzing ? 'AI 分析中...' : (aiResults[selectedItem.id] ? '重新 AI 分析' : 'AI 智能分析')}
              </Button>

              {singleResult && (
                <Alert
                  type={singleResult.risk_level === 'low' ? 'success' : singleResult.risk_level === 'medium' ? 'warning' : 'error'}
                  message={
                    <div>
                      <div><strong>风险等级：</strong>
                        <Tag color={riskLevelConfig[singleResult.risk_level]?.color}>{riskLevelConfig[singleResult.risk_level]?.text} ({singleResult.risk_score}/100)</Tag>
                      </div>
                      <div style={{ marginTop: 4 }}><strong>可禁用：</strong>
                        <Tag color={singleResult.can_disable ? 'green' : 'red'}>{singleResult.can_disable ? '是 ✓' : '否 ✗'}</Tag>
                      </div>
                    </div>
                  }
                  description={
                    <div>
                      <p><strong>分析理由：</strong>{singleResult.reason}</p>
                      <p><strong>建议：</strong>{singleResult.suggestion}</p>
                      {singleResult.disable_warning && (
                        <Alert type="warning" message={singleResult.disable_warning} showIcon style={{ marginTop: 8 }} />
                      )}
                    </div>
                  }
                  showIcon
                />
              )}

              <Divider />

              <Button block onClick={() => handleToggle(selectedItem, selectedItem.enabled)}>
                {selectedItem.enabled ? '禁用此启动项' : '启用此启动项'}
              </Button>
              <Button block onClick={() => selectedItem.path && window.electronAPI.openFileLocation(selectedItem.path)}>
                打开文件位置
              </Button>
              <Button block danger onClick={async () => {
                const r = await window.electronAPI.deleteStartupItem(selectedItem)
                if (r.success) {
                  message.success(r.message || '已删除')
                  setScanItems(scanItems.filter(i => i.id !== selectedItem.id))
                  setDetailVisible(false)
                } else if (r.requireConfirm) {
                  Modal.confirm({
                    title: '⚠️ 系统关键项',
                    content: r.warning,
                    okText: '确认删除',
                    okType: 'danger',
                    cancelText: '取消',
                    onOk: async () => {
                      const fr = await window.electronAPI.deleteStartupItemForce(selectedItem)
                      if (fr.success) {
                        setScanItems(scanItems.filter(i => i.id !== selectedItem.id))
                        setDetailVisible(false)
                        message.success(fr.message)
                      } else message.error(fr.error)
                    }
                  })
                } else message.error(r.error || '删除失败')
              }}>
                删除此启动项
              </Button>
            </Space>
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default StartupItemsPage
