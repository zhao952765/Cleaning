import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Button, Alert, List, Progress, Space, Typography, Tag, App, Divider } from 'antd'
import {
  ThunderboltOutlined, SafetyCertificateOutlined, ClockCircleOutlined,
  WarningOutlined, CheckCircleOutlined, ScanOutlined, RocketOutlined,
  FileTextOutlined, CloseOutlined, ReloadOutlined, LockOutlined,
  FolderOpenOutlined, RobotOutlined, FireOutlined, CloseCircleOutlined
} from '@ant-design/icons'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useAppStore } from '../../stores/appStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2']

const RISK_COLORS: Record<string, string> = {
  low: '#52c41a', medium: '#faad14', high: '#ff4d4f', critical: '#722ed1'
}

const Dashboard: React.FC = () => {
  const { message } = App.useApp()
  const { scanItems: startupItems, isScanning: scanStatus, lastScanTime, setScanItems, setIsScanning } = useAppStore()
  const [showWarning, setShowWarning] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [scanProgress, setScanProgress] = useState<{ stage: string; message: string } | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)

  const items = Array.isArray(startupItems) ? startupItems : []
  const totalItems = items.length
  const enabledCount = items.filter(item => item.enabled === true).length
  const disabledCount = items.filter(item => item.enabled === false).length
  const suspiciousCount = items.filter(item =>
    item.securityLevel === 'caution' || item.securityLevel === 'dangerous'
  ).length

  const healthScore = Math.max(0, Math.min(100,
    100 - (suspiciousCount * 10) - (disabledCount > 20 ? 10 : 0)
  ))

  const categoryData = [
    { name: '注册表项', value: items.filter(i => i.type === 'registry').length },
    { name: '系统服务', value: items.filter(i => i.type === 'service').length },
    { name: '计划任务', value: items.filter(i => i.type === 'scheduledTask').length },
    { name: '启动文件夹', value: items.filter(i => i.type === 'folder').length },
    { name: '驱动程序', value: items.filter(i => i.type === 'driver').length },
    { name: 'Shell扩展', value: items.filter(i => i.type === 'shell').length },
  ].filter(item => item.value > 0)

  useEffect(() => {
    window.electronAPI.isAdmin().then(result => {
      if (result.success) setIsAdmin(result.data)
    })
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setLastUpdate(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const handleScan = async () => {
    setIsScanning(true)
    setScanProgress({ stage: 'init', message: '开始扫描...' })
    setAiSummary(null)

    const cleanup = window.electronAPI.onScanProgress?.((p: any) => {
      if (p.message) setScanProgress({ stage: p.stage || '', message: p.message })
    })

    try {
      const result = await window.electronAPI.scanAll({
        scanRegistry: true, scanServices: true,
        scanScheduledTasks: true, scanStartupFolder: true
      })
      if (result.success && result.data && result.data.items?.length > 0) {
        message.success({ content: `扫描完成！发现 ${result.data.items.length} 个启动项`, key: 'scan', duration: 3 })
        setScanItems(result.data.items)
      } else {
        message.warning('未找到任何启动项')
      }
    } catch (error: any) {
      message.error({ content: `扫描失败: ${error.message}`, key: 'scan', duration: 5 })
    } finally {
      setIsScanning(false)
      setScanProgress(null)
      if (cleanup) cleanup()
    }
  }

  const handleAIOneClick = async () => {
    const enabledItems = items.filter(i => i.enabled)
    if (enabledItems.length === 0) {
      message.warning('没有已启用的启动项需要分析')
      return
    }
    setAnalyzing(true)
    setAiSummary(null)
    try {
      const r = await window.electronAPI.analyzeBatch(enabledItems)
      if (r.success && r.data) {
        setAiSummary(r.data.summary || `分析完成，可优化 ${r.data.totalOptimizable} 项`)
        message.success(r.data.summary || 'AI 分析完成')
      } else {
        message.error(r.error || 'AI 分析失败')
      }
    } catch (e: any) {
      message.error('AI 分析出错: ' + e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleScanRegistry = async () => {
    setIsScanning(true)
    try {
      const result = await window.electronAPI.scanRegistry()
      if (result.success && Array.isArray(result.data)) {
        setScanItems(result.data)
        message.success(`注册表扫描完成，找到 ${result.data.length} 个启动项`)
      } else message.error(result.error || '注册表扫描失败')
    } catch (e: any) { message.error('注册表扫描失败: ' + e.message) }
    finally { setIsScanning(false) }
  }

  const handleScanServices = async () => {
    setIsScanning(true)
    try {
      const result = await window.electronAPI.scanServices()
      if (result.success && Array.isArray(result.data)) {
        setScanItems(result.data)
        message.success(`服务扫描完成，找到 ${result.data.length} 个服务`)
      } else message.error(result.error || '服务扫描失败')
    } catch (e: any) { message.error('服务扫描失败: ' + e.message) }
    finally { setIsScanning(false) }
  }

  const handleScanTasks = async () => {
    setIsScanning(true)
    try {
      const result = await window.electronAPI.scanScheduledTasks()
      if (result.success && Array.isArray(result.data)) {
        setScanItems(result.data)
        message.success(`计划任务扫描完成，找到 ${result.data.length} 个任务`)
      } else message.error(result.error || '计划任务扫描失败')
    } catch (e: any) { message.error('计划任务扫描失败: ' + e.message) }
    finally { setIsScanning(false) }
  }

  const handleScanFolder = async () => {
    setIsScanning(true)
    try {
      const result = await window.electronAPI.scanStartupFolder()
      if (result.success && Array.isArray(result.data)) {
        setScanItems(result.data)
        message.success(`启动文件夹扫描完成，找到 ${result.data.length} 个启动项`)
      } else message.error(result.error || '启动文件夹扫描失败')
    } catch (e: any) { message.error('启动文件夹扫描失败: ' + e.message) }
    finally { setIsScanning(false) }
  }

  // 空状态
  if (totalItems === 0 && !scanStatus) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Card variant="borderless" style={{ maxWidth: 600, margin: '0 auto' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ fontSize: 64, color: '#1890ff' }}><ScanOutlined /></div>
            <Title level={3}>欢迎使用 Windows 启动项管理器</Title>
            <Text type="secondary">开始首次系统扫描，了解您的开机启动情况</Text>
            {isAdmin === false && (
              <Alert message="建议以管理员身份运行" type="warning" showIcon icon={<LockOutlined />}
                description="当前以普通用户运行，可能无法扫描部分系统级启动项"
                style={{ marginBottom: 16 }} />
            )}
            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
              <Col span={8}><Card size="small" variant="borderless"><SafetyCertificateOutlined style={{ fontSize: 24, color: '#52c41a' }} /><div style={{ marginTop: 8 }}>智能分析</div></Card></Col>
              <Col span={8}><Card size="small" variant="borderless"><ThunderboltOutlined style={{ fontSize: 24, color: '#1890ff' }} /><div style={{ marginTop: 8 }}>性能优化</div></Card></Col>
              <Col span={8}><Card size="small" variant="borderless"><ClockCircleOutlined style={{ fontSize: 24, color: '#faad14' }} /><div style={{ marginTop: 8 }}>快速启动</div></Card></Col>
            </Row>
            <Button type="primary" size="large" icon={<ScanOutlined />} onClick={handleScan} loading={scanStatus} style={{ marginTop: 16 }}>开始首次系统扫描</Button>
          </Space>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 权限警告 */}
      {isAdmin === false && (
        <Alert message="当前未以管理员身份运行" type="warning" showIcon icon={<LockOutlined />}
          closable onClose={() => setIsAdmin(null)} style={{ marginBottom: 16 }} />
      )}

      {/* 风险警告 */}
      {suspiciousCount > 0 && showWarning && (
        <Alert message={`检测到 ${suspiciousCount} 个可疑启动项`} type="error" showIcon icon={<WarningOutlined />}
          action={<Space><Button size="small" type="primary" onClick={() => window.location.hash = '#/startup-items'}>立即查看</Button><Button size="small" icon={<CloseOutlined />} onClick={() => setShowWarning(false)} /></Space>}
          style={{ marginBottom: 24 }} />
      )}

      {/* 扫描进度 */}
      {scanProgress && (
        <Card size="small" style={{ marginBottom: 16, background: '#e6f7ff' }}>
          <Progress percent={80} format={() => ''} />
          <div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>
            <Tag color="blue">{scanProgress.stage}</Tag> {scanProgress.message}
          </div>
        </Card>
      )}

      {/* AI 分析摘要 */}
      {aiSummary && (
        <Alert message={aiSummary} type="success" showIcon icon={<RobotOutlined />}
          closable onClose={() => setAiSummary(null)} style={{ marginBottom: 16 }} />
      )}

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="总启动项数" value={totalItems} prefix={<ScanOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="已启用" value={enabledCount} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />}
            suffix={<Text type="secondary" style={{ fontSize: 14 }}>({totalItems > 0 ? ((enabledCount / totalItems) * 100).toFixed(0) : 0}%)</Text>} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="已禁用" value={disabledCount} valueStyle={{ color: '#faad14' }} prefix={<WarningOutlined />}
            suffix={<Text type="secondary" style={{ fontSize: 14 }}>({totalItems > 0 ? ((disabledCount / totalItems) * 100).toFixed(0) : 0}%)</Text>} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="安全状态" value={suspiciousCount === 0 ? '安全' : '警告'}
            valueStyle={{ color: suspiciousCount === 0 ? '#52c41a' : '#faad14' }}
            prefix={suspiciousCount === 0 ? <SafetyCertificateOutlined /> : <WarningOutlined />} /></Card>
        </Col>
      </Row>

      {/* 风险等级过滤按钮（快速跳转启动项页面） */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>风险过滤：</Text>
          <Button size="small" icon={<CheckCircleOutlined />} style={{ color: RISK_COLORS.low }}
            onClick={() => window.location.hash = '#/startup-items'}>低风险</Button>
          <Button size="small" icon={<WarningOutlined />} style={{ color: RISK_COLORS.medium }}
            onClick={() => window.location.hash = '#/startup-items'}>中风险</Button>
          <Button size="small" icon={<FireOutlined />} style={{ color: RISK_COLORS.high }}
            onClick={() => window.location.hash = '#/startup-items'}>高风险</Button>
          <Button size="small" icon={<CloseCircleOutlined />} style={{ color: RISK_COLORS.critical }}
            onClick={() => window.location.hash = '#/startup-items'}>严重</Button>
          <Divider type="vertical" />
          <Button type="primary" icon={<RobotOutlined />} onClick={handleAIOneClick}
            loading={analyzing} disabled={totalItems === 0}>
            AI 一键分析 ({enabledCount}项)
          </Button>
        </Space>
      </Card>

      {/* 健康评分 + 分类饼图 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="系统健康评分" variant="borderless">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Progress type="dashboard" percent={healthScore}
                strokeColor={{ '0%': '#f5222d', '50%': '#faad14', '100%': '#52c41a' }}
                format={(p) => <div><div style={{ fontSize: 24, fontWeight: 'bold' }}>{p}</div><div style={{ fontSize: 12, color: '#999' }}>分</div></div>} />
              <div style={{ marginTop: 16, color: '#666' }}>{healthScore >= 80 ? '系统启动状态良好' : healthScore >= 50 ? '仍有优化空间' : '需要优化'}</div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="启动项分类分布" variant="borderless">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} outerRadius={80}
                  fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="最近活动" variant="borderless">
            <List
              itemLayout="horizontal"
              dataSource={[
                { time: '刚刚', action: totalItems > 0 ? `扫描发现 ${totalItems} 个启动项` : '暂无数据', type: 'scan' },
                { time: lastScanTime ? dayjs(lastScanTime).format('HH:mm:ss') : '-', action: `上次扫描`, type: 'scan' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={item.type === 'scan' ? <ScanOutlined /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    title={<Text strong>{item.action}</Text>}
                    description={item.time} />
                </List.Item>
              )} />
            <div style={{ textAlign: 'right', marginTop: 8, color: '#999', fontSize: 12 }}>
              最后更新: {dayjs(lastUpdate).format('HH:mm:ss')}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="快速操作" variant="borderless">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Button type="primary" size="large" block icon={scanStatus ? <ReloadOutlined spin /> : <ScanOutlined />}
                onClick={handleScan} loading={scanStatus}>一键扫描</Button>
              <Divider style={{ margin: '8px 0' }}>AI 分析</Divider>
              <Button size="large" block icon={<RobotOutlined />} onClick={handleAIOneClick}
                loading={analyzing} disabled={totalItems === 0}>
                AI 智能分析 ({enabledCount}项)
              </Button>
              <Divider style={{ margin: '8px 0' }}>分项扫描</Divider>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Button size="middle" block icon={<ThunderboltOutlined />} onClick={handleScanRegistry} loading={scanStatus} disabled={scanStatus}>注册表启动项</Button>
                <Button size="middle" block icon={<RocketOutlined />} onClick={handleScanServices} loading={scanStatus} disabled={scanStatus}>系统服务</Button>
                <Button size="middle" block icon={<ClockCircleOutlined />} onClick={handleScanTasks} loading={scanStatus} disabled={scanStatus}>计划任务</Button>
                <Button size="middle" block icon={<FolderOpenOutlined />} onClick={handleScanFolder} loading={scanStatus} disabled={scanStatus}>启动文件夹</Button>
              </Space>
              <Divider style={{ margin: '8px 0' }}>报告</Divider>
              <Button size="large" block icon={<FileTextOutlined />} onClick={() => window.location.hash = '#/scan-report'}>查看报告</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
