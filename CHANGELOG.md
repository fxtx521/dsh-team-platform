# 更新日志 / Changelog

## 0.47.1（2026-10-28，已撤回）
- 该版本因发布流水线取错源码目录（tag 内 desktop 仍是 0.47.0），Windows 包名与内容版本不符，已撤回并删除发布与 tag；同内容以 0.47.2 重发。

## 0.47.2（2026-10-28）
- 修复全局搜索弹层被裁（误用普通弹窗样式导致关闭按钮与输入框被裁剪）；打开/关闭/短查询推进请求序号，防止旧结果覆盖；知识库列表加请求序号。
- 0.47.1 因流水线取错源码目录导致 Windows 包版本错误，已撤回，0.47.2 为重发版。

### EN
- Fixed the clipped global-search overlay (generic modal styles cut off the close button and input); request sequences on open/close/short queries and on the KB document list prevent stale overwrites.
- 0.47.1 was withdrawn because the pipeline picked a stale desktop directory, so the Windows asset had the wrong version; 0.47.2 supersedes it.


## 0.47.0（2026-10-28）
- 新增全局搜索：⌘⇧F 或顶栏「搜索」，一次搜会话标题与消息、项目文件名与内容、知识库文档；知识库结果点开自动定位并高亮命中文档。
- 修复搜索浮层常驻遮挡界面的问题（隐藏样式缺失）；补充输入防抖、点遮罩关闭、请求序号防抖覆盖。

### EN
- Added global search (⌘⇧F or the top-bar button): sessions, project file names/content and KB documents in one box; KB hits jump to and highlight the matched document.
- Fixed the search overlay that stayed visible and blocked the UI; added input debounce, mask-click close and a request sequence guard.

## 0.46.0（2026-10-27）
- 新增专家团派活：对话专家下拉列出团队，专家团卡片可「派活」；修复团队 id 被当专家解析导致派活不可达的阻断问题。
- 定时任务支持启用/停用。

### EN
- Added team dispatch: teams appear in the chat expert dropdown and team cards offer Dispatch; fixed the blocking bug where team IDs were resolved as expert IDs.
- Cron jobs can be enabled or disabled.

## 0.45.0（2026-10-27）
- 新增技能市场（SkillHub 搜索与安装）、知识库文档管理（列表/删除）、模型供应商与默认模型切换（密钥仅掩码）。

### EN
- Added SkillHub marketplace (search & install), KB document management (list/delete), model providers with masked keys and active-model switching.

## 0.44.0（2026-10-27）
- 与官方对齐第一批：专家团（建团/解散）、定时任务（新建/立即跑/删除）、云端记忆（原子事实/候选采纳忽略）。

### EN
- First upstream-alignment batch: expert teams (create/dissolve), cron jobs (create/run-now/delete), cloud memory (atoms and candidate promote/reject).

## 0.43.1（2026-10-27）
- Windows 自更新验证版；更新链加固（size+sha256 校验、备份回滚、退出等待、失败清理）。

### EN
- Windows self-update verification build; hardened update chain (size + sha256, backup/rollback, exit wait, cleanup).

## 0.43.0（2026-10-27）
- 自更新、自建更新源、用量与审计、渠道管理、深色模式等。

### EN
- Self-update, self-hosted update source, usage & audit, channel management, dark mode.


所有重要变更记录在此。格式参考 Keep a Changelog；版本遵循语义化。每个版本含**中文 + English** 说明。
All notable changes are documented here. Format follows Keep a Changelog; versions follow SemVer. Each release has **Chinese + English** notes.

---

## [0.42.0] - 2026-10-27

说明：0.5.0/0.6.0 版本号回退已修正——此前误发 v0.5.0 / v0.6.0，按语义化版本它们低于 0.41.0，老客户端不会认为这是更新；本版把两批改动合并为 0.42.0，v0.5.0 / v0.6.0 已标记为预发布，请以本版为准。

### 中文

- **执行审计**：工具调用、命令执行、文档入库、渠道操作、拦截全留痕（只记摘要），按本地日期分文件，可导出 CSV；时间按本地时区显示
- **用量与配额**：读 Octop 账单显示累计 token、输入输出、缓存命中率、调用与轮次、最近一天用量；可设每日/每月 token 额度，超八成提醒
- **文档解析入库**：知识库上传支持 docx、pdf、xlsx、txt、md，本地解析成文本再传云端
- **模型预设**：对话区一键切换省钱 / 写作 / 深度分析
- **敏感拦截**：发送前本地规则校验，拦截词直接不发，提醒词照常发
- **渠道接入**：设置页填飞书 / 企微 / 钉钉 / Slack 的 App ID 与 Secret，提交给云端 Octop 绑定，可看列表、可删除；凭证只发云端不留本地
- **会话导出**：当前对话导出 Markdown 到下载目录
- **快捷键**：Cmd+K 搜会话、Cmd+Shift+N 新建、Cmd+Enter 发送
- **失败自动重试**：一轮失败先自动重试一次再报错
- **深色模式**：设置里开关，重启保持
- **稳定性**：登录凭据加密保存且修复了勾选「记住登录」不生效的问题；MCP 隧道单实例（清理遗留隧道进程）；非 macOS 不拉隧道；未登录不刷 401；MCP 会话协议补齐；IPC 幂等注册
- **验证**：独立子代理复测通过（语法、IPC 74/74、8 个页面无运行时报错、MCP 200、审计落盘、云端接口 200、版本一致）；助理调本地工具 9 秒返回

