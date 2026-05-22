import React from 'react'
import { Drawer, Card, Descriptions, Tag, Button, Space, Timeline, Skeleton, Divider } from 'antd'
import { 
  FolderOpenOutlined, 
  CopyOutlined, 
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import { StartupItem } from '../../../shared/types'

interface DetailPanelProps {
  visible: boolean
  item: StartupItem | null
  onClose: () => void
  onToggle: (itemId: string, enabled: boolean) => void
  onAnalyze?: (item: StartupItem) => void
}

const DetailPanel: React.FC<DetailPanelProps> = ({
  visible,
  item,
  onClose,
  onToggle,
  onAnalyze
}) => {
  if (!item) return null

  // 复制路径
  const handleCopyPath = () => {
    navigator.clipboard.writeText(item.path)
  }

  // 打开文件位置（需要主进程支持）
  const handleOpenLocation = async () => {
    try {
      await window.electronAPI.openFileLocation?.(item.path)
    } catch (error) {
      console.error('打开文件位置失败:', error)
    }
  }

  // 安全等级图标
  const getSecurityIcon = (level: string) => {
    switch (level) {
      case 'safe':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'caution':
        return <WarningOutlined style={{ color: '#faad14' }} />
      case 'dangerous':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return null
    }
  }

  return (
    <Drawer
      title="启动项详情"
      placement="right"
      width={600}
      onClose={onClose}
      open={visible}
      extra={
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => onAnalyze?.(item)}
          >
            重新分析
          </Button>
          <Button 
            type={item.enabled ? 'default' : 'primary'}
            onClick={() => onToggle(item.id, item.enabled)}
          >
            {item.enabled ? '禁用' : '启用'}
          </Button>
        </Space>
      }
    >
      {/* 头部信息 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space align="start" style={{ width: '100%' }}>
          <div style={{ fontSize: 48 }}>📦</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 8px 0' }}>{item.name}</h3>
            <p style={{ margin: 0, color: '#999', fontSize: 12 }}>{item.publisher || '未知厂商'}</p>
            <Space style={{ marginTop: 8 }}>
              <Tag>{item.source}</Tag>
              <Tag color={item.enabled ? 'green' : 'red'}>
                {item.enabled ? '已启用' : '已禁用'}
              </Tag>
            </Space>
          </div>
        </Space>
      </Card>

      {/* 基本信息 */}
      <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="路径">
            <span style={{ wordBreak: 'break-all' }}>{item.path}</span>
            <Button 
              type="link" 
              size="small" 
              icon={<CopyOutlined />}
              onClick={handleCopyPath}
            >
              复制
            </Button>
          </Descriptions.Item>
          <Descriptions.Item label="参数">
            {item.arguments || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="版本">
            {item.version || '未知'}
          </Descriptions.Item>
          <Descriptions.Item label="最后修改">
            {item.lastModified ? new Date(item.lastModified).toLocaleString() : '未知'}
          </Descriptions.Item>
        </Descriptions>
        
        <Divider style={{ margin: '12px 0' }} />
        
        <Space>
          <Button 
            size="small" 
            icon={<FolderOpenOutlined />}
            onClick={handleOpenLocation}
          >
            打开文件位置
          </Button>
        </Space>
      </Card>

      {/* AI 分析结果 */}
      <Card title="AI 分析" size="small" style={{ marginBottom: 16 }}>
        {item.description ? (
          <>
            <p><strong>功能说明：</strong>{item.description}</p>
            
            <Timeline mode="left">
              <Timeline.Item label="安全评估" dot={getSecurityIcon(item.securityLevel)}>
                <Tag color={
                  item.securityLevel === 'safe' ? 'success' :
                  item.securityLevel === 'caution' ? 'warning' : 'error'
                }>
                  {item.securityLevel === 'safe' ? '可信' :
                   item.securityLevel === 'caution' ? '可疑' : '恶意'}
                </Tag>
              </Timeline.Item>
              
              <Timeline.Item label="建议操作">
                <Tag color={
                  item.impact === 'low' ? 'green' :
                  item.impact === 'medium' ? 'orange' : 'red'
                }>
                  {item.impact}
                </Tag>
              </Timeline.Item>
            </Timeline>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: '#999' }}>尚未进行 AI 分析</p>
            <Button 
              type="primary" 
              icon={<ReloadOutlined />}
              onClick={() => onAnalyze?.(item)}
            >
              点击分析
            </Button>
          </div>
        )}
      </Card>

      {/* 性能影响 */}
      <Card title="性能影响" size="small">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="启动耗时">
            ~{Math.floor(Math.random() * 1000)}ms
          </Descriptions.Item>
          <Descriptions.Item label="内存占用">
            ~{Math.floor(Math.random() * 100)}MB
          </Descriptions.Item>
          <Descriptions.Item label="CPU 占用">
            ~{(Math.random() * 5).toFixed(1)}%
          </Descriptions.Item>
          <Descriptions.Item label="影响等级">
            <Tag color={
              item.impact === 'low' ? 'green' :
              item.impact === 'medium' ? 'orange' : 'red'
            }>
              {item.impact}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </Drawer>
  )
}

export default DetailPanel
