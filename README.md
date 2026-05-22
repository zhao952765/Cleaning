# Windows 启动项管理器

基于 Electron + React + TypeScript 构建的智能 Windows 启动项管理工具。

## 功能特性

- **智能扫描**：扫描注册表、系统服务、计划任务、启动文件夹等多来源启动项
- **AI 智能分析**：接入 DeepSeek/OpenAI 等 LLM，自动判断启动项安全性和必要性
- **安全管理**：数字签名验证、系统关键项保护、一键还原备份
- **性能优化**：开机速度预估、性能影响分析、批量操作
- **可视化报告**：统计图表、风险项高亮、JSON 报告导出
- **现代化界面**：深色/浅色主题、响应式设计、中文界面

## 截图

> 应用截图位于 `docs/screenshots/` 目录（待补充）

## 系统要求

- Windows 10 或 Windows 11（64 位）
- 4GB 以上内存
- 500MB 可用磁盘空间

## 安装

### 安装包

从 [Releases](https://github.com/your-username/startup-manager/releases) 下载 `.exe` 安装包运行。

### 便携版

下载 `.zip` 压缩包，解压后直接运行 `Windows启动项管理器.exe`，**建议右键选择"以管理员身份运行"**。

### 从源码构建

```bash
git clone https://github.com/your-username/startup-manager.git
cd startup-manager
npm install
npm run dev    # 开发模式
npm run dist   # 打包分发
```

## 快速使用

1. 启动应用，点击 **开始扫描**
2. 查看扫描结果，了解系统中的启动项
3. 使用开关启用/禁用单个启动项
4. 在"设置"页面配置 AI 并开启智能分析
5. 进入"AI 助手"页面进行自然语言对话

## 项目结构

```
startup-manager/
├── src/
│   ├── main/               # Electron 主进程
│   │   ├── ai/             # AI 客户端和提示词
│   │   ├── database/       # SQLite 数据库
│   │   ├── ipc/            # IPC 通信处理器
│   │   ├── scanner/        # 启动项扫描器
│   │   ├── system/         # 系统操作模块
│   │   └── utils/          # 日志等工具
│   ├── preload/            # 预加载脚本
│   ├── renderer/           # React 渲染进程
│   │   ├── components/     # UI 组件
│   │   ├── pages/          # 页面组件
│   │   ├── stores/         # Zustand 状态管理
│   │   └── styles/         # 主题配置
│   └── shared/             # 共享类型和 IPC 通道常量
├── build/                  # 构建资源
└── docs/                   # 文档和截图
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron 28 |
| 前端框架 | React 18 + TypeScript 5 |
| UI 库 | Ant Design 5 |
| 状态管理 | Zustand 5 |
| 数据库 | better-sqlite3 |
| AI SDK | openai |
| 打包工具 | electron-builder |

## 开发

```bash
npm run dev        # 开发模式
npm run build      # 构建
npm test           # 运行测试
npm run typecheck  # 类型检查
npm run lint       # 代码检查
npm run dist       # 打包分发
```

## IPC 通道

所有 IPC 通道集中定义在 `src/shared/ipc/channels.ts` 的 `IPC_CHANNELS` 常量中。main 和 renderer 必须通过该常量引用，禁止硬编码字符串。主要分类：

- `SCAN.*` — 扫描相关
- `ITEM.*` — 启动项操作（切换、删除、批量、还原、关键项检查）
- `AI.*` — AI 分析、对话、配置
- `DB.*` — 数据库操作
- `FILE.*` — 文件信息
- `CACHE.*` — 缓存管理
- `SYSTEM.*` — 系统信息、管理员重启

## 隐私说明

- 所有扫描结果和操作历史存储在本地（`%APPDATA%/startup-manager/`）
- AI 分析仅发送软件元数据（名称、路径、版本），**不发送文件本体**
- 不收集个人文件、文档、图片、浏览器历史等隐私数据

## 许可证

本项目采用 [MIT 许可证](./LICENSE)。