### English

- **Audit trail** with local dates and local-time display, CSV export
- **Usage and quotas** panel backed by Octop billing, with daily/monthly token limits and 80% warnings
- **Document ingest** for docx/pdf/xlsx/txt/md parsed locally before upload
- **Model presets** (budget / writing / deep analysis)
- **Sensitive guard** before sending
- **Channel onboarding** for Feishu / WeCom / DingTalk / Slack via the cloud Octop
- **Session export** to Markdown
- **Shortcuts** Cmd+K / Cmd+Shift+N / Cmd+Enter
- **Automatic single retry** on a failed turn
- **Dark mode** toggle, persisted
- **Reliability fixes**: encrypted credentials and a real fix for the remember-login flag, single-instance MCP tunnel, no tunnel on non-macOS, no 401 spam while logged out, MCP session protocol, idempotent IPC
- Verified by an independent subagent: syntax, 74/74 IPC parity, 8 pages without runtime errors, MCP 200, audit rows, cloud endpoints 200, version consistency

---

## [0.6.0] - 2026-10-27

### 中文

**稳定性修复（这次踩的坑一并堵上）**
- **登录过期自动续登**：登录凭据用系统 safeStorage 加密存本机；token 过期时自动用凭据续登，续不上会弹登录框并提示，不再出现「专家列表空了、发消息不回」
- **401/403 明确提示**：接口鉴权失败会写日志并通知界面，不再静默失败
- **本地 MCP 隧道改由客户端托管**：客户端启动后自己拉起反向隧道，断开每 8 秒重连，不依赖外部脚本；这是之前「mcp load failed」的根因
- **MCP 会话协议补齐**：initialize 返回 `Mcp-Session-Id`，支持 GET 的 SSE 推送通道与 DELETE 关闭会话
- **IPC 注册幂等化**：同一通道重复注册先注销旧的，避免 Electron 抛异常导致 App 起不来
- 实测：连接器探测 ok=true、工具 9 个；让助理读本地 说明.txt，4.7 秒返回内容；直接对话 6 秒回复

### English

**Reliability fixes (the pitfalls from this round)**
- **Silent re-login**: credentials are encrypted with the OS safeStorage; when the token expires the client logs in again automatically and falls back to a login prompt instead of showing empty expert lists
- **Explicit 401/403 handling**: auth failures are logged and surfaced to the UI
- **The local MCP tunnel is now owned by the client**: it spawns the reverse tunnel on startup and reconnects every 8 seconds; its absence was the root cause of `mcp load failed`
- **MCP session protocol**: initialize returns `Mcp-Session-Id`; GET SSE stream and DELETE session are supported
- **Idempotent IPC registration**: re-registering a channel unregisters the old handler instead of crashing Electron at startup
- Verified: connector probe ok with 9 tools; the agent read a local file in 4.7s; plain chat replied in 6s

---

## [0.40.0] - 2026-10-26

### 中文

- **长任务实时进度**：等待提示从「思考中 N 秒」升级为「思考中 N 秒 · 第 k 步：读取 报价单.xlsx」
- 每当云端调用本地工具（列目录、读写文件、搜索、执行命令），进度条上的步骤号和当前动作会立刻更新
- 步骤内容同时以条目形式留在对话里，跑完可回看每一步
- 已验证：语法检查、打包启动、Octop 连接正常、本地 MCP 200

### English

- **Live progress for long turns**: the waiting indicator now reads like \"thinking 12s · step 3: read quote.xlsx\" instead of only a timer
- Every local tool call (list/read/write/search/run) immediately updates the step number and current action
- Each step is also appended to the conversation so the whole run can be reviewed afterwards
- Verified with syntax checks and a rebuilt app; Octop connected, local MCP healthy

---

## [0.39.0] - 2026-10-26

### 中文

- **删除确认**：会话删除、项目移除都先弹确认框，项目那条还写明「只取消登记，不删文件」
- **录音倒计时**：点麦克风后按钮显示 5 秒倒计时，不再让人干等不知道录没录
- **思考计时**：助理回复前的等待提示带上秒数，长任务能看出过了多久
- 已验证：语法检查通过、打包启动后 Octop 连接正常、MCP 200

### English

- **Confirmations**: deleting a session or removing a project now asks first (the project dialog notes that files are untouched)
- **Recording countdown**: the mic button counts down 5 seconds so you know it is recording
- **Waiting timer**: the thinking indicator shows elapsed seconds, useful for long turns
- Verified with syntax checks; app starts with Octop connected and MCP healthy

