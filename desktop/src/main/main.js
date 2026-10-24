'use strict';
const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, shell, nativeImage } = require('electron');
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
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data });
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
  const r = await api('POST', '/v1/heartbeat', { version: '0.1.0', host: os.hostname(), platform: process.platform });
  state.online = r.ok;
  state.lastBeat = new Date().toISOString();
  if (r.ok) {
    log('心跳正常 · skills_version=' + (r.data.skills_version ?? '-'));
    await syncSkills();
  } else {
    log('心跳失败: status=' + r.status + ' ' + JSON.stringify(r.data).slice(0, 160));
  }
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
  };
}

// ── IPC ───────────────────────────────────────────────────
ipcMain.handle('app:snapshot', () => snapshot());
ipcMain.handle('app:saveConfig', (_e, patch) => { const c = writeCfg({ ...readCfg(), ...patch }); broadcast(); return c; });

ipcMain.handle('project:pickFolder', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});
ipcMain.handle('project:add', (_e, { name, dir }) => {
  const cfg = readCfg();
  if (!cfg.projects.find((p) => p.dir === dir)) {
    cfg.projects.push({ id: 'p' + Date.now(), name: name || path.basename(dir), dir, createdAt: new Date().toISOString() });
    writeCfg(cfg);
    log('已添加项目: ' + (name || path.basename(dir)) + ' → ' + dir);
  }
  broadcast();
  return cfg.projects;
});
ipcMain.handle('project:remove', (_e, id) => {
  const cfg = readCfg();
  cfg.projects = cfg.projects.filter((p) => p.id !== id);
  writeCfg(cfg); broadcast(); return cfg.projects;
});
ipcMain.handle('project:listFiles', (_e, { dir, rel }) => {
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
ipcMain.handle('project:readFile', (_e, { file, max = 200000 }) => {
  const f = path.resolve(file);
  if (!isInside(cfgRoots(), f)) return { ok: false, error: '文件不在允许范围' };
  try { return { ok: true, content: fs.readFileSync(f, 'utf8').slice(0, max) }; } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('project:writeFile', (_e, { file, content }) => {
  const f = path.resolve(file);
  if (!isInside(cfgRoots(), f)) return { ok: false, error: '文件不在允许范围' };
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content, 'utf8'); log('已写文件: ' + f); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('project:readBrief', (_e, { dir }) => {
  try {
    const f = path.join(path.resolve(dir), 'PROJECT.md');
    return { ok: true, content: fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '' };
  } catch (e) { return { ok: false, content: '', error: e.message }; }
});
ipcMain.handle('project:saveBrief', (_e, { dir, content }) => {
  const base = path.resolve(dir);
  if (!isInside(cfgRoots(), base)) return { ok: false, error: '目录不在允许范围' };
  try {
    fs.writeFileSync(path.join(base, 'PROJECT.md'), String(content || ''), 'utf8');
    log('已保存项目简报: ' + base);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('project:openInFinder', (_e, dir) => { shell.openPath(dir); return true; });
ipcMain.handle('project:reveal', (_e, file) => { shell.showItemInFolder(file); return true; });

ipcMain.handle('cmd:run', async (_e, { cmd, cwd }) => {
  const cfg = readCfg();
  if (!cfg.allowCommand) return { ok: false, error: '命令执行未开启（设置 → 允许执行命令）' };
  const bin = String(cmd || '').trim().split(/\s+/)[0];
  if (!cfg.cmdWhitelist.includes(bin)) return { ok: false, error: '不在白名单: ' + bin };
  const wd = cwd && isInside(cfgRoots(), path.resolve(cwd)) ? path.resolve(cwd) : cfg.projectRoot;
  return await new Promise((resolve) => {
    execFile('/bin/sh', ['-c', cmd], { cwd: wd, timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      const out = (stdout || '') + (stderr ? '\n[stderr] ' + stderr : '');
      log('命令: ' + cmd + ' → ' + (err ? '失败' : '成功'));
      resolve({ ok: !err, output: out.slice(0, 20000), code: err ? err.code : 0 });
    });
  });
});

ipcMain.handle('cloud:heartbeat', async () => { await heartbeat(); return snapshot(); });
ipcMain.handle('cloud:tasks', async () => {
  const r = await api('GET', '/v1/tasks?limit=20');
  return r;
});
ipcMain.handle('cloud:skills', async () => {
  const r = await api('GET', '/v1/skills?since=0');
  return r;
});
ipcMain.handle('cloud:skillStats', async () => {
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

ipcMain.handle('cloud:mySummary', async () => {
  return await api('GET', '/v1/my/summary');
});

ipcMain.handle('cloud:experts', async () => {
  return await api('GET', '/v1/experts');
});

ipcMain.handle('cloud:me', async () => {
  return await api('GET', '/v1/auth/me');
});

ipcMain.handle('auth:login', async (_e, { username, password }) => {
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

ipcMain.handle('auth:logout', async () => {
  const cfg = readCfg();
  writeCfg({ ...cfg, token: '' });
  broadcast();
  return { ok: true };
});

ipcMain.handle('cloud:expAction', async (_e, { id, action }) => {
  const r = await api('POST', '/v1/experience/' + encodeURIComponent(id) + '/' + (action === 'approve' ? 'approve' : 'reject'), {});
  if (r.ok) log('经验' + (action === 'approve' ? '通过' : '驳回') + ': ' + id.slice(0, 8));
  return r;
});

ipcMain.handle('cloud:chat', async (_e, { message, sessionId, files, projectId, expertId }) => {
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

ipcMain.handle('cloud:runTask', async (_e, payload) => {
  const r = await api('POST', '/v1/octop/run', payload);
  if (r.ok) log('任务已提交 → ' + (r.data.task_id || '') + ' · ' + (r.data.elapsed_ms || 0) + 'ms');
  else log('任务提交失败: ' + JSON.stringify(r.data).slice(0, 200));
  return r;
});
ipcMain.handle('cloud:uploadArtifact', async (_e, { taskId, name, content }) => {
  const r = await api('POST', '/v1/tasks/' + encodeURIComponent(taskId) + '/artifacts/upload-b64',
    { name, visibility: 'team', content_b64: Buffer.from(String(content || ''), 'utf8').toString('base64') });
  if (r.ok) log('产物已上传: ' + name);
  return r;
});
ipcMain.handle('project:saveOutput', (_e, { dir, name, content }) => {
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
ipcMain.handle('project:listTextFiles', (_e, { dir, rel }) => {
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
ipcMain.handle('window:minimize', () => win && win.minimize());
ipcMain.handle('window:close', () => win && win.hide());

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
  const _c = readCfg();
  log('启动 · server=' + _c.serverUrl + ' ref=' + (process.env.ELECTRON_RUN_AS_NODE || 'no') + ' pid=' + process.pid);
  setTimeout(heartbeat, 1500);
  setInterval(heartbeat, 60 * 1000);
  setTimeout(startPoller, 2500);
  app.on('activate', () => { if (!win) createWindow(); else win.show(); });
});
app.on('before-quit', () => { app.isQuitting = true; });
app.on('window-all-closed', (e) => { if (process.platform !== 'darwin') app.quit(); });
