'use strict';
const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, shell, nativeImage, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const http = require('http');
const https = require('https');

// 轻量 HTTP 请求（Node fetch 在本机直连会卡住，改用 http 模块）
function httpReq(method, urlStr, body, headers = {}, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(urlStr); } catch (e) { return resolve({ ok: false, status: 0, data: { error: 'bad url' } }); }
    const mod = u.protocol === 'https:' ? https : http;
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = mod.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search, method,
      headers: { ...headers, ...(payload ? { 'Content-Length': payload.length } : {}) },
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = null;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data, headers: res.headers });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (e) => resolve({ ok: false, status: 0, data: { error: e.message } }));
    if (payload) req.write(payload);
    req.end();
  });
}

const CFG_PATH = () => path.join(app.getPath('userData'), 'config.json');
const DEFAULT_CFG = {
  serverUrl: 'http://8.140.227.88:18000',
  apiKey: 'demo-key-0001',
  employeeName: '演示员工',
  projectRoot: path.join(os.homedir(), 'Documents', '砺项目'),
  projects: [],          // [{id,name,dir,createdAt}]
  cmdWhitelist: ['python3', 'node', 'git', 'ls', 'cat', 'echo', 'head', 'wc'],
  allowCommand: true,
  mcpEnabled: true,
  mcpBind: '127.0.0.1',   // 局域网直连可改 0.0.0.0
  autoLaunch: false,
  theme: 'light',
};

function readCfg() {
  try {
    const raw = fs.readFileSync(CFG_PATH(), 'utf8');
    return { ...DEFAULT_CFG, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_CFG }; }
}
function writeCfg(cfg) {
  fs.mkdirSync(path.dirname(CFG_PATH()), { recursive: true });
  fs.writeFileSync(CFG_PATH(), JSON.stringify(cfg, null, 2), 'utf8');
  return cfg;
}

let win = null;
let tray = null;
let state = { online: false, lastBeat: null, pending: 0, running: 0, log: [] };

function log(line) {
  const text = new Date().toISOString() + ' ' + String(line) + '\n';
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'app.log'), text); } catch {}
  const rec = { t: new Date().toISOString(), line: String(line) };
  state.log.unshift(rec);
  if (state.log.length > 500) state.log.pop();
  if (win && !win.isDestroyed()) win.webContents.send('app:log', rec);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1240, height: 820, minWidth: 980, minHeight: 640,
    title: '砺 · 工作台',
    backgroundColor: '#f6f7fb',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { preload: path.join(__dirname, '..', 'main', 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } });
  win.on('closed', () => { win = null; });
}

function createTray() {
  try {
    const p = path.join(__dirname, '..', '..', 'assets', 'tray.png');
    const img = fs.existsSync(p) ? nativeImage.createFromPath(p) : nativeImage.createEmpty();
    tray = new Tray(img);
    tray.setToolTip('砺 · 工作台');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开工作台', click: () => { if (win) { win.show(); win.focus(); } else createWindow(); } },
      { label: '状态：' + (state.online ? '已连接云端' : '离线'), enabled: false },
      { type: 'separator' },
      { label: '设置', click: () => { if (win) { win.show(); win.webContents.send('app:goto', 'settings'); } } },
      { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    tray.on('click', () => { if (win) { win.show(); win.focus(); } else createWindow(); });
  } catch (e) { log('托盘创建失败: ' + e.message); }
}

// ── 云端通信 ──────────────────────────────────────────────
async function api(method, p, body) {
  const cfg = readCfg();
  const headers = { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey };
  if (cfg.token) headers['Authorization'] = 'Bearer ' + cfg.token;
  return httpReq(method, cfg.serverUrl.replace(/\/$/, '') + p, body, headers, 20000);
}

async function heartbeat() {
  // 直连模式：健康检查打 Octop；未登录时离线
  const cfg = readCfg();
  if (!cfg.octopToken) {
    state.online = false;
    state.lastBeat = new Date().toISOString();
    log('未登录 Octop');
    broadcast();
    return;
  }
  const r = await octopFetch('GET', '/api/health');
  state.online = r.ok;
  state.lastBeat = new Date().toISOString();
  log(r.ok ? 'Octop 连接正常' : ('Octop 连接失败: status=' + r.status));
  broadcast();
}

let localSkillsVersion = 0;
async function syncSkills() {
  const r = await api('GET', '/v1/skills?since=0');
  if (!r.ok || !r.data.items) return;
  const dir = path.join(app.getPath('userData'), 'skills');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of r.data.items) {
    const name = String(s.name || 'skill').replace(/[\\/:*?"<>|]/g, '_');
    const d = path.join(dir, name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'SKILL.md'), '# ' + s.name + '\n\n' + (s.content || '') + '\n', 'utf8');
  }
  localSkillsVersion = r.data.items.length;
  broadcast();
}

function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send('app:state', snapshot());
}
function snapshot() {
  const cfg = readCfg();
  return {
    state: { ...state },
    cfg: { ...cfg },
    skills: (() => { try { return fs.readdirSync(path.join(app.getPath('userData'), 'skills')); } catch { return []; } })(),
    platform: process.platform,
    version: app.getVersion(),
    mcp: { enabled: cfg.mcpEnabled !== false, host: cfg.mcpBind || '127.0.0.1', port: MCP_PORT,
           url: 'http://' + (cfg.mcpBind || '127.0.0.1') + ':' + MCP_PORT + '/mcp' },
  };
}

// ── IPC ───────────────────────────────────────────────────
// 幂等注册：重复注册同一通道时先注销旧的，避免 Electron 抛异常导致整个 App 起不来
function handle(channel, fn) {
  try { ipcMain.removeHandler(channel); } catch {}
  ipcMain.handle(channel, fn);
}

// 本地 MCP 反向隧道：客户端自己维护，断了自动重连
let tunnelChild = null;
function startMcpTunnel() {
  const cfg = readCfg();
  if (cfg.mcpTunnel === false) return;
  const sshKey = process.env.DSH_SSH_KEY || path.join(app.getPath("home"), "Library/Application Support/lishi/ssh/id_ed25519");
  const kh = process.env.DSH_SSH_KNOWN || path.join(app.getPath("home"), "Library/Application Support/lishi/ssh/known_hosts");
  const host = cfg.tunnelHost || "Administrator@8.140.227.88";
  const port = String(cfg.tunnelPort || 60022);
  const spawnTunnel = () => {
    const { spawn } = require("child_process");
    const args = ["-N", "-R", "18991:127.0.0.1:18991", "-p", port, "-i", sshKey,
      "-o", "BatchMode=yes", "-o", "UserKnownHostsFile=" + kh, "-o", "StrictHostKeyChecking=accept-new",
      "-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveInterval=30", host];
    tunnelChild = spawn("ssh", args, { stdio: "ignore" });
    tunnelChild.on("exit", () => { tunnelChild = null; setTimeout(spawnTunnel, 8000); });
    log("MCP 隧道已启动（自动重连）");
  };
  try { spawnTunnel(); } catch (e) { log("MCP 隧道启动失败: " + e.message); }
}

handle('app:snapshot', () => snapshot());
handle('app:saveConfig', (_e, patch) => { const c = writeCfg({ ...readCfg(), ...patch }); broadcast(); return c; });

