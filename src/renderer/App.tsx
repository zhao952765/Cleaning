import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme as antdTheme, App as AntdApp, Modal, Button, Space, Typography, Result } from 'antd'
import { LockOutlined, WarningOutlined, SecurityScanOutlined } from '@ant-design/icons'
import zhCN from 'antd/locale/zh_CN'
import AppLayout from './components/Layout/AppLayout'
import ErrorBoundary from './components/ErrorBoundary'
import DashboardPage from './pages/Dashboard'
import StartupItemsPage from './pages/StartupItems'
import ScheduledTasksPage from './pages/ScheduledTasks'
import ServicesPage from './pages/Services'
import AISettingsPage from './pages/AISettings'
import AIChatPage from './pages/AIChat'
import ScanReportPage from './pages/ScanReport'
import { useAppStore } from './stores/appStore'
import { injectThemeVariables } from './styles/theme'

const { Text, Title } = Typography

// 占位组件（其他页面后续实现）
const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ textAlign: 'center', padding: '100px 0' }}>
    <h2>{title}</h2>
    <p style={{ color: '#999' }}>此页面正在开发中...</p>
  </div>
)

const App: React.FC = () => {
  const { themeMode, setAIConnected } = useAppStore()
  const [adminModalVisible, setAdminModalVisible] = useState(false)
  const [restarting, setRestarting] = useState(false)

  // =========================================================
  // 管理员权限检测：应用启动后立即检查
  // 如果不是管理员，弹出 Modal 提示并提供重启按钮
  // =========================================================
  useEffect(() => {
    // 方式一：主动查询
    const checkAdmin = async () => {
      try {
        const result = await window.electronAPI.isAdmin()
        if (result.success && result.data === false) {
          setAdminModalVisible(true)
        }
      } catch (error) {
        console.error('[AdminCheck] 查询权限失败:', error)
      }
    }

    checkAdmin()

    // 方式二：监听主进程推送（窗口 ready-to-show 后发送）
    const unsubscribe = window.electronAPI.onAdminStatus?.((result: any) => {
      if (result && result.data === false) {
        setAdminModalVisible(true)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // 以管理员身份重启
  const handleRelaunchAsAdmin = async () => {
    setRestarting(true)
    try {
      await window.electronAPI.relaunchAsAdmin()
    } catch (error) {
      console.error('[AdminCheck] 重启失败:', error)
      setRestarting(false)
      setAdminModalVisible(false)
    }
  }

  // 关闭弹窗（用户选择暂时不重启）
  const handleCloseModal = () => {
    setAdminModalVisible(false)
  }

  // 初始化主题
  useEffect(() => {
    injectThemeVariables(themeMode)
    
    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (themeMode === 'system') {
        injectThemeVariables('system')
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeMode])

  // 检查 AI 连接状态
  useEffect(() => {
    const checkAIConnection = async () => {
      try {
        const config = await window.electronAPI.getAIConfig()
        if (config.success && config.data) {
          const result = await window.electronAPI.testAIConnection()
          setAIConnected(result.success)
        }
      } catch (error) {
        console.error('检查 AI 连接失败:', error)
      }
    }
    
    checkAIConnection()
  }, [setAIConnected])

  // Ant Design 主题配置
  const isDark = themeMode === 'dark' || 
    (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <ErrorBoundary>
      {/* ===================================================== */}
      {/* 管理员权限缺失提示 Modal                               */}
      {/* 应用启动后检测到非管理员权限时弹出                       */}
      {/* ===================================================== */}
      <Modal
        title={
          <Space>
            <WarningOutlined style={{ color: '#faad14' }} />
            <span>需要管理员权限</span>
          </Space>
        }
        open={adminModalVisible}
        onCancel={handleCloseModal}
        footer={
          <Space>
            <Button onClick={handleCloseModal} disabled={restarting}>
              稍后再说
            </Button>
            <Button
              type="primary"
              danger
              icon={<SecurityScanOutlined />}
              loading={restarting}
              onClick={handleRelaunchAsAdmin}
            >
              {restarting ? '正在以管理员身份重启...' : '以管理员身份重启'}
            </Button>
          </Space>
        }
        width={500}
        closable={!restarting}
        maskClosable={false}
        keyboard={!restarting}
      >
        <Result
          status="warning"
          icon={<LockOutlined style={{ color: '#faad14', fontSize: 48 }} />}
          title={<Title level={4} style={{ margin: 0 }}>当前未以管理员身份运行</Title>}
          subTitle={
            <div style={{ textAlign: 'left', lineHeight: 2 }}>
              <Text type="secondary">
                Windows 启动项管理器需要管理员权限才能正常工作。
              </Text>
              <ul style={{ marginTop: 12, paddingLeft: 20, color: '#666' }}>
                <li>扫描系统级注册表启动项（HKLM 等）</li>
                <li>启用/禁用系统服务和计划任务</li>
                <li>读取所有用户启动文件夹</li>
                <li>获取完整的数字签名信息</li>
              </ul>
              <Text type="secondary">
                点击下方按钮将以管理员权限重新启动应用。
              </Text>
            </div>
          }
        />
      </Modal>
      <ConfigProvider 
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 6,
            fontSize: 14
          },
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
        }}
      >
        <AntdApp>
          <BrowserRouter>
            <AppLayout>
              <Routes>
                {/* 概览页 */}
                <Route 
                  path="/" 
                  element={<DashboardPage />} 
                />
                
                {/* 启动项列表 */}
                <Route 
                  path="/startup-items" 
                  element={<StartupItemsPage />} 
                />
                
                {/* 计划任务 */}
                <Route 
                  path="/scheduled-tasks" 
                  element={<ScheduledTasksPage />} 
                />
                
                {/* 系统服务 */}
                <Route 
                  path="/services" 
                  element={<ServicesPage />} 
                />
                
                {/* 扫描报告 */}
                <Route 
                  path="/scan-report" 
                  element={<ScanReportPage />} 
                />
                
                {/* AI 助手 */}
                <Route 
                  path="/ai-chat" 
                  element={<AIChatPage />} 
                />
                
                {/* 设置 */}
                <Route 
                  path="/settings" 
                  element={<AISettingsPage />} 
                />
                
                {/* 默认重定向到首页 */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  )
}

export default App