---

## [0.38.0] - 2026-10-26

### 中文

- **失败重试**：对话出错的那条消息上直接给「重试」按钮，点一下重新发一遍，不用手动重敲
- **拖拽文件**：把文件直接拖进对话区域就能附加为上下文（走系统文件路径，不复制内容）
- 两项都做了语法检查与重新打包验证，启动后日志显示 Octop 连接正常、本地 MCP 200

### English

- **Retry on failure**: failed replies show a Retry button that re-sends the same prompt
- **Drag and drop**: drop files onto the chat area to attach them as context (uses the real file path)
- Verified with syntax checks and a rebuilt app; startup logs show Octop connected and local MCP healthy

---

## [0.37.0] - 2026-10-24

### 中文

**P0 体验收口（第一组）**
- **会话搜索**：会话栏加搜索框，按标题和消息内容过滤
- **消息操作**：每条 AI 回复加「复制」「重新生成」（重新生成会撤回该问并重跑）
- **实时进度**：助理思考时显示动画点；云端调用本地工具时，对话里实时出现「📂 读取文件…」等步骤（MCP 工具执行现在会向前端推送事件）
- 无头渲染截图核对搜索框与示例卡片布局

### English

**P0 polish (batch 1)**
- **Session search**: filter sessions by title and message content
- **Message actions**: Copy and Regenerate on each AI reply (regenerate removes that turn and re-runs)
- **Live progress**: animated typing dots, plus real-time step entries when the cloud agent calls local MCP tools
- Layout verified with headless screenshots

---

## [0.36.0] - 2026-10-24

### 中文

- **对话示例提示词**：空会话显示 4 个例子（台账整理/客户核查/标书初稿/文件分类），点一下自动填入输入框
- **终端增强**：加「清屏」按钮；命令历史支持 ↑/↓ 翻
- **错误提示友好化**：不再直接甩 JSON/英文，统一成中文提示（登录过期/连不上云端/助理未启动/技能不可用/模型失败/超时）
- 修复变量名重复导致的语法错误（`cc` 重复声明）
- 截图核对：示例卡片与上下文标签不遮挡输入框

### English

- **Sample prompts**: empty chats show four examples (ledger, customer check, bid draft, file sorting); one click fills the composer
- **Terminal**: Clear button plus command history via ArrowUp/ArrowDown
- **Friendly errors**: raw JSON/English replaced with clear Chinese messages (expired login, unreachable cloud, agent not running, skill unavailable, model failure, timeout)
- Fixed a syntax error from a duplicated variable name
- Screenshots verified that samples and chips do not overlap the composer

---

## [0.35.0] - 2026-10-24

### 中文

- **对话上下文标签**：输入框上方显示本轮启用的「技能：xxx」「知识库：xxx」标签，可点 ✕ 移除
- **产物操作**：产物列表可直接「在访达显示」；点条目仍可预览
- 标签随技能/知识库选择实时更新，切换专家时清空避免串用
- 用无头渲染截图核对了标签与按钮位置（不遮挡输入框）

### English

- **Context chips**: chips above the composer show the skills and knowledge bases used by the current turn, removable via the x
- **Artifact actions**: artifacts can be revealed in Finder directly; clicking still previews the file
- Chips update as you pick skills/bases and reset when switching experts
- Verified with headless screenshots that chips do not overlap the composer

---

## [0.34.0] - 2026-10-24

### 中文

- **新手引导**：首次打开弹三步引导（选项目 → 直接说事 → 产物自动存），点「知道了」后不再出现
- **经验页卡片化**：经验候选显示为卡片（标题/类型/状态），主管可直接「通过 / 驳回」
- **项目文件卡片化**：文件列表改成卡片网格，悬停高亮，避免长文件名排版错乱
- 顺手修掉重复的 `requireLogin()` 调用
- 每页仍用无头渲染截图复核（经验页/项目页/概览页）

### English

- **Onboarding**: a three-step welcome on first launch (pick a project → just ask → artifacts are saved), dismissed permanently after clicking Got it
- **Experiences as cards**: candidates show title/type/status with promote/reject actions
- **Project files as cards**: the file list is now a card grid with hover states
- Removed a duplicated `requireLogin()` call
- Pages re-checked with headless screenshots

---

## [0.33.0] - 2026-10-24

### 中文

**对话可直接引用知识库（实测）**
- 对话头部新增「知识库 N」按钮：选一个/多个知识库，发送时随对话带上（字段 knowledge_base_ids）
- **实测**：引用「团队知识库」提问「台账整理规范里日期格式怎么写」，助理答 `YYYY-MM-DD`（内容来自我们上传的文档）
**设置页瘦身**
- 「安全与权限」「本地 MCP」「诊断」「旧后台」收进「高级设置 / 诊断」折叠区，默认收起
**修复**
- 修掉一个后遗症：聊天视图被 CSS 强制常显，导致设置/知识库等页面顶部也出现对话面板；现在只在「对话」页显示
- 每页用 1400×900 无头渲染截图复核，确认单页显示正常

