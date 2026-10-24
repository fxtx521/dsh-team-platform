# 更新日志 / Changelog

所有重要变更记录在此。格式参考 Keep a Changelog；版本遵循语义化。每个版本含**中文 + English** 说明。
All notable changes are documented here. Format follows Keep a Changelog; versions follow SemVer. Each release has **Chinese + English** notes.

---

## [0.14.1] - 2026-10-24

### 中文

- **登录流程修正**：恢复「登录框 + 记住登录 + 退出登录」的正常流程；自动从工作区读取 token 的行为改为**仅开发开关**（默认关闭）。
- 设置页显示当前登录账号与助理，并提供「退出登录」。
- 安全审计：仓库中**未包含**任何 token / 密钥；`.octop-token` 已加入忽略列表。

### English

- **Login flow fixed**: the normal flow (login dialog + remember + logout) is restored; auto-reading a workspace token is now a **dev-only switch** (off by default).
- Settings shows the signed-in account/agent and a Logout button.
- Security audit: the repo contains **no** tokens or secrets; `.octop-token` is ignored.

---

## [0.14.0] - 2026-10-24

### 中文

- **经验沉淀接 Octop**：客户端「经验」页直接读取 Octop 的 `memory/candidates`（经验候选）与 agent `skills`（技能），主管可通过 / 驳回。
- **免手动登录**：客户端启动时若检测到工作区 `.octop-token`，自动写入配置并连接 Octop（无需点登录框，也不依赖界面操控）。
- 自动登录后日志输出「已从工作区自动配置 Octop token / Octop 连接正常」。

### English

- **Experience distillation now backed by Octop**: the client experiences page reads Octop `memory/candidates` and per-agent `skills` directly; reviewers can promote or reject.
- **No manual login needed**: when a workspace `.octop-token` exists, the client configures itself and connects to Octop on startup.
- Startup log prints "auto-configured Octop token" and "Octop connection OK".

---

## [0.13.0] - 2026-10-24

### 中文

- **客户端完全直连 Octop**：登录、助理列表、专家库、对话（WebSocket `/api/agents/{id}/chat/ws`）全部直达 Octop，不再经过自研后台。
- 心跳改为探测 Octop `/api/health`；未登录时明确提示「未登录 Octop」。
- 内置 MCP 服务与反向隧道保持不变，Octop 可直连本地文件/命令。
- 设置页新增「Octop 地址」；旧后台配置保留但不再使用。
- 移除本地守护任务（旧后台已停用，不再需要）。

### English

- **The client now talks to Octop directly**: login, agents, experts and chat (WebSocket `/api/agents/{id}/chat/ws`) all go straight to Octop; no self-hosted backend in the path.
- Heartbeat now probes Octop `/api/health`; when not logged in it clearly shows "not logged in to Octop".
- Built-in MCP server and reverse tunnel unchanged; Octop can access local files/commands directly.
- Settings gained an "Octop URL" field; legacy backend settings kept but unused.
- Removed the local watchdog job (the old backend is retired).

---

## [0.12.0] - 2026-10-24

### 中文

**架构收敛：彻底停用自研后台，仓库瘦身。**

- 停用并 disable 自研平台服务（账号/看板/任务/经验/技能下发全部下线）
- 仓库只保留客户端与文档：`desktop/` + `docs/`，删除 `platform/`、`sites/`、`plugins/`、`tools/`
- README 重写为「客户端直连 Octop + 内置 MCP」架构说明（中英双语）
- 文档仅保留 `docs/octop-direct.md`（接口清单 / 迁移步骤 / 兼容策略）
- 运行态：Octop（18090）与客户端内置 MCP（18991）不再依赖旧后台

### English

**Architecture consolidation: the self-hosted backend is fully retired; repository slimmed.**

- Stopped and disabled the self-hosted platform (accounts / dashboard / tasks / experiences / skill distribution are gone)
- Repo now only contains the client and docs: `desktop/` + `docs/`; removed `platform/`, `sites/`, `plugins/`, `tools/`
- README rewritten for the "client connects directly to Octop + built-in MCP" architecture (Chinese + English)
- Only `docs/octop-direct.md` kept (API inventory / migration / compatibility)
- Runtime: Octop (18090) and the client MCP (18991) no longer depend on the old backend

---

## [0.11.0] - 2026-10-24

### 中文

**新增**
- **客户端内置 MCP 服务**：客户端启动后本地提供 `http://127.0.0.1:18991/mcp`（可配置端口），暴露 4 个工具：列目录 / 读文件 / 写文件 / 执行命令；只允许「已登记项目目录」，命令需白名单且默认关闭外部绑定。
- **Octop 直连本地客户端**：Octop 后台把客户端 MCP 注册为「自定义 MCP 服务」后，云端助理可**直接**读写员工本地文件，**不经过自研后台**（实测 6.5 秒列出本地目录 3 个文件）。
- 设置页新增「本地 MCP 服务」区块：显示地址、开关。

