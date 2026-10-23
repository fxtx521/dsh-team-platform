'use strict';
const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const CFG_PATH = () => path.join(app.getPath('userData'), 'config.json');
const DEFAULT_CFG = {
  serverUrl: 'http://8.140.227.88:18000',
  apiKey: 'demo-key-0001',
  employeeName: '演示员工',
  projectRoot: path.join(os.homedir(), 'Documents', '砺项目'),
  projects: [],          // [{id,name,dir,createdAt}]
  cmdWhitelist: ['python3', 'node', 'git', 'ls', 'dir', 'echo'],
  allowCommand: false,
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
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(cfg.serverUrl.replace(/\/$/, '') + p, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: e.message } };
  } finally { clearTimeout(timer); }
}

async function heartbeat() {
  const r = await api('POST', '/v1/heartbeat', { version: '0.1.0', host: os.hostname(), platform: process.platform });
  state.online = r.ok;
  state.lastBeat = new Date().toISOString();
  if (r.ok) {
    log('心跳正常 · skills_version=' + (r.data.skills_version ?? '-'));
    await syncSkills();
  } else {
    log('心跳失败: ' + (r.data.error || r.status));
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
  setTimeout(heartbeat, 1500);
  setInterval(heartbeat, 60 * 1000);
  app.on('activate', () => { if (!win) createWindow(); else win.show(); });
});
app.on('before-quit', () => { app.isQuitting = true; });
app.on('window-all-closed', (e) => { if (process.platform !== 'darwin') app.quit(); });
