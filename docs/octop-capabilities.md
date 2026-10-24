# Octop 能力接入清单 / Capability Matrix

> 更新：2026-10-24（v0.21.0）。状态：✅ 已接入并实测 · ⚠️ 接口存在但需配置 · ❌ 该版本无公开接口 · ⏳ 待做

## 一、本地电脑访问（客户端独有）/ Local machine access

| 能力 | 状态 | 说明 |
|---|---|---|
| 列目录 | ✅ | MCP `local_list_dir` |
| 读文件 | ✅ | MCP `local_read_file` |
| 写文件 | ✅ | MCP `local_write_file` |
| 执行命令 | ✅ | MCP `local_run_cmd` + 客户端终端（白名单、60s 超时）|
| 目录白名单 | ✅ | 只允许登记过的项目目录 |
| 文件搜索 | ✅ | MCP `local_find_files` |
| 内容搜索 | ✅ | MCP `local_grep_files` |
| 剪贴板读写 | ✅ | MCP `local_clipboard_read/write` |
| 打开路径 | ✅ | MCP `local_open_path`（访达/资源管理器）|

## 二、云端能力 / Cloud capabilities

| 能力 | 接口 | 状态 |
|---|---|---|
| 登录 | `POST /api/auth/login` | ✅ |
| 专家库 | `GET /api/experts` | ✅ 22 个 |
| 助理 | `/api/agents` | ✅ |
| 会话 | `POST /api/agents/{id}/threads` | ✅ |
| 对话 | `WS /api/agents/{id}/chat/ws` | ✅ |
| 技能 | `GET /api/agents/{id}/skills` | ✅ 24 条，可选择下发 |
| 记忆/经验 | `/api/agents/{id}/memory/*` | ✅ 候选 9 条，可通过/驳回 |
| 连接器（自定义 MCP）| `/api/connectors/custom-mcp` | ✅ |
| 知识库 | `/api/knowledge-bases` | ✅ 已启用（ONNX bge-small-zh），可建库、上传文档、检索 |
| 技能市场 | `/api/skill-packages/hub/search` | ✅ |
| 子代理目录 | `/api/subagent-catalog` | ✅ |
| 当前助理子代理 | `/api/agents/{id}/subagents` | ✅ |
| 模型供应商 | `/api/providers` | ✅ |
| 渠道 | `/api/agents/{id}/channels` | ✅ 可建/测/删（需凭证）|
| 浏览器 | `/api/browser/env-status`、`/api/browser/install` | ✅ Chromium 已安装，实测可抓网页 |
| 终端 | `/api/agents/{id}/terminal/context` | ✅ |
| 用户 | `/api/users` | ✅ 管理员可见 |
| 备份 | `/api/admin/backup/status`、`/api/admin/backup/list` | ✅ |
| 任务 | — | ❌ 该版本未暴露 REST 接口 |
| 观测 observability | — | ❌ 仅控制台，无公开 REST |
| 语音 voice | `WS /stt-stream`（助手侧）| ❌ 客户端侧未开放 |

## 三、待做 / Next

1. 渠道实操：飞书/企微/微信扫码与机器人创建（需 Octop 启用渠道插件）
2. 浏览器实操：安装/启动/会话接管（当前环境 headless-server）
3. 知识库：配置向量模型后建库、上传文档、检索
4. 本地扩展工具：文件搜索、批量处理、剪贴板、打开应用
5. 语音：等 Octop 开放客户端接口

## 四、发布流程 / Release flow

- 改动 → 本机实测 → 打 tag `vX.Y.Z` → GitHub Actions 自动构建 Windows 并附加到 Release；macOS 包本地上传
- 每版更新 `CHANGELOG.md`（中英双语）
- 仓库 public：Actions 免费不限量（Windows 单次约 6–8 分钟）