handle('project:pickFolder', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});
handle('project:add', (_e, { name, dir }) => {
  const cfg = readCfg();
  if (!cfg.projects.find((p) => p.dir === dir)) {
    cfg.projects.push({ id: 'p' + Date.now(), name: name || path.basename(dir), dir, createdAt: new Date().toISOString() });
    writeCfg(cfg);
    log('已添加项目: ' + (name || path.basename(dir)) + ' → ' + dir);
  }
  broadcast();
  return cfg.projects;
});
handle('project:remove', (_e, id) => {
  const cfg = readCfg();
  cfg.projects = cfg.projects.filter((p) => p.id !== id);
  writeCfg(cfg); broadcast(); return cfg.projects;
});
handle('project:listFiles', (_e, { dir, rel }) => {
  const base = path.resolve(dir);
  const target = path.resolve(base, rel || '.');
  if (!isInside(cfgRoots(), target)) return { ok: false, error: '目录不在允许范围' };
  try {
    const items = fs.readdirSync(target, { withFileTypes: true }).slice(0, 300).map((d) => {
      const full = path.join(target, d.name);
      let size = 0; try { size = fs.statSync(full).size; } catch {}
      return { name: d.name, dir: d.isDirectory(), size, mtime: (() => { try { return fs.statSync(full).mtime.toISOString(); } catch { return ''; } })() };
    });
    return { ok: true, items, path: target };
  } catch (e) { return { ok: false, error: e.message }; }
});
handle('project:readFile', (_e, { file, max = 200000 }) => {
  const f = path.resolve(file);
  if (!isInside(cfgRoots(), f)) return { ok: false, error: '文件不在允许范围' };
  try { return { ok: true, content: fs.readFileSync(f, 'utf8').slice(0, max) }; } catch (e) { return { ok: false, error: e.message }; }
});
handle('project:writeFile', (_e, { file, content }) => {
  const f = path.resolve(file);
  if (!isInside(cfgRoots(), f)) return { ok: false, error: '文件不在允许范围' };
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content, 'utf8'); log('已写文件: ' + f); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});
handle('project:readBrief', (_e, { dir }) => {
  try {
    const f = path.join(path.resolve(dir), 'PROJECT.md');
    return { ok: true, content: fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '' };
  } catch (e) { return { ok: false, content: '', error: e.message }; }
});
handle('project:saveBrief', (_e, { dir, content }) => {
  const base = path.resolve(dir);
  if (!isInside(cfgRoots(), base)) return { ok: false, error: '目录不在允许范围' };
  try {
    fs.writeFileSync(path.join(base, 'PROJECT.md'), String(content || ''), 'utf8');
    log('已保存项目简报: ' + base);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});
handle('project:openInFinder', (_e, dir) => { shell.openPath(dir); return true; });
handle('project:reveal', (_e, file) => { shell.showItemInFolder(file); return true; });


handle('cloud:heartbeat', async () => { await heartbeat(); return snapshot(); });
handle('cloud:tasks', async () => {
  const r = await api('GET', '/v1/tasks?limit=20');
  return r;
});
handle('cloud:skills', async () => {
  const r = await api('GET', '/v1/skills?since=0');
  return r;
});
handle('cloud:skillStats', async () => {
  const r = await api('GET', '/v1/skills/stats');
  return r;
});
// ── 本地工具执行器（长轮询：等云端 AI 派活，在本地真干）─────
let pollBusy = false;
let pollStopped = false;
// 当前对话轮次的本地工具步骤（用于上报任务/经验沉淀）
let turn = { id: '', startedAt: '', steps: [], title: '' };
function newTurn(title) {
  turn = { id: 'chat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6), startedAt: new Date().toISOString(), steps: [], title: String(title || '').slice(0, 80) };
  return turn;
}

async function pollOnce() {
  const cfg = readCfg();
  let call = null;
  try {
    const r = await httpReq('POST', cfg.serverUrl.replace(/\/$/, '') + '/v1/local/poll?timeout=15', {},
      { 'X-API-Key': cfg.apiKey, 'Content-Type': 'application/json' }, 25000);
    call = r.data && r.data.call;
  } catch (e) { /* 网络抖动忽略 */ }
  if (!call) return;
  const { id, tool, args } = call;
  const t0 = Date.now();
  let ok = true, output = '';
  try {
    if (tool === 'local_list_dir') {
      const dir = path.resolve(String(args.dir || ''));
      if (!isInside(cfgRoots(), dir)) throw new Error('目录不在白名单');
      output = fs.readdirSync(dir).slice(0, 200).map((n) => {
        const full = path.join(dir, n);
        try { const s = fs.statSync(full); return (s.isDirectory() ? '[DIR] ' : '') + n + (s.isDirectory() ? '' : '  ' + s.size + 'B'); }
        catch { return n; }
      }).join('\n');
    } else if (tool === 'local_read_file') {
      const f = path.resolve(String(args.file || ''));
      if (!isInside(cfgRoots(), f)) throw new Error('文件不在白名单');
      output = fs.readFileSync(f, 'utf8').slice(0, 200000);
    } else if (tool === 'local_write_file') {
      const f = path.resolve(String(args.file || ''));
      if (!isInside(cfgRoots(), f)) throw new Error('文件不在白名单');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, String(args.content || ''), 'utf8');
      output = '已写入 ' + f;
    } else if (tool === 'local_run_cmd') {
      if (!cfg.allowCommand) throw new Error('命令执行未开启（客户端设置里打开）');
      const bin = String(args.cmd || '').trim().split(/\s+/)[0];
      if (!(cfg.cmdWhitelist || []).includes(bin)) throw new Error('不在命令白名单: ' + bin);
      const wd = args.cwd && isInside(cfgRoots(), path.resolve(args.cwd)) ? path.resolve(args.cwd) : cfg.projectRoot;
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
      const shellArgs = process.platform === 'win32' ? ['/c', String(args.cmd)] : ['-c', String(args.cmd)];
      output = await new Promise((resolve, reject) => {
        execFile(shell, shellArgs, { cwd: wd, timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
          (err, stdout, stderr) => { if (err) reject(new Error((stderr || err.message).slice(0, 2000))); else resolve((stdout || '').slice(0, 20000)); });
      });
    } else throw new Error('未知工具 ' + tool);
  } catch (e) { ok = false; output = ''; log('本地工具失败: ' + tool + ' · ' + e.message); }
  if (ok) log('本地工具执行: ' + tool);
  if (win && !win.isDestroyed()) {
    win.webContents.send('app:tool', {
      tool, ok, ms: dur,
      dir: args && (args.dir || args.file || args.cmd || ''),
      path: args && (args.file || args.dir || ''),
      argsText: String(args && (args.cmd || args.file || args.dir) || '').slice(0, 160),
      outputPreview: String(output || '').slice(0, 1200),
    });
  }
  const dur = Date.now() - t0;
  try { turn.steps.push({ tool: tool, args_digest: '', duration_ms: dur, ok: ok ? 1 : 0, error_code: ok ? '' : 'tool_error' }); } catch {}
  try {
    await httpReq('POST', cfg.serverUrl.replace(/\/$/, '') + '/v1/local/result',
      { id, ok, output, error: ok ? '' : '执行失败' },
      { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey }, 15000);
  } catch (e) { log('回传结果失败: ' + e.message); }
  broadcast();
}

function startPoller() {
  pollStopped = false;
  const loop = async () => {
    if (pollStopped) return;
    if (!pollBusy) {
      pollBusy = true;
      try { await pollOnce(); } catch (e) { log('poll err: ' + e.message); }
      pollBusy = false;
    }
    setTimeout(loop, 500);
  };
  loop();
}

handle('cloud:mySummary', async () => {
  return await api('GET', '/v1/my/summary');
});

handle('cmd:run', async (_e, { cmd, cwd }) => {
  const cfg = readCfg();
  if (cfg.allowCommand === false) return { ok: false, error: '命令执行已在设置里关闭' };
  const line = String(cmd || '').trim();
  if (!line) return { ok: false, error: '命令为空' };
  const bin = line.split(/\s+/)[0];
  if (!(cfg.cmdWhitelist || []).includes(bin)) return { ok: false, error: '不在命令白名单: ' + bin };
  let wd = cfg.projectRoot || os.homedir();
  if (cwd && isInside(cfgRoots(), path.resolve(cwd))) wd = path.resolve(cwd);
  try {
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const args = process.platform === 'win32' ? ['/c', line] : ['-c', line];
    const out = requireChild(shell, args, wd);
    log('本地执行: ' + line);
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, error: String(e.message || e).slice(0, 800) };
  }
});

handle('mcp:toggle', async (_e, on) => {
  const cfg = readCfg();
  writeCfg({ ...cfg, mcpEnabled: !!on });
  if (on && !mcpServer) startMcpServer();
  if (!on && mcpServer) { try { mcpServer.close(); } catch {} mcpServer = null; }
  broadcast();
  return { ok: true, enabled: !!on };
});

handle('cloud:experts', async () => {
  return await api('GET', '/v1/experts');
});

handle('cloud:me', async () => {
  return await api('GET', '/v1/auth/me');
});

handle('octop:login', async (_e, { username, password, remember }) => {
  const r = await octopLogin(username, password);
  if (r && r.ok) {
    if (remember) saveCreds(username, password);
    else writeCfg({ ...readCfg(), octopCred: "" });
  }
  return r;
});

handle('octop:experts', async () => {
  const r = await octopFetch('GET', '/api/experts');
  const list = (r.ok && Array.isArray(r.data)) ? r.data : [];
  return { ok: r.ok, items: list.map((e) => {
    const lb = e.label || {};
    return { id: e.id, name: lb.zh || lb.en || e.id };
  }) };
});


// ── Octop 经验（记忆候选）与技能 ──────────────────────────
async function octopMemoryCandidates() {
  const aid = await ensureOctopAgent();
  if (!aid) return { ok: false, items: [] };
  const r = await octopFetch("POST", "/api/agents/" + aid + "/memory/candidates/list", {});
  const d = r.data || {};
  const list = Array.isArray(d) ? d : (d.items || d.candidates || []);
  return { ok: r.ok, items: list.slice(0, 50).map((c) => ({
    id: c.id || c.candidate_id,
    title: c.title || c.summary || String(c.assertion || "").slice(0, 80) || "(经验候选)",
    kind: c.candidate_type || c.kind || "",
    status: c.status || "pending",
  })) };
}

async function octopSkills(expertId) {
  let aid = readCfg().octopAgent;
  if (expertId) {
    const known = (readCfg().expertAgents || {})[expertId];
    aid = known || (await resolveExpertAgent(expertId)) || aid;
  }
  if (!aid) aid = await ensureOctopAgent();
  if (!aid) return { ok: false, items: [] };
  const r = await octopFetch("GET", "/api/agents/" + aid + "/skills");
  const d = r.data || [];
  const list = Array.isArray(d) ? d : (d.items || d.skills || []);
  return { ok: r.ok, agentId: aid, items: list.map((s) => ({
    name: s.name || s.slug || s.id,
    slug: s.slug || s.name || s.id,
    desc: s.description || "",
    kind: s.kind || "",
  })) };
}

async function octopCandidateAction(id, action) {
  const aid = await ensureOctopAgent();
  if (!aid) return { ok: false, error: "no agent" };
  const verb = action === "promote" ? ":promote" : ":reject";
  const r = await octopFetch("POST", "/api/agents/" + aid + "/memory/candidates/" + encodeURIComponent(id) + verb, {});
  return { ok: r.ok, error: r.ok ? "" : ((r.data && (r.data.detail || r.data.error)) || "") };
}


// ── 云端能力聚合（子代理/供应商/渠道/浏览器/终端/备份）────
async function octopCapabilities(search) {
  const aid = await ensureOctopAgent();
  const out = { ok: true, agentId: aid };
  const safe = async (fn) => { try { return await fn(); } catch (e) { return { ok: false, error: e.message }; } };
  out.subagents = await safe(async () => {
    const r = await octopFetch("GET", "/api/subagent-catalog");
    const d = r.data || {};
    const list = Array.isArray(d) ? d : (d.items || d.subagents || []);
    return { ok: r.ok, count: list.length, sample: list.slice(0, 30).map((s) => ({
      slug: s.slug || s.id, name: (s.label && (s.label.zh || s.label.en)) || s.name || s.slug, div: s.division || s.category || "" })) };
  });
  out.divisions = await safe(async () => {
    const r = await octopFetch("GET", "/api/subagent-catalog/divisions");
    return { ok: r.ok, items: r.data };
  });
  out.providers = await safe(async () => {
    const r = await octopFetch("GET", "/api/providers");
    const d = r.data || {};
    const list = Array.isArray(d) ? d : (d.items || d.providers || []);
    return { ok: r.ok, items: list.map((p) => ({ id: p.id || p.provider_id, name: p.name || p.label || p.kind, active: p.is_active || p.active || false })) };
  });
  out.channels = await safe(async () => {
    const r = await octopFetch("GET", "/api/agents/" + aid + "/channels");
    const d = r.data || [];
    const list = Array.isArray(d) ? d : (d.items || []);
    return { ok: r.ok, items: list.map((c) => ({ id: c.id, kind: c.kind || c.channel_type, name: c.name || c.title, enabled: c.enabled })) };
  });
  out.browser = await safe(async () => {
    const r = await octopFetch("GET", "/api/browser/env-status");
    return { ok: r.ok, data: r.data };
  });
  out.terminal = await safe(async () => {
    const r = await octopFetch("GET", "/api/agents/" + aid + "/terminal/context");
    return { ok: r.ok, data: r.data };
  });
  out.models = await safe(async () => await octopModels());
  out.usage = await safe(async () => {
    const r = await octopFetch("GET", "/api/usage/summary");
    const d = r.data || {};
    return { ok: r.ok, data: { window: d.window, total: d.total_tokens, input: d.input_tokens, output: d.output_tokens, calls: d.model_calls, turns: d.turns, cache_hit: d.cache_hit_percent } };
  });
  out.pluginMarket = await safe(async () => {
    const r = await octopFetch("GET", "/api/plugins/market");
    const d = r.data || [];
    const list = Array.isArray(d) ? d : (d.items || []);
    return { ok: r.ok, count: list.length,
             items: list.slice(0, 24).map((p) => ({ id: p.id, name: p.name || p.id, kind: p.kind || "", group: p.group || "", desc: String(p.description || "").slice(0, 60) })) };
  });
  out.connectorCatalog = await safe(async () => {
    const r = await octopFetch("GET", "/api/connectors/catalog");
    const d = r.data || [];
    const list = Array.isArray(d) ? d : (d.items || []);
    return { ok: r.ok, count: list.length,
             items: list.slice(0, 24).map((c) => ({ kind: c.kind, name: c.name || c.kind, auth: c.auth_kind || "" })) };
  });
  out.agentTools = await safe(async () => {
    const r = await octopFetch("GET", "/api/plugins/agents/" + aid + "/tools");
    const d = r.data || {};
    const list = Array.isArray(d) ? d : (d.tools || []);
    return { ok: r.ok, count: list.length, items: list.slice(0, 20).map((t) => ({ name: t.name || t.id, desc: String(t.description || "").slice(0, 60) })) };
  });
  out.users = await safe(async () => {
    const r = await octopFetch("GET", "/api/users");
    const d = r.data || [];
    const list = Array.isArray(d) ? d : (d.items || []);
    return { ok: r.ok, count: list.length, items: list.slice(0, 20).map((u) => ({ username: u.username, role: u.role, name: u.display_name || "" })) };
  });
  out.backupState = await safe(async () => {
    const [st, ls] = await Promise.all([
      octopFetch("GET", "/api/admin/backup/status"),
      octopFetch("GET", "/api/admin/backup/list"),
    ]);
    const items = ((ls.data && ls.data.items) || []);
    return { ok: st.ok, busy: !!(st.data && st.data.busy), count: items.length,
             latest: items.length ? (items[items.length - 1].filename || items[items.length - 1].name || "") : "" };
  });
  out.plugins = await safe(async () => {
    const r = await octopFetch("GET", "/api/plugins");
    const d = r.data || [];
    const list = Array.isArray(d) ? d : (d.items || []);
    return { ok: r.ok, count: list.length, items: list.slice(0, 20).map((p) => ({ id: p.id || p.name, name: p.name || p.id, enabled: p.enabled })) };
  });
  out.agentSubagents = await safe(async () => {
    const r = await octopFetch("GET", "/api/agents/" + aid + "/subagents");
    const d = r.data || [];
    const list = Array.isArray(d) ? d : (d.items || []);
    return { ok: r.ok, items: list.map((s) => ({ slug: s.slug, name: s.name, desc: String(s.description || "").slice(0, 70) })) };
  });
  out.channelKinds = await safe(async () => {
    const r = await octopFetch("GET", "/api/channels/plugin-kinds");
    const d = r.data || [];
    return { ok: r.ok, items: (Array.isArray(d) ? d : []).map((k) => ({ kind: k.kind || k.id, name: k.name || k.label || k.kind })) };
  });
  out.browserSessions = await safe(async () => {
    const r = await octopFetch("GET", "/api/browser/harness-sessions");
    return { ok: r.ok, environment: (r.data && r.data.environment) || "", count: ((r.data && r.data.sessions) || []).length };
  });
  out.knowledge = await safe(async () => {
    const [list, cap] = await Promise.all([
      octopFetch("GET", "/api/knowledge-bases"),
      octopFetch("GET", "/api/knowledge-bases/capability"),
    ]);
    const d = list.data || [];
    const items = Array.isArray(d) ? d : (d.items || []);
    return { ok: list.ok, count: items.length,
             items: items.map((k) => ({ id: k.id, name: k.name || k.title, docs: k.document_count || 0 })),
             usable: (cap.data && cap.data.usable) || false };
  });
  out.skillhub = await safe(async () => {
    const r = await octopFetch("GET", "/api/skill-packages/hub/search?q=" + encodeURIComponent(search || "SOP") + "&limit=8");
    const d = r.data || [];
    const list = Array.isArray(d) ? d : (d.items || []);
    return { ok: r.ok, items: list.map((s) => ({ name: s.name || s.slug, category: s.category || "", desc: String(s.description || "").slice(0, 80) })) };
  });
  out.backup = await safe(async () => {
    const r = await octopFetch("GET", "/api/admin/backup/status");
    return { ok: r.ok, data: r.data };
  });
  return out;
}

handle('octop:capabilities', async (_e, p) => await octopCapabilities(p && p.search));


// ── 渠道 / 用户 / 供应商 写操作 ─────────────────────────

// ── 模型/供应商 ─────────────────────────────────────
async function octopModels() {
  const [act, res] = await Promise.all([
    octopFetch("GET", "/api/providers/active-model"),
    octopFetch("GET", "/api/providers/resolved"),
  ]);
  const list = Array.isArray(res.data) ? res.data : [];
  return {
    ok: act.ok && res.ok,
    active: act.data || {},
    items: list.map((m) => ({ provider: m.provider_name, model: m.model, name: m.name || m.model, ctx: m.context_window || 0 })),
  };
}


// ── 用量统计 / 上下文用量 / 语音 ───────────────────

// ── 语音朗读（TTS + 本地播放）────────────────────

// ── 语音输入（录音 + STT）──────────────────────────
handle("local:record", async (_e, p) => {
  const secs = Math.min(Math.max(Number((p && p.seconds) || 5), 1), 60);
  const dir = path.join(app.getPath("userData"), "voice");
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  const file = path.join(dir, "rec-" + Date.now() + ".wav");
  const ff = process.platform === "win32" ? "ffmpeg" : "/opt/homebrew/bin/ffmpeg";
  const args = process.platform === "win32"
    ? ["-y", "-f", "dshow", "-i", "audio=default", "-t", String(secs), file]
    : ["-y", "-f", "avfoundation", "-i", ":0", "-t", String(secs), file];
  const ok = await new Promise((resolve) => {
    const { spawn } = require("child_process");
    const c = spawn(ff, args, { stdio: "ignore" });
    c.on("exit", (code) => resolve(code === 0 && fs.existsSync(file)));
    c.on("error", () => resolve(false));
    setTimeout(() => { try { c.kill(); } catch {} }, (secs + 15) * 1000);
  });
  if (!ok) return { ok: false, error: "录音失败（检查麦克风权限 / ffmpeg）" };
  log("录音完成: " + file);
  return { ok: true, file };
});

handle("octop:stt", async (_e, p) => {
  const f = String((p && p.file) || "");
  if (!f || !fs.existsSync(f)) return { ok: false, error: "音频文件不存在" };
  const data = fs.readFileSync(f);
  const boundary = "----lishi" + Date.now();
  const head = Buffer.from("--" + boundary + "\r\n" +
    "Content-Disposition: form-data; name=\"audio\"; filename=\"" + path.basename(f) + "\"\r\n" +
    "Content-Type: audio/wav\r\n\r\n");
  const lang = Buffer.from("\r\n--" + boundary + "\r\n" +
    "Content-Disposition: form-data; name=\"language\"\r\n\r\nzh-CN\r\n--" + boundary + "--\r\n");
  const body = Buffer.concat([head, data, lang]);
  const base = octopBase();
  const url = new URL(base + "/api/voice/stt");
  const resp = await new Promise((resolve) => {
    const req = (url.protocol === "https:" ? require("https") : require("http")).request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=" + boundary, "Content-Length": body.length, Authorization: "Bearer " + readCfg().octopToken },
    }, (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode, text: b })); });
    req.on("error", (e) => resolve({ status: 0, text: e.message }));
    req.write(body); req.end();
  });
  let parsed = {};
  try { parsed = JSON.parse(resp.text); } catch {}
  if (resp.status === 200 && parsed.text !== undefined) { log("STT: " + String(parsed.text).slice(0, 40)); return { ok: true, text: parsed.text }; }
  return { ok: false, error: (parsed.error && (parsed.error.message || parsed.error.code)) || ("STT 失败 " + resp.status) };
});

