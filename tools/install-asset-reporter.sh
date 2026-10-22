#!/bin/bash
# 安装「资产上报」插件到桌面端 profile（需要写 ~/.dsh，会触发一次审批）
set -e
W="/Users/liubang/Documents/deepseek-harness/default-workspace"
PROFILE="$HOME/.dsh/profiles/desktop"
PLUGIN="$W/plugins/l3b-asset-reporter"
NAME="@local/l3b-asset-reporter"

# 1) 链接
mkdir -p "$PROFILE/node_modules/@local"
ln -sfn "$PLUGIN" "$PROFILE/node_modules/@local/l3b-asset-reporter"
echo "linked: $PROFILE/node_modules/@local/l3b-asset-reporter"

# 2) package.json：加依赖 + bundles
/usr/bin/python3 - "$PROFILE/package.json" "$NAME" "$PLUGIN" <<'PY'
import json, sys, shutil, time
path, name, plugin = sys.argv[1], sys.argv[2], sys.argv[3]
shutil.copy2(path, path + ".bak-reporter-" + time.strftime("%Y%m%d%H%M%S"))
d = json.load(open(path, encoding="utf-8"))
deps = d.setdefault("dependencies", {})
deps[name] = "link:" + plugin
bundles = d.get("dsh", {}).get("profile", {}).get("bundles")
if isinstance(bundles, list) and name not in bundles:
    bundles.append(name)
json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("package.json updated")
PY

# 3) cordis.patch.yml：追加 insert 块（幂等）
if ! grep -q "l3b-asset-reporter" "$PROFILE/cordis.patch.yml"; then
  cp "$PROFILE/cordis.patch.yml" "$PROFILE/cordis.patch.yml.bak-reporter"
  cat >> "$PROFILE/cordis.patch.yml" <<'YAML'

# ── 团队 AI 资产平台 · 客户端上报（2026-10-18）─────────────────────
- insert:
    - id: l3b-asset-reporter
      name: '@local/l3b-asset-reporter'
      config:
        enabled: true
        serverUrl: 'http://127.0.0.1:8000'
        apiKey: 'demo-key-0001'
        flushMs: 30000
        heartbeatMs: 300000
YAML
  echo "patch appended"
else
  echo "patch already present"
fi
echo "DONE"