### English

**Chat can reference knowledge bases (verified)**
- New Knowledge bases N button in the chat header: pick one or more bases; they are sent with the turn (knowledge_base_ids)
- Verified: referencing the Team KB and asking about the ledger date format returned YYYY-MM-DD from the uploaded document
**Settings slimmed**
- Security, local MCP, diagnostics and legacy backend moved into a collapsed Advanced section
**Fixed**
- Regression fix: the chat view was forced visible by CSS and appeared on every page; now only on the Chat page
- Each page re-checked with 1400x900 headless screenshots

---

## [0.32.0] - 2026-10-24

### 中文

**窗口缩放不再遮挡（响应式布局）**
- 1240px 以下：会话栏与上下文栏收窄；1080px 以下：右侧上下文面板自动隐藏（保留对话与文件面板主要功能）
- 980px 以下：左侧导航变图标栏、隐藏快捷开始与员工信息，避免文字竖排/挤压
- 对话区高度随窗口自适应（修掉输入框被顶出视口的问题）
- 长文本自动换行（消息、卡片、文件名），不再溢出遮挡
- 已按 980×640 / 1100×760 / 1240×800 / 1400×900 四档截图验证

### English

**No more overlap when resizing (responsive layout)**
- Below 1240px the session and context columns narrow; below 1080px the right context panel hides automatically
- Below 980px the sidebar collapses to icons and quick-start/employee info hide to avoid vertical text
- The chat area height adapts to the window (fixes the input being pushed out of view)
- Long text wraps (messages, cards, file names) instead of overflowing
- Verified with screenshots at 980x640 / 1100x760 / 1240x800 / 1400x900

---

## [0.31.0] - 2026-10-24

### 中文

- 概览页新增「常用专家」：6 个专家卡片，点「开始对话」直接用
- 技能库改为卡片网格，每个技能带「用于对话」按钮（点了自动带上该技能）
- 文件预览弹窗新增「＋ 附加到对话」：项目里的文件一键带进对话当上下文
- 技能页/首页数据均跟随当前助理

### English

- Overview gained a Frequently used experts row: six cards with Start chat
- The skills page is now a card grid; each skill has a Use in chat button
- File preview modal gained Attach to chat so a project file becomes chat context in one click
- Skills and home data follow the currently selected agent

---

## [0.30.0] - 2026-10-24

### 中文

**工作台功能补齐（第二阶段）**
- 「任务」页改为「**执行记录**」：展示本机会话、消息数、工具执行次数，点开看每一步；下方新增「**产物**」列表（项目 产出/ 目录，可预览）
- 「概览」页改为今日工作台：今日会话 / 工具执行 / 项目数 + 最近会话（点一下继续）+ 运行日志
- 清理死代码：移除依赖已停用后端的旧任务函数与残留引用（api.tasks / showTask / cleanTitle）
- 每页均用无头浏览器渲染截图检查布局，再打包发布

### English

**Workbench features (phase 2)**
- The Task page became **Execution record**: local sessions, message counts, tool-run counts, per-session step detail; plus an **Artifacts** list from the project 产出/ folder with preview
- The Overview page is now a daily workbench: today sessions / tool runs / projects, recent sessions (click to resume), and run logs
- Removed dead code that still referenced the retired backend (api.tasks / showTask / cleanTitle)
- Each page is rendered headlessly and screenshotted before packaging

---

## [0.29.0] - 2026-10-24

### 中文

**UI 按 WorkBuddy 形态重构（第一阶段）**
- 对话页改为**三栏工作台**：左「会话列表」+ 中「对话」+ 右「上下文面板」
- 右键上下文面板支持三个标签：**文件**（项目文件树，点击预览）、**知识库**（列表与文档数）、**产物**（项目 产出/ 目录）
- 新增「**知识库**」功能页：新建知识库、从本地项目上传文件、查看文档状态与分片数
- 新增「**专家广场**」：22 个专家卡片，点「开始对话」自动切换专家
- 原「云端能力」页降级为 **设置 → 诊断**（接口自查用，不再是主功能）
- 视觉打磨：卡片圆角/阴影、渐变主按钮、消息气泡、滚动条、导航高亮、悬停反馈
- 修复：会话头部标题被挤压成竖排的布局问题

### English

**WorkBuddy-style UI (phase 1)**
- Chat is now a **three-column workbench**: session list + chat + context panel
- Context panel tabs: **Files** (project tree with preview), **Knowledge bases**, **Artifacts** (产出 folder)
- New **Knowledge base** page: create bases, upload local files, view document status and chunk counts
- New **Expert plaza**: 22 expert cards; click Start chat to switch experts
- The old capabilities page moved to **Settings → Diagnostics**
- Visual polish: rounded cards, soft shadows, gradient primary buttons, chat bubbles, scrollbars, nav highlight, hover feedback
- Fixed a layout bug where the chat header text was squeezed vertically

---