handle("octop:tts", async (_e, p) => {
  const text = String((p && p.text) || "").slice(0, 2000);
  if (!text) return { ok: false, error: "文本为空" };
  const provider = (p && p.provider) || "edge";
  const base = octopBase();
  const resp = await new Promise((resolve) => {
    const url = new URL(base + "/api/voice/tts");
    const payload = JSON.stringify({ text, provider });
    const req = (url.protocol === "https:" ? require("https") : require("http")).request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), Authorization: "Bearer " + readCfg().octopToken },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, buf: Buffer.concat(chunks) }));
    });
    req.on("error", () => resolve({ status: 0, buf: Buffer.alloc(0) }));
    req.write(payload); req.end();
  });
  if (resp.status !== 200 || !resp.buf.length) return { ok: false, error: "TTS 失败（status " + resp.status + "）" };
  const dir = path.join(app.getPath("userData"), "voice");
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  const file = path.join(dir, "tts-" + Date.now() + ".mp3");
  fs.writeFileSync(file, resp.buf);
  log("TTS 生成: " + file + " (" + resp.buf.length + "B)");
  return { ok: true, file, bytes: resp.buf.length };
});

handle("local:playAudio", async (_e, p) => {
  const f = String((p && p.file) || "");
  if (!f || !fs.existsSync(f)) return { ok: false, error: "文件不存在" };
  const { spawn } = require("child_process");
  const cmd = process.platform === "win32" ? "powershell" : "afplay";
  const args = process.platform === "win32" ? ["-NoProfile", "-Command", "Start-Process -FilePath \"" + f + "\""] : [f];
  try { spawn(cmd, args, { detached: true, stdio: "ignore" }).unref(); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});

handle("octop:usage", async () => {
  const r = await octopFetch("GET", "/api/usage/summary");
  const d = r.data || {};
  return { ok: r.ok, data: {
    window: d.window, total: d.total_tokens, input: d.input_tokens, output: d.output_tokens,
    calls: d.model_calls, turns: d.turns, cache_hit: d.cache_hit_percent,
  } };
});

handle("octop:contextUsage", async (_e, p) => {
  const aid = await ensureOctopAgent();
  const tid = await octopThread(aid, p && p.sessionId ? p.sessionId : "usage");
  const r = await octopFetch("GET", "/api/agents/" + aid + "/threads/" + tid + "/context-usage");
  return { ok: r.ok, data: r.data };
});

handle("octop:models", async () => await octopModels());

handle("octop:setActiveModel", async (_e, p) => {
  const r = await octopFetch("PUT", "/api/providers/active-model", { provider_name: p.provider, model: p.model });
  if (r.ok) log("已切换当前模型: " + p.provider + "/" + p.model);
  return { ok: r.ok, data: r.data };
});

handle("octop:channelCreate", async (_e, p) => {
  const aid = await ensureOctopAgent();
  const body = { kind: p.kind, name: p.name || p.kind, enabled: true };
  if (p.credentials && typeof p.credentials === "object") body.credentials = p.credentials;
  const r = await octopFetch("POST", "/api/agents/" + aid + "/channels", body);
  if (r.ok) log("已创建渠道: " + p.kind);
  return { ok: r.ok, data: r.data, error: r.ok ? "" : JSON.stringify(r.data).slice(0, 200) };
});

handle("octop:channelDelete", async (_e, p) => {
  const aid = await ensureOctopAgent();
  const r = await octopFetch("DELETE", "/api/agents/" + aid + "/channels/" + encodeURIComponent(p.id), null);
  return { ok: r.ok, data: r.data };
});

handle("octop:channelTest", async (_e, p) => {
  const aid = await ensureOctopAgent();
  const r = await octopFetch("POST", "/api/agents/" + aid + "/channels/" + encodeURIComponent(p.id) + "/test", {});
  return { ok: r.ok, data: r.data, error: r.ok ? "" : JSON.stringify(r.data).slice(0, 200) };
});

handle("octop:userCreate", async (_e, p) => {
  const r = await octopFetch("POST", "/api/users", {
    username: p.username, password: p.password, role: p.role || "user", display_name: p.display_name || p.username,
  });
  return { ok: r.ok, data: r.data, error: r.ok ? "" : JSON.stringify(r.data).slice(0, 200) };
});

handle("octop:userToggle", async (_e, p) => {
  const r = await octopFetch("PATCH", "/api/users/" + encodeURIComponent(p.id), { disabled: !p.enabled });
  return { ok: r.ok, data: r.data };
});

handle('octop:browserInstall', async () => {
  log('开始安装浏览器运行时…');
  const r = await octopFetch("POST", "/api/browser/install", {});
  return { ok: r.ok, data: r.data };
});


// ── 知识库（产品化页面）──────────────────────────
handle("octop:kbList", async () => {
  const r = await octopFetch("GET", "/api/knowledge-bases");
  const d = r.data || [];
  const list = Array.isArray(d) ? d : (d.items || []);
  return { ok: r.ok, items: list.map((k) => ({ id: k.id, name: k.name || k.title, docs: k.doc_count || 0 })) };
});

handle("octop:kbDocs", async (_e, p) => {
  const r = await octopFetch("GET", "/api/knowledge-bases/" + encodeURIComponent(p.kbId) + "/documents");
  const d = r.data || [];
  const list = Array.isArray(d) ? d : (d.items || []);
  return { ok: r.ok, items: list.map((x) => ({ id: x.id, name: x.filename || x.path, status: x.status || "", size: x.byte_size || 0, chunks: x.chunk_count || 0 })) };
});

handle('octop:kbUpload', async (_e, { kbId, name, content, format }) => {
  const r = await octopFetch("POST", "/api/knowledge-bases/" + encodeURIComponent(kbId) + "/documents/text",
    { name: name || "未命名.txt", content: String(content || ""), format: format || "txt" });
  return { ok: r.ok, data: r.data };
});

handle('octop:kbCreate', async (_e, { name, description }) => {
  const r = await octopFetch("POST", "/api/knowledge-bases", { name, description: description || "" });
  return { ok: r.ok, data: r.data, error: r.ok ? "" : ((r.data && (r.data.error || r.data.detail)) || "") };
});

handle('octop:memory', async () => await octopMemoryCandidates());
handle('octop:skills', async (_e, p) => await octopSkills(p && p.expertId));
handle('octop:candidateAction', async (_e, p) => await octopCandidateAction(p && p.id, p && p.action));

handle('octop:chat', async (_e, payload) => {
  const r = await octopChat(payload);
  if (!r.ok) log('对话失败: ' + (r.error || '未知'));
  return r;
});

handle('auth:login', async (_e, { username, password }) => {
  const cfg = readCfg();
  const base = cfg.serverUrl.replace(/\/$/, '');
  const r = await httpReq('POST', base + '/v1/auth/login', { username, password }, { 'Content-Type': 'application/json' }, 20000);
  if (!r.ok) return { ok: false, error: (r.data && (r.data.detail || r.data.error)) || '登录失败' };
  const token = r.data.token;
  writeCfg({ ...cfg, token, employeeName: (r.data.user && r.data.user.display_name) || username });
  // 绑定本机为终端
  const b = await httpReq('POST', base + '/v1/auth/bind-device', { hostname: os.hostname() },
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, 20000);
  if (b.ok && b.data && b.data.api_key) {
    writeCfg({ ...readCfg(), apiKey: b.data.api_key });
    log('设备已绑定: ' + os.hostname());
  }
  log('登录成功: ' + username);
  await heartbeat();
  return { ok: true, user: r.data.user, permissions: r.data.permissions };
});

handle('octop:logout', async () => {
  const cfg = readCfg();
  writeCfg({ ...cfg, octopToken: '', octopAgent: '', devAutoLogin: false });
  log('已退出 Octop 登录');
  broadcast();
  return { ok: true };
});

handle('auth:logout', async () => {
  const cfg = readCfg();
  writeCfg({ ...cfg, token: '' });
  broadcast();
  return { ok: true };
});

handle('cloud:expAction', async (_e, { id, action }) => {
  const r = await api('POST', '/v1/experience/' + encodeURIComponent(id) + '/' + (action === 'approve' ? 'approve' : 'reject'), {});
  if (r.ok) log('经验' + (action === 'approve' ? '通过' : '驳回') + ': ' + id.slice(0, 8));
  return r;
});


// ── 客户端内置 MCP 服务（供 Octop 直连，替代自研后台桥）──────
const MCP_PORT = Number(process.env.DSH_MCP_PORT || 18991);
let mcpServer = null;

function mcpTools() {
  return [
    { name: "local_list_dir", description: "列出本地项目目录下的文件（仅限已登记目录）",
      inputSchema: { type: "object", properties: { dir: { type: "string" } }, required: ["dir"] } },
    { name: "local_read_file", description: "读取本地文件（仅限已登记目录，最大 200KB）",
      inputSchema: { type: "object", properties: { file: { type: "string" } }, required: ["file"] } },
    { name: "local_write_file", description: "写入本地文件（仅限已登记目录）",
      inputSchema: { type: "object", properties: { file: { type: "string" }, content: { type: "string" } }, required: ["file", "content"] } },
    { name: "local_find_files", description: "按文件名关键字在已登记目录里搜索文件",
      inputSchema: { type: "object", properties: { dir: { type: "string" }, keyword: { type: "string" }, limit: { type: "number" } }, required: ["dir", "keyword"] } },
    { name: "local_open_path", description: "在访达/资源管理器中打开文件或文件夹",
      inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
    { name: "local_clipboard_read", description: "读取系统剪贴板文本",
      inputSchema: { type: "object", properties: {} } },
    { name: "local_clipboard_write", description: "写入系统剪贴板文本",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } },
    { name: "local_grep_files", description: "在目录内按内容关键字搜索文本文件",
      inputSchema: { type: "object", properties: { dir: { type: "string" }, keyword: { type: "string" } }, required: ["dir", "keyword"] } },
    { name: "local_run_cmd", description: "在本地执行命令（需开启命令白名单）",
      inputSchema: { type: "object", properties: { cmd: { type: "string" }, cwd: { type: "string" } }, required: ["cmd"] } },
  ];
}

function mcpExec(tool, args) {
  const cfg = readCfg();
  if (tool === "local_list_dir") {
    const dir = path.resolve(String(args.dir || ""));
    if (!isInside(cfgRoots(), dir)) throw new Error("目录不在白名单");
    return fs.readdirSync(dir).slice(0, 200).map((n) => {
      const full = path.join(dir, n);
      try { const s = fs.statSync(full); return (s.isDirectory() ? "[DIR] " : "") + n + (s.isDirectory() ? "" : "  " + s.size + "B"); }
      catch { return n; }
    }).join("\n");
  }
  if (tool === "local_read_file") {
    const f = path.resolve(String(args.file || ""));
    if (!isInside(cfgRoots(), f)) throw new Error("文件不在白名单");
    return fs.readFileSync(f, "utf8").slice(0, 200000);
  }
  if (tool === "local_write_file") {
    const f = path.resolve(String(args.file || ""));
    if (!isInside(cfgRoots(), f)) throw new Error("文件不在白名单");
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, String(args.content || ""), "utf8");
    log("MCP 写入: " + f);
    return "已写入 " + f;
  }
  if (tool === "local_find_files") {
    const root = path.resolve(String(args.dir || ""));
    if (!isInside(cfgRoots(), root)) throw new Error("目录不在白名单");
    const kw = String(args.keyword || "").toLowerCase();
    const limit = Math.min(Number(args.limit) || 50, 200);
    const hits = [];
    const walk = (d, depth) => {
      if (hits.length >= limit || depth > 4) return;
      let names = [];
      try { names = fs.readdirSync(d); } catch { return; }
      for (const n of names) {
        if (n.startsWith(".") || n === "node_modules") continue;
        const full = path.join(d, n);
        let st = null;
        try { st = fs.statSync(full); } catch {}
        if (!st) continue;
        if (st.isDirectory()) walk(full, depth + 1);
        else if (n.toLowerCase().includes(kw)) hits.push(full + "  (" + st.size + "B)");
        if (hits.length >= limit) return;
      }
    };
    walk(root, 0);
    return hits.length ? hits.join("\n") : "没有匹配的文件";
  }
  if (tool === "local_open_path") {
    const p2 = path.resolve(String(args.path || ""));
    if (!isInside(cfgRoots(), p2)) throw new Error("路径不在白名单");
    shell.openPath(p2);
    return "已打开: " + p2;
  }
  if (tool === "local_clipboard_read") {
    const { execFileSync } = require("child_process");
    const cmd = process.platform === "win32" ? ["powershell", ["-NoProfile", "-Command", "Get-Clipboard"]] : ["pbpaste", []];
    return String(execFileSync(cmd[0], cmd[1], { timeout: 5000 })).slice(0, 20000);
  }
  if (tool === "local_clipboard_write") {
    const { execFileSync, spawn } = require("child_process");
    const text = String(args.text || "");
    if (process.platform === "win32") {
      const p = spawn("powershell", ["-NoProfile", "-Command", "Set-Clipboard -Value $input"], { stdio: ["pipe", "ignore", "ignore"] });
      p.stdin.end(text);
    } else {
      const p = spawn("pbcopy", [], { stdio: ["pipe", "ignore", "ignore"] });
      p.stdin.end(text);
    }
    return "已写入剪贴板（" + text.length + " 字符）";
  }
  if (tool === "local_grep_files") {
    const root = path.resolve(String(args.dir || ""));
    if (!isInside(cfgRoots(), root)) throw new Error("目录不在白名单");
    const kw = String(args.keyword || "").toLowerCase();
    const out = [];
    const walk = (d, depth) => {
      if (out.length > 60 || depth > 3) return;
      let names = [];
      try { names = fs.readdirSync(d); } catch { return; }
      for (const n of names) {
        if (n.startsWith(".") || n === "node_modules") continue;
        const full = path.join(d, n);
        let st = null; try { st = fs.statSync(full); } catch {}
        if (!st) continue;
        if (st.isDirectory()) { walk(full, depth + 1); continue; }
        if (st.size > 2 * 1024 * 1024) continue;
        let txt = ""; try { txt = fs.readFileSync(full, "utf8"); } catch { continue; }
        if (txt.toLowerCase().includes(kw)) {
          const line = txt.split("\n").find((l) => l.toLowerCase().includes(kw)) || "";
          out.push(full + " :: " + line.trim().slice(0, 120));
        }
      }
    };
    walk(root, 0);
    return out.length ? out.join("\n") : "没有内容匹配";
  }
  if (tool === "local_run_cmd") {
    if (!cfg.allowCommand) throw new Error("命令执行未开启");
    const bin = String(args.cmd || "").trim().split(/\s+/)[0];
    if (!(cfg.cmdWhitelist || []).includes(bin)) throw new Error("不在命令白名单: " + bin);
    const wd = args.cwd && isInside(cfgRoots(), path.resolve(args.cwd)) ? path.resolve(args.cwd) : cfg.projectRoot;
    const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
    const shArgs = process.platform === "win32" ? ["/c", String(args.cmd)] : ["-c", String(args.cmd)];
    const out = requireChild(shell, shArgs, wd);
    log("MCP 执行命令: " + args.cmd);
    return out;
  }
  throw new Error("未知工具 " + tool);
}