**修复**
- 专家切换后对话报错/无回复（会话线程按「会话 + 助理」维度创建，专家助理自动补默认模型）。

**说明**
- 架构调整：自研后台不再作为必经中间层；仅保留可选看板能力。
- 不给 Octop 打补丁；只用其公开的 HTTP / WebSocket / MCP 接口，锁版本 1.0.2。

### English

**Added**
- **Built-in MCP server in the desktop client**: exposes `http://127.0.0.1:18991/mcp` with 4 tools (list dir / read file / write file / run command). Access is limited to registered project folders; commands are whitelisted and external binding is off by default.
- **Octop connects to the local client directly**: once the client MCP is registered as a Custom MCP server in Octop, cloud agents can read/write employee-local files **without our own backend** (verified: listing a local folder took 6.5s).
- Settings page shows the local MCP endpoint and an on/off switch.

**Fixed**
- Expert switch caused empty replies (threads are now created per session+agent; expert agents get a default model automatically).

**Notes**
- Architecture change: our backend is no longer a mandatory middle layer; only an optional dashboard is kept.
- No patches to Octop source; only public HTTP/WebSocket/MCP APIs, pinned to 1.0.2.

---

## [0.10.1] - 2026-10-24

### 中文
- 修复：切换专家后对话报错/无回复（线程错配 + 专家助理无默认模型）。
- 修复：同名助理已存在时创建失败，改为先按专家名查找。

### English
- Fixed: empty replies after switching experts (thread mismatch + expert agents had no default model).
- Fixed: agent creation failed when an agent with the same name already existed; now looked up first.

## [0.10.0] - 2026-10-24

### 中文
- 新增：客户端专家库（22 个专家可切换，每个专家一个独立助理实例）。
- 修复：经验提炼只针对「有本地执行步骤」的任务，纯聊天不再入库；清理了被污染的技能与经验。

### English
- Added: expert library in the client (22 experts, each mapped to its own agent).
- Fixed: experience distillation now requires real local tool steps; chat-only tasks are skipped; polluted skills/experiences cleaned.

## [0.9.0] - 2026-10-24

### 中文
- 新增：网页「账号管理」页（列表 / 新建 / 改角色 / 重置密码 / 禁用）。
- 说明：账号体系为平台自建（PBKDF2 加盐），不依赖 Octop/飞书/AD。

### English
- Added: account management page (list / create / change role / reset password / disable).
- Note: accounts are self-hosted (PBKDF2 salted), independent of Octop/Feishu/AD.

## [0.8.0] - 2026-10-24

### 中文
- 新增：统一账号（客户端与网页同一套账号密码）、登录接口、设备自动绑定、账号管理接口。

### English
- Added: unified accounts shared by client and web, login API, automatic device binding, user management APIs.

## [0.7.0] - 2026-10-24

### 中文
- 新增：身份与权限（员工/主管/管理员），审核接口按角色校验，客户端按角色显示审核按钮。

### English
- Added: identity and roles (employee / reviewer / admin), role-checked approval APIs, role-aware UI.

## [0.6.x] - 2026-10-24

### 中文
- 新增：执行过程可视化、项目简报、文件预览、我的任务页、经验页、web 周报。
- 修复：会话串味（每会话独立线程）、快速新建会话合并、项目只能加一个。

### English
- Added: execution timeline, project brief (PROJECT.md), file preview, my-tasks page, experiences page, weekly report.
- Fixed: session cross-talk (per-session threads), fast session merge, only-one-project bug.

## [0.5.0] - 2026-10-23

### 中文
- 新增：本地 MCP 网关、客户端长轮询执行器、云端 AI 读写本地文件。
- 修复：MCP 握手卡住对话、服务端事件循环阻塞、SQLite 写锁、客户端 fetch 挂起。

### English
- Added: local MCP gateway, client long-poll executor, cloud AI reading/writing local files.
- Fixed: MCP handshake hang, blocked event loop, SQLite write locks, client fetch hang.

## [0.1.0 - 0.4.0] - 2026-10-22

### 中文
- P0 平台（登录/终端/任务/看板/详情）、客户端上报插件、Octop 独立部署与品牌定制、平台与 Octop 打通、业务模板（客户核查/台账/标书）、技能库与下发、产物回流、经验提炼。

### English
- P0 platform (login / terminals / tasks / dashboard / detail), client reporter plugin, self-hosted Octop with branding, platform-Octop integration, business templates, skills library and distribution, artifact round-trip, experience distillation.
