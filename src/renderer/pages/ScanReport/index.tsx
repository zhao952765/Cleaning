import React, { useState } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Button, Progress, Empty, Alert } from 'antd'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts'
import { DownloadOutlined, ThunderboltOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useAppStore } from '../../stores/appStore'

const ScanReportPage: React.FC = () => {
  const { scanItems, lastScanTime } = useAppStore()
  const [exporting, setExporting] = useState(false)

  // 如果还没有扫描数据
  if (scanItems.length === 0) {
    return (
      <Empty
        description="暂无扫描数据"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        <p style={{ color: '#999' }}>请先执行扫描以生成报告</p>
      </Empty>
    )
  }

  // 统计数据
  const enabledCount = scanItems.filter(i => i.enabled).length
  const disabledCount = scanItems.filter(i => !i.enabled).length
  const safeCount = scanItems.filter(i => i.securityLevel === 'safe').length
  const cautionCount = scanItems.filter(i => i.securityLevel === 'caution').length
  const dangerousCount = scanItems.filter(i => i.securityLevel === 'dangerous').length

  // 分类统计
  const categoryData = [
    { name: '注册表', value: scanItems.filter(i => i.source === 'registry').length },
    { name: '服务', value: scanItems.filter(i => i.source === 'service').length },
    { name: '计划任务', value: scanItems.filter(i => i.source === 'scheduled_task').length },
    { name: '启动文件夹', value: scanItems.filter(i => i.source === 'folder').length }
  ]

  const COLORS = ['#1890ff', '#52c41a', '#faad14', '#722ed1']

  // 风险项
  const riskyItems = scanItems.filter(i => 
    i.securityLevel === 'caution' || i.securityLevel === 'dangerous'
  )

  const riskColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true
    },
    {
      title: '风险等级',
      dataIndex: 'securityLevel',
      key: 'securityLevel',
      render: (level: string) => {
        const config = {
          caution: { color: 'warning', icon: WarningOutlined, text: '可疑' },
          dangerous: { color: 'error', icon: CloseCircleOutlined, text: '恶意' }
        }
        const { color, icon: Icon, text } = config[level as keyof typeof config]
        return <Tag color={color} icon={<Icon />}>{text}</Tag>
      }
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Button size="small" type="link" danger>
          立即禁用
        </Button>
      )
    }
  ]

  // 导出报告
  const handleExport = async () => {
    setExporting(true)
    try {
      const report = {
        scanTime: lastScanTime,
        totalItems: scanItems.length,
        enabledCount,
        disabledCount,
        items: scanItems
      }
      
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `scan-report-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      {/* 报告头部 */}
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h2 style={{ margin: 0 }}>扫描报告</h2>
            <p style={{ color: '#999', margin: '8px 0 0 0' }}>
              扫描时间: {lastScanTime ? new Date(lastScanTime).toLocaleString() : '未知'}
            </p>
          </Col>
          <Col>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              onClick={handleExport}
              loading={exporting}
            >
              导出 JSON
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="总启动项" 
              value={scanItems.length} 
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="已启用" 
              value={enabledCount}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="已禁用" 
              value={disabledCount}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="安全项" 
              value={safeCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="来源分布">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="安全状态">
            <div style={{ padding: '20px 0' }}>
              <Progress 
                percent={(safeCount / scanItems.length) * 100} 
                status="success"
                format={() => `可信 ${safeCount}`}
              />
              <Progress 
                percent={(cautionCount / scanItems.length) * 100} 
                status="exception"
                strokeColor="#faad14"
                format={() => `可疑 ${cautionCount}`}
              />
              <Progress 
                percent={(dangerousCount / scanItems.length) * 100} 
                status="exception"
                strokeColor="#ff4d4f"
                format={() => `恶意 ${dangerousCount}`}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 风险项列表 */}
      {riskyItems.length > 0 && (
        <Card title="⚠️ 风险项" style={{ marginBottom: 24 }}>
          <Alert
            message={`发现 ${riskyItems.length} 个可疑或恶意的启动项，建议立即处理`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Table
            columns={riskColumns}
            dataSource={riskyItems}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* AI 优化建议 */}
      <Card title="💡 AI 优化建议">
        <Alert
          message="一键优化方案"
          description={
            <div>
              <p>根据分析，建议您禁用以下类型的启动项以优化开机速度：</p>
              <ul>
                <li>不必要的云存储同步工具</li>
                <li>游戏平台的自动启动</li>
                <li>软件的自动更新服务</li>
              </ul>
              <p><strong>预计效果：</strong>可减少 3-5 秒开机时间，节省约 200MB 内存</p>
            </div>
          }
          type="info"
          showIcon
          action={
            <Button type="primary">一键应用优化</Button>
          }
        />
      </Card>
    </div>
  )
}

export default ScanReportPage