function requireChild(shell, args, cwd) {
  const { execFileSync } = require("child_process");
  return String(execFileSync(shell, args, { cwd, timeout: 60000, maxBuffer: 4 * 1024 * 1024 })).slice(0, 20000);
}

function startMcpServer() {
  const cfg = readCfg();
  if (cfg.mcpEnabled === false) return;
  const host = cfg.mcpBind || "127.0.0.1";
  const mcpSessions = new Set();
  mcpServer = http.createServer((req, res) => {
    // MCP streamable-HTTP：GET 用于服务端推送通道，DELETE 关闭会话
    if (req.method === "GET") {
      const sid = req.headers["mcp-session-id"] || "";
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive",
        ...(sid ? { "Mcp-Session-Id": sid } : {}) });
      res.write(": connected\n\n");
      const hb = setInterval(() => { try { res.write(": ping\n\n"); } catch {} }, 25000);
      req.on("close", () => clearInterval(hb));
      return;
    }
    if (req.method === "DELETE") {
      const sid = req.headers["mcp-session-id"];
      if (sid) mcpSessions.delete(sid);
      res.writeHead(200); return res.end();
    }
    if (req.method !== "POST") { res.writeHead(405); return res.end(); }
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      let msg = {};
      try { msg = JSON.parse(body || "{}"); } catch {}
      const method = msg.method || "";
      const id = msg.id;
      const send = (obj) => {
        const payload = JSON.stringify(obj);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(payload);
      };
      const ok = (result) => send({ jsonrpc: "2.0", id, result });
      if (method === "initialize") {
        const sid = require("crypto").randomBytes(16).toString("hex");
        mcpSessions.add(sid);
        res.setHeader("Mcp-Session-Id", sid);
        return ok({ protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "lishi-workbench-local", version: app.getVersion() } });
      }
      if (method === "notifications/initialized") { res.writeHead(202); return res.end(); }
      if (method === "ping") return ok({});
      if (method === "tools/list") return ok({ tools: mcpTools() });
      if (method === "tools/call") {
        const p = msg.params || {};
        try {
          const t0 = Date.now();
          const out = mcpExec(p.name, p.arguments || {});
          if (win && !win.isDestroyed()) {
            win.webContents.send("app:tool", {
              tool: p.name, ok: true, ms: Date.now() - t0,
              argsText: String((p.arguments && (p.arguments.dir || p.arguments.file || p.arguments.cmd)) || "").slice(0, 120),
              path: (p.arguments && (p.arguments.file || p.arguments.dir)) || "",
              outputPreview: String(out || "").slice(0, 600),
            });
          }
          return ok({ content: [{ type: "text", text: String(out).slice(0, 20000) }], isError: false });
        } catch (e) {
          if (win && !win.isDestroyed()) {
            win.webContents.send("app:tool", { tool: p.name, ok: false, ms: 0, argsText: "", path: "", outputPreview: String(e.message || "") });
          }
          return ok({ content: [{ type: "text", text: "错误: " + e.message }], isError: true });
        }
      }
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: "method not found" } });
    });
  });
  mcpServer.on("error", (e) => log("MCP 服务启动失败: " + e.message));
  mcpServer.listen(MCP_PORT, host, () => log("MCP 服务已启动: http://" + host + ":" + MCP_PORT + "/mcp"));
}


