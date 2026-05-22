import { ThemeConfig } from 'antd'

// 主题类型
export type ThemeMode = 'light' | 'dark' | 'system'

// 主题色配置
export const themeColors = {
  primary: '#1890ff', // 科技蓝
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#1677ff'
}

// 深色主题配置
export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: themeColors.primary,
    colorSuccess: themeColors.success,
    colorWarning: themeColors.warning,
    colorError: themeColors.error,
    colorInfo: themeColors.info,
    borderRadius: 6,
    fontSize: 14
  },
  algorithm: ['darkAlgorithm']
}

// 浅色主题配置
export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: themeColors.primary,
    colorSuccess: themeColors.success,
    colorWarning: themeColors.warning,
    colorError: themeColors.error,
    colorInfo: themeColors.info,
    borderRadius: 6,
    fontSize: 14
  },
  algorithm: ['defaultAlgorithm']
}

// CSS 变量注入
export const injectThemeVariables = (mode: ThemeMode) => {
  const root = document.documentElement
  
  if (mode === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    mode = isDark ? 'dark' : 'light'
  }

  const colors = mode === 'dark' ? {
    '--color-primary': themeColors.primary,
    '--color-success': themeColors.success,
    '--color-warning': themeColors.warning,
    '--color-error': themeColors.error,
    '--color-info': themeColors.info,
    '--bg-color': '#141414',
    '--text-color': '#ffffff',
    '--border-color': '#303030'
  } : {
    '--color-primary': themeColors.primary,
    '--color-success': themeColors.success,
    '--color-warning': themeColors.warning,
    '--color-error': themeColors.error,
    '--color-info': themeColors.info,
    '--bg-color': '#ffffff',
    '--text-color': '#000000',
    '--border-color': '#d9d9d9'
  }

  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}
