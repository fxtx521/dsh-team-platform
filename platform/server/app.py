#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""团队 AI 资产平台 · P0 服务端（FastAPI 单体）"""
import os, sqlite3, hashlib, hmac, secrets, time, uuid, json, subprocess
from datetime import datetime, timezone
from typing import Optional, List
from urllib.parse import parse_qs
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

DATA = os.environ.get("DSH_PLATFORM_DATA", "/opt/dsh-platform/data")
DB = os.path.join(DATA, "platform.db")
ART = os.path.join(DATA, "artifacts")
os.makedirs(ART, exist_ok=True)

SCHEMA = """
CREATE TABLE IF NOT EXISTS terminals(
  id TEXT PRIMARY KEY, name TEXT, hostname TEXT, os TEXT, user_name TEXT, employee_no TEXT,
  api_key TEXT UNIQUE, last_seen TEXT, version TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS tasks(
  id TEXT PRIMARY KEY, terminal_id TEXT, title TEXT, type TEXT, status TEXT,
  started_at TEXT, ended_at TEXT, model TEXT, tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0, summary TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS task_steps(
  id TEXT PRIMARY KEY, task_id TEXT, seq INTEGER, tool TEXT, args_digest TEXT,
  duration_ms INTEGER, ok INTEGER, error_code TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS artifacts(
  id TEXT PRIMARY KEY, task_id TEXT, name TEXT, mime TEXT, size INTEGER, sha256 TEXT,
  path TEXT, visibility TEXT DEFAULT 'self', created_at TEXT);
CREATE TABLE IF NOT EXISTS skills(
  id TEXT PRIMARY KEY, name TEXT, type TEXT, version INTEGER DEFAULT 1, content TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS audit_logs(
  id TEXT PRIMARY KEY, actor TEXT, action TEXT, target TEXT, detail TEXT, created_at TEXT);
"""

def now():
    return datetime.now(timezone.utc).isoformat()

def conn():
    c = sqlite3.connect(DB, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c

def init():
    c = conn(); c.executescript(SCHEMA)
    try:
        c.execute("ALTER TABLE terminals ADD COLUMN enabled INTEGER DEFAULT 1")
    except Exception:
        pass
    c.commit()
    # 种子：一个演示终端 + 管理员密钥
    row = c.execute("SELECT count(*) n FROM terminals").fetchone()
    if row["n"] == 0:
        c.execute("INSERT INTO terminals(id,name,hostname,os,user_name,employee_no,api_key,last_seen,version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                  (uuid.uuid4().hex, "演示终端", "demo-pc", "macOS", "演示员工", "ZY-0001",
                   "demo-key-0001", now(), "1.0.0", now()))
        c.execute("INSERT INTO skills(id,name,type,version,content,updated_at) VALUES(?,?,?,?,?,?)",
                  (uuid.uuid4().hex, "客户资料核查 SOP", "sop", 1,
                   "1) 工商信息核对\n2) 司法涉诉查询\n3) 经营异常\n4) 出具报告（模板：核查报告_v2.docx）", now()))
        c.commit()
    c.close()

init()
app = FastAPI(title="团队 AI 资产平台", version="0.1.0")

# 静态站点（效果图复刻站）
SITE_DIR = os.environ.get("DSH_SITE_DIR", "/opt/dsh-platform/site")
try:
    os.makedirs(SITE_DIR, exist_ok=True)
    app.mount("/site", StaticFiles(directory=SITE_DIR, html=True), name="site")
except Exception as _e:
    print("site mount failed:", _e)

# ── 管理端登录（账号密码，2026-10-18 老板要求：不能裸奔）──────────────
AUTH_FILE = os.path.join(DATA, "admin-credentials.json")
COOKIE_NAME = "dsh_admin"
SESSION_TTL = 7 * 86400

def _load_auth():
    if os.path.exists(AUTH_FILE):
        try:
            return json.load(open(AUTH_FILE, encoding="utf-8"))
        except Exception:
            pass
    pw = os.environ.get("DSH_ADMIN_PASSWORD") or secrets.token_urlsafe(9)
    data = {
        "user": os.environ.get("DSH_ADMIN_USER", "admin"),
        "pass_sha": hashlib.sha256(pw.encode()).hexdigest(),
        "secret": secrets.token_hex(32),
    }
    json.dump(data, open(AUTH_FILE, "w", encoding="utf-8"))
    os.chmod(AUTH_FILE, 0o600)
    txt = os.path.join(DATA, "admin-credentials.txt")
    with open(txt, "w", encoding="utf-8") as f:
        f.write(f"username: {data['user']}\npassword: {pw}\n")
    os.chmod(txt, 0o600)
    return data

