# Octop 对接说明 / Octop Integration

## 原则 / Principles

- 不改 Octop 源码，只用官方镜像 + 公开 API。
- 所有调用集中在 `platform/server/app.py` 的 `octop_chat()` 适配函数，接口变更只改一处。
- 锁版本：固定镜像 tag（例如 1.0.2），升级前先测试。

## 已踩过的坑 / Pitfalls (verified)

1. **模型配置必须用 `id` 字段**：`--models '[{"id":"qwen3.5:9b",...}]'`；只写 `name` 会报 `no_models_configured`。
2. **接本地 Ollama 用 OpenAI 兼容模式**：`kind=openai` + `base-url http://127.0.0.1:11434/v1`；`kind=ollama` 探测会 404。
3. **创建助理必须带用户**：`octop agent create "名称" --user admin --default-model <model>`。
4. **人设用 PATCH**：`PATCH /api/agents/{agent_id}` with `{"system_prompt": "..."}`。
5. **登录 API**：`POST /api/auth/login` 返回 `access_token`（Bearer），不是 Cookie。

## 平台 → Octop 流程 / Flow

```
POST /v1/octop/run {title, prompt}
  -> 建 task(type=octop, terminal_id=octop)
  -> subprocess: octop chats send <prompt> --agent <id> --plain
  -> 回写 task_steps(tool=octop.agent) + summary + status
```

## 验证 / Verification

- `provider test <id> --model <model>` 返回 `ok (xxx ms)`
- `chats send "你好"` 返回真实回复
- 平台 `/v1/octop/run` 返回 `{ok:true, task_id, reply, elapsed_ms}` 且看板可见
