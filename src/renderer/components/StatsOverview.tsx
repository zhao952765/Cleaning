import React from 'react'
import { Card, Statistic, Row, Col } from 'antd'
import { 
  ThunderboltOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  RocketOutlined 
} from '@ant-design/icons'

interface StatsOverviewProps {
  totalItems?: number
  enabledCount?: number
  disabledCount?: number
  optimizedCount?: number
}

const StatsOverview: React.FC<StatsOverviewProps> = ({
  totalItems = 0,
  enabledCount = 0,
  disabledCount = 0,
  optimizedCount = 0
}) => {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false}>
          <Statistic
            title="启动项总数"
            value={totalItems}
            prefix={<RocketOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false}>
          <Statistic
            title="已启用"
            value={enabledCount}
            prefix={<ThunderboltOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false}>
          <Statistic
            title="已禁用"
            value={disabledCount}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: '#ff4d4f' }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card bordered={false}>
          <Statistic
            title="已优化"
            value={optimizedCount}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
    </Row>
  )
}

export default StatsOverview
