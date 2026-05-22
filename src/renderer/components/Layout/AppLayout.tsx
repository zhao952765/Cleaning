import React, { useState } from 'react'
import { Layout, Menu, Button, theme, Badge, Input } from 'antd'
import {
  DashboardOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  FileTextOutlined,
  RobotOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'

const { Header, Sider, Content, Footer } = Layout

interface AppLayoutProps {
  children: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  
  // 从全局状态获取数据
  const { isScanning, aiConnected, scanItems } = useAppStore()

  // 菜单项配置
  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '概览'
    },
    {
      key: '/startup-items',
      icon: <RocketOutlined />,
      label: '启动项'
    },
    {
      key: '/scheduled-tasks',
      icon: <ClockCircleOutlined />,
      label: '计划任务'
    },
    {
      key: '/services',
      icon: <SettingOutlined />,
      label: '系统服务'
    },
    {
      key: '/scan-report',
      icon: <FileTextOutlined />,
      label: '扫描报告'
    },
    {
      key: '/ai-chat',
      icon: <RobotOutlined />,
      label: 'AI 助手'
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '设置'
    }
  ]

  // 菜单点击处理
  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 左侧导航栏 */}
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100
        }}
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: token.colorWhite,
          fontSize: collapsed ? 20 : 16,
          fontWeight: 'bold'
        }}>
          {collapsed ? 'SM' : '启动项管家'}
        </div>
        
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>

      {/* 主布局 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        {/* 顶部工具栏 */}
        <Header style={{ 
          padding: '0 24px',
          background: token.colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '16px' }}
            />
            
            {/* 搜索框 */}
            <div style={{ width: 300 }}>
              <Input.Search
                placeholder="搜索启动项..."
                prefix={<SearchOutlined />}
                allowClear
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* AI 连接状态 */}
            <Badge 
              status={aiConnected ? 'success' : 'error'} 
              text={aiConnected ? 'AI 已连接' : 'AI 未连接'}
            />
            
            {/* 扫描状态 */}
            {isScanning && (
              <Badge count="扫描中" style={{ backgroundColor: '#52c41a' }} />
            )}
          </div>
        </Header>

        {/* 主内容区 */}
        <Content style={{ 
          margin: '24px 16px',
          padding: 24,
          minHeight: 280,
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG
        }}>
          {children}
        </Content>

        {/* 底部状态栏 */}
        <Footer style={{ 
          textAlign: 'center',
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`
        }}>
          Windows 启动项管理器 ©2026 | 
          共 {scanItems.length} 个启动项 | 
          {isScanning ? '正在扫描...' : '就绪'}
        </Footer>
      </Layout>
    </Layout>
  )
}

export default AppLayout