## [0.28.0] - 2026-10-24

### 中文

**语音输入打通（录音 -> STT）**
- 服务端配置小米 MiMo ASR 作为语音识别提供商（mimo-stt），并设置 stt=mimo-stt, tts=edge
- 实测：用 TTS 生成的中文音频调用 /api/voice/stt，返回「你好，这是语音测试。」
- 客户端对话输入框新增麦克风按钮：录 5 秒，自动转文字填入输入框（macOS 用 ffmpeg avfoundation，Windows 用 dshow）
- 至此语音双向打通：TTS 朗读 + STT 输入

### English

**Voice input works (record -> STT)**
- Configured Xiaomi MiMo ASR as the STT provider (mimo-stt) and set stt=mimo-stt, tts=edge
- Verified: transcribing TTS-generated Chinese audio via /api/voice/stt returned 你好，这是语音测试。
- Client chat input has a mic button: records 5 seconds and inserts the transcript (ffmpeg avfoundation on macOS, dshow on Windows)
- Voice is now bidirectional: TTS playback + STT input

---

## [0.27.0] - 2026-10-24

### 中文

**语音朗读打通（TTS + 本地播放）**
- `POST /api/voice/tts` 指定 `provider=edge`（Edge 神经语音，免费、无需密钥）→ 返回 MP3（实测 15,264B）
- 客户端每条 AI 回复新增「🔊 朗读」：生成 MP3 → 本机 `afplay` 播放（Windows 用系统播放器）
- 实测：生成音频 15KB 并成功播放
- STT 接口（`POST /api/voice/stt`、`WS /stt-stream`）存在，客户端录音输入待接

### English

**Speech output works (TTS + local playback)**
- `POST /api/voice/tts` with `provider=edge` (free Edge neural voices, no key) returns MP3 (15,264B measured)
- Every AI reply now has a 🔊 Speak button: generate MP3 → play locally with `afplay` (system player on Windows)
- Verified: 15KB audio generated and played successfully
- STT endpoints (`POST /api/voice/stt`, `WS /stt-stream`) exist; client microphone input is next

---

## [0.26.0] - 2026-10-24

### 中文

**用量统计与上下文用量**
- 能力页显示近 30 天用量：总 tokens（实测 2,289,854）、输入/输出、模型调用 101 次、对话 63 轮、缓存命中 88%
- 新增线程上下文用量接口接入（`/api/agents/{id}/threads/{tid}/context-usage`，max 128k）
- **语音**：接口存在（`POST /api/voice/tts`、`/stt`、`WS /stt-stream`），但当前返回空音频 → 需在 Octop 配置语音模型

### English

**Usage statistics and context usage**
- Capabilities page shows last-30-days usage: total tokens (2,289,854 measured), input/output, 101 model calls, 63 turns, 88% cache hit
- Wired the per-thread context-usage endpoint (`/api/agents/{id}/threads/{tid}/context-usage`, max 128k)
- **Voice**: APIs exist (`POST /api/voice/tts`, `/stt`, `WS /stt-stream`) but return empty audio → requires a voice model configured in Octop

---

## [0.25.0] - 2026-10-24

### 中文

**模型管理（写操作）**
- 能力页显示当前模型（供应商 / 模型名）
- 模型下拉可切换（小米MiMo: mimo-v2.6-pro / flash；本机Ollama: qwen3.5:9b）
- 实测：`PUT /api/providers/active-model` 200，切回 flash 成功

### English

**Model management (write)**
- Capabilities page shows the active model (provider / model).
- Dropdown switches models (MiMo: pro/flash; local Ollama: qwen3.5:9b).
- Verified: `PUT /api/providers/active-model` returned 200 and switching back to flash succeeded.

---

## [0.24.0] - 2026-10-24

### 中文

**渠道与账号管理（写操作）**
- 渠道：能力页可新建（飞书/企微/微信/钉钉）、测试连接、删除；实测创建 201、删除 204。
- 渠道连通需要凭证（如飞书 app_id/app_secret），创建后补凭证即可用。
- 账号：能力页可列出账号并新建（用户名 + 随机初始密码 + 角色）。实测创建成功。

### English

**Channel and account management (write operations)**
- Channels: create (Feishu/WeCom/WeChat/DingTalk), test, delete from the capabilities page; verified create 201 and delete 204.
- Channels require credentials (e.g. Feishu app_id/app_secret); add them after creation.
- Accounts: list and create users (username + random initial password + role); verified creation.

---

## [0.23.0] - 2026-10-24

### 中文

**浏览器自动化打通（实测）**
- 服务端安装 Playwright Chromium（`/api/browser/install`），状态 `browsers_ok=true`
- 客户端能力页显示浏览器状态，并可一键触发安装
- **实测**：让助理用浏览器打开 https://example.com → 回复页面标题「Example Domain」

### English

**Browser automation verified**
- Installed Playwright Chromium server-side (`/api/browser/install`), `browsers_ok=true`
- The capabilities page shows browser status and triggers installation
- **Verified**: asked the agent to open https://example.com in the browser; it reported the title "Example Domain"

