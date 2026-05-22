import React, { useState } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Button, Progress, Empty, Alert, Space, message } from 'antd'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { DownloadOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, RobotOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#f5222d']

const ScanReportPage: React.FC = () => {
  const { scanItems, lastScanTime } = useAppStore()
  const [loading, setLoading] = useState(false)

  if (scanItems.length === 0) {
    return (
      <div style={{ padding: '100px 0', textAlign: 'center' }}>
        <Empty description="暂无扫描数据" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <p style={{ color: '#999' }}>请先执行扫描以生成报告</p>
        </Empty>
      </div>
    )
  }

  const enabledCount = scanItems.filter(i => i.enabled).length
  const disabledCount = scanItems.filter(i => !i.enabled).length
  const safeCount = scanItems.filter(i => i.securityLevel === 'safe').length
  const cautionCount = scanItems.filter(i => i.securityLevel === 'caution').length
  const dangerousCount = scanItems.filter(i => i.securityLevel === 'dangerous').length

  const categoryData = [
    { name: '注册表', value: scanItems.filter(i => i.source === 'registry').length, color: COLORS[0] },
    { name: '服务', value: scanItems.filter(i => i.source === 'service').length, color: COLORS[1] },
    { name: '计划任务', value: scanItems.filter(i => i.source === 'task').length, color: COLORS[2] },
    { name: '启动文件夹', value: scanItems.filter(i => i.source === 'folder').length, color: COLORS[3] },
    { name: '其他', value: scanItems.filter(i => !['registry', 'service', 'task', 'folder'].includes(i.source)).length, color: COLORS[4] },
  ].filter(i => i.value > 0)

  const riskyItems = scanItems.filter(i => i.securityLevel === 'caution' || i.securityLevel === 'dangerous')
  const enabledPercent = scanItems.length > 0 ? ((enabledCount / scanItems.length) * 100).toFixed(1) : '0'

  const handleExport = () => {
    setLoading(true)
    try {
      const report = {
        scanTime: lastScanTime,
        totalItems: scanItems.length,
        enabledCount, disabledCount,
        safeCount, cautionCount, dangerousCount,
        items: scanItems.map(({ fileInfo, ...rest }) => rest),
      }
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scan-report-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setLoading(false) }
  }

  const riskColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '路径', dataIndex: 'path', key: 'path', ellipsis: true },
    {
      title: '类型', dataIndex: 'source', key: 'source', width: 100,
      render: (s: string) => {
        const m: Record<string, string> = { registry: '注册表', service: '服务', task: '任务', folder: '文件夹' }
        return <Tag>{m[s] || s}</Tag>
      }
    },
    {
      title: '风险等级', dataIndex: 'securityLevel', key: 'securityLevel', width: 100,
      render: (level: string) => {
        const cfg = { caution: { color: 'warning', icon: WarningOutlined, text: '可疑' }, dangerous: { color: 'error', icon: CloseCircleOutlined, text: '恶意' } }
        const c = cfg[level as keyof typeof cfg]
        return c ? <Tag color={c.color} icon={<c.icon />}>{c.text}</Tag> : <Tag>{level}</Tag>
      }
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, record: any) => (
        <Button size="small" type="link" danger onClick={() => {
          window.electronAPI.toggleStartupItem(record, false)
          message.success('已提交禁用请求')
        }}>立即禁用</Button>
      )
    }
  ]

  // 基于扫描数据生成 AI 建议
  const nonCriticalEnabled = scanItems.filter(i => i.enabled && !i.isSystem)
  const suggestions = [
    nonCriticalEnabled.length > 10 ? `有 ${nonCriticalEnabled.length - 10} 个非关键启动项正在运行，建议禁用不必要的自启` : null,
    safeCount === scanItems.length ? '所有启动项均为可信状态，系统安全' : null,
    cautionCount > 0 ? `发现 ${cautionCount} 个可疑启动项，建议逐一检查` : null,
    dangerousCount > 0 ? `存在 ${dangerousCount} 个恶意项！请立即处理` : null,
    disabledCount > 20 ? `已禁用 ${disabledCount} 项，系统启动速度已优化` : null,
  ].filter(Boolean)

  return (
    <div>
      {/* 报告头部 */}
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h2 style={{ margin: 0 }}>扫描报告</h2>
            <p style={{ color: '#999', margin: '8px 0 0 0' }}>
              扫描时间: {lastScanTime ? new Date(lastScanTime).toLocaleString() : '未知'}
              <span style={{ marginLeft: 16 }}>启用率: {enabledPercent}%</span>
            </p>
          </Col>
          <Col>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} loading={loading}>导出 JSON</Button>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="总启动项" value={scanItems.length} prefix={<SafetyCertificateOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="已启用" value={enabledCount} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="已禁用" value={disabledCount} valueStyle={{ color: '#ff4d4f' }} prefix={<CloseCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="可信项" value={safeCount} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="来源分布">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80} dataKey="value">
                  {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="安全状态">
            <div style={{ padding: '20px 0' }}>
              <Progress percent={Number(((safeCount / scanItems.length) * 100).toFixed(0))} status="success" format={() => `可信 ${safeCount}`} style={{ marginBottom: 12 }} />
              <Progress percent={Number(((cautionCount / scanItems.length) * 100).toFixed(0))} strokeColor="#faad14" format={() => `可疑 ${cautionCount}`} style={{ marginBottom: 12 }} />
              <Progress percent={Number(((dangerousCount / scanItems.length) * 100).toFixed(0))} strokeColor="#ff4d4f" format={() => `恶意 ${dangerousCount}`} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* AI 优化建议 */}
      <Card title={<Space><RobotOutlined /> AI 优化建议</Space>} style={{ marginBottom: 24 }}>
        {suggestions.length > 0 ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            {suggestions.map((s, i) => (
              <Alert key={i} message={s} type={s?.includes('恶意') ? 'error' : s?.includes('可疑') ? 'warning' : 'info'} showIcon />
            ))}
            {nonCriticalEnabled.length > 0 && (
              <Alert type="success" showIcon icon={<RobotOutlined />}
                message={`建议禁用 ${Math.max(0, nonCriticalEnabled.length - 5)} 个非关键启动项以优化开机速度`}
                action={<Button type="primary" size="small" onClick={() => window.location.hash = '#/startup-items'}>前往管理</Button>} />
            )}
          </Space>
        ) : (
          <Alert message="暂无优化建议" type="info" showIcon />
        )}
      </Card>

      {/* 风险项 */}
      {riskyItems.length > 0 && (
        <Card title={<Space><WarningOutlined style={{ color: '#faad14' }} />风险项 ({riskyItems.length})</Space>} style={{ marginBottom: 24 }}>
          <Alert message={`发现 ${riskyItems.length} 个可疑或恶意启动项，建议立即处理`} type="warning" showIcon style={{ marginBottom: 16 }} />
          <Table columns={riskColumns} dataSource={riskyItems} rowKey="id" pagination={false} size="small" />
        </Card>
      )}
    </div>
  )
}

export default ScanReportPage
