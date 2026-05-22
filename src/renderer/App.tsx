import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd'
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

// 占位组件（其他页面后续实现）
const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ textAlign: 'center', padding: '100px 0' }}>
    <h2>{title}</h2>
    <p style={{ color: '#999' }}>此页面正在开发中...</p>
  </div>
)

const App: React.FC = () => {
  const { themeMode, setAIConnected } = useAppStore()

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