// ── Octop 直连客户端（登录 / 专家 / 对话 WS）────────────────
const WebSocket = require("ws");

function octopBase() {
  const c = readCfg();
  return String(c.octopUrl || "http://127.0.0.1:18090").replace(/\/$/, "");
}

async function octopFetch(method, p, body, token) {
  const base = octopBase();
  const headers = { "Content-Type": "application/json" };
  const tk = token || readCfg().octopToken;
  if (tk) headers["Authorization"] = "Bearer " + tk;
  const r = await httpReq(method, base + p, body, headers, 25000);
  // 滑动续期：Octop 会在响应头里给新 token
  try {
    const fresh = r && r.headers && (r.headers["x-octop-access-token"] || r.headers["X-Octop-Access-Token"]);
    if (fresh) writeCfg({ ...readCfg(), octopToken: fresh });
  } catch {}
  if (r && (r.status === 401 || r.status === 403) && !token) {
    state.needLogin = true;
    log("登录状态已失效（" + r.status + "），需要重新登录");
    if (win && !win.isDestroyed()) win.webContents.send("app:needLogin", {});
  }
  return r;
}


// ── 凭据记忆（safeStorage 加密，仅本机）──────────────
function saveCreds(username, password) {
  try {
    const raw = JSON.stringify({ username, password });
    const enc = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(raw).toString("base64")
      : Buffer.from(raw, "utf8").toString("base64");
    writeCfg({ ...readCfg(), octopCred: enc });
    log("已记住登录凭据（本机加密）");
  } catch (e) { log("保存凭据失败: " + e.message); }
}