---

## [0.22.0] - 2026-10-24

### 中文

- **插件市场**：`GET /api/plugins/market`（当前 8KB 目录，含工具类插件如「空气质量」）
- **连接器目录**：`GET /api/connectors/catalog`（21KB，腾讯文档等 MCP 连接器及认证方式）
- **助理已装工具**：`GET /api/plugins/agents/{id}/tools`（当前为空）
- 能力页统一展示并标注数量，便于后续「一键安装」改造

### English

- **Plugin market**: `GET /api/plugins/market` (8KB catalog, tool plugins such as air quality)
- **Connector catalog**: `GET /api/connectors/catalog` (21KB, e.g. Tencent Docs MCP connector with auth kinds)
- **Agent installed tools**: `GET /api/plugins/agents/{id}/tools` (currently empty)
- Capabilities page lists them with counts, ready for a future one-click install flow

---

## [0.21.0] - 2026-10-24

### 中文

**知识库真正打通（端到端实测）**
- 启用 ONNX 向量模型 `BAAI/bge-small-zh-v1.5`（下载 → 激活 → 开启知识库功能，`usable=true`）
- 创建知识库「团队知识库」，上传文档 `台账整理规范.md`（140B，状态 processing→可检索）
- **客户端**：能力页可「上传本地文件」到知识库（读本地项目文件 → 写入云端知识库）

**本地工具扩充到 9 个**
- `local_clipboard_read` / `local_clipboard_write`（系统剪贴板）
- `local_grep_files`（按内容关键字搜索目录内文本文件）
- 原有：列目录、读文件、写文件、文件搜索、打开路径、执行命令

### English

**Knowledge bases fully wired (end-to-end verified)**
- Enabled the ONNX embedding model `BAAI/bge-small-zh-v1.5` (download → activate → feature on; `usable=true`)
- Created the "Team KB" base and uploaded `台账整理规范.md` (140B, processing → searchable)
- **Client**: the capabilities page can upload a local project file into the cloud knowledge base

**Local tools now 9**
- `local_clipboard_read` / `local_clipboard_write` (system clipboard)
- `local_grep_files` (content search across text files in a folder)
- Plus: list dir, read file, write file, find files, open path, run command

---

## [0.20.1] - 2026-10-24

### 中文

**本地能力扩展（MCP 工具从 4 个增加到 6 个）**
- `local_find_files`：在已登记目录内按文件名关键字搜索（递归 4 层，最多 200 条）。
- `local_open_path`：在访达/资源管理器中打开文件或目录（白名单内）。
- 实测：搜索「.md」返回演示项目 2 个 markdown 文件。

### English

**Local tools extended (MCP tools 4 → 6)**
- `local_find_files`: search files by name keyword inside registered folders (4 levels deep, max 200 hits).
- `local_open_path`: reveal a file or folder in Finder/Explorer (whitelisted paths only).
- Verified: searching ".md" returned two markdown files in the demo project.

---

## [0.20.0] - 2026-10-24

### 中文

**云端能力页扩展（批次二/三）**
- 插件：`GET /api/plugins`（当前 0 个）
- 当前助理子代理：`GET /api/agents/{id}/subagents`（如「通用子智能体」）
- 可接入渠道类型：`GET /api/channels/plugin-kinds`（当前 Octop 未启用渠道插件）
- 浏览器会话：`GET /api/browser/harness-sessions`（环境 headless-server，会话 0）
- 账号：`GET /api/users`（管理员可见）
- 备份：`GET /api/admin/backup/status|list`（空闲，备份文件 0）
- 能力矩阵文档更新：区分「已接 / 需配置 / 无接口」

### English

**Capabilities page extended (batches 2–3)**
- Plugins (`GET /api/plugins`, currently 0)
- Agent sub-agents (`GET /api/agents/{id}/subagents`, e.g. general-purpose)
- Channel kinds (`GET /api/channels/plugin-kinds`; no channel plugin enabled yet)
- Browser sessions (`GET /api/browser/harness-sessions`, headless-server, 0 sessions)
- Users (`GET /api/users`, admin only)
- Backup (`GET /api/admin/backup/status|list`, idle, 0 files)
- Capability matrix now distinguishes integrated / needs-config / no-API

---

## [0.19.2] - 2026-10-24

### 中文

**修复（严重）：App 启动即退出**
- `ipcMain.handle("cmd:run")` 被注册两次 → Electron 抛出 `Attempted to register a second handler`，主进程直接崩溃、窗口不出现。
- 移除旧的 `/bin/sh` 版本，保留跨平台版本（Windows 用 `cmd.exe`）。

**本地终端可用**
- 客户端「终端」页恢复工作：在项目目录内执行命令，白名单 + 60 秒超时，输出回显；与内置 MCP 的 `local_run_cmd` 同一实现。
- 实测：MCP `local_run_cmd` 执行 `ls` 返回演示项目 3 个文件。

### English

