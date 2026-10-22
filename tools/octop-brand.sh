#!/bin/bash
set -e
DASH=/opt/dsh-octop/venv/lib/python3.12/site-packages/octop/dashboard
BRAND=/opt/dsh-octop/brand
BK=/opt/dsh-octop/brand-backup
mkdir -p "$BK"
for f in logo_horizontal_dark.png logo_horizontal_white.png logo_vertical_dark.svg logo_vertical_white.svg favico.svg apple-touch-icon.png pwa-192.png pwa-512.png manifest.json index.html; do
  if [ -f "$DASH/$f" ] && [ ! -f "$BK/$f" ]; then cp "$DASH/$f" "$BK/$f"; fi
done
cp -f "$BRAND"/*.png "$BRAND"/*.svg "$DASH"/
/opt/dsh-octop/venv/bin/python - <<'PY'
import json
p='/opt/dsh-octop/venv/lib/python3.12/site-packages/octop/dashboard/manifest.json'
d=json.load(open(p,encoding='utf-8'))
d['name']='砺 · 团队助理'; d['short_name']='砺助理'
d['description']='团队 AI 助理 · 本地干活、云端管理、经验复制'
json.dump(d, open(p,'w',encoding='utf-8'), ensure_ascii=False, indent=2)
print('manifest updated')
PY
sed -i 's#<title>[^<]*</title>#<title>砺 · 团队助理</title>#' "$DASH/index.html" || true
systemctl restart dsh-octop
sleep 10
systemctl is-active dsh-octop
curl -s --max-time 8 http://127.0.0.1:18090/ | grep -o '<title>[^<]*</title>' | head -1
