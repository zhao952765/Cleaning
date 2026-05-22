import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { StartupItem } from '../../shared/types'
import { ThemeMode } from '../styles/theme'
import { LLMConfig } from '../../main/ai/types'

interface AppState {
  scanItems: StartupItem[]
  isScanning: boolean
  scanProgress: number
  lastScanTime: Date | null
  aiConfig: LLMConfig | null
  aiConnected: boolean
  themeMode: ThemeMode

  setScanItems: (items: StartupItem[]) => void
  setIsScanning: (scanning: boolean) => void
  setScanProgress: (progress: number) => void
  setLastScanTime: (time: Date) => void
  setAIConfig: (config: LLMConfig | null) => void
  setAIConnected: (connected: boolean) => void
  setThemeMode: (mode: ThemeMode) => void
  clearScanData: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      scanItems: [],
      isScanning: false,
      scanProgress: 0,
      lastScanTime: null,
      aiConfig: null,
      aiConnected: false,
      themeMode: 'system',

      setScanItems: (items) => set({ scanItems: items }),
      setIsScanning: (scanning) => set({ isScanning: scanning }),
      setScanProgress: (progress) => set({ scanProgress: progress }),
      setLastScanTime: (time) => set({ lastScanTime: time }),
      setAIConfig: (config) => set({ aiConfig: config }),
      setAIConnected: (connected) => set({ aiConnected: connected }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      clearScanData: () => set({ scanItems: [], isScanning: false, scanProgress: 0, lastScanTime: null })
    }),
    {
      name: 'startup-manager-storage',
      partialize: (state) => ({
        scanItems: state.scanItems,         // 新增：持久化扫描结果
        aiConfig: state.aiConfig,
        themeMode: state.themeMode,
        lastScanTime: state.lastScanTime
      })
    }
  )
)