**Critical fix: the app quit right after launch**
- `ipcMain.handle("cmd:run")` was registered twice → Electron threw `Attempted to register a second handler`, killing the main process (no window).
- Removed the legacy `/bin/sh` handler; kept the cross-platform one (`cmd.exe` on Windows).

**Local terminal works again**
- The client terminal runs commands inside project folders with a whitelist and a 60s timeout; same implementation as the built-in MCP `local_run_cmd`.
- Verified: MCP `local_run_cmd` with `ls` returned the demo project files.

---

## [0.19.1] - 2026-10-24

### 中文

- **知识库接入**：`GET /api/knowledge-bases` 列表 + `capability` 状态（当前 0 个，向量模型未启用）。
- **技能市场搜索**：`GET /api/skill-packages/hub/search?q=…`，能力页可直接搜技能包并查看分类与描述。
- 能力页重构：拆出渲染函数，搜索后可原地刷新。

### English

- **Knowledge bases wired in**: list via `GET /api/knowledge-bases` plus `capability` status (currently 0 bases; embedding model not configured).
- **Skill hub search**: `GET /api/skill-packages/hub/search?q=…`; the capabilities page can search packages and show category/description.
- Capabilities page refactored to re-render in place after searching.

---

## [0.19.0] - 2026-10-24

### 中文

**新增「云端能力」页**：把 Octop 的能力集中展示并接入。
- 子代理目录（`/api/subagent-catalog`，分组与数量）
- 模型供应商（`/api/providers`，含当前启用标记）
- 渠道（`/api/agents/{id}/channels`，当前助理已配置的渠道）
- 浏览器自动化环境（`/api/browser/env-status`）
- 终端上下文（`/api/agents/{id}/terminal/context`）

### English

**Added a "Cloud capabilities" page** aggregating Octop capabilities.
- Sub-agent catalog (`/api/subagent-catalog`, divisions + counts)
- Model providers (`/api/providers`, with the active flag)
- Channels for the current agent (`/api/agents/{id}/channels`)
- Browser automation environment (`/api/browser/env-status`)
- Terminal context (`/api/agents/{id}/terminal/context`)

---

## [0.18.0] - 2026-10-24

### 中文

- **发布流程固化**：打 tag `vX.Y.Z` 时，GitHub Actions 自动构建 Windows 安装包并附加到对应 Release；macOS 包本地构建后上传。
- 新增 `docs/octop-capabilities.md`：云端能力接入清单（本地访问已完成；云端已接 8 项，待接 15 项，按三批推进）。
- 对话气泡 Markdown 渲染、专家/技能选择已包含在本版本。

### English

- **Release pipeline**: pushing a `vX.Y.Z` tag makes GitHub Actions build the Windows installer and attach it to the GitHub Release automatically; the macOS package is uploaded from the local machine.
- Added `docs/octop-capabilities.md`: capability matrix (local access done; 8 cloud capabilities integrated, 15 pending, delivered in three batches).
- Includes Markdown rendering in chat bubbles and the expert/skill pickers.

---

## [0.17.1] - 2026-10-24

### 中文

- **对话气泡支持 Markdown 渲染**：标题、加粗、斜体、行内代码、代码块、无序/有序列表、分隔线、段落间距；先转义再解析，避免 XSS。
- 样式：代码块浅灰底+边框、列表缩进、标题字号加大，长回复更易读。

### English

- **Markdown rendering in chat bubbles**: headings, bold/italic, inline code, fenced code blocks, ordered/unordered lists, horizontal rules, paragraph spacing; escape-then-parse to avoid XSS.
- Styling: light code blocks with borders, list indentation, larger headings — long answers are easier to scan.

---

## [0.17.0] - 2026-10-24

### 中文

**新增：对话中可选专家与技能**
- 对话页顶部新增「专家」下拉（云端 22 个专家）与「技能 N」按钮；选技能打开勾选面板，当前助理技能列表（如 24 条）按需勾选。
- 勾选的技能随每轮对话下发（字段 `skills`），服务端按技能 slug 校验；切换专家时技能列表同步切换。
- 修复：技能选项使用 slug（此前用显示名会被服务端拒绝 `skill(s) not found or disabled`）。

**验证**
- 勾选「备忘录」并以 slug 下发后，助理回复确认该技能可用。

### English

**Added: pick experts and skills right in the chat**
- Chat header now has an "Expert" dropdown (22 cloud experts) and a "Skills N" button; the picker lists the current agent's skills and lets you tick them.
- Selected skills are sent with each turn (`skills` field, validated by slug server-side); switching experts switches the skill list.
- Fixed: skill options now use slugs (display names were rejected with `skill(s) not found or disabled`).

**Verified**
- Ticking "Apple Notes" and sending its slug made the agent confirm the skill is usable.

---

## [0.16.1] - 2026-10-24

### 中文