function loadCreds() {
  try {
    const enc = readCfg().octopCred;
    if (!enc) return null;
    const raw = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(enc, "base64"))
      : Buffer.from(enc, "base64").toString("utf8");
    const o = JSON.parse(raw);
    return o && o.username && o.password ? o : null;
  } catch (e) { return null; }
}

async function ensureSession() {
  const cfg = readCfg();
  if (!cfg.octopToken) { state.needLogin = true; return false; }
  const r = await octopFetch("GET", "/api/agents");
  if (r.ok) { state.needLogin = false; return true; }
  if (r.status === 401 || r.status === 403) {
    const cred = loadCreds();
    if (cred) {
      log("登录已过期，用记住的凭据自动续登…");
      const res = await octopLogin(cred.username, cred.password);
      if (res && res.ok) { log("自动续登成功"); state.needLogin = false; return true; }
    }
    state.needLogin = true;
    log("登录状态失效，需要重新登录");
    if (win && !win.isDestroyed()) win.webContents.send("app:needLogin", {});
    return false;
  }
  return false;
}

async function octopLogin(username, password) {
  const base = octopBase();
  const r = await httpReq("POST", base + "/api/auth/login", { username, password }, { "Content-Type": "application/json" }, 20000);
  if (!r.ok || !r.data || !r.data.access_token) {
    return { ok: false, error: (r.data && (r.data.error || r.data.detail)) || "登录失败" };
  }
  const token = r.data.access_token;
  const me = r.data.user || {};
  // 选默认助理（已绑定 MCP 的优先，其次第一个）
  let agentId = "";
  const ags = await octopFetch("GET", "/api/agents", null, token);
  const list = (ags.ok && Array.isArray(ags.data)) ? ags.data : [];
  const withMcp = list.find((a) => Array.isArray(a.mcp_servers) && a.mcp_servers.length);
  agentId = (withMcp && withMcp.agent_id) || (list[0] && list[0].agent_id) || "";
  writeCfg({ ...readCfg(), octopToken: token, octopAgent: agentId, employeeName: me.display_name || me.username || username });
  state.needLogin = false;
  log("Octop 登录成功: " + (me.username || username) + " · 助理 " + agentId);
  broadcast();
  return { ok: true, token, user: me, agentId, agents: list.map((a) => ({ id: a.agent_id, name: a.name })) };
}

