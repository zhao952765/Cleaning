# Windows 启动项管理器

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows%2010/11-lightgrey.svg)
![Electron](https://img.shields.io/badge/Electron-28.2.0-47848F.svg?logo=electron)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB.svg?logo=react)

**基于 Electron + React + TypeScript 构建的智能 Windows 启动项管理工具**

[功能特性](#-功能特性) • [快速开始](#-快速开始) • [使用指南](#-使用指南) • [开发文档](#-开发文档) • [常见问题](#-常见问题)

</div>

---

## 📸 应用截图

> 以下是应用的主要界面截图（占位符）

### 主界面 - 启动项列表
![主界面](./docs/screenshots/main-dashboard.png)

### AI 分析结果
![AI分析](./docs/screenshots/ai-analysis.png)

### 扫描报告
![扫描报告](./docs/screenshots/scan-report.png)

### AI 助手对话
![AI助手](./docs/screenshots/ai-chat.png)

---

## ✨ 功能特性

### 🔍 智能扫描
- **多来源扫描**：注册表、系统服务、计划任务、启动文件夹
- **快速扫描**：并发扫描技术，5分钟内缓存避免重复扫描
- **详细分析**：提取文件信息、数字签名、版本信息

### 🤖 AI 智能分析
- **DeepSeek/OpenAI/Claude 支持**：兼容多个大语言模型
- **智能评估**：自动判断启动项的必要性和安全性
- **优化建议**：提供个性化的禁用/启用建议
- **自然语言对话**：通过 AI 助手解答疑问

### 🛡️ 安全管理
- **安全等级评估**：可信/可疑/恶意三级分类
- **数字签名验证**：检测文件签名有效性
- **系统关键项保护**：防止误操作导致系统不稳定
- **备份与还原**：所有修改自动备份，支持一键还原

### ⚡ 性能优化
- **开机速度预估**：实时显示当前启动耗时
- **性能影响分析**：评估每个启动项对系统的影响
- **批量操作**：支持批量启用/禁用启动项
- **虚拟列表**：流畅处理大量数据

### 📊 可视化报告
- **统计图表**：饼图、柱状图展示启动项分布
- **风险项高亮**：红色标记可疑和恶意启动项
- **历史对比**：跟踪启动项变化趋势
- **导出功能**：支持 JSON 格式导出报告

### 🎨 现代化界面
- **深色/浅色主题**：支持跟随系统或手动切换
- **响应式设计**：适配不同屏幕尺寸
- **流畅动画**：优雅的过渡效果
- **中文界面**：完全中文化，易于使用

---

## 🚀 快速开始

### 系统要求

- **操作系统**：Windows 10 或 Windows 11（64位）
- **内存**：至少 4GB RAM
- **磁盘空间**：至少 500MB 可用空间
- **.NET Framework**：4.7.2 或更高版本（用于某些系统 API）

### 安装步骤

#### 方式一：下载安装包（推荐）

1. 访问 [GitHub Releases](https://github.com/your-username/startup-manager/releases) 页面
2. 下载最新版本的 `.exe` 安装包
3. 双击运行安装程序
4. 按照提示完成安装

#### 方式二：便携版

1. 下载 `.zip` 便携版压缩包
2. 解压到任意目录
3. 直接运行 `Windows启动项管理器.exe`

#### 方式三：从源码构建

```bash
# 克隆仓库
git clone https://github.com/your-username/startup-manager.git
cd startup-manager

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 生产构建
npm run build

# 打包分发
npm run dist
```

---

## 📖 使用指南

### 1. 首次使用

启动应用后，您会看到主界面。点击左侧菜单的"启动项"进入扫描页面。

### 2. 执行扫描

- 点击 **"开始扫描"** 按钮
- 等待扫描完成（通常需要 5-10 秒）
- 查看扫描结果列表

### 3. 查看详细信息

- 点击任一启动项的 **"详情"** 按钮
- 右侧面板会显示完整信息：
  - 基本信息（路径、版本、厂商）
  - AI 分析结果（安全等级、建议操作）
  - 性能影响评估

### 4. 管理启动项

#### 单个操作
- 使用行内的 **开关** 快速启用/禁用
- 右键菜单提供更多选项

#### 批量操作
1. 勾选多个启动项
2. 点击工具栏的 **"批量禁用"** 按钮
3. 确认操作

### 5. 配置 AI

1. 进入 **"设置"** 页面
2. 选择 AI 提供商（DeepSeek / OpenAI / Claude）
3. 输入 API Key
4. 点击 **"测试连接"** 验证配置
5. 保存配置

### 6. 使用 AI 助手

1. 进入 **"AI 助手"** 页面
2. 输入您的问题，例如：
   - "哪些启动项可以安全关闭？"
   - "为什么开机这么慢？"
   - "这个软件是病毒吗？"
3. 查看 AI 的回答和建议

### 7. 查看扫描报告

1. 进入 **"扫描报告"** 页面
2. 查看统计数据和图表
3. 点击 **"导出 JSON"** 下载报告

---

## ❓ 常见问题

### Q1: 应用需要管理员权限吗？

A: 是的，修改系统启动项需要管理员权限。首次运行时，请以管理员身份运行应用。

### Q2: AI 分析需要联网吗？

A: 是的，AI 分析需要连接到 DeepSeek/OpenAI/Claude 的 API 服务器。请确保网络连接正常。

### Q3: 我的数据安全吗？

A: 非常安全！我们只发送软件的元数据（名称、路径、版本等），**不会上传文件本体或个人隐私信息**。所有数据都存储在本地。

### Q4: 禁用某个启动项后如何恢复？

A: 有两种方式：
1. 在启动项列表中重新启用
2. 在设置页面点击 **"还原所有修改"**

### Q5: 为什么有些启动项显示为"系统关键项"？

A: 这些是 Windows 系统核心组件或服务，禁用可能导致系统不稳定。我们建议您保留它们启用。

### Q6: 应用会开机自启吗？

A: 默认不会。您可以在安装时选择是否创建开机启动快捷方式。

### Q7: 如何更新到最新版本？

A: 
- 如果使用安装包版本，应用会自动检查更新
- 或者手动下载最新安装包覆盖安装

### Q8: 支持其他操作系统吗？

A: 目前仅支持 Windows 10/11。macOS 和 Linux 版本正在开发中。

---

## 🔧 开发文档

### 项目架构

```
startup-manager/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── ai/           # AI 客户端和提示词
│   │   ├── database/     # SQLite 数据库
│   │   ├── ipc/          # IPC 通信处理器
│   │   ├── scanner/      # 启动项扫描器
│   │   ├── system/       # 系统操作模块
│   │   └── utils/        # 工具函数
│   ├── preload/          # 预加载脚本
│   ├── renderer/         # React 渲染进程
│   │   ├── components/   # UI 组件
│   │   ├── pages/        # 页面组件
│   │   ├── stores/       # Zustand 状态管理
│   │   └── styles/       # 主题配置
│   └── shared/           # 共享类型和常量
├── build/                # 构建资源
├── docs/                 # 文档
└── tests/                # 测试文件
```

### 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron 28.2.0 |
| 前端框架 | React 18.2.0 |
| 语言 | TypeScript 5.3.3 |
| UI 库 | Ant Design 5.14.0 |
| 状态管理 | Zustand 5.0 |
| 路由 | react-router-dom 7.x |
| 图表 | Recharts 3.x |
| 数据库 | better-sqlite3 12.x |
| AI SDK | openai 6.x |
| 构建工具 | electron-vite 2.x, Vite 5.x |
| 测试框架 | Vitest |
| 打包工具 | electron-builder |

### 开发环境搭建

```bash
# 1. 安装 Node.js (推荐 LTS 版本)
# https://nodejs.org/

# 2. 克隆仓库
git clone https://github.com/your-username/startup-manager.git
cd startup-manager

# 3. 安装依赖
npm install

# 4. 启动开发服务器
npm run dev

# 5. 运行测试
npm test

# 6. 类型检查
npm run typecheck

# 7. 代码检查
npm run lint
```

### IPC 接口文档

详见 [IPC_CHANNELS 定义](./src/shared/ipc/channels.ts)

主要接口分类：
- **SCAN**: 扫描相关（registry, services, tasks, folder, all）
- **ITEM**: 启动项操作（toggle, delete, get-detail）
- **AI**: AI 相关（analyze, chat, test-connection）
- **DB**: 数据库操作（get-cache, save-cache, get-history）
- **SYSTEM**: 系统操作（get-boot-time, open-file-location）

### AI 提示词扩展

要添加新的 AI 分析类型：

1. 在 `src/main/ai/prompts.ts` 中添加模板
2. 在 `PromptBuilder` 类中添加构建方法
3. 在 `IPCHandlers` 中注册新的 IPC 处理器
4. 在 `preload/index.ts` 中暴露 API

示例：
```typescript
// prompts.ts
export const MY_NEW_PROMPT = `...`

// handlers.ts
ipcMain.handle('ai:my-new-feature', async () => {
  const prompt = promptBuilder.buildMyNewFeature(data)
  const result = await aiClient.chat(prompt)
  return result
})
```

---

## 📝 隐私政策

### 数据收集

我们**不会**收集或传输以下信息：
- ❌ 个人文件内容
- ❌ 文档、图片、视频等私人数据
- ❌ 浏览器历史记录
- ❌ 键盘记录

我们**可能**收集以下匿名数据（需用户同意）：
- ✅ 应用崩溃报告（不含个人信息）
- ✅ 功能使用情况统计
- ✅ 性能指标

### 数据存储

- 所有扫描结果和操作历史存储在**本地**
- 数据库位置：`%APPDATA%\startup-manager\`
- 您可以随时删除这些数据

### AI 数据传输

- 仅发送软件元数据（名称、路径、版本、大小）
- **不发送**文件本体
- 使用 HTTPS 加密传输
- 遵循 AI 提供商的隐私政策

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 [MIT 许可证](./LICENSE)。

---

## 🙏 致谢

感谢以下开源项目：

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Ant Design](https://ant.design/)
- [DeepSeek](https://deepseek.com/)
- [Vite](https://vitejs.dev/)

---

## 📞 联系方式

- **GitHub Issues**: [提交问题](https://github.com/your-username/startup-manager/issues)
- **Email**: support@startupmanager.com
- **网站**: https://startupmanager.com

---

<div align="center">

**Made with ❤️ by Startup Manager Team**

[⭐ Star this repo](https://github.com/your-username/startup-manager) • [🐛 Report Bug](https://github.com/your-username/startup-manager/issues) • [💡 Request Feature](https://github.com/your-username/startup-manager/issues)

</div>