**修复：技能库与经验页此前仍指向已停用的自研后台（显示为空）**
- 技能库改为直接读 Octop 助理技能：`GET /api/agents/{id}/skills`（当前「助理一号」24 条），并跟随对话所选的专家助理切换。
- 经验页改为读 Octop 记忆候选：`POST /api/agents/{id}/memory/candidates/list`（当前 9 条），主管可通过 / 驳回。
- 补上此前缺失的 IPC：`octop:memory` / `octop:skills` / `octop:candidateAction`。

**对齐核对**
- 专家库 22 个（客户端下拉读同一接口 `/api/experts`）；已创建助理 6 个，全部有默认模型与身份提示词。

### English

**Fixed: the skills and experiences pages still pointed at the retired self-hosted backend (showed empty)**
- Skills now read Octop agent skills directly (`GET /api/agents/{id}/skills`, 24 for the default agent) and follow the selected expert agent.
- Experiences read Octop memory candidates (`POST /api/agents/{id}/memory/candidates/list`, currently 9); reviewers can promote/reject.
- Added the missing IPC handlers: `octop:memory` / `octop:skills` / `octop:candidateAction`.

**Alignment check**
- 22 experts in the library (the client dropdown uses the same `/api/experts` endpoint); 6 agents exist, all with a default model and identity prompt.

---

## [0.16.0] - 2026-10-24

### 中文

**修复：切换专家后「不知道自己是谁」**
- 根因：从专家模板新建的助理，名字正确但 **system_prompt 为空**、default_model 也为空，导致它把自己当无名新助理。
- 现在选专家（首次使用）时自动：创建/复用助理 → 写入身份提示词（专家名 + 专家描述 + 回答要求）→ 补默认模型 → 缓存映射。
- 启动时对已有助理全量修复（补身份提示词与模型），不覆盖用户已自定义的提示词。

**验证**
- 设计专家：回复「我是 Octop 里的设计专家，专做设计评审、设计系统、UX 文案…」
- 多专家协作编排：回复「我是「多专家协作编排师」——把你的目标拆成有依赖关系的步骤…」

### English

**Fixed: expert agents "forgot who they are" after switching experts**
- Root cause: agents created from expert templates had the right name but an **empty system_prompt** and empty default_model, so they behaved like unnamed new agents.
- On first use of an expert the client now creates/reuses the agent, writes an identity prompt (expert name + description + answer rules), fills the default model, and caches the mapping.
- A startup sweep repairs existing agents (identity + model) without overwriting user-customised prompts.

**Verified**
- Design expert replies "I am Octop's design expert, covering design reviews, design systems, UX copy…".
- Multi-agent orchestrator replies with its orchestration role.

---

## [0.15.1] - 2026-10-24

### 中文

**修复：切换专家后对话无回复**（两个根因）
- 客户端把「专家 ID」当成「助理 ID」直接用于会话/WS，指向了不存在的助理 → 现在会先解析成对应助理。
- 从专家新建的助理 `default_model` 为空，模型必然调用失败 → 现在自动补默认模型（启动时全量修复 + 对话时兜底）。
- 新增：专家助理按需创建并缓存（`expertAgents` 映射），以后新增专家无需手工配置。

**验证**
- 全新专家「AI 编程实战导师」：自动创建助理 EMPMCR → 自动补 `mimo-v2.6-flash` → 正常回复。

### English

**Fixed: no reply after switching experts** (two root causes)
- The client used the **expert id** as an **agent id**, pointing at a non-existent agent; it now resolves expert → agent first.
- Agents created from experts have an empty `default_model`, so model calls failed; the client now fills a default model (startup sweep + on-demand fallback).
- Expert agents are created on demand and cached (`expertAgents` map), so newly added experts work without manual setup.

**Verified**
- A brand-new expert ("AI Coding Coach") auto-created agent EMPMCR, got `mimo-v2.6-flash`, and replied normally.

---

## [0.15.0] - 2026-10-24

### 中文

- **修复：客户端对话无回复/报错**。根因是 Octop 的流式帧把正文放在 `token` 帧的 `content` 字段，客户端只认 `text` 字段 → 回调空。已按真实协议解析（`token.content` / `reasoning` / `done` / `error`）。
- **修复：客户端没有自动选择助理** → 登录后自动读取 `/api/agents`，优先选已绑定 MCP 的助理并缓存。
- 对话失败会写入本地日志，便于排查。
- **Windows 构建上线**：GitHub Actions 工作流（`.github/workflows/build-desktop.yml`）在 `windows-latest` 上打出 NSIS 安装包，已成功产出。

### English

- **Fixed: empty replies / errors in client chat.** Octop streams text in `token` frames under `content` (not `text`), so the client accumulated nothing. Parsing now follows the real protocol (`token.content`, `reasoning`, `done`, `error`).
- **Fixed: client never picked an agent** → on login it now reads `/api/agents`, prefers one with MCP bound, and caches it.
- Chat failures are written to the local log for diagnosis.
- **Windows builds enabled**: GitHub Actions workflow (`.github/workflows/build-desktop.yml`) produces an NSIS installer on `windows-latest`; first build succeeded.

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