AUTH = _load_auth()

def _sign(payload: str) -> str:
    return hmac.new(AUTH["secret"].encode(), payload.encode(), hashlib.sha256).hexdigest()

def make_token() -> str:
    exp = int(time.time()) + SESSION_TTL
    payload = f"{AUTH['user']}:{exp}"
    return payload + ":" + _sign(payload)

def check_token(token: str) -> bool:
    try:
        user, exp, sig = token.rsplit(":", 2)
        if user != AUTH["user"] or int(exp) < time.time():
            return False
        return hmac.compare_digest(sig, _sign(f"{user}:{exp}"))
    except Exception:
        return False

def require_admin(request: Request):
    if not check_token(request.cookies.get(COOKIE_NAME, "")):
        raise HTTPException(401, "unauthorized")

def auth(x_api_key: Optional[str]):
    if not x_api_key:
        raise HTTPException(401, "missing api key")
    c = conn()
    r = c.execute("SELECT * FROM terminals WHERE api_key=?", (x_api_key,)).fetchone()
    c.close()
    if not r:
        raise HTTPException(401, "invalid api key")
    if "enabled" in r.keys() and not r["enabled"]:
        raise HTTPException(403, "terminal disabled")
    return r

def audit(actor, action, target="", detail=""):
    c = conn()
    c.execute("INSERT INTO audit_logs(id,actor,action,target,detail,created_at) VALUES(?,?,?,?,?,?)",
              (uuid.uuid4().hex, actor, action, target, detail, now()))
    c.commit(); c.close()

# ── 员工端接口 ──────────────────────────────────────────────
@app.post("/v1/heartbeat")
async def heartbeat(request: Request, x_api_key: Optional[str] = Header(None)):
    t = auth(x_api_key)
    body = await request.json() if request.headers.get("content-length","0") != "0" else {}
    c = conn()
    c.execute("UPDATE terminals SET last_seen=?, version=? WHERE id=?",
              (now(), str(body.get("version") or t["version"]), t["id"]))
    c.commit(); c.close()
    return {"ok": True, "server_time": now(), "skills_version": latest_skill_version()}

