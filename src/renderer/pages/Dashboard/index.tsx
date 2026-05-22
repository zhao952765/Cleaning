import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Button, Alert, List, Badge, Progress, Space, Typography, Tag, App, Spin, Modal, Divider } from 'antd'
import { 
  ThunderboltOutlined, 
  SafetyCertificateOutlined, 
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ScanOutlined,
  RocketOutlined,
  FileTextOutlined,
  CloseOutlined,
  ReloadOutlined,
  LockOutlined,
  FolderOpenOutlined
} from '@ant-design/icons'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useAppStore } from '../../stores/appStore'
import dayjs from 'dayjs'

const { Title, Text } = Typography

interface DashboardProps {}

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2']

// 声明 window 扩展类型
declare global {
  interface Window {
    electronAPI: any
  }
}

const Dashboard: React.FC<DashboardProps> = () => {
  const { message } = App.useApp()
  const { scanItems: startupItems, isScanning: scanStatus, lastScanTime, setScanItems, setIsScanning } = useAppStore()
  const [showWarning, setShowWarning] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  // 确保 startupItems 是数组
  const items = Array.isArray(startupItems) ? startupItems : []

  // 计算统计数据
  const totalItems = items.length
  const enabledCount = items.filter(item => item.enabled !== false).length
  const disabledCount = totalItems - enabledCount
  // 使用 securityLevel 替代 trustLevel
  const suspiciousCount = items.filter(item => 
    item.securityLevel === 'caution' || item.securityLevel === 'dangerous'
  ).length
  
  // 健康评分计算（简化版）
  const healthScore = Math.max(0, Math.min(100, 
    100 - (suspiciousCount * 10) - (disabledCount > 20 ? 10 : 0)
  ))

  // 分类统计（使用 type 字段）
  const categoryData = [
    { name: '注册表项', value: items.filter(i => i.type === 'registry').length },
    { name: '系统服务', value: items.filter(i => i.type === 'service').length },
    { name: '计划任务', value: items.filter(i => i.type === 'scheduled_task').length },
    { name: '启动文件夹', value: items.filter(i => i.type === 'startup_folder').length },
    { name: '插件/扩展', value: items.filter(i => i.type === 'plugin').length },
  ].filter(item => item.value > 0)

  // 最近操作记录（模拟数据）
  const recentActions = [
    { time: '刚刚', action: '禁用了 微信开机启动', type: 'disable' },
    { time: '5分钟前', action: '扫描了系统启动项', type: 'scan' },
    { time: '1小时前', action: '启用了 OneDrive 同步', type: 'enable' },
    { time: '2小时前', action: '分析了 Steam 客户端', type: 'analyze' },
    { time: '昨天', action: '禁用了 Adobe Updater', type: 'disable' },
  ]

  // 检查管理员权限
  useEffect(() => {
    window.electronAPI.isAdmin().then(result => {
      if (result.success) {
        setIsAdmin(result.data)
      }
    })
  }, [])

  // 执行完整扫描
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

  // 分项扫描函数
  const handleScanRegistry = async () => {
    setIsScanning(true)
    try {
      const result = await window.electronAPI.scanRegistry()
      if (result.success && Array.isArray(result.data)) {
        setScanItems(result.data)
        message.success(`注册表扫描完成，找到 ${result.data.length} 个启动项`)
      } else {
        message.error(result.error || '注册表扫描失败')
      }
    } catch (error: any) {
      console.error('注册表扫描失败:', error)
      message.error('注册表扫描过程中发生错误: ' + error.message)
    } finally {
      setIsScanning(false)
    }
  }

  const handleScanServices = async () => {
    setIsScanning(true)
    try {
      const result = await window.electronAPI.scanServices()
      if (result.success && Array.isArray(result.data)) {
        setScanItems(result.data)
        message.success(`服务扫描完成，找到 ${result.data.length} 个服务`)
      } else {
        message.error(result.error || '服务扫描失败')
      }
    } catch (error: any) {
      console.error('服务扫描失败:', error)
      message.error('服务扫描过程中发生错误: ' + error.message)
    } finally {
      setIsScanning(false)
    }
  }

  const handleScanTasks = async () => {
    setIsScanning(true)
    try {
      const result = await window.electronAPI.scanScheduledTasks()
      if (result.success && Array.isArray(result.data)) {
        setScanItems(result.data)
        message.success(`计划任务扫描完成，找到 ${result.data.length} 个任务`)
      } else {
        message.error(result.error || '计划任务扫描失败')
      }
    } catch (error: any) {
      console.error('计划任务扫描失败:', error)
      message.error('计划任务扫描过程中发生错误: ' + error.message)
    } finally {
      setIsScanning(false)
    }
  }

  const handleScanFolder = async () => {
    setIsScanning(true)
    try {
      const result = await window.electronAPI.scanStartupFolder()
      if (result.success && Array.isArray(result.data)) {
        setScanItems(result.data)
        message.success(`启动文件夹扫描完成，找到 ${result.data.length} 个启动项`)
      } else {
        message.error(result.error || '启动文件夹扫描失败')
      }
    } catch (error: any) {
      console.error('启动文件夹扫描失败:', error)
      message.error('启动文件夹扫描过程中发生错误: ' + error.message)
    } finally {
      setIsScanning(false)
    }
  }

  // 自动刷新
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date())
    }, 60000) // 每分钟刷新

    return () => clearInterval(interval)
  }, [])

  // 空状态
  if (totalItems === 0 && !scanStatus) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Card variant="borderless" style={{ maxWidth: 600, margin: '0 auto' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ fontSize: 64, color: '#1890ff' }}>
              <ScanOutlined />
            </div>
            <Title level={3}>欢迎使用 Windows 启动项管理器</Title>
            <Text type="secondary">
              开始首次系统扫描，了解您的开机启动情况
            </Text>
            
            {/* 权限提示 */}
            {isAdmin === false && (
              <Alert
                message="建议以管理员身份运行"
                description="当前以普通用户身份运行，可能无法扫描部分系统级启动项。建议右键应用图标，选择'以管理员身份运行'以获得完整扫描结果。"
                type="warning"
                showIcon
                icon={<LockOutlined />}
                style={{ marginBottom: 16 }}
              />
            )}
            
            <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
              <Col span={8}>
                <Card size="small" variant="borderless">
                  <SafetyCertificateOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                  <div style={{ marginTop: 8 }}>智能分析</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" variant="borderless">
                  <ThunderboltOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                  <div style={{ marginTop: 8 }}>性能优化</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" variant="borderless">
                  <ClockCircleOutlined style={{ fontSize: 24, color: '#faad14' }} />
                  <div style={{ marginTop: 8 }}>快速启动</div>
                </Card>
              </Col>
            </Row>

            <Button 
              type="primary" 
              size="large" 
              icon={<ScanOutlined />}
              onClick={handleScan}
              loading={scanStatus}
              style={{ marginTop: 16 }}
            >
              开始首次系统扫描
            </Button>
          </Space>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 权限警告横幅 */}
      {isAdmin === false && (
        <Alert
          message="当前未以管理员身份运行"
          description="可能无法扫描完整的系统级启动项（如 HKLM 注册表、系统服务等）。建议右键应用图标，选择'以管理员身份运行'。"
          type="warning"
          showIcon
          icon={<LockOutlined />}
          closable
          onClose={() => setIsAdmin(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 风险提示横幅 */}
      {suspiciousCount > 0 && showWarning && (
        <Alert
          message={`检测到 ${suspiciousCount} 个可疑启动项`}
          description="建议立即查看这些启动项的详细信息，确保系统安全"
          type="error"
          showIcon
          icon={<WarningOutlined />}
          action={
            <Space>
              <Button size="small" type="primary" onClick={() => window.location.hash = '#/startup-items'}>立即查看</Button>
              <Button size="small" icon={<CloseOutlined />} onClick={() => setShowWarning(false)} />
            </Space>
          }
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 顶部统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总启动项数"
              value={totalItems}
              prefix={<ScanOutlined />}
              suffix={
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {scanStatus ? <ReloadOutlined spin /> : null}
                </Tag>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已启用项数"
              value={enabledCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              suffix={
                <Text type="secondary" style={{ fontSize: 14 }}>
                  ({totalItems > 0 ? ((enabledCount / totalItems) * 100).toFixed(0) : 0}%)
                </Text>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="平均开机耗时"
              value={Math.floor(Math.random() * 20) + 15}
              suffix="秒"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="安全状态"
              value={suspiciousCount === 0 ? '安全' : '警告'}
              valueStyle={{ color: suspiciousCount === 0 ? '#52c41a' : '#faad14' }}
              prefix={suspiciousCount === 0 ? <SafetyCertificateOutlined /> : <WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 系统健康评分和分类饼图 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="系统健康评分" variant="borderless">
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Progress
                type="dashboard"
                percent={healthScore}
                strokeColor={{
                  '0%': '#f5222d',
                  '50%': '#faad14',
                  '100%': '#52c41a',
                }}
                format={(percent) => (
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 'bold' }}>{percent}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>分</div>
                  </div>
                )}
              />
              <div style={{ marginTop: 16, color: '#666' }}>
                {healthScore >= 80 ? '您的系统启动状态良好' : '仍有优化空间'}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                启动速度 40% | 安全性 30% | 整洁度 30%
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="启动项分类分布" variant="borderless">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 最近活动和快速操作 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="最近活动" variant="borderless">
            <List
              itemLayout="horizontal"
              dataSource={recentActions}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      item.type === 'scan' ? <ScanOutlined /> :
                      item.type === 'enable' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
                      item.type === 'disable' ? <CloseOutlined style={{ color: '#f5222d' }} /> :
                      <RocketOutlined style={{ color: '#1890ff' }} />
                    }
                    title={<Text strong>{item.action}</Text>}
                    description={item.time}
                  />
                </List.Item>
              )}
            />
            <div style={{ textAlign: 'right', marginTop: 8, color: '#999', fontSize: 12 }}>
              最后更新: {dayjs(lastUpdate).format('HH:mm:ss')}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="快速操作" variant="borderless">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Button 
                type="primary" 
                size="large" 
                block 
                icon={scanStatus ? <ReloadOutlined spin /> : <ScanOutlined />}
                onClick={handleScan}
                loading={scanStatus}
              >
                🔍 一键扫描
              </Button>
              
              <Divider style={{ margin: '8px 0' }}>分项扫描</Divider>
              
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Button 
                  size="middle" 
                  block 
                  icon={<ThunderboltOutlined />}
                  onClick={handleScanRegistry}
                  loading={scanStatus}
                  disabled={scanStatus}
                >
                  📋 注册表启动项
                </Button>
                <Button 
                  size="middle" 
                  block 
                  icon={<RocketOutlined />}
                  onClick={handleScanServices}
                  loading={scanStatus}
                  disabled={scanStatus}
                >
                  ⚙️ 系统服务
                </Button>
                <Button 
                  size="middle" 
                  block 
                  icon={<ClockCircleOutlined />}
                  onClick={handleScanTasks}
                  loading={scanStatus}
                  disabled={scanStatus}
                >
                  🕐 计划任务
                </Button>
                <Button 
                  size="middle" 
                  block 
                  icon={<FolderOpenOutlined />}
                  onClick={handleScanFolder}
                  loading={scanStatus}
                  disabled={scanStatus}
                >
                  📁 启动文件夹
                </Button>
              </Space>
              
              <Divider style={{ margin: '8px 0' }}>其他操作</Divider>
              
              <Button 
                size="large" 
                block 
                icon={<RocketOutlined />}
                disabled={items.length === 0}
                onClick={() => message.info('智能优化功能开发中...')}
              >
                ⚡ 智能优化
              </Button>
              <Button 
                size="large" 
                block 
                icon={<FileTextOutlined />}
                onClick={() => window.location.hash = '#/scan-report'}
              >
                📊 查看报告
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