const octopThreads = {};
async function octopThread(agentId, sessionId) {
  const key = agentId + ":" + sessionId;
  if (octopThreads[key]) return octopThreads[key];
  const r = await octopFetch("POST", "/api/agents/" + agentId + "/threads", {});
  const tid = (r.ok && r.data && r.data.thread_id) || "";
  if (tid) octopThreads[key] = tid;
  return tid;
}

async function ensureOctopAgent() {
  const cfg = readCfg();
  if (cfg.octopAgent) return cfg.octopAgent;
  const r = await octopFetch("GET", "/api/agents");
  const list = (r.ok && Array.isArray(r.data)) ? r.data : [];
  const withMcp = list.find((a) => Array.isArray(a.mcp_servers) && a.mcp_servers.length);
  const aid = (withMcp && withMcp.agent_id) || (list[0] && list[0].agent_id) || "";
  if (aid) { writeCfg({ ...readCfg(), octopAgent: aid }); log("已自动选择助理: " + aid); }
  return aid;
}


// 专家 -> 助理 解析（按需创建 / 补默认模型），保证任何专家都能回话
async function octopAgents() {
  const r = await octopFetch("GET", "/api/agents");
  return (r.ok && Array.isArray(r.data)) ? r.data : [];
}

function activeModelOf(agents) {
  const withModel = agents.find((a) => a && a.default_model);
  return (withModel && withModel.default_model) || "mimo-v2.6-flash";
}

async function ensureAgentModel(agentId, model) {
  const r = await octopFetch("PATCH", "/api/agents/" + agentId, { default_model: model });
  if (r.ok) log("已为助理 " + agentId + " 补默认模型: " + model);
  return r.ok;
}


async function octopExperts() {
  const r = await octopFetch("GET", "/api/experts");
  return (r.ok && Array.isArray(r.data)) ? r.data : [];
}

function expertName(e) {
  const lb = (e && e.label) || {};
  if (typeof lb === "string") return lb;
  return lb.zh || lb.en || (e && e.id) || "";
}

function expertDesc(e) {
  const d = e && e.description;
  if (!d) return "";
  if (typeof d === "string") return d;
  return d.zh || d.en || "";
}

async function ensureAgentProfile(agent, expert) {
  if (!agent || !expert) return;
  const body = {};
  const name = expertName(expert);
  if (name && agent.name !== name) body.name = name;
  if (!agent.default_model) body.default_model = activeModelOf(await octopAgents());
  const desc = expertDesc(expert);
  if (!(agent.system_prompt || "").trim() && desc.trim()) {
    body.system_prompt =
      "你是「" + name + "」。" + desc + "\n" +
      "回答要求：先给结论，再给步骤；简洁专业；使用中文；不确定时说明依据。";
    body.description = desc;
  }
  if (!Object.keys(body).length) return;
  const r = await octopFetch("PATCH", "/api/agents/" + agent.agent_id, body);
  if (r.ok) log("已配置专家助理: " + agent.agent_id + " (" + name + ")");
}

async function resolveExpertAgent(expertId) {
  const cfg = readCfg();
  const cache = cfg.expertAgents || {};
  if (cache[expertId]) return cache[expertId];
  let agents = await octopAgents();
  const experts = await octopExperts();
  const expert = experts.find((e) => e.id === expertId);
  const ename = expertName(expert);
  let hit = agents.find((a) => a.expert_id === expertId) ||
            (ename ? agents.find((a) => a.name === ename) : null);
  if (!hit) {
    const r = await octopFetch("POST", "/api/agents/from-expert/" + encodeURIComponent(expertId), {});
    if (!r.ok) { log("创建专家助理失败: " + expertId); return ""; }
    hit = r.data;
    log("已从专家创建助理: " + expertId + " -> " + (hit && hit.agent_id));
  }
  const aid = hit && hit.agent_id;
  if (!aid) return "";
  await ensureAgentProfile(hit, expert);
  writeCfg({ ...readCfg(), expertAgents: Object.assign({}, cache, { [expertId]: aid }) });
  return aid;
}

async function repairExpertAgents() {
  const agents = await octopAgents();
  const experts = await octopExperts();
  for (const a of agents) {
    const ex = experts.find((e) => expertName(e) === a.name);
    if (ex) await ensureAgentProfile(a, ex);
  }
}

async function repairAllAgentModels() {
  const agents = await octopAgents();
  const model = activeModelOf(agents);
  for (const a of agents) {
    if (a && a.agent_id && !a.default_model) await ensureAgentModel(a.agent_id, model);
  }
}

async function octopChat({ text, sessionId, agentId, skills, kbIds }) {
  const cfg = readCfg();
  const tk = cfg.octopToken;
  if (!tk) return { ok: false, error: "未登录 Octop" };
  let aid = agentId || cfg.octopAgent;
  if (aid && aid !== cfg.octopAgent) {
    // 传进来的是专家 id 时，先解析成助理 id
    const known = (cfg.expertAgents || {})[aid];
    aid = known || await resolveExpertAgent(aid);
    if (!aid) return { ok: false, error: "该专家暂时无法创建助理" };
  }
  if (!aid) aid = await ensureOctopAgent();
  if (!aid) return { ok: false, error: "没有可用助理" };
  const tid = await octopThread(aid, sessionId || "default");
  const base = octopBase();
  const wsUrl = base.replace(/^http/, "ws") + "/api/agents/" + aid + "/chat/ws?token=" + encodeURIComponent(tk);
  return await new Promise((resolve) => {
    let out = "";
    let settled = false;
    const finish = (v) => { if (settled) return; settled = true; try { ws.close(); } catch {} resolve(v); };
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => finish({ ok: false, error: "超时" }), 240000);
    ws.on("open", () => {
      const frame = { type: "user_turn", text, thread_id: tid || undefined, session_key: "client:" + (sessionId || "default") };
      if (Array.isArray(skills) && skills.length) frame.skills = skills;
      if (Array.isArray(kbIds) && kbIds.length) frame.knowledge_base_ids = kbIds;
      ws.send(JSON.stringify(frame));
    });
    ws.on("message", (buf) => {
      let m;
      try { m = JSON.parse(buf.toString()); } catch { return; }
      const t = m.type || (m.data && m.data.type);
      if (t === "error") { clearTimeout(timer); return finish({ ok: false, error: m.message || "对话出错" }); }
      if (t === "done") { clearTimeout(timer); return finish({ ok: true, reply: out, elapsed_ms: Date.now() - started }); }
      // Octop 流式帧：token 帧的正文在 content 字段
      if (t === "token" && typeof m.content === "string") { out += m.content; return; }
      if (t === "reasoning") return;
      const chunk = (typeof m.text === "string" && m.text) ||
                    (m.data && (typeof m.data.text === "string" ? m.data.text : (typeof m.data.delta === "string" ? m.data.delta : ""))) ||
                    (typeof m.content === "string" ? m.content : "");
      if (typeof chunk === "string") out += chunk;
    });
    const started = Date.now();
    ws.on("error", (e) => { clearTimeout(timer); finish({ ok: false, error: e.message }); });
    ws.on("close", () => { if (!settled) { clearTimeout(timer); finish({ ok: out.length > 0, reply: out }); } });
  });
}

