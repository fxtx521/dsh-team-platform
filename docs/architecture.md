# 架构说明 / Architecture

## 分层 / Layers

| 层 | 组成 | 归属 |
|---|---|---|
| 员工端 | DSH 桌面端 + 资产上报插件 | 本地执行，文件不出机 |
| 接入层 | FastAPI 网关 + API Key / 登录 | 自研 |
| 控制层 | 账号、终端、任务、步骤、产物、看板、经验提炼 | 自研（核心） |
| 能力层 | Octop：专家、技能、知识库、MCP、IM | 复用（MIT） |
| 模型层 | 本地 Ollama / 云端 API | 可切换 |

## 数据模型 / Data model

| 表 | 关键字段 |
|---|---|
| terminals | id, name, employee_no, hostname, api_key, enabled, last_seen |
| tasks | id, terminal_id, title, type, status, started_at, ended_at, tokens, summary |
| task_steps | task_id, seq, tool, args_digest, duration_ms, ok |
| artifacts | task_id, name, size, sha256, visibility |
| skills | name, type, version, content |
| audit_logs | actor, action, target, created_at |

## 接口 / API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /v1/auth/token | 终端换 token |
| POST | /v1/heartbeat | 终端心跳 |
| POST | /v1/tasks | 建任务 |
| POST | /v1/tasks/{id}/steps | 上报步骤 |
| POST | /v1/tasks/{id}/artifacts | 登记产物 |
| GET | /v1/dashboard/summary | 看板聚合（需登录） |
| POST | /v1/octop/run | 派任务给 Octop 执行（需登录） |
| GET | /v1/octop/status | Octop 助理状态（需登录） |
