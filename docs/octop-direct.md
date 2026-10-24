# 与 Octop 的对接（直连模式）

> 目标：桌面客户端**直连 Octop**（登录、专家、会话、对话、技能/记忆），我们的服务只保留「本地 MCP 桥 + 可选看板」。**不修改 Octop 源码。**

## 1. 为什么不 fork 源码

- Octop 发版频繁（例：2026-10 内多次），fork 后每次合并冲突成本高；
- MIT 允许 fork，但**维护成本**远超收益；
- 我们只依赖其**公开 HTTP / WebSocket API**，锁版本（当前 **1.0.2**），升级时跑回归即可。

## 2. 客户端直连的接口清单（已确认可用）

| 能力 | 接口 | 状态 |
|---|---|---|
| 登录 | `POST /api/auth/login` → Bearer token | ✅ 已验证 |
| 当前用户 | `GET /api/me`（或用登录返回） | ✅ |
| 专家库 | `GET /api/experts` | ✅ 已验证（22 个） |
| 助理列表 | `GET /api/agents` | ✅ 已验证 |
| 新建会话 | `POST /api/agents/{agent_id}/threads` | ✅ 已验证 |
| 会话列表 | `GET /api/agents/{agent_id}/threads` | ✅ |
| **对话** | `WS /api/agents/{agent_id}/chat/ws` | ⏳ 协议待摸清（下一步） |
| 技能 | Octop skills（per-agent） | ⏳ 待对接 |
| 记忆/经验 | Octop memory（atoms / candidates） | ⏳ 待对接 |
| 本地工具 | 我们的 MCP 网关（custom-mcp） | ✅ 已验证 |

## 3. 目标架构

```
员工电脑                          云端
┌──────────────┐   HTTP/WS   ┌──────────────────────┐
│ 砺工作台     │ ──────────▶ │ Octop 1.0.2          │
│ （Electron） │  直连        │ - 账号/专家/会话/对话 │
│              │             │ - 技能/记忆（经验沉淀）│
│ 本地 MCP 网关 │ ◀────────── │ - 通过 custom-mcp 调本地工具 │
└──────────────┘             └──────────────────────┘
        │ 可选（看板/汇总）
        ▼
  我们的小服务（可下线）
```

## 4. 迁移步骤

1. **登录/专家直连**（本步）：客户端设置里加「Octop 地址」，登录与专家列表直接请求 Octop；
2. **对话直连**：改用 `WS /api/agents/{id}/chat/ws`，摸清帧格式（send / stream / done）；
3. **经验沉淀迁到 Octop**：打开 agent memory，用 Octop 的 candidates → skills 机制；关闭我们后台的自动提炼；
4. **精简我们服务**：只保留 MCP 桥（本地文件/命令）+ 可选看板；
5. **发布**：打 tag + 安装包 + 更新日志。

## 5. 兼容策略

- 锁版本：客户端记录适配的 Octop 版本（当前 1.0.2），启动时探测并提示；
- 适配层：所有 Octop 调用集中在 `src/main/octop.js`；接口变更只改这里；
- 升级流程：测试实例验证 → 8 个接口回归 → 切生产 → 保留回滚镜像。
