# 砺 · 工作台 / LiShi Workbench

**中文** | [English](#english)

面向 Octop 的**桌面客户端**：补齐官方缺失的「本地工作台」—— 云端大脑（Octop）+ 本地手脚（读写文件、执行命令）。

## 架构 / Architecture

```
员工电脑                                      云端
┌──────────────────────┐   HTTPS / WS   ┌────────────────────────────┐
│ 砺工作台 (Electron)   │ ─────────────▶ │ Octop 1.0.2 (官方)          │
│ - 登录 / 专家 / 对话   │   直连          │ - 账号 / 专家 / 会话 / 技能  │
│ - 本地 MCP 服务 :18991│                │ - 记忆（经验沉淀）           │
│ - 项目文件 / 命令执行  │ ◀───────────── │ - 自定义 MCP 连接到客户端     │
└──────────────────────┘   工具调用       └────────────────────────────┘
```

- **不改 Octop 源码**：只用官方 HTTP / WebSocket / 自定义 MCP 接口，锁版本 1.0.2
- **不需要中间后台**：客户端内置 MCP，Octop 直连（内网直连或反向隧道）
- **安全边界**：只允许已登记项目目录；命令白名单；MCP 默认只监听本机

## 功能 / Features

- 账号登录（与 Octop 同源账号）
- 多会话对话，会话隔离、可重命名
- 专家库（直接读取 Octop 专家）
- 本地文件读写、命令执行（白名单）
- 执行过程可视化（工具 / 耗时 / 输出）
- 项目简报 PROJECT.md（项目记忆，自动注入）
- 内置 MCP 服务（供 Octop 直连）

## 快速开始 / Quick start

```bash
cd desktop
npm install
npm start          # 开发运行
npm run dist:mac   # 打 .app / .dmg（macOS）
npm run dist:win   # 打 .exe（需 Windows 或 CI）
```

## 部署 / Deployment

1. 客户端启动后在「设置」查看本地 MCP 地址（默认 `http://127.0.0.1:18991/mcp`）
2. Octop 后台 → 连接器 → 自定义 MCP → 添加该地址（内网可监听 `0.0.0.0`；外网用反向隧道）
3. 助理绑定该 MCP 后，即可读写员工本地文件

## 版本 / Releases

见 [CHANGELOG.md](./CHANGELOG.md)（中英双语）与 Releases。

## 许可 / License

MIT

---

## English

A **desktop client for Octop** that fills the missing piece: the local workbench. Cloud brain (Octop) + local hands (files & commands).

Key points: no Octop source patches (public HTTP / WebSocket / custom-MCP APIs only, pinned to 1.0.2); no middle backend (the client ships an MCP server, Octop connects directly via LAN or a reverse tunnel); safety boundaries (registered folders only, command whitelist, localhost binding by default).

Features, quick start and deployment are the same as the Chinese section above (code blocks are language-neutral).