@app.post("/v1/tasks")
async def create_task(request: Request, x_api_key: Optional[str] = Header(None)):
    t = auth(x_api_key)
    b = await request.json()
    tid = b.get("id") or uuid.uuid4().hex
    c = conn()
    c.execute("""INSERT INTO tasks(id,terminal_id,title,type,status,started_at,model,tokens_in,tokens_out,summary,created_at)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
              (tid, t["id"], b.get("title",""), b.get("type","general"), b.get("status","running"),
               b.get("started_at") or now(), b.get("model",""), int(b.get("tokens_in") or 0),
               int(b.get("tokens_out") or 0), b.get("summary",""), now()))
    c.commit(); c.close()
    audit(t["user_name"], "task.create", tid, b.get("title",""))
    return {"ok": True, "id": tid}

@app.patch("/v1/tasks/{task_id}")
async def update_task(task_id: str, request: Request, x_api_key: Optional[str] = Header(None)):
    t = auth(x_api_key)
    b = await request.json()
    c = conn()
    c.execute("""UPDATE tasks SET status=COALESCE(?,status), ended_at=COALESCE(?,ended_at),
                 summary=COALESCE(?,summary), tokens_in=COALESCE(?,tokens_in), tokens_out=COALESCE(?,tokens_out)
                 WHERE id=? AND terminal_id=?""",
              (b.get("status"), b.get("ended_at"), b.get("summary"),
               b.get("tokens_in"), b.get("tokens_out"), task_id, t["id"]))
    c.commit(); c.close()
    audit(t["user_name"], "task.update", task_id, str(b.get("status")))
    return {"ok": True}

@app.post("/v1/tasks/{task_id}/steps")
async def add_steps(task_id: str, request: Request, x_api_key: Optional[str] = Header(None)):
    t = auth(x_api_key)
    b = await request.json()
    steps = b.get("steps") or []
    c = conn()
    for i, s in enumerate(steps):
        seq = int(s.get("seq", i + 1))
        # 幂等：同 task+seq 已存在则更新
        c.execute("""INSERT INTO task_steps(id,task_id,seq,tool,args_digest,duration_ms,ok,error_code,created_at)
                     VALUES(?,?,?,?,?,?,?,?,?)
                     ON CONFLICT(id) DO UPDATE SET duration_ms=excluded.duration_ms, ok=excluded.ok""",
                  (f"{task_id}-{seq}", task_id, seq, s.get("tool",""), s.get("args_digest",""),
                   int(s.get("duration_ms") or 0), 1 if s.get("ok", True) else 0,
                   s.get("error_code",""), now()))
    c.commit(); c.close()
    return {"ok": True, "count": len(steps)}

@app.post("/v1/tasks/{task_id}/artifacts")
async def add_artifact(task_id: str, request: Request, x_api_key: Optional[str] = Header(None)):
    t = auth(x_api_key)
    b = await request.json()
    aid = uuid.uuid4().hex
    c = conn()
    c.execute("""INSERT INTO artifacts(id,task_id,name,mime,size,sha256,path,visibility,created_at)
                 VALUES(?,?,?,?,?,?,?,?,?)""",
              (aid, task_id, b.get("name",""), b.get("mime",""), int(b.get("size") or 0),
               b.get("sha256",""), b.get("path",""), b.get("visibility","self"), now()))
    c.commit(); c.close()
    audit(t["user_name"], "artifact.add", task_id, b.get("name",""))
    return {"ok": True, "id": aid}

@app.get("/v1/skills")
async def list_skills(since: int = 0, x_api_key: Optional[str] = Header(None)):
    auth(x_api_key)
    c = conn()
    rows = c.execute("SELECT * FROM skills WHERE version >= ? ORDER BY updated_at DESC", (since,)).fetchall()
    c.close()
    return {"ok": True, "items": [dict(r) for r in rows]}


# ── Octop 适配层（PoC：平台任务交给 Octop 助理执行）──────────────
OCTOP_HOME = os.environ.get("DSH_OCTOP_HOME", "/opt/dsh-octop/data")
OCTOP_BIN = os.environ.get("DSH_OCTOP_BIN", "/opt/dsh-octop/venv/bin/octop")
OCTOP_AGENT = os.environ.get("DSH_OCTOP_AGENT", "VHSDB4")

def octop_chat(prompt: str, agent_id: str = "", timeout: int = 240) -> dict:
    """调用 Octop 助理执行一句话任务，返回 {ok, reply, elapsed_ms}。"""
    agent_id = agent_id or OCTOP_AGENT
    env = dict(os.environ)
    env["HOME"] = OCTOP_HOME
    t0 = time.time()
    try:
        p = subprocess.run(
            [OCTOP_BIN, "chats", "send", prompt, "--agent", agent_id, "--plain"],
            capture_output=True, text=True, timeout=timeout, env=env,
        )
        out = (p.stdout or "").strip()
        err = (p.stderr or "").strip()
        # 去掉末尾的耗时行（形如 "  ────... 2.8s"）
        lines = [l for l in out.splitlines() if not l.strip().startswith("──") and not l.strip().endswith("s") ]
        reply = "\n".join(lines).strip() or out
        ok = p.returncode == 0 and bool(reply)
        return {"ok": ok, "reply": reply, "error": err[:500] if not ok else "", "elapsed_ms": int((time.time()-t0)*1000)}
    except subprocess.TimeoutExpired:
        return {"ok": False, "reply": "", "error": "octop timeout", "elapsed_ms": int((time.time()-t0)*1000)}
    except Exception as e:
        return {"ok": False, "reply": "", "error": str(e)[:500], "elapsed_ms": int((time.time()-t0)*1000)}

@app.post("/v1/octop/run")
async def octop_run(request: Request, x_api_key: Optional[str] = None, x_admin_cookie: Optional[str] = Header(None)):
    """管理员在平台上派一个任务，交给 Octop 执行，并把结果记成 task + step。"""
    require_admin(request)
    body = await request.json()
    title = (body.get("title") or "").strip() or "Octop 任务"
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        raise HTTPException(400, "prompt required")
    tid = uuid.uuid4().hex
    c = conn()
    c.execute("""INSERT INTO tasks(id,terminal_id,title,type,status,started_at,model,summary,created_at)
                 VALUES(?,?,?,?,?,?,?,?,?)""",
              (tid, "octop", title, "octop", "running", now(), "qwen3.5:9b", "", now()))
    c.commit(); c.close()
    res = octop_chat(prompt)
    c = conn()
    c.execute("""INSERT INTO task_steps(id,task_id,seq,tool,args_digest,duration_ms,ok,error_code,created_at)
                 VALUES(?,?,?,?,?,?,?,?,?)""",
              (f"{tid}-1", tid, 1, "octop.agent", hashlib.sha256(prompt.encode()).hexdigest()[:16],
               res["elapsed_ms"], 1 if res["ok"] else 0, "" if res["ok"] else "octop_error", now()))
    if res["ok"]:
        c.execute("UPDATE tasks SET status='done', ended_at=?, summary=? WHERE id=?", (now(), res["reply"][:2000], tid))
    else:
        c.execute("UPDATE tasks SET status='failed', ended_at=?, summary=? WHERE id=?", (now(), res.get("error","")[:2000], tid))
    c.commit(); c.close()
    audit("admin", "octop.run", tid, title)
    return {"ok": res["ok"], "task_id": tid, "reply": res["reply"], "elapsed_ms": res["elapsed_ms"], "error": res.get("error","")}

@app.get("/v1/octop/status")
async def octop_status(request: Request):
    require_admin(request)
    env = dict(os.environ); env["HOME"] = OCTOP_HOME
    try:
        p = subprocess.run([OCTOP_BIN, "--json", "agent", "list"], capture_output=True, text=True, timeout=20, env=env)
        return {"ok": True, "agents": json.loads(p.stdout or "[]")}
    except Exception as e:
        return {"ok": False, "error": str(e)[:300]}

def latest_skill_version():
    c = conn()
    r = c.execute("SELECT MAX(version) v FROM skills").fetchone()
    c.close()
    return r["v"] or 0

# ── 看板 ──────────────────────────────────────────────────
@app.get("/v1/dashboard/summary")
async def summary(request: Request, x_admin_key: Optional[str] = Header(None)):
    require_admin(request)
    c = conn()
    today = datetime.now(timezone.utc).date().isoformat()
    tasks_today = c.execute("SELECT count(*) n FROM tasks WHERE date(created_at)=?", (today,)).fetchone()["n"]
    terminals = c.execute("SELECT * FROM terminals ORDER BY last_seen DESC").fetchall()
    online = 0
    for t in terminals:
        try:
            if t["last_seen"] and (datetime.now(timezone.utc) - datetime.fromisoformat(t["last_seen"])).total_seconds() < 300:
                online += 1
        except Exception:
            pass
    tokens = c.execute("SELECT COALESCE(SUM(tokens_in+tokens_out),0) v FROM tasks").fetchone()["v"]
    artifacts = c.execute("SELECT count(*) n FROM artifacts").fetchone()["n"]
    recent = c.execute("""SELECT t.id,t.title,t.status,t.started_at,t.ended_at,t.tokens_in,t.tokens_out,
                                 tr.user_name, tr.hostname, t.terminal_id, t.type
                          FROM tasks t LEFT JOIN terminals tr ON tr.id=t.terminal_id
                          ORDER BY t.created_at DESC LIMIT 20""").fetchall()
    steps = c.execute("SELECT * FROM task_steps ORDER BY created_at DESC LIMIT 200").fetchall()
    c.close()
    return {"ok": True, "stats": {"tasks_today": tasks_today, "online": online, "terminals": len(terminals),
                                 "tokens": tokens, "artifacts": artifacts},
            "terminals": [dict(t) for t in terminals], "recent_tasks": [dict(r) for r in recent],
            "steps": [dict(s) for s in steps]}

@app.get("/v1/audit")
async def audit_list(request: Request, limit: int = 100):
    require_admin(request)
    c = conn()
    rows = c.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    c.close()
    return {"ok": True, "items": [dict(r) for r in rows]}

# ── 终端/员工管理 ──────────────────────────────────────────
TERMINALS_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>终端管理</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef1f7;color:#1f2937;padding:24px}
.bar{background:#1f3a5f;color:#fff;border-radius:14px;padding:14px 22px;display:flex;align-items:center;gap:14px;margin-bottom:18px}
.logo{width:32px;height:32px;border-radius:8px;background:#4f8cff;display:flex;align-items:center;justify-content:center;font-weight:700}
a{color:#fff;text-decoration:none;opacity:.8;font-size:13px}
.card{background:#fff;border-radius:14px;padding:18px 22px;box-shadow:0 6px 24px rgba(15,35,70,.06);margin-bottom:16px}
h3{font-size:14px;color:#1f3a5f;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid #f1f4f9}
th{color:#8592a8;font-size:12px}
.tag{display:inline-block;font-size:11.5px;padding:2px 8px;border-radius:20px;background:#e8f7ee;color:#0b7a45}
.tag.off{background:#fdecea;color:#b3261e}
input,select{height:36px;border:1px solid #dbe2ee;border-radius:8px;padding:0 10px;font-size:13px;margin-right:8px;background:#fbfcfe}
button{height:36px;border:0;border-radius:8px;background:#2f6bff;color:#fff;font-size:13px;font-weight:600;padding:0 16px;cursor:pointer}
button.gray{background:#eef2ff;color:#2f6bff}
.key{background:#f6f8fc;border:1px dashed #b9c9e6;border-radius:8px;padding:10px 12px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;word-break:break-all;margin-top:8px}
</style></head><body>
<div class="bar"><div class="logo">砺</div><div style="font-weight:600">终端 / 员工管理</div>
<div style="margin-left:auto;display:flex;gap:16px"><a href="/dashboard">看板</a><a href="/logout">退出</a></div></div>
<div class="card"><h3>新增员工终端</h3>
<form method="post" action="/terminals/add">
<input name="name" placeholder="员工姓名" required>
<input name="employee_no" placeholder="工号（可选）">
<input name="hostname" placeholder="设备名（可选）">
<button type="submit">生成并添加</button>
</form>
<div style="font-size:12.5px;color:#8592a8;margin-top:10px">添加后会生成一把专属密钥，复制到该员工电脑的插件配置里即可。</div>
<div id="newkey"></div></div>
<div class="card"><h3>全部终端</h3>
<table><thead><tr><th>员工</th><th>工号</th><th>设备</th><th>密钥</th><th>状态</th><th>最后心跳</th><th>操作</th></tr></thead>
<tbody id="rows"></tbody></table></div>
<script>
async function load(){
  const r = await fetch('/v1/terminals'); const d = await r.json();
  const tb = document.getElementById('rows'); tb.innerHTML = '';
  (d.items||[]).forEach(t=>{
    const tr = document.createElement('tr');
    const masked = t.api_key ? (t.api_key.slice(0,6) + '••••' + t.api_key.slice(-4)) : '（已禁用）';
    tr.innerHTML = '<td>'+esc(t.name)+'</td><td>'+esc(t.employee_no||'-')+'</td><td>'+esc(t.hostname||'-')+'</td><td style="font-family:monospace;font-size:12px">'+masked+'</td>'
      + '<td><span class="tag '+(t.enabled?'':'off')+'">'+(t.enabled?'启用':'禁用')+'</span></td>'
      + '<td style="font-size:12px;color:#8592a8">'+(t.last_seen?new Date(t.last_seen).toLocaleString():'-')+'</td>'
      + '<td><form method="post" action="/terminals/'+t.id+'/toggle" style="display:inline"><button class="gray" type="submit">'+(t.enabled?'禁用':'启用')+'</button></form></td>';
    tb.appendChild(tr);
  });
  const q = new URLSearchParams(location.search);
  if(q.get('key')){
    document.getElementById('newkey').innerHTML = '<div class="key">新终端密钥（只显示这一次，请复制保存）：<br><b>'+esc(q.get('key'))+'</b></div>';
  }
}
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
load();
</script></body></html>"""

@app.get("/terminals", response_class=HTMLResponse)
async def terminals_page(request: Request):
    if not check_token(request.cookies.get(COOKIE_NAME, "")):
        return RedirectResponse("/login", status_code=303)
    return TERMINALS_HTML

@app.get("/v1/terminals")
async def terminals_list(request: Request):
    require_admin(request)
    c = conn()
    rows = c.execute("SELECT * FROM terminals ORDER BY created_at DESC").fetchall()
    c.close()
    return {"ok": True, "items": [dict(r) for r in rows]}

@app.post("/terminals/add")
async def terminals_add(request: Request):
    if not check_token(request.cookies.get(COOKIE_NAME, "")):
        return RedirectResponse("/login", status_code=303)
    body = (await request.body()).decode("utf-8", "ignore")
    form = parse_qs(body)
    name = (form.get("name") or [""])[0].strip() or "未命名"
    emp = (form.get("employee_no") or [""])[0].strip()
    host = (form.get("hostname") or [""])[0].strip()
    key = "dsh_" + secrets.token_hex(16)
    c = conn()
    c.execute("""INSERT INTO terminals(id,name,hostname,os,user_name,employee_no,api_key,last_seen,version,created_at,enabled)
                 VALUES(?,?,?,?,?,?,?,?,?,?,1)""",
              (uuid.uuid4().hex, name, host, "", name, emp, key, None, "", now()))
    c.commit(); c.close()
    audit("admin", "terminal.add", name, emp)
    return RedirectResponse("/terminals?key=" + key, status_code=303)

@app.post("/terminals/{tid}/toggle")
async def terminal_toggle(tid: str, request: Request):
    if not check_token(request.cookies.get(COOKIE_NAME, "")):
        return RedirectResponse("/login", status_code=303)
    c = conn()
    c.execute("UPDATE terminals SET enabled = CASE WHEN enabled=1 THEN 0 ELSE 1 END WHERE id=?", (tid,))
    c.commit(); c.close()
    audit("admin", "terminal.toggle", tid, "")
    return RedirectResponse("/terminals", status_code=303)

# ── 任务详情 ──────────────────────────────────────────────
@app.get("/v1/tasks/{task_id}")
async def task_detail(task_id: str, request: Request):
    require_admin(request)
    c = conn()
    t = c.execute("""SELECT t.*, tr.name AS emp_name, tr.employee_no, tr.hostname
                     FROM tasks t LEFT JOIN terminals tr ON tr.id=t.terminal_id WHERE t.id=?""", (task_id,)).fetchone()
    if not t:
        c.close()
        raise HTTPException(404, "not found")
    steps = c.execute("SELECT * FROM task_steps WHERE task_id=? ORDER BY seq", (task_id,)).fetchall()
    arts = c.execute("SELECT * FROM artifacts WHERE task_id=? ORDER BY created_at", (task_id,)).fetchall()
    c.close()
    return {"ok": True, "task": dict(t), "steps": [dict(s) for s in steps], "artifacts": [dict(a) for a in arts]}

TASK_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>任务详情</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef1f7;color:#1f2937;padding:24px}
.bar{background:#1f3a5f;color:#fff;border-radius:14px;padding:14px 22px;display:flex;align-items:center;gap:14px;margin-bottom:18px}
.logo{width:32px;height:32px;border-radius:8px;background:#4f8cff;display:flex;align-items:center;justify-content:center;font-weight:700}
a{color:#fff;text-decoration:none;opacity:.8;font-size:13px}
.card{background:#fff;border-radius:14px;padding:20px 24px;box-shadow:0 6px 24px rgba(15,35,70,.06);margin-bottom:16px}
h2{font-size:18px;color:#1f3a5f;margin-bottom:6px}
.muted{color:#8592a8;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #f1f4f9}
th{color:#8592a8;font-size:12px}
.tag{display:inline-block;font-size:11.5px;padding:2px 8px;border-radius:20px;background:#e8f0ff;color:#2f6bff}
.tag.ok{background:#e8f7ee;color:#0b7a45}.tag.err{background:#fdecea;color:#b3261e}
pre{background:#f6f8fc;border-radius:8px;padding:10px 12px;font-size:12px;white-space:pre-wrap}
</style></head><body>
<div class="bar"><div class="logo">砺</div><div style="font-weight:600">任务详情</div>
<div style="margin-left:auto;display:flex;gap:16px"><a href="/dashboard">看板</a><a href="/terminals">终端管理</a><a href="/logout">退出</a></div></div>
<div id="app"></div>
<script>
const id = location.pathname.split('/').pop();
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
async function load(){
  const r = await fetch('/v1/tasks/' + encodeURIComponent(id));
  if(!r.ok){ document.getElementById('app').innerHTML = '<div class="card">任务不存在或无权限</div>'; return; }
  const d = await r.json(); const t = d.task;
  let html = '<div class="card"><h2>'+esc(t.title)+'</h2>'
    + '<div class="muted">员工：'+esc(t.emp_name||'-')+'（'+esc(t.employee_no||'-')+'） · 设备：'+esc(t.hostname||'-')+'</div>'
    + '<div class="muted" style="margin-top:6px">状态：<span class="tag '+(t.status==='done'?'ok':(t.status==='failed'?'err':''))+'">'+esc(t.status)+'</span>'
    + ' · 开始：'+esc(t.started_at||'-')+' · 结束：'+esc(t.ended_at||'-')+' · Token：'+((t.tokens_in||0)+(t.tokens_out||0))+'</div>'
    + '<div style="margin-top:12px"><b>结果摘要</b><pre>'+esc(t.summary||'（无）')+'</pre></div></div>';
  html += '<div class="card"><h3 style="font-size:14px;color:#1f3a5f;margin-bottom:8px">执行步骤（'+d.steps.length+'）</h3><table><thead><tr><th>#</th><th>工具</th><th>耗时</th><th>结果</th><th>时间</th></tr></thead><tbody>';
  d.steps.forEach(s=>{ html += '<tr><td>'+s.seq+'</td><td>'+esc(s.tool)+'</td><td>'+s.duration_ms+' ms</td><td>'+(s.ok?'✅ 成功':'❌ 失败')+'</td><td class="muted">'+esc(s.created_at||'')+'</td></tr>'; });
  html += '</tbody></table></div>';
  html += '<div class="card"><h3 style="font-size:14px;color:#1f3a5f;margin-bottom:8px">产物（'+d.artifacts.length+'）</h3>';
  if(!d.artifacts.length) html += '<div class="muted">无</div>';
  d.artifacts.forEach(a=>{ html += '<div style="padding:6px 0;font-size:13px">📄 '+esc(a.name)+' <span class="muted">· '+(a.size||0)+' B · '+esc(a.visibility||'')+'</span></div>'; });
  html += '</div>';
  document.getElementById('app').innerHTML = html;
}
load();
</script></body></html>"""

@app.get("/tasks/{task_id}", response_class=HTMLResponse)
async def task_page(task_id: str, request: Request):
    if not check_token(request.cookies.get(COOKIE_NAME, "")):
        return RedirectResponse("/login", status_code=303)
    return TASK_HTML

DASHBOARD = """<!doctype html><html><head><meta charset="utf-8"><title>团队 AI 资产平台 · 看板</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef1f7;color:#1f2937;padding:24px}
.bar{background:#1f3a5f;color:#fff;border-radius:14px;padding:16px 22px;display:flex;align-items:center;gap:12px;margin-bottom:18px}
.logo{width:34px;height:34px;border-radius:9px;background:#4f8cff;display:flex;align-items:center;justify-content:center;font-weight:700}
.kpis{display:flex;gap:16px;margin-bottom:18px}
.kpi{flex:1;background:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 6px 24px rgba(15,35,70,.06)}
.kpi .lbl{font-size:12.5px;color:#8592a8}.kpi .num{font-size:26px;font-weight:700;color:#1f3a5f}
.grid{display:flex;gap:16px}
.card{background:#fff;border-radius:14px;padding:18px;box-shadow:0 6px 24px rgba(15,35,70,.06)}
.card h3{font-size:14px;color:#1f3a5f;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #f1f4f9}
th{color:#8592a8;font-weight:600;font-size:12px}
.tag{display:inline-block;font-size:11.5px;padding:2px 8px;border-radius:20px;background:#e8f0ff;color:#2f6bff}
.tag.ok{background:#e8f7ee;color:#0b7a45}.tag.run{background:#fff4e5;color:#a15c00}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
</style></head><body>
<div class="bar"><div class="logo">砺</div><div style="font-size:18px;font-weight:600">团队 AI 资产平台 · P0 看板</div>
<div style="margin-left:auto;font-size:12.5px;opacity:.8" id="ts"></div>
<a href="/terminals" style="color:#fff;opacity:.75;font-size:12.5px;margin-left:16px;text-decoration:none">终端管理</a>
<a href="/logout" style="color:#fff;opacity:.75;font-size:12.5px;margin-left:14px;text-decoration:none">退出</a></div>
<div class="kpis">
<div class="kpi"><div class="lbl">今日任务</div><div class="num" id="k1">-</div></div>
<div class="kpi"><div class="lbl">在线终端</div><div class="num" id="k2">-</div></div>
<div class="kpi"><div class="lbl">累计 Token</div><div class="num" id="k3">-</div></div>
<div class="kpi"><div class="lbl">产物数</div><div class="num" id="k4">-</div></div>
</div>
<div class="grid">
<div class="card" style="width:360px"><h3>终端 / 成员</h3><table id="terms"><thead><tr><th>成员</th><th>终端</th><th>最后心跳</th></tr></thead><tbody></tbody></table></div>
<div class="card" style="flex:1"><h3>最近任务与执行步骤</h3><table id="tasks"><thead><tr><th>任务</th><th>成员</th><th>状态</th><th>Token</th><th>开始</th></tr></thead><tbody></tbody></table>
<div id="steps" style="margin-top:14px;font-size:12.5px;color:#5b6b85"></div></div>
</div>
<script>
async function load(){
  const r = await fetch('/v1/dashboard/summary'); const d = await r.json();
  k1.textContent=d.stats.tasks_today; k2.textContent=d.stats.online+' / '+d.stats.terminals;
  k3.textContent=d.stats.tokens.toLocaleString(); k4.textContent=d.stats.artifacts;
  ts.textContent='刷新于 '+new Date().toLocaleTimeString();
  const tb=document.querySelector('#terms tbody'); tb.innerHTML='';
  d.terminals.forEach(t=>{ const tr=document.createElement('tr');
    tr.innerHTML='<td>'+esc(t.user_name)+'</td><td>'+esc(t.hostname)+'</td><td>'+(t.last_seen?new Date(t.last_seen).toLocaleTimeString():'-')+'</td>';
    tb.appendChild(tr); });
  const tb2=document.querySelector('#tasks tbody'); tb2.innerHTML='';
  d.recent_tasks.forEach(t=>{ const tr=document.createElement('tr');
    const cls=t.status==='done'?'ok':(t.status==='running'?'run':'');
    tr.innerHTML='<td><a href="/tasks/'+t.id+'" style="color:#2f6bff;text-decoration:none">'+esc(t.title)+'</a></td><td>'+esc(t.user_name||(t.terminal_id==='octop'?'Octop 助理':'-'))+'</td><td><span class="tag '+cls+'">'+esc(t.status)+'</span></td><td>'+((t.tokens_in+t.tokens_out)||0)+'</td><td>'+(t.started_at?new Date(t.started_at).toLocaleTimeString():'-')+'</td>';
    tb2.appendChild(tr); });
  const s=document.querySelector('#steps'); s.innerHTML='';
  d.steps.slice(0,12).forEach(x=>{ const div=document.createElement('div');
    div.style.padding='3px 0'; div.textContent='• ['+(x.ok?'✅':'❌')+'] '+x.tool+' · '+x.duration_ms+'ms';
    s.appendChild(div); });
}
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
load(); setInterval(load, 8000);
</script></body></html>"""

LOGIN_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>登录 · 团队 AI 资产平台</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef1f7;display:flex;align-items:center;justify-content:center;height:100vh}
.card{background:#fff;border-radius:16px;padding:36px 40px;box-shadow:0 10px 40px rgba(15,35,70,.12);width:360px}
.logo{width:44px;height:44px;border-radius:12px;background:#4f8cff;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;margin-bottom:14px}
h1{font-size:19px;color:#1f3a5f;margin-bottom:4px}
p{font-size:13px;color:#8592a8;margin-bottom:22px}
label{display:block;font-size:13px;color:#5b6b85;margin-bottom:6px}
input{width:100%;height:40px;border:1px solid #dbe2ee;border-radius:9px;padding:0 12px;font-size:14px;margin-bottom:14px;background:#fbfcfe}
button{width:100%;height:42px;border:0;border-radius:9px;background:#2f6bff;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
.err{color:#d93025;font-size:13px;margin-bottom:12px;display:none}
</style></head><body>
<div class="card"><div class="logo">砺</div><h1>团队 AI 资产平台</h1><p>请登录后查看</p>
<div class="err" id="err">账号或密码错误</div>
<form method="post" action="/login">
<label>账号</label><input name="username" autofocus autocomplete="username">
<label>密码</label><input name="password" type="password" autocomplete="current-password">
<button type="submit">登录</button>
</form></div>
<script>if(location.search.indexOf('err=1')>=0){document.getElementById('err').style.display='block'}</script>
</body></html>"""

@app.get("/login", response_class=HTMLResponse)
async def login_page():
    return LOGIN_HTML

@app.post("/login")
async def login_submit(request: Request):
    body = (await request.body()).decode("utf-8", "ignore")
    form = parse_qs(body)
    u = (form.get("username") or [""])[0]
    p = (form.get("password") or [""])[0]
    if u == AUTH["user"] and hmac.compare_digest(hashlib.sha256(p.encode()).hexdigest(), AUTH["pass_sha"]):
        resp = RedirectResponse("/dashboard", status_code=303)
        resp.set_cookie(COOKIE_NAME, make_token(), max_age=SESSION_TTL, httponly=True, samesite="lax")
        audit(u, "admin.login", "", "")
        return resp
    return RedirectResponse("/login?err=1", status_code=303)

@app.get("/logout")
async def logout():
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie(COOKIE_NAME)
    return resp

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    if not check_token(request.cookies.get(COOKIE_NAME, "")):
        return RedirectResponse("/login", status_code=303)
    return DASHBOARD

@app.get("/health")
async def health():
    return {"status": "ok", "time": now()}