handle('cloud:chat', async (_e, { message, sessionId, files, projectId, expertId }) => {
  const t = newTurn(message);
  for (const f of (files || [])) {
    try {
      const c = fs.readFileSync(f.path, 'utf8').slice(0, 12000);
      (t.attachments = t.attachments || []).push({ name: f.name, content: c });
    } catch (e) { log('读取附件失败: ' + f.name); }
  }
  // 自动附带当前项目简报 PROJECT.md（项目记忆）
  try {
    if (projectId) {
      const p = (readCfg().projects || []).find((x) => x.id === projectId);
      if (p) {
        const bf = path.join(path.resolve(p.dir), 'PROJECT.md');
        if (fs.existsSync(bf)) {
          (t.attachments = t.attachments || []).unshift({ name: 'PROJECT.md（项目简报）', content: fs.readFileSync(bf, 'utf8').slice(0, 8000) });
        }
      }
    }
  } catch (e) { log('读取项目简报失败: ' + e.message); }
  const r = await api('POST', '/v1/chat', { message, session_id: sessionId || '', files: t.attachments || [], expert_id: expertId || '' });
  if (r.ok) log('对话完成 · ' + (r.data.elapsed_ms || 0) + 'ms');
  // 上报这一轮（任务 + 本地步骤 + 摘要），让云端能沉淀经验
  try {
    const reply = (r.data && r.data.reply) || '';
    await api('POST', '/v1/tasks', {
      id: t.id, title: t.title || '对话任务', type: 'chat', status: 'done',
      started_at: t.startedAt, summary: reply.slice(0, 1500),
    });
    if (t.steps.length) {
      await api('POST', '/v1/tasks/' + encodeURIComponent(t.id) + '/steps', { steps: t.steps });
    }
    log('已上报任务 ' + t.id + ' · 步骤 ' + t.steps.length);
  } catch (e) { log('上报任务失败: ' + e.message); }
  return r;
});

handle('cloud:runTask', async (_e, payload) => {
  const r = await api('POST', '/v1/octop/run', payload);
  if (r.ok) log('任务已提交 → ' + (r.data.task_id || '') + ' · ' + (r.data.elapsed_ms || 0) + 'ms');
  else log('任务提交失败: ' + JSON.stringify(r.data).slice(0, 200));
  return r;
});
handle('cloud:uploadArtifact', async (_e, { taskId, name, content }) => {
  const r = await api('POST', '/v1/tasks/' + encodeURIComponent(taskId) + '/artifacts/upload-b64',
    { name, visibility: 'team', content_b64: Buffer.from(String(content || ''), 'utf8').toString('base64') });
  if (r.ok) log('产物已上传: ' + name);
  return r;
});
handle('project:saveOutput', (_e, { dir, name, content }) => {
  const base = path.resolve(dir);
  if (!isInside(cfgRoots(), base)) return { ok: false, error: '目录不在允许范围' };
  try {
    const outDir = path.join(base, '产出');
    fs.mkdirSync(outDir, { recursive: true });
    const safe = String(name || 'output.md').replace(/[\\/:*?"<>|]/g, '_');
    const f = path.join(outDir, safe);
    fs.writeFileSync(f, content, 'utf8');
    log('已保存产出: ' + f);
    return { ok: true, path: f };
  } catch (e) { return { ok: false, error: e.message }; }
});
handle('project:listTextFiles', (_e, { dir, rel }) => {
  const base = path.resolve(dir);
  const target = path.resolve(base, rel || '.');
  if (!isInside(cfgRoots(), target)) return { ok: false, items: [] };
  const exts = ['.txt', '.md', '.csv', '.json', '.log', '.yaml', '.yml', '.html', '.py', '.js'];
  try {
    const items = fs.readdirSync(target, { withFileTypes: true })
      .filter((d) => d.isFile() && exts.includes(path.extname(d.name).toLowerCase()))
      .slice(0, 50)
      .map((d) => ({ name: d.name, path: path.join(target, d.name) }));
    return { ok: true, items };
  } catch (e) { return { ok: false, items: [], error: e.message }; }
});
handle('window:minimize', () => win && win.minimize());
handle('window:close', () => win && win.hide());

function cfgRoots() {
  const cfg = readCfg();
  return [cfg.projectRoot, ...cfg.projects.map((p) => p.dir)];
}
function isInside(roots, target) {
  const t = path.resolve(target);
  return roots.some((r) => { try { return t === path.resolve(r) || t.startsWith(path.resolve(r) + path.sep); } catch { return false; } });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  // 开发便利：仅当配置里显式开启 devAutoLogin 才读取工作区 token（默认关闭，正常流程必须登录）
  try {
    const cfg0 = readCfg();
    const tf = path.join('/Users/liubang/Documents/deepseek-harness/default-workspace', '.octop-token');
    if (cfg0.devAutoLogin === true && !cfg0.octopToken && fs.existsSync(tf)) {
      const tok = fs.readFileSync(tf, 'utf8').trim();
      if (tok) {
        writeCfg({ ...cfg0, octopToken: tok, octopUrl: cfg0.octopUrl || 'http://8.140.227.88:18090' });
        log('已从工作区自动配置 Octop token');
      }
    }
  } catch (e) { log('自动配置失败: ' + e.message); }
  const _c = readCfg();
  log('启动 · server=' + _c.serverUrl + ' octop=' + (_c.octopUrl || '-') + ' tok=' + (_c.octopToken ? 'yes' : 'no') + ' pid=' + process.pid);
  setTimeout(heartbeat, 1500);
  setInterval(heartbeat, 60 * 1000);
  setTimeout(async () => {
    try {
      const credFile = path.join('/Users/liubang/Documents/deepseek-harness/default-workspace', '.octop-creds');
      if (fs.existsSync(credFile)) {
        const lines = fs.readFileSync(credFile, 'utf8').trim().split(/\r?\n/);
        const username = (lines[0] || '').trim();
        const password = (lines[1] || '').trim();
        if (username && password) {
          log('发现本机引导凭据，尝试登录…');
          const res = await octopLogin(username, password);
          if (res && res.ok) {
            saveCreds(username, password);
            try { fs.unlinkSync(credFile); } catch {}
            log('引导登录成功，凭据已加密保存');
          } else {
            log('引导登录失败: ' + ((res && res.error) || ''));
          }
        }
      }
    } catch (e) { log('引导登录异常: ' + e.message); }
    try { await ensureSession(); } catch (e) { log('会话校验失败: ' + e.message); }
  }, 3000);
  setTimeout(async () => { try { await ensureOctopAgent(); } catch {} }, 4000);
  setTimeout(async () => { try { await repairAllAgentModels(); } catch (e) { log('修复模型失败: ' + e.message); } }, 6000);
  setTimeout(async () => { try { await repairExpertAgents(); } catch (e) { log('修复专家身份失败: ' + e.message); } }, 8000);
  setTimeout(startPoller, 2500);
  setTimeout(() => { try { startMcpTunnel(); } catch (e) { log('隧道启动异常: ' + e.message); } }, 6000);
  try { startMcpServer(); } catch (e) { log('MCP 启动异常: ' + e.message); }
  app.on('activate', () => { if (!win) createWindow(); else win.show(); });
});
app.on('before-quit', () => { app.isQuitting = true; });
app.on('window-all-closed', (e) => { if (process.platform !== 'darwin') app.quit(); });
