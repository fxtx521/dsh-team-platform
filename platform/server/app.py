#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""团队 AI 资产平台 · P0 服务端（FastAPI 单体）"""
import os, sqlite3, hashlib, hmac, secrets, time, uuid, json, subprocess
from datetime import datetime, timezone
from typing import Optional, List
from urllib.parse import parse_qs
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse, Response, StreamingResponse
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
CREATE TABLE IF NOT EXISTS experiences(
  id TEXT PRIMARY KEY, task_id TEXT, title TEXT, kind TEXT, content TEXT,
  status TEXT DEFAULT 'pending', skill_id TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS chat_sessions(
  id TEXT PRIMARY KEY, session_id TEXT, thread_id TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS skill_deliveries(
  id TEXT PRIMARY KEY, terminal_id TEXT, skill_id TEXT, version INTEGER, delivered_at TEXT);
CREATE TABLE IF NOT EXISTS audit_logs(
  id TEXT PRIMARY KEY, actor TEXT, action TEXT, target TEXT, detail TEXT, created_at TEXT);
"""

def now():
    return datetime.now(timezone.utc).isoformat()

def conn():
    c = sqlite3.connect(DB, timeout=30)
    c.row_factory = sqlite3.Row
    try:
        c.execute("PRAGMA journal_mode=WAL")
        c.execute("PRAGMA busy_timeout=3000")
        c.execute("PRAGMA synchronous=NORMAL")
    except Exception:
        pass
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
    try:
        c.execute("INSERT INTO audit_logs(id,actor,action,target,detail,created_at) VALUES(?,?,?,?,?,?)",
                  (uuid.uuid4().hex, actor, action, target, detail, now()))
        c.commit()
    except Exception:
        try: c.rollback()
        except Exception: pass
    finally:
        c.close()

# ── 员工端接口 ──────────────────────────────────────────────
@app.post("/v1/heartbeat")
async def heartbeat(request: Request, x_api_key: Optional[str] = Header(None)):
    t = auth(x_api_key)
    body = await request.json() if request.headers.get("content-length","0") != "0" else {}
    c = conn()
    try:
        c.execute("UPDATE terminals SET last_seen=?, version=? WHERE id=?",
                  (now(), str(body.get("version") or t["version"]), t["id"]))
        c.commit()
    except Exception as e:
        print("heartbeat write skipped:", e)
    finally:
        c.close()
    return {"ok": True, "server_time": now(), "skills_version": latest_skill_version()}

@app.post("/v1/tasks")
async def create_task(request: Request, x_api_key: Optional[str] = Header(None)):
    t = auth(x_api_key)
    b = await request.json()
    tid = b.get("id") or uuid.uuid4().hex
    c = conn()
    try:
        c.execute("""INSERT INTO tasks(id,terminal_id,title,type,status,started_at,model,tokens_in,tokens_out,summary,created_at)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?)
                     ON CONFLICT(id) DO UPDATE SET title=excluded.title, status=excluded.status,
                       ended_at=COALESCE(tasks.ended_at, tasks.ended_at), summary=COALESCE(excluded.summary, tasks.summary)""",
                  (tid, t["id"], b.get("title",""), b.get("type","general"), b.get("status","running"),
                   b.get("started_at") or now(), b.get("model",""), int(b.get("tokens_in") or 0),
                   int(b.get("tokens_out") or 0), b.get("summary",""), now()))
        c.commit()
    except Exception as e:
        print("create_task skipped:", e)
        try: c.rollback()
        except Exception: pass
    finally:
        c.close()
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

@app.post("/v1/tasks/{task_id}/artifacts/upload")
async def upload_artifact(task_id: str, file: UploadFile = File(...),
                          x_api_key: Optional[str] = Header(None), visibility: str = Form("self")):
    """终端上传产物文件（上传后可在看板下载）。"""
    t = auth(x_api_key)
    raw = await file.read()
    if len(raw) > 200 * 1024 * 1024:
        raise HTTPException(413, "file too large (max 200MB)")
    aid = uuid.uuid4().hex
    safe = os.path.basename(file.filename or "artifact")
    dest = os.path.join(ART, aid + "_" + safe)
    with open(dest, "wb") as f:
        f.write(raw)
    sha = hashlib.sha256(raw).hexdigest()
    c = conn()
    c.execute("""INSERT INTO artifacts(id,task_id,name,mime,size,sha256,path,visibility,created_at)
                 VALUES(?,?,?,?,?,?,?,?,?)""",
              (aid, task_id, safe, file.content_type or "", len(raw), sha, dest, visibility, now()))
    c.commit(); c.close()
    audit(t["user_name"], "artifact.upload", task_id, safe)
    return {"ok": True, "id": aid, "name": safe, "size": len(raw), "sha256": sha}

@app.post("/v1/tasks/{task_id}/artifacts/upload-b64")
async def upload_artifact_b64(task_id: str, request: Request, x_api_key: Optional[str] = Header(None)):
    """终端上传产物（base64，供浏览器端插件使用）。"""
    t = auth(x_api_key)
    b = await request.json()
    import base64 as _b64
    name = os.path.basename(str(b.get("name") or "artifact"))
    try:
        raw = _b64.b64decode(str(b.get("content_b64") or ""), validate=False)
    except Exception:
        raise HTTPException(400, "invalid base64")
    if len(raw) > 200 * 1024 * 1024:
        raise HTTPException(413, "file too large")
    aid = uuid.uuid4().hex
    dest = os.path.join(ART, aid + "_" + name)
    with open(dest, "wb") as f:
        f.write(raw)
    sha = hashlib.sha256(raw).hexdigest()
    c = conn()
    c.execute("""INSERT INTO artifacts(id,task_id,name,mime,size,sha256,path,visibility,created_at)
                 VALUES(?,?,?,?,?,?,?,?,?)""",
              (aid, task_id, name, b.get("mime") or "", len(raw), sha, dest, b.get("visibility") or "team", now()))
    c.commit(); c.close()
    audit(t["user_name"], "artifact.upload", task_id, name)
    return {"ok": True, "id": aid, "name": name, "size": len(raw), "sha256": sha}

@app.get("/v1/artifacts/{artifact_id}/download")
async def download_artifact(artifact_id: str, request: Request):
    require_admin(request)
    c = conn()
    r = c.execute("SELECT * FROM artifacts WHERE id=?", (artifact_id,)).fetchone()
    c.close()
    if not r or not r["path"] or not os.path.exists(r["path"]):
        raise HTTPException(404, "artifact not found")
    return FileResponse(r["path"], filename=r["name"] or "artifact")

@app.get("/v1/skills")
async def list_skills(since: int = 0, x_api_key: Optional[str] = Header(None)):
    auth(x_api_key)
    t = auth(x_api_key)
    c = conn()
    rows = c.execute("SELECT * FROM skills WHERE version >= ? ORDER BY updated_at DESC", (since,)).fetchall()
    if x_api_key:
        for r in rows:
            exists = c.execute("SELECT id FROM skill_deliveries WHERE terminal_id=? AND skill_id=? AND version=?",
                               (t["id"], r["id"], r["version"])).fetchone()
            if not exists:
                c.execute("INSERT INTO skill_deliveries(id,terminal_id,skill_id,version,delivered_at) VALUES(?,?,?,?,?)",
                          (uuid.uuid4().hex, t["id"], r["id"], r["version"], now()))
        c.commit()
    c.close()
    return {"ok": True, "items": [dict(r) for r in rows]}

@app.post("/v1/experience/distill")
async def distill_experience(request: Request):
    """经验提炼 V1：扫描最近完成的 Octop 任务，生成经验候选（待审核）。"""
    require_admin(request)
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    hours = int(body.get("hours") or 24)
    import datetime as _dt
    since = (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(hours=hours)).isoformat()
    c = conn()
    tasks = c.execute("""SELECT * FROM tasks WHERE type='octop' AND status='done' AND created_at>=?
                         ORDER BY created_at DESC LIMIT 50""", (since,)).fetchall()
    created = []
    for t in tasks:
        dup = c.execute("SELECT id FROM experiences WHERE task_id=?", (t["id"],)).fetchone()
        if dup:
            continue
        steps = c.execute("SELECT tool, duration_ms, ok FROM task_steps WHERE task_id=? ORDER BY seq", (t["id"],)).fetchall()
        step_txt = "、".join(f'{s["tool"]}({s["duration_ms"]}ms)' for s in steps)
        content = ("适用场景：" + (t["title"] or "") + "\n"
                   "执行链路：" + (step_txt or "无步骤记录") + "\n"
                   "产出要点：" + ((t["summary"] or "")[:600] or "无摘要"))
        eid = uuid.uuid4().hex
        c.execute("""INSERT INTO experiences(id,task_id,title,kind,content,status,created_at)
                     VALUES(?,?,?,?,?,?,?)""",
                  (eid, t["id"], (t["title"] or "经验") + " · 可固化", "sop", content, "pending", now()))
        created.append(eid)
    c.commit(); c.close()
    return {"ok": True, "created": len(created), "ids": created}

@app.get("/v1/experience")
async def list_experience(request: Request, status: str = ""):
    require_admin(request)
    c = conn()
    if status:
        rows = c.execute("SELECT * FROM experiences WHERE status=? ORDER BY created_at DESC LIMIT 100", (status,)).fetchall()
    else:
        rows = c.execute("SELECT * FROM experiences ORDER BY created_at DESC LIMIT 100").fetchall()
    c.close()
    return {"ok": True, "items": [dict(r) for r in rows]}

@app.post("/v1/experience/{exp_id}/approve")
async def approve_experience(exp_id: str, request: Request):
    """审核通过：把经验候选固化成技能（进技能库 → 自动下发终端）。"""
    require_admin(request)
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    c = conn()
    e = c.execute("SELECT * FROM experiences WHERE id=?", (exp_id,)).fetchone()
    if not e:
        c.close(); raise HTTPException(404, "experience not found")
    name = (body.get("name") or e["title"]).strip()
    content = e["content"] or ""
    sk = c.execute("SELECT * FROM skills WHERE name=?", (name,)).fetchone()
    if sk:
        ver = int(sk["version"]) + 1
        c.execute("UPDATE skills SET content=?, version=?, updated_at=? WHERE id=?", (content, ver, now(), sk["id"]))
        sid = sk["id"]
    else:
        sid = uuid.uuid4().hex
        c.execute("INSERT INTO skills(id,name,type,version,content,updated_at) VALUES(?,?,?,?,?,?)",
                  (sid, name, "sop", 1, content, now()))
    c.execute("UPDATE experiences SET status='approved', skill_id=? WHERE id=?", (sid, exp_id))
    c.commit(); c.close()
    audit("admin", "experience.approve", exp_id, name)
    return {"ok": True, "skill_id": sid, "name": name}

@app.post("/v1/skills/dedupe")
async def dedupe_skills(request: Request):
    """技能去重：规范化名称后同名合并，保留内容最长的一条。"""
    require_admin(request)
    import re as _re
    def norm(n):
        n = n or ""
        for p in ("经验 · ", "经验:", " · 可固化", "（v2）", "(v2)"):
            n = n.replace(p, "")
        return _re.sub(r"\s+", "", n).lower()
    c = conn()
    rows = c.execute("SELECT id, name, content, version FROM skills ORDER BY length(content) DESC").fetchall()
    keep, removed = {}, 0
    for r in rows:
        k = norm(r["name"])
        if k in keep:
            c.execute("DELETE FROM skills WHERE id=?", (r["id"],))
            removed += 1
        else:
            keep[k] = r["id"]
    c.commit()
    total = c.execute("SELECT count(*) n FROM skills").fetchone()["n"]
    c.close()
    audit("admin", "skills.dedupe", str(removed), f"left={total}")
    return {"ok": True, "removed": removed, "left": total}

@app.post("/v1/experience/batch-approve")
async def batch_approve(request: Request):
    """批量审核：低风险经验自动入库成技能，敏感类留人工。"""
    require_admin(request)
    body = await request.json() if request.headers.get("content-type","").startswith("application/json") else {}
    limit = int(body.get("limit") or 200)
    sensitive = ["客户名称", "身份证", "银行卡", "工资", "报价金额", "合同金额", "密码", "法人"]
    c = conn()
    rows = c.execute("SELECT * FROM experiences WHERE status='pending' ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    approved, kept = 0, 0
    for e in rows:
        blob = (e["title"] or "") + (e["content"] or "")
        if any(k in blob for k in sensitive):
            kept += 1
            continue
        name = ("经验 · " + (e["title"] or "未命名"))[:60]
        content = e["content"] or ""
        sk = c.execute("SELECT id, version FROM skills WHERE name=?", (name,)).fetchone()
        if sk:
            c.execute("UPDATE skills SET content=?, version=?, updated_at=? WHERE id=?", (content, int(sk["version"]) + 1, now(), sk["id"]))
            sid = sk["id"]
        else:
            sid = uuid.uuid4().hex
            c.execute("INSERT INTO skills(id,name,type,version,content,updated_at) VALUES(?,?,?,?,?,?)",
                      (sid, name, "sop", 1, content, now()))
        c.execute("UPDATE experiences SET status='approved', skill_id=? WHERE id=?", (sid, e["id"]))
        approved += 1
    c.commit(); c.close()
    audit("admin", "experience.batch_approve", str(approved), f"kept={kept}")
    return {"ok": True, "approved": approved, "kept_for_review": kept}

@app.get("/v1/skills/stats")
async def skill_stats(request: Request):
    require_admin(request)
    c = conn()
    rows = c.execute("""SELECT s.id, s.name, s.version,
                               (SELECT COUNT(DISTINCT terminal_id) FROM skill_deliveries d WHERE d.skill_id=s.id) AS delivered_terminals,
                               (SELECT MAX(delivered_at) FROM skill_deliveries d WHERE d.skill_id=s.id) AS last_delivered
                        FROM skills s ORDER BY s.updated_at DESC""").fetchall()
    c.close()
    return {"ok": True, "items": [dict(r) for r in rows]}

@app.post("/v1/skills")
async def upsert_skill(request: Request):
    """管理员新增/更新技能（同名自动版本 +1）。"""
    require_admin(request)
    b = await request.json()
    name = (b.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "name required")
    content = b.get("content") or ""
    c = conn()
    row = c.execute("SELECT * FROM skills WHERE name=?", (name,)).fetchone()
    if row:
        ver = int(row["version"]) + 1
        c.execute("UPDATE skills SET type=?,version=?,content=?,updated_at=? WHERE id=?",
                  (b.get("type", "sop"), ver, content, now(), row["id"]))
        sid, ver_out = row["id"], ver
    else:
        sid = uuid.uuid4().hex
        c.execute("INSERT INTO skills(id,name,type,version,content,updated_at) VALUES(?,?,?,?,?,?)",
                  (sid, name, b.get("type", "sop"), 1, content, now()))
        ver_out = 1
    c.commit(); c.close()
    audit("admin", "skill.upsert", sid, name)
    return {"ok": True, "id": sid, "name": name, "version": ver_out}



# ── 业务任务模板（客户核查 / 台账 / 标书）──────────────────────
TEMPLATES = [
    {
        "id": "verify",
        "name": "客户资料核查",
        "skill": "客户核查 SOP（v2）",
        "params": ["公司名称"],
        "prompt": (
            "请按公司 SOP 核查客户「{公司名称}」，输出核查报告：\n"
            "1) 工商信息：注册资本、成立时间、经营状态、注册地址\n"
            "2) 司法风险：涉诉、被执行、失信记录\n"
            "3) 经营异常：异常名录、行政处罚\n"
            "4) 结论与建议：可合作/需谨慎/不建议，并说明理由\n"
            "要求：中文、先结论再分点、每条给依据；查不到或不确定的，明确标注「需人工核实」，不要编造。"
        ),
    },
    {
        "id": "ledger",
        "name": "台账整理",
        "skill": "台账整理 SOP",
        "params": ["数据说明"],
        "prompt": (
            "请按公司 SOP 整理台账数据：{数据说明}。\n"
            "1) 缺失字段清单\n2) 格式不合规项（日期/金额/名称）\n"
            "3) 疑似重复记录\n4) 处理建议\n"
            "要求：中文、先给结论、分点列出问题清单，不编造数据。"
        ),
    },
    {
        "id": "bid",
        "name": "标书初稿",
        "skill": "标书撰写 SOP",
        "params": ["项目名称", "招标要求"],
        "prompt": (
            "请为项目「{项目名称}」撰写投标文件初稿。招标要求：{招标要求}。\n"
            "结构：一、项目理解 二、技术方案 三、实施计划 四、服务承诺 五、报价说明\n"
            "要求：中文、正式书面语、条款对应招标要求；不确定的参数标注「待确认」，不要编造资质或业绩。"
        ),
    },
]

@app.get("/v1/templates")
async def list_templates(request: Request):
    require_admin(request)
    return {"ok": True, "items": [{"id": t["id"], "name": t["name"], "params": t["params"]} for t in TEMPLATES]}

def render_template(template_id: str, params: dict) -> tuple:
    for t in TEMPLATES:
        if t["id"] != template_id:
            continue
        prompt = t["prompt"]
        missing = []
        for p in t["params"]:
            v = (params or {}).get(p, "")
            if not v:
                missing.append(p)
            prompt = prompt.replace("{" + p + "}", str(v))
        if missing:
            raise HTTPException(400, "missing params: " + ", ".join(missing))
        return t["name"], prompt
    raise HTTPException(404, "template not found")

# ── Octop 适配层（PoC：平台任务交给 Octop 助理执行）──────────────
OCTOP_HOME = os.environ.get("DSH_OCTOP_HOME", "/opt/dsh-octop/data")
OCTOP_BIN = os.environ.get("DSH_OCTOP_BIN", "/opt/dsh-octop/venv/bin/octop")
OCTOP_AGENT = os.environ.get("DSH_OCTOP_AGENT", "VHSDB4")

def octop_chat(prompt: str, agent_id: str = "", timeout: int = 240, session_key: str = "", thread_id: str = "") -> dict:
    """调用 Octop 助理执行一句话任务，返回 {ok, reply, elapsed_ms}。"""
    agent_id = agent_id or OCTOP_AGENT
    env = dict(os.environ)
    env["HOME"] = OCTOP_HOME
    t0 = time.time()
    try:
        argv = [OCTOP_BIN, "chats", "send", prompt, "--agent", agent_id, "--plain"]
        if thread_id:
            argv += ["--thread-id", thread_id]
        elif session_key:
            argv += ["--session-key", session_key]
        p = subprocess.run(argv, capture_output=True, text=True, timeout=timeout, env=env)
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

SEARCH_BIN = os.environ.get("DSH_SEARCH_BIN", "/opt/dsh-octop/tools/websearch.py")

def sanitize_hits(text: str, limit: int = 2200) -> str:
    """精简检索结果：去掉长链接行，控制注入提示词的长度。"""
    out = []
    for line in (text or "").splitlines():
        s = line.strip()
        if not s or s.startswith("http") or s.startswith("[来源"):
            continue
        if len(s) > 300:
            s = s[:300] + "…"
        out.append(s)
    return "\n".join(out)[:limit]

def run_search(q: str, n: int = 6, timeout: int = 60) -> str:
    """调用本地搜索脚本，返回纯文本结果（失败返回空串）。"""
    try:
        p = subprocess.run(["/usr/bin/python3", SEARCH_BIN, q, str(n)],
                           capture_output=True, text=True, timeout=timeout)
        return (p.stdout or "").strip()
    except Exception:
        return ""


# ── 本地工作台接入（长轮询） + MCP 网关 ──────────────────
import asyncio as _asyncio
_LOCAL_CALLS = {}        # call_id -> {"event": asyncio.Event, "result": Any, "tool": str, "args": dict, "terminal": str}
_LOCAL_QUEUE = []        # [(call_id, payload)] 待员工端拉取
_LOCAL_LOCK = _asyncio.Lock()

LOCAL_TOOLS = [
    {"name": "local_list_dir", "description": "列出员工本地项目目录下的文件（仅限已登记目录）",
     "inputSchema": {"type": "object", "properties": {"dir": {"type": "string", "description": "目录绝对路径"}}, "required": ["dir"]}},
    {"name": "local_read_file", "description": "读取员工本地文件内容（仅限已登记目录，最大 200KB）",
     "inputSchema": {"type": "object", "properties": {"file": {"type": "string"}}, "required": ["file"]}},
    {"name": "local_write_file", "description": "在员工本地写入文件（仅限已登记目录）",
     "inputSchema": {"type": "object", "properties": {"file": {"type": "string"}, "content": {"type": "string"}}, "required": ["file", "content"]}},
    {"name": "local_run_cmd", "description": "在员工本地执行命令（需员工在客户端开启命令白名单）",
     "inputSchema": {"type": "object", "properties": {"cmd": {"type": "string"}, "cwd": {"type": "string"}}, "required": ["cmd"]}},
]

@app.post("/v1/local/poll")
async def local_poll(request: Request, x_api_key: Optional[str] = Header(None), timeout: int = 20):
    """员工端长轮询：拉取云端下发的本地工具调用。"""
    t = auth(x_api_key)
    deadline = time.time() + max(1, min(timeout, 30))
    while time.time() < deadline:
        async with _LOCAL_LOCK:
            for i, (cid, payload) in enumerate(_LOCAL_QUEUE):
                if payload.get("terminal") in ("", t["id"]) or payload.get("terminal") == t["id"]:
                    _LOCAL_QUEUE.pop(i)
                    return {"ok": True, "call": {"id": cid, **payload}}
        await _asyncio.sleep(0.5)
    return {"ok": True, "call": None}

@app.post("/v1/local/result")
async def local_result(request: Request, x_api_key: Optional[str] = Header(None)):
    """员工端回传本地工具执行结果。"""
    auth(x_api_key)
    b = await request.json()
    cid = str(b.get("id") or "")
    entry = _LOCAL_CALLS.get(cid)
    if not entry:
        raise HTTPException(404, "call not found")
    entry["result"] = {"ok": bool(b.get("ok")), "output": b.get("output") or "", "error": b.get("error") or ""}
    entry["event"].set()
    return {"ok": True}

async def _dispatch_local(tool: str, args: dict, timeout: float = 60.0):
    cid = uuid.uuid4().hex
    ev = _asyncio.Event()
    _LOCAL_CALLS[cid] = {"event": ev, "result": None, "tool": tool, "args": args, "terminal": ""}
    async with _LOCAL_LOCK:
        _LOCAL_QUEUE.append((cid, {"tool": tool, "args": args, "terminal": ""}))
    try:
        await _asyncio.wait_for(ev.wait(), timeout=timeout)
    except _asyncio.TimeoutError:
        _LOCAL_CALLS.pop(cid, None)
        return {"ok": False, "error": "员工端未响应（可能未启动客户端）"}
    r = _LOCAL_CALLS.pop(cid, {}).get("result")
    return r or {"ok": False, "error": "no result"}

@app.post("/mcp")
async def mcp_endpoint(request: Request):
    """MCP（streamable HTTP）网关：把 Octop 的工具调用转发到员工本地工作台。"""
    try:
        body = await request.json()
    except Exception:
        return Response("bad request", status_code=400)
    method = body.get("method") or ""
    rid = body.get("id")
    accept = (request.headers.get("accept") or "").lower()
    sid = request.headers.get("mcp-session-id") or ""

    def send(payload: dict, status: int = 200):
        headers = {}
        if sid:
            headers["Mcp-Session-Id"] = sid
        if "text/event-stream" in accept:
            data = "event: message\ndata: " + json.dumps(payload, ensure_ascii=False) + "\n\n"
            return Response(data, status_code=status, media_type="text/event-stream", headers=headers)
        return JSONResponse(payload, status_code=status, headers=headers)

    def ok(result):
        return {"jsonrpc": "2.0", "id": rid, "result": result}

    if method == "initialize":
        sid = uuid.uuid4().hex
        return send(ok({"protocolVersion": "2024-11-05", "capabilities": {"tools": {"listChanged": False}},
                        "serverInfo": {"name": "lishi-local-workbench", "version": "0.1.0"}}))
    if method in ("notifications/initialized", "initialized", "notifications/cancelled"):
        return Response("", status_code=202, headers=({"Mcp-Session-Id": sid} if sid else {}))
    if method == "ping":
        return send(ok({}))
    if method == "tools/list":
        return send(ok({"tools": LOCAL_TOOLS}))
    if method == "tools/call":
        params = body.get("params") or {}
        name = params.get("name") or ""
        args = params.get("arguments") or {}
        if name not in [t["name"] for t in LOCAL_TOOLS]:
            return send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32602, "message": "unknown tool: " + name}})
        r = await _dispatch_local(name, args)
        text = r.get("output") if r.get("ok") else ("错误: " + str(r.get("error")))
        return send(ok({"content": [{"type": "text", "text": str(text)[:20000]}], "isError": not r.get("ok")}))
    return send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": "method not found"}})

@app.get("/mcp")
async def mcp_get(request: Request):
    """streamable HTTP 的 GET 流：允许建立但不推送（保持连接可用）。"""
    sid = request.headers.get("mcp-session-id") or ""
    async def stream():
        yield ": keep-alive\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers=({"Mcp-Session-Id": sid} if sid else {}))

@app.delete("/mcp")
async def mcp_delete(request: Request):
    return Response("", status_code=204)
OCTOP_API = os.environ.get("DSH_OCTOP_API", "http://127.0.0.1:18090")
OCTOP_USER = os.environ.get("DSH_OCTOP_USER", "admin")
OCTOP_PASS = os.environ.get("DSH_OCTOP_PASS", "Dsh-OCTOP-2026-a7f3")
_octop_token = {"t": "", "exp": 0.0}

def octop_api_token() -> str:
    import urllib.request as _u
    if _octop_token["t"] and time.time() < _octop_token["exp"]:
        return _octop_token["t"]
    req = _u.Request(OCTOP_API + "/api/auth/login",
                     data=json.dumps({"username": OCTOP_USER, "password": OCTOP_PASS}).encode(),
                     headers={"Content-Type": "application/json"})
    d = json.loads(_u.urlopen(req, timeout=15).read())
    _octop_token["t"] = d.get("access_token", "")
    _octop_token["exp"] = time.time() + 3000
    return _octop_token["t"]

def octop_create_thread() -> str:
    """通过 Octop HTTP 接口新建独立会话线程。"""
    import urllib.request as _u
    req = _u.Request(OCTOP_API + "/api/agents/" + OCTOP_AGENT + "/threads",
                     data=b"{}", method="POST",
                     headers={"Content-Type": "application/json", "Authorization": "Bearer " + octop_api_token()})
    d = json.loads(_u.urlopen(req, timeout=30).read())
    return d.get("thread_id", "")

def thread_for_session(session_id: str) -> str:
    """每个客户端会话对应一个独立的 Octop thread（没有就新建）。"""
    if not session_id:
        return ""
    c = conn()
    row = c.execute("SELECT thread_id FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()
    c.close()
    if row and row["thread_id"]:
        return row["thread_id"]
    tid = ""
    try:
        tid = octop_create_thread()
    except Exception as e:
        print("create thread failed:", e)
    if tid:
        c = conn()
        try:
            c.execute("INSERT OR REPLACE INTO chat_sessions(id,session_id,thread_id,created_at) VALUES(?,?,?,?)",
                      (uuid.uuid4().hex, session_id, tid, now()))
            c.commit()
        except Exception:
            pass
        finally:
            c.close()
    return tid


# ── 自动沉淀：后台定时提炼 + 对话时技能召回注入 ──────────
def _distill_once(hours: int = 24) -> int:
    import datetime as _dt
    since = (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(hours=hours)).isoformat()
    c = conn()
    try:
        tasks = c.execute("""SELECT * FROM tasks WHERE status='done' AND created_at>=?
                             ORDER BY created_at DESC LIMIT 50""", (since,)).fetchall()
        n = 0
        for t in tasks:
            if c.execute("SELECT id FROM experiences WHERE task_id=?", (t["id"],)).fetchone():
                continue
            title = (t["title"] or "")
            summary = (t["summary"] or "")
            # 清掉飞书桥前缀等噪音
            for p in ("（飞书消息 · 回复直接发回飞书 · 简短口语化）", "(飞书消息)", "【砺的长期记忆召回"):
                title = title.replace(p, "")
            title = title.strip()[:60]
            if not title or title.startswith("命中"):
                continue
            # 质量过滤：测试类、过短、无实质结论的不要
            if any(k in title for k in ("测试", "负载", "loadtest", "一句话")):
                continue
            if len(summary) < 40:
                continue
            steps = c.execute("SELECT tool, duration_ms, ok FROM task_steps WHERE task_id=? ORDER BY seq", (t["id"],)).fetchall()
            step_txt = "、".join(f'{s["tool"]}({s["duration_ms"]}ms)' for s in steps)
            content = ("适用场景：" + (t["title"] or "") + "\n"
                       "执行链路：" + (step_txt or "无步骤记录") + "\n"
                       "产出要点：" + ((t["summary"] or "")[:600] or "无摘要"))
            c.execute("""INSERT INTO experiences(id,task_id,title,kind,content,status,created_at)
                         VALUES(?,?,?,?,?,?,?)""",
                      (uuid.uuid4().hex, t["id"], (t["title"] or "经验") + " · 可固化", "sop", content, "pending", now()))
            n += 1
        c.commit()
        return n
    finally:
        c.close()

def recall_skills(text: str, limit: int = 3) -> str:
    """按问题关键词，从技能库召回最相关经验，拼成提示词片段。"""
    text = (text or "").lower()
    if not text:
        return ""
    c = conn()
    rows = c.execute("SELECT name, content FROM skills").fetchall()
    c.close()
    def grams(s):
        s = "".join(ch for ch in (s or "") if ch.strip())
        return {s[i:i+2] for i in range(max(0, len(s) - 1))}
    tg = grams(text)
    scored = []
    for r in rows:
        name, content = r["name"] or "", r["content"] or ""
        score = 0
        if name and name[:6] in text:
            score += 8
        sg = grams(name + content[:300])
        score += len(tg & sg)
        if score > 1:
            scored.append((score, name, content))
    scored.sort(reverse=True)
    top = scored[:limit]
    if not top:
        return ""
    out = "【公司已有经验/技能（优先遵循）】\n"
    for sc, name, content in top:
        out += f"- {name}：{content[:400]}\n"
    return out

@app.on_event("startup")
async def _startup_bg():
    async def loop():
        await _asyncio.sleep(60)
        while True:
            try:
                n = await _asyncio.to_thread(_distill_once, 24)
                if n:
                    print("auto distill:", n)
            except Exception as e:
                print("auto distill failed:", e)
            await _asyncio.sleep(1800)
    _asyncio.create_task(loop())

@app.get("/v1/my/summary")
async def my_summary(x_api_key: Optional[str] = Header(None)):
    """员工端看自己的数据：任务、步骤、技能、经验统计。"""
    t = auth(x_api_key)
    c = conn()
    tasks = c.execute("""SELECT id, title, status, created_at, summary FROM tasks
                         WHERE terminal_id=? ORDER BY created_at DESC LIMIT 30""", (t["id"],)).fetchall()
    total = c.execute("SELECT count(*) n FROM tasks WHERE terminal_id=?", (t["id"],)).fetchone()["n"]
    today = datetime.now(timezone.utc).date().isoformat()
    today_n = c.execute("SELECT count(*) n FROM tasks WHERE terminal_id=? AND date(created_at)=?",
                        (t["id"], today)).fetchone()["n"]
    steps = c.execute("""SELECT s.tool, count(*) n, ROUND(AVG(s.duration_ms)) avg_ms, SUM(s.ok) ok_n
                         FROM task_steps s JOIN tasks t2 ON t2.id = s.task_id
                         WHERE t2.terminal_id=? GROUP BY s.tool ORDER BY n DESC LIMIT 10""", (t["id"],)).fetchall()
    skills_n = c.execute("SELECT count(*) n FROM skills").fetchone()["n"]
    exp_n = c.execute("SELECT count(*) n FROM experiences").fetchone()["n"]
    exp_pending = c.execute("SELECT count(*) n FROM experiences WHERE status='pending'").fetchone()["n"]
    c.close()
    return {"ok": True, "who": t["user_name"],
            "stats": {"total_tasks": total, "today_tasks": today_n, "skills": skills_n,
                      "experiences": exp_n, "pending_experience": exp_pending},
            "tasks": [dict(r) for r in tasks],
            "tools": [dict(s) for s in steps]}

@app.post("/v1/chat")
async def chat_with_assistant(request: Request, x_api_key: Optional[str] = Header(None)):
    """客户端聊天：员工终端 Key 直接和云端助理对话（不建任务，轻量）。"""
    terminal = None
    try:
        require_admin(request)
    except HTTPException:
        terminal = auth(x_api_key)
    b = await request.json()
    msg = (b.get("message") or "").strip()
    if not msg:
        raise HTTPException(400, "message required")
    sid = str(b.get("session_id") or "")
    tid = await _asyncio.to_thread(thread_for_session, sid) if sid else ""
    ctx = ""
    try:
        ctx = await _asyncio.to_thread(recall_skills, msg, 3)
    except Exception:
        ctx = ""
    files = b.get("files") or []
    file_block = ""
    for f in files[:8]:
        fname = os.path.basename(str(f.get("name") or "file"))
        content = str(f.get("content") or "")[:12000]
        if content:
            file_block += f"\n--- 文件：{fname} ---\n{content}\n"
    parts = []
    if ctx:
        parts.append(ctx)
    if file_block:
        parts.append("【本地文件内容（由客户端读取）】" + file_block)
    parts.append("【用户问题】\n" + msg)
    final_msg = "\n\n".join(parts)
    res = await _asyncio.to_thread(octop_chat, final_msg, "", 240, "", tid)
    return {"ok": res["ok"], "reply": res["reply"], "elapsed_ms": res["elapsed_ms"], "error": res.get("error", ""),
            "who": (terminal["user_name"] if terminal else "admin")}

@app.post("/v1/octop/run")
async def octop_run(request: Request, x_api_key: Optional[str] = Header(None), x_admin_cookie: Optional[str] = Header(None)):
    """派任务给 Octop 执行：管理员（网页）或员工终端（X-API-Key）都可以调用。"""
    terminal = None
    try:
        require_admin(request)
    except HTTPException:
        terminal = auth(x_api_key)
    body = await request.json()
    title = (body.get("title") or "").strip()
    prompt = (body.get("prompt") or "").strip()
    if body.get("template_id"):
        tname, prompt = render_template(str(body["template_id"]), body.get("params") or {})
        title = title or tname
    files = body.get("files") or []
    file_block = ""
    for f in files[:10]:
        fname = os.path.basename(str(f.get("name") or "file"))
        content = str(f.get("content") or "")[:8000]
        if not content:
            continue
        file_block += f"\n--- 文件：{fname} ---\n{content}\n"
    if file_block:
        prompt = ("【本地项目文件内容（由员工客户端读取，任务结束后不会留在服务器）】\n"
                  + file_block + "\n【任务要求】\n" + prompt)
    title = title or "Octop 任务"
    if not prompt:
        raise HTTPException(400, "prompt required")
    tid = uuid.uuid4().hex
    c = conn()
    c.execute("""INSERT INTO tasks(id,terminal_id,title,type,status,started_at,model,summary,created_at)
                 VALUES(?,?,?,?,?,?,?,?,?)""",
              (tid, (terminal["id"] if terminal else "octop"), title, "octop", "running", now(), "qwen3.5:9b", "", now()))
    c.commit(); c.close()
    # 先做确定性检索（平台做工具，模型只做推理与写作）
    search_query = ""
    if body.get("template_id") == "verify":
        search_query = str((body.get("params") or {}).get("公司名称", "")).strip()
    elif body.get("search_query"):
        search_query = str(body["search_query"]).strip()
    if search_query:
        t_search = time.time()
        hits = sanitize_hits(await _asyncio.to_thread(run_search, search_query + " 工商信息 注册资本 成立时间", 6))
        c = conn()
        c.execute("""INSERT INTO task_steps(id,task_id,seq,tool,args_digest,duration_ms,ok,error_code,created_at)
                     VALUES(?,?,?,?,?,?,?,?,?)""",
                  (f"{tid}-s", tid, 1, "web.search", hashlib.sha256(search_query.encode()).hexdigest()[:16],
                   int((time.time()-t_search)*1000), 1 if hits else 0, "" if hits else "no_result", now()))
        c.commit(); c.close()
        if hits:
            prompt = (
                "【重要】系统已经为你完成了联网检索，下面就是刚刚检索到的真实结果（不是让你再检索）。\n"
                "请直接引用其中的公司名称、成立时间、地址、状态等事实，严禁声称「检索失败/超时/无数据」。\n"
                "资料里没有的字段，写「资料未提供」，不要编造。\n\n"
                "=== 检索到的真实资料 ===\n" + hits + "\n\n=== 你的任务 ===\n" + prompt
            )
    # 技能注入：把公司 SOP 拼进提示词，让助理照规矩干活
    seq = 2 if search_query else 1
    skill_name = ""
    if body.get("template_id"):
        for t in TEMPLATES:
            if t["id"] == body["template_id"]:
                skill_name = t.get("skill") or ""
    if not skill_name and body.get("skill"):
        skill_name = str(body["skill"])
    if skill_name:
        c = conn()
        sk = c.execute("SELECT * FROM skills WHERE name=?", (skill_name,)).fetchone()
        c.close()
        if sk:
            t0 = time.time()
            prompt = ("【必须遵循的公司 SOP】\n" + sk["content"] + "\n\n【任务】\n" + prompt)
            c = conn()
            c.execute("""INSERT INTO task_steps(id,task_id,seq,tool,args_digest,duration_ms,ok,error_code,created_at)
                         VALUES(?,?,?,?,?,?,?,?,?)""",
                      (f"{tid}-k", tid, seq, "skill.inject", sk["id"][:16], int((time.time()-t0)*1000), 1, "", now()))
            c.commit(); c.close()
            seq += 1
    if file_block:
        c = conn()
        c.execute("""INSERT INTO task_steps(id,task_id,seq,tool,args_digest,duration_ms,ok,error_code,created_at)
                     VALUES(?,?,?,?,?,?,?,?,?)""",
                  (f"{tid}-f", tid, seq, "file.attach", hashlib.sha256(file_block.encode()).hexdigest()[:16], 0, 1, "", now()))
        c.commit(); c.close()
        seq += 1
    res = await _asyncio.to_thread(octop_chat, prompt)
    c = conn()
    c.execute("""INSERT INTO task_steps(id,task_id,seq,tool,args_digest,duration_ms,ok,error_code,created_at)
                 VALUES(?,?,?,?,?,?,?,?,?)""",
              (f"{tid}-1", tid, seq, "octop.agent", hashlib.sha256(prompt.encode()).hexdigest()[:16],
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
        p = await _asyncio.to_thread(subprocess.run, [OCTOP_BIN, "--json", "agent", "list"], capture_output=True, text=True, timeout=20, env=env)
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
    octop_today = c.execute("SELECT count(*) n FROM tasks WHERE type='octop' AND date(created_at)=?", (today,)).fetchone()["n"]
    octop_total = c.execute("SELECT count(*) n FROM tasks WHERE type='octop'").fetchone()["n"]
    recent_octop = c.execute("""SELECT id,title,status,created_at FROM tasks WHERE type='octop'
                                ORDER BY created_at DESC LIMIT 5""").fetchall()
    skills_n = c.execute("SELECT count(*) n FROM skills").fetchone()["n"]
    deliveries_n = c.execute("SELECT count(*) n FROM skill_deliveries").fetchone()["n"]
    pending_exp = c.execute("SELECT count(*) n FROM experiences WHERE status='pending'").fetchone()["n"]
    c.close()
    return {"ok": True, "stats": {"tasks_today": tasks_today, "online": online, "terminals": len(terminals),
                                 "tokens": tokens, "artifacts": artifacts},
            "octop": {"today": octop_today, "total": octop_total,
                      "recent": [dict(x) for x in recent_octop]},
            "skills": {"count": skills_n, "deliveries": deliveries_n, "pending_experience": pending_exp},
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


# ── 经验审核 / 技能库 页面 ───────────────────────────────
@app.get("/v1/skills/admin")
async def skills_admin(request: Request):
    require_admin(request)
    c = conn()
    rows = c.execute("""SELECT s.id, s.name, s.type, s.version, s.content, s.updated_at,
                               (SELECT COUNT(DISTINCT terminal_id) FROM skill_deliveries d WHERE d.skill_id=s.id) AS delivered,
                               (SELECT MAX(delivered_at) FROM skill_deliveries d WHERE d.skill_id=s.id) AS last_delivered
                        FROM skills s ORDER BY s.updated_at DESC""").fetchall()
    c.close()
    return {"ok": True, "items": [dict(r) for r in rows]}

@app.post("/v1/experience/{exp_id}/reject")
async def reject_experience(exp_id: str, request: Request):
    require_admin(request)
    c = conn()
    c.execute("UPDATE experiences SET status='rejected' WHERE id=?", (exp_id,))
    c.commit(); c.close()
    audit("admin", "experience.reject", exp_id, "")
    return {"ok": True}

NAV = '<div class="bar"><div class="logo">砺</div><b>团队 AI 平台</b>' \
      '<span class="sp"></span>' \
      '<a href="/dashboard">看板</a><a href="/terminals">终端</a>' \
      '<a href="/experience">经验审核</a><a href="/skills">技能库</a>' \
      '<a href="/logout">退出</a></div>'

PAGE_CSS = """*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef1f7;color:#1f2937;padding:24px}
.bar{background:#1f3a5f;color:#fff;border-radius:14px;padding:14px 22px;display:flex;align-items:center;gap:14px;margin-bottom:18px}
.bar .logo{width:32px;height:32px;border-radius:8px;background:#f5661f;display:flex;align-items:center;justify-content:center;font-weight:700}
.bar .sp{flex:1}
.bar a{color:#fff;text-decoration:none;opacity:.85;font-size:13px}
.bar a:hover{opacity:1}
.card{background:#fff;border-radius:14px;padding:20px 24px;box-shadow:0 6px 24px rgba(15,35,70,.06);margin-bottom:14px}
h2{font-size:18px;color:#1f3a5f;margin-bottom:10px}
.muted{color:#6b7280;font-size:13px}
pre{white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.6;color:#374151;background:#f8fafc;border-radius:10px;padding:12px;margin:10px 0}
button{border:0;border-radius:9px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;margin-right:8px}
.ok{background:#16a34a;color:#fff}.no{background:#e5e7eb;color:#374151}
.tag{display:inline-block;background:#eef2ff;color:#3b5bdb;border-radius:999px;padding:2px 10px;font-size:12px;margin-left:8px}
input,textarea{width:100%;border:1px solid #dfe3ea;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;margin:6px 0 12px}
textarea{min-height:120px}
"""

EXPERIENCE_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>经验审核</title><style>""" + PAGE_CSS + """</style></head><body>""" + NAV + """
<div class="card"><h2>经验审核 · 待通过</h2>
<div class="muted">助理完成任务后自动提炼的「可固化经验」。通过后会进技能库并自动下发到所有终端。</div>
<div id="list" style="margin-top:14px"></div></div>
<script>
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
async function load(){
  const r=await fetch("/v1/experience?status=pending");const d=await r.json();
  const el=document.getElementById("list");
  if(!d.items.length){el.innerHTML='<div class="muted">暂无待审核经验（可以先派几个任务，再点“提炼”）</div>';return;}
  el.innerHTML=d.items.map(i=>`<div style="border:1px solid #eef0f4;border-radius:12px;padding:14px;margin-bottom:12px">
    <div><b>${esc(i.title)}</b><span class="tag">${esc(i.kind)}</span></div>
    <div class="muted" style="margin-top:6px">任务 ID：${esc(i.task_id).slice(0,12)}</div>
    <pre>${esc(i.content)}</pre>
    <button class="ok" onclick="act('${i.id}','approve')">通过并入库</button>
    <button class="no" onclick="act('${i.id}','reject')">驳回</button></div>`).join("");
}
async function act(id,action){
  const r=await fetch("/v1/experience/"+id+"/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
  const d=await r.json();
  if(d.ok){alert(action==="approve"?("已入库："+(d.name||"")):"已驳回");load();}else{alert("失败："+JSON.stringify(d));}
}
load();
</script></body></html>"""

SKILLS_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>技能库</title><style>""" + PAGE_CSS + """</style></head><body>""" + NAV + """
<div class="card"><h2>技能库</h2>
<div class="muted">技能会自动下发到员工终端（DSH 技能目录），助理按 SOP 干活。</div>
<div id="list" style="margin-top:14px"></div></div>
<div class="card"><h2>新增 / 更新技能</h2>
<div class="muted">同名技能会自动版本 +1 并重新下发。</div>
<div style="margin-top:10px"><input id="name" placeholder="技能名称，例如：客户核查 SOP"></div>
<input id="type" placeholder="类型，例如：sop" value="sop">
<textarea id="content" placeholder="技能内容（步骤/规范/模板）"></textarea>
<button class="ok" onclick="save()">保存</button></div>
<script>
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
async function load(){
  const r=await fetch("/v1/skills/admin");const d=await r.json();
  document.getElementById("list").innerHTML=d.items.map(s=>`<div style="border:1px solid #eef0f4;border-radius:12px;padding:14px;margin-bottom:12px">
    <div><b>${esc(s.name)}</b><span class="tag">v${s.version}</span><span class="tag">${esc(s.type||"")}</span></div>
    <div class="muted" style="margin-top:6px">已下发终端：${s.delivered||0} 台 · 最近下发：${esc((s.last_delivered||"未下发")).slice(0,19)}</div>
    <pre>${esc(s.content)}</pre></div>`).join("");
}
async function save(){
  const body={name:document.getElementById("name").value,type:document.getElementById("type").value,content:document.getElementById("content").value};
  if(!body.name){alert("技能名称必填");return;}
  const r=await fetch("/v1/skills",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const d=await r.json();
  if(d.ok){alert("已保存：v"+d.version);document.getElementById("name").value="";document.getElementById("content").value="";load();}else{alert("失败："+JSON.stringify(d));}
}
load();
</script></body></html>"""


@app.get("/v1/report/weekly")
async def weekly_report(request: Request, days: int = 7):
    """周报：最近 N 天的任务、工具、产物、经验、技能下发汇总。"""
    require_admin(request)
    import datetime as _dt
    since = (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(days=days)).isoformat()
    c = conn()
    total = c.execute("SELECT count(*) n FROM tasks WHERE created_at>=?", (since,)).fetchone()["n"]
    done = c.execute("SELECT count(*) n FROM tasks WHERE created_at>=? AND status='done'", (since,)).fetchone()["n"]
    failed = c.execute("SELECT count(*) n FROM tasks WHERE created_at>=? AND status='failed'", (since,)).fetchone()["n"]
    octop = c.execute("SELECT count(*) n FROM tasks WHERE created_at>=? AND type='octop'", (since,)).fetchone()["n"]
    arts = c.execute("SELECT count(*) n FROM artifacts WHERE created_at>=?", (since,)).fetchone()["n"]
    exp_new = c.execute("SELECT count(*) n FROM experiences WHERE created_at>=?", (since,)).fetchone()["n"]
    exp_ok = c.execute("SELECT count(*) n FROM experiences WHERE created_at>=? AND status='approved'", (since,)).fetchone()["n"]
    deliv = c.execute("SELECT count(*) n FROM skill_deliveries WHERE delivered_at>=?", (since,)).fetchone()["n"]
    tools = c.execute("""SELECT tool, count(*) n, ROUND(AVG(duration_ms)) avg_ms, SUM(ok) ok_n
                        FROM task_steps WHERE created_at>=? GROUP BY tool ORDER BY n DESC LIMIT 12""", (since,)).fetchall()
    by_user = c.execute("""SELECT COALESCE(tr.user_name, CASE WHEN t.terminal_id='octop' THEN 'Octop 助理' ELSE '未知' END) who,
                                 count(*) n FROM tasks t LEFT JOIN terminals tr ON tr.id=t.terminal_id
                          WHERE t.created_at>=? GROUP BY who ORDER BY n DESC LIMIT 10""", (since,)).fetchall()
    c.close()
    return {"ok": True, "days": days,
            "summary": {"tasks": total, "done": done, "failed": failed, "octop": octop,
                        "artifacts": arts, "experience_new": exp_new, "experience_approved": exp_ok,
                        "skill_deliveries": deliv},
            "tools": [dict(t) for t in tools], "by_user": [dict(u) for u in by_user]}

REPORT_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>周报</title><style>""" + PAGE_CSS + """
.row{display:flex;gap:14px;flex-wrap:wrap}
.box{flex:1;min-width:150px;background:#f8fafc;border-radius:12px;padding:14px}
.box .n{font-size:24px;font-weight:700;color:#1f3a5f}
.box .t{font-size:12.5px;color:#6b7280;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #eef0f4}
th{color:#6b7280;font-weight:600}
""" + """</style></head><body>""" + NAV + """
<div class="card"><h2>近 7 天团队周报</h2><div class="muted" id="range"></div>
<div class="row" id="boxes" style="margin-top:14px"></div></div>
<div class="card"><h2>工具使用排行</h2><table id="tools"><thead><tr><th>工具</th><th>次数</th><th>平均耗时</th><th>成功率</th></tr></thead><tbody></tbody></table></div>
<div class="card"><h2>按成员</h2><table id="users"><thead><tr><th>成员</th><th>任务数</th></tr></thead><tbody></tbody></table></div>
<script>
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
async function load(){
  const r=await fetch("/v1/report/weekly?days=7");const d=await r.json();
  document.getElementById("range").textContent="统计范围：最近 "+d.days+" 天（截至 "+new Date().toLocaleString()+"）";
  const s=d.summary;
  document.getElementById("boxes").innerHTML=[
    ["任务总数",s.tasks],["完成",s.done],["失败",s.failed],["Octop 任务",s.octop],
    ["产物",s.artifacts],["新经验",s.experience_new],["已固化",s.experience_approved],["技能下发",s.skill_deliveries]
  ].map(([t,n])=>`<div class="box"><div class="n">${n}</div><div class="t">${t}</div></div>`).join("");
  document.querySelector("#tools tbody").innerHTML=d.tools.map(x=>`<tr><td>${esc(x.tool)}</td><td>${x.n}</td><td>${x.avg_ms||0} ms</td><td>${x.n?Math.round((x.ok_n||0)*100/x.n):0}%</td></tr>`).join("");
  document.querySelector("#users tbody").innerHTML=d.by_user.map(x=>`<tr><td>${esc(x.who)}</td><td>${x.n}</td></tr>`).join("");
}
load();
</script></body></html>"""

@app.get("/report", response_class=HTMLResponse)
async def report_page(request: Request):
    if not check_token(request.cookies.get(COOKIE_NAME, "")):
        return RedirectResponse("/login", status_code=303)
    return REPORT_HTML

@app.get("/experience", response_class=HTMLResponse)
async def experience_page(request: Request):
    if not check_token(request.cookies.get(COOKIE_NAME, "")):
        return RedirectResponse("/login", status_code=303)
    return EXPERIENCE_HTML

@app.get("/skills", response_class=HTMLResponse)
async def skills_page(request: Request):
    if not check_token(request.cookies.get(COOKIE_NAME, "")):
        return RedirectResponse("/login", status_code=303)
    return SKILLS_HTML

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
  d.artifacts.forEach(a=>{ html += '<div style="padding:6px 0;font-size:13px">📄 '+esc(a.name)+' <span class="muted">· '+(a.size||0)+' B · '+esc(a.visibility||'')+'</span> <a style="color:#2f6bff;margin-left:8px" href="/v1/artifacts/'+a.id+'/download">下载</a></div>'; });
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
<a href="/experience" style="color:#fff;opacity:.75;font-size:12.5px;margin-left:16px;text-decoration:none">经验审核</a>
<a href="/skills" style="color:#fff;opacity:.75;font-size:12.5px;margin-left:12px;text-decoration:none">技能库</a>
<a href="/report" style="color:#fff;opacity:.75;font-size:12.5px;margin-left:12px;text-decoration:none">周报</a>
<a href="/terminals" style="color:#fff;opacity:.75;font-size:12.5px;margin-left:12px;text-decoration:none">终端管理</a>
<a href="/logout" style="color:#fff;opacity:.75;font-size:12.5px;margin-left:14px;text-decoration:none">退出</a></div>
<div class="kpis">
<div class="kpi"><div class="lbl">今日任务</div><div class="num" id="k1">-</div></div>
<div class="kpi"><div class="lbl">在线终端</div><div class="num" id="k2">-</div></div>
<div class="kpi"><div class="lbl">累计 Token</div><div class="num" id="k3">-</div></div>
<div class="kpi"><div class="lbl">产物数</div><div class="num" id="k4">-</div></div>
</div>
<div class="kpis" style="margin-top:14px">
<div class="kpi" style="text-align:left"><div class="lbl">Octop 今日任务 / 累计</div><div class="num" id="o1">-</div></div>
<div class="kpi" style="text-align:left"><div class="lbl">技能库 / 已下发次数</div><div class="num" id="o2">-</div></div>
<div class="kpi" style="text-align:left"><div class="lbl">待审经验</div><div class="num" id="o3">-</div></div>
</div>
<div class="grid">
<div class="card" style="width:360px"><h3>Octop 最近任务</h3><table id="octasks"><thead><tr><th>任务</th><th>状态</th><th>时间</th></tr></thead><tbody></tbody></table></div>
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
  if(d.octop){ o1.textContent=(d.octop.today||0)+' / '+(d.octop.total||0); }
  if(d.skills){ o2.textContent=(d.skills.count||0)+' 条 / '+(d.skills.deliveries||0)+' 次'; o3.textContent=(d.skills.pending_experience||0)+' 条'; }
  if(d.octop && d.octop.recent){
    const ot=document.querySelector('#octasks tbody'); ot.innerHTML='';
    d.octop.recent.forEach(t=>{ const tr=document.createElement('tr');
      tr.innerHTML='<td><a href="/tasks/'+t.id+'" style="color:#2f6bff;text-decoration:none">'+esc(t.title).slice(0,18)+'</a></td><td><span class="tag '+(t.status==='done'?'ok':'run')+'">'+esc(t.status)+'</span></td><td>'+(t.created_at?new Date(t.created_at).toLocaleTimeString():'-')+'</td>';
      ot.appendChild(tr); });
  }
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
