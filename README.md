# DSH Team AI Platform

**English** | [中文](#中文说明)

A self-hosted team AI platform: **local execution on employee computers + cloud control + experience replication**.

Employee AI clients run locally (files and customer data stay on the machine), the cloud keeps accounts, models, permissions and an execution dashboard, and work experience is distilled into reusable skills that are pushed back to everyone.

---

## English

### What it is

This repository is the **control plane + client plugin** of our team AI platform, built and validated step by step (PoC → production).

```
Employee PC (local)                     Cloud (self-hosted)                 AI engine (Octop)
+--------------------+   HTTPS    +---------------------------+   HTTP   +------------------+
| DSH desktop        | ---------> | Control plane (FastAPI)   | -------> | Octop server     |
| + asset reporter   |  metadata  | - accounts / terminals    |  tasks   | - experts/skills |
| + skill puller     | <--------- | - tasks / steps / artifacts| <------- | - knowledge base |
+--------------------+  skills    | - dashboard / experience  | results  | - IM channels    |
                                  | SQLite + object storage   |          | local models     |
                                  +---------------------------+          +------------------+
```

### Components

| Path | What | Status |
|---|---|---|
| `platform/server/app.py` | Control plane: login, terminals, tasks, steps, artifacts, dashboard, Octop adapter | Working (PoC) |
| `plugins/l3b-asset-reporter/` | DSH client plugin: reports each turn (task/steps/artifacts) with an offline queue | Working |
| `sites/food-trailer/` | Pixel-faithful clone of a reference website (HTML/CSS demo) | Demo |
| `desktop/` | Employee-side desktop app (Electron, macOS + Windows) | New (v0.1) |
| `sites/brand/` | Brand assets for our own Octop instance | Working |
| `tools/` | Install & branding scripts | Working |
| `docs/` | Architecture, roadmap, Octop integration notes | Working |

### Key ideas

1. **Local first** — employee files (customer data, contracts) never leave the machine; only metadata is reported.
2. **One identity per terminal** — an API key binds one employee to one device; the dashboard is always attributable.
3. **Experience replication** — tasks are distilled into `SKILL.md` skills, reviewed by a manager, then pushed to everyone.
4. **No framework forks** — Octop is used as-is (MIT) through its public API; an adapter layer isolates version changes.
5. **Verify every step** — each change ends with a real end-to-end check (API call, dashboard record, or screenshot).

### Quick start (server)

```bash
cd platform/server
python3 -m venv .venv && .venv/bin/pip install fastapi uvicorn
DSH_PLATFORM_DATA=./data .venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000
# open http://localhost:8000/login
```

Default admin is generated on first run at `data/admin-credentials.txt`.


### Desktop client (WorkBuddy-style local workbench)

The employee-side app (Electron, macOS + Windows):

- Projects = local folders (allow-listed); files never leave the machine
- One-click business tasks (customer verification / ledger / bidding)
- Cloud task pull, local execution, artifacts back to the dashboard
- Skills (SOP) auto-synced from cloud
- Tray-resident; command execution disabled by default

Build: npm install && npm run dist:mac (dmg) or npm run dist:win (exe, Windows only; CI workflow provided).

### Client plugin (DSH)

See `plugins/l3b-asset-reporter/README.md` for install and configuration.

### Roadmap

- [x] P0: client reporting → server → dashboard, login, terminal management, task detail
- [x] Octop integration: platform task → Octop agent → result back to dashboard
- [ ] Business task templates (customer verification / ledger / bidding)
- [ ] Skills library + push to clients
- [ ] Experience distillation (task flow → SOP candidates → review → skill)
- [ ] Artifact upload/download

### License

MIT

---

## 中文说明

**团队 AI 平台**：员工本地干活、云端统一管理、经验可复制。

员工端 AI 在自己电脑上运行（文件与客户数据不出本机），云端负责账号、模型、权限与执行看板，并把工作中的经验沉淀成可复用技能，再下发回全员。

### 它是什么

本仓库是团队 AI 平台的**控制层 + 客户端插件**，按「PoC → 生产」逐步验证。

```
员工电脑（本地）                      云端（自托管）                       AI 能力层（Octop）
+--------------------+   HTTPS    +---------------------------+   HTTP   +------------------+
| DSH 桌面端         | ---------> | 控制层（FastAPI）         | -------> | Octop 服务       |
| + 资产上报插件     |  元数据    | - 账号 / 终端             |  任务    | - 专家 / 技能    |
| + 技能拉取插件     | <--------- | - 任务 / 步骤 / 产物      | <------- | - 知识库         |
+--------------------+  技能下发  | - 看板 / 经验提炼         |  结果    | - IM 通道        |
                                  | SQLite + 对象存储         |          | 本地模型         |
                                  +---------------------------+          +------------------+
```

### 组件

| 目录 | 作用 | 状态 |
|---|---|---|
| `platform/server/app.py` | 控制层：登录、终端、任务、步骤、产物、看板、Octop 适配 | 可用（PoC） |
| `plugins/l3b-asset-reporter/` | DSH 客户端插件：每轮上报任务/步骤/产物，断网排队 | 可用 |
| `sites/food-trailer/` | 按效果图 1:1 复刻的示例网站（HTML/CSS） | 演示 |
| `desktop/` | 员工端桌面客户端（Electron，macOS + Windows） | 新增（v0.1） |
| `sites/brand/` | 咱们自己 Octop 实例的品牌素材 | 可用 |
| `tools/` | 安装与品牌脚本 | 可用 |
| `docs/` | 架构、路线图、Octop 对接说明 | 可用 |

### 核心原则

1. **本地优先**：员工文件（客户资料、合同）不出本机，只上报元数据。
2. **一终端一身份**：一把 API Key 绑定「一个员工 + 一台设备」，看板永远能溯源。
3. **经验可复制**：任务沉淀为 `SKILL.md` 技能 → 主管审核 → 下发全员。
4. **不改框架**：Octop（MIT）原样使用，只走公开 API，用适配层隔离版本变化。
5. **每一步都验证**：每次改动都以真实端到端验证收尾（接口、看板记录或截图）。

### 快速开始（服务端）

```bash
cd platform/server
python3 -m venv .venv && .venv/bin/pip install fastapi uvicorn
DSH_PLATFORM_DATA=./data .venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000
# 打开 http://localhost:8000/login
```

首次启动会自动生成管理员账号，见 `data/admin-credentials.txt`。


### 桌面客户端（本地工作台）

员工端应用（Electron，支持 macOS + Windows）：

- 项目 = 本地文件夹（白名单），文件不出本机
- 一键业务任务（客户核查 / 台账 / 标书）
- 云端派活、本地执行、产物回看板
- 云端技能（SOP）自动同步
- 托盘常驻；命令执行默认关闭

打包：npm install && npm run dist:mac（dmg）或 npm run dist:win（exe，仅 Windows；已配 GitHub Actions）。

### 客户端插件（DSH）

安装与配置见 `plugins/l3b-asset-reporter/README.md`。

### 路线图

- [x] P0：客户端上报 → 服务端 → 看板、登录、终端管理、任务详情
- [x] Octop 对接：平台派任务 → Octop 助理执行 → 结果回看板
- [ ] 业务任务模板（客户核查 / 台账 / 标书）
- [ ] 技能库 + 下发到客户端
- [ ] 经验提炼（任务流 → SOP 候选 → 审核 → 技能）
- [ ] 产物上传 / 下载

### 许可

MIT
