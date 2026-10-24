# Octop 能力接入清单 / Capability Matrix

目标：桌面客户端把云端（Octop）能力**全部接过来**，同时保留「访问本地电脑」的独有能力（内置 MCP）。
Goal: bring **all** cloud (Octop) capabilities into the desktop client, while keeping the unique local-computer access via the built-in MCP server.

## 一、本地电脑访问（客户端独有能力）/ Local machine access (client-only)

| 能力 Capability | 状态 Status |
|---|---|
| 列目录 list dir | ✅ MCP `local_list_dir` |
| 读文件 read file | ✅ MCP `local_read_file` |
| 写文件 write file | ✅ MCP `local_write_file` |
| 执行命令 run command | ✅ MCP `local_run_cmd`（白名单 + 超时）|
| 项目目录白名单 sandbox | ✅ |
| 搜索文件 / 批量 / 剪贴板 / 打开应用 | ⏳ 规划中 planned |

## 二、云端能力（Octop）/ Cloud capabilities

| 能力 Capability | 接口 API | 状态 Status |
|---|---|---|
| 登录 login | `POST /api/auth/login` | ✅ |
| 专家库 experts | `GET /api/experts` | ✅ |
| 助理 agents | `GET/POST/PATCH /api/agents` | ✅ |
| 会话 threads | `POST /api/agents/{id}/threads` | ✅ |
| 对话 chat | `WS /api/agents/{id}/chat/ws` | ✅ |
| 技能 skills | `GET /api/agents/{id}/skills` | ✅ 读取 + 选择下发 |
| 经验/记忆 memory | `/api/agents/{id}/memory/*` | ✅ 候选读取 + 通过/驳回 |
| 连接器 connectors（自定义 MCP）| `/api/connectors/custom-mcp` | ✅ |
| 知识库 knowledge bases | `/api/knowledge_bases/*` | ⏳ 批次一 |
| 任务 tasks | `/api/tasks/*` | ⏳ 批次一 |
| 联网搜索 search | `/api/search/*` | ⏳ 批次一 |
| 终端 terminal | `WS /api/agents/{id}/terminal/ws` | ⏳ 批次一 |
| 浏览器自动化 browser | `/api/browser/*` | ⏳ 批次二 |
| 插件 plugins | `/api/plugins/*` | ⏳ 批次二 |
| 渠道 channels | `/api/channels/*` | ⏳ 批次二 |
| 子代理 subagents | `/api/subagents/*` | ⏳ 批次二 |
| 语音 voice | `/stt-stream`、tts | ⏳ 批次三 |
| 观测 observability | `/api/observability/*` | ⏳ 批次三 |
| 模型/供应商 providers | `/api/providers/*` | ⏳ 批次三 |
| 用户与权限 users | `/api/users/*` | ⏳ 批次三 |
| 备份 backup | `/api/backup/*` | ⏳ 批次三（管理端）|

## 三、接入批次 / Planned batches

1. **批次一（业务高频）**：知识库、任务、联网搜索、终端
2. **批次二（自动化）**：浏览器、插件、渠道、子代理
3. **批次三（管理/增强）**：语音、观测、模型供应商、用户权限、备份

## 四、发布流程 / Release flow

- 打 tag `vX.Y.Z` → GitHub Actions 在 `windows-latest` 构建 Windows 安装包并**自动附加到 Release**
- macOS 包在本机构建后上传到同一 Release
- 每个版本更新 `CHANGELOG.md`（中英双语）

## 五、GitHub Actions 额度 / Quota

- 仓库为 **public** → Actions **不限制用量**（免费）
- 私有仓库免费额度 2000 分钟/月；单次 Windows 构建约 6–8 分钟
