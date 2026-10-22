# 砺 · 资产上报插件（l3b-asset-reporter）

团队 AI 资产平台 P0 的客户端插件：监听 DSH 会话的 `turn/start` / `tool/call` / `tool/result` /
`assistant/message` / `deliverables/presented` / `turn/end`，把每个 turn 整理成一条任务记录，
通过 HTTP 上报到平台服务端。

## 上报内容（只有元数据）
- 任务：id、标题（首条用户消息前 80 字）、状态、开始/结束时间、模型、token
- 步骤：工具名、参数 sha256 摘要、耗时、成败
- 产物：文件名、路径、可见范围

**不上报**正文内容、工具返回的原文、客户资料。

## 可靠性
- 本地 JSONL 队列（`~/.dsh/platform/queue.jsonl`），上报失败保留并每 30 秒重试
- 心跳每 5 分钟一次
- 所有异常吞掉并写日志 `~/.dsh/platform/reporter.log`，绝不影响正常会话

## 配置（cordis.patch.yml）
| 键 | 说明 |
|---|---|
| serverUrl | 平台服务端地址 |
| apiKey | 该终端的 API Key（服务端注册终端时生成） |
| flushMs | 队列重试间隔 |
| heartbeatMs | 心跳间隔 |

## 安装
```
dsh plugin --profile desktop add <绝对路径>   # 或用 plugin_manager install_bundle
```
改代码后：`remove_bundle` + `install_bundle`（稳定入口带时间戳，无需重启）。
