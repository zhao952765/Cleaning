import React from 'react'
import { FixedSizeList as List } from 'react-window'
import { StartupItem } from '../../../shared/types'

interface VirtualStartupListProps {
  items: StartupItem[]
  height: number
  width: number
  itemHeight: number
  renderItem: (item: StartupItem, index: number) => React.ReactNode
}

/**
 * 虚拟启动项列表
 * 使用 react-window 实现高性能渲染大量数据
 */
const VirtualStartupList: React.FC<VirtualStartupListProps> = ({
  items,
  height,
  width,
  itemHeight,
  renderItem
}) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = items[index]
    
    return (
      <div style={style}>
        {renderItem(item, index)}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#999'
      }}>
        暂无数据
      </div>
    )
  }

  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      width={width}
    >
      {Row}
    </List>
  )
}

export default VirtualStartupList
