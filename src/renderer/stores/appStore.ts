import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { StartupItem } from '../../shared/types'
import { ThemeMode } from '../styles/theme'
import { LLMConfig } from '../../main/ai/types'

// 应用状态接口
interface AppState {
  // 扫描相关
  scanItems: StartupItem[]
  isScanning: boolean
  scanProgress: number
  lastScanTime: Date | null
  
  // AI 配置
  aiConfig: LLMConfig | null
  aiConnected: boolean
  
  // 主题设置
  themeMode: ThemeMode
  
  // Actions
  setScanItems: (items: StartupItem[]) => void
  setIsScanning: (scanning: boolean) => void
  setScanProgress: (progress: number) => void
  setLastScanTime: (time: Date) => void
  setAIConfig: (config: LLMConfig | null) => void
  setAIConnected: (connected: boolean) => void
  setThemeMode: (mode: ThemeMode) => void
  clearScanData: () => void
}

// 创建全局 Store
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 初始状态
      scanItems: [],
      isScanning: false,
      scanProgress: 0,
      lastScanTime: null,
      aiConfig: null,
      aiConnected: false,
      themeMode: 'system',

      // Actions
      setScanItems: (items) => set({ scanItems: items }),
      
      setIsScanning: (scanning) => set({ isScanning: scanning }),
      
      setScanProgress: (progress) => set({ scanProgress: progress }),
      
      setLastScanTime: (time) => set({ lastScanTime: time }),
      
      setAIConfig: (config) => set({ aiConfig: config }),
      
      setAIConnected: (connected) => set({ aiConnected: connected }),
      
      setThemeMode: (mode) => set({ themeMode: mode }),
      
      clearScanData: () => set({
        scanItems: [],
        isScanning: false,
        scanProgress: 0,
        lastScanTime: null
      })
    }),
    {
      name: 'startup-manager-storage', // localStorage key
      partialize: (state) => ({
        // 只持久化部分状态
        aiConfig: state.aiConfig,
        themeMode: state.themeMode,
        lastScanTime: state.lastScanTime
      })
    }
  )
)
