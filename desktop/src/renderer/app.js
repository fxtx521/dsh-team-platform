'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtSize = (n) => (n > 1024 * 1024 ? (n / 1048576).toFixed(1) + ' MB' : n > 1024 ? (n / 1024).toFixed(0) + ' KB' : (n || 0) + ' B');
const fmtTime = (s) => { if (!s) return '-'; const d = new Date(s); return isNaN(d) ? s : d.toLocaleString(); };

// 浏览器预览用的 mock（打包成 app 后走真实的 window.wb）
const MOCK = {
  state: { online: true, lastBeat: new Date().toISOString(), pending: 0, running: 0, todayTasks: 3, log: [
    { t: new Date().toISOString(), line: '心跳正常 · skills_version=6' },
    { t: new Date().toISOString(), line: '已同步技能: 客户核查 SOP（v2）' },
    { t: new Date().toISOString(), line: '已写文件: ~/Documents/砺项目/鼎晟/核查报告.docx' },
  ] },
  cfg: { serverUrl: 'http://8.140.227.88:18000', apiKey: 'demo-key-0001', employeeName: '演示员工', projectRoot: '~/Documents/砺项目',
         projects: [{ id: 'p1', name: '鼎晟机械核查', dir: '~/Documents/砺项目/鼎晟机械', createdAt: new Date().toISOString() },
                    { id: 'p2', name: '珍云官网 SEO', dir: '~/Documents/砺项目/珍云SEO', createdAt: new Date().toISOString() }],
         cmdWhitelist: ['python3', 'node', 'git'], allowCommand: false },
  skills: ['客户核查 SOP（v2）', '台账整理 SOP', '标书撰写 SOP', '客户资料核查 SOP'],
  platform: 'darwin', version: '0.1.0',
};
const api = window.wb || {
  snapshot: async () => MOCK,
  saveConfig: async (p) => ({ ...MOCK.cfg, ...p }),
  pickFolder: async () => '~/Documents/砺项目/新项目',
  addProject: async () => MOCK.cfg.projects,
  removeProject: async () => MOCK.cfg.projects,
  listFiles: async () => ({ ok: true, items: [
    { name: '核查报告.docx', dir: false, size: 24576, mtime: new Date().toISOString() },
    { name: '客户资料.xlsx', dir: false, size: 102400, mtime: new Date().toISOString() },
    { name: '截图', dir: true, size: 0, mtime: new Date().toISOString() },
  ] }),
  readFile: async () => ({ ok: true, content: '（预览模式，未读取真实文件）' }),
  writeFile: async () => ({ ok: true }),
  openInFinder: async () => true,
  reveal: async () => true,
  runCmd: async () => ({ ok: true, output: '（预览模式，未执行真实命令）' }),
  heartbeat: async () => MOCK,
  tasks: async () => ({ ok: true, data: { items: [
    { id: 't1', title: '客户资料核查 · 山东鼎晟机械', status: 'done', created_at: new Date().toISOString() },
    { id: 't2', title: '台账整理 · 本月客户台账', status: 'running', created_at: new Date().toISOString() },
    { id: 't3', title: '标书初稿 · 某园区餐车采购', status: 'done', created_at: new Date().toISOString() },
  ] } }),
  skills: async () => ({ ok: true, data: { items: [
    { name: '客户核查 SOP（v2）', version: 1, content: '1) 先查工商\n2) 查司法\n3) 查经营异常\n4) 结论' },
    { name: '台账整理 SOP', version: 1, content: '1) 字段齐全\n2) 格式统一\n3) 重复检测' },
    { name: '标书撰写 SOP', version: 1, content: '1) 响应矩阵\n2) 技术方案\n3) 报价' },
  ] } }),
  skillStats: async () => ({ ok: true, data: { items: [] } }),
  minimize: async () => {}, close: async () => {},
  onState: () => {}, onLog: () => {}, onGoto: () => {},
};

let SNAP = null;
let curView = 'home';
let curProject = null;   // {id,name,dir}
let curRel = '.';
let curTasks = [];
let curSkills = [];

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200); }
function go(view) {
  curView = view;
  if (location.hash.replace('#', '') !== view) history.replaceState(null, '', '#' + view);
  $$('.view').forEach((v) => v.classList.remove('active'));
  const el = $('#view-' + view); if (el) el.classList.add('active');
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#crumb').textContent = { home: '概览', projects: '我的项目', tasks: '任务', skills: '技能库', console: '终端', settings: '设置' }[view] || '';
  if (view === 'tasks') loadTasks();
  if (view === 'skills') loadSkills();
  if (view === 'settings') fillSettings();
}
function renderConn() {
  const pill = $('#connPill'); const st = SNAP?.state || {};
  pill.className = 'conn ' + (st.online ? 'on' : 'off');
  pill.querySelector('span').textContent = st.online ? '已连接云端' : '未连接';
  $('#whoBox').textContent = SNAP?.cfg?.employeeName || '未设置员工';
  $('#verBox').textContent = 'v' + (SNAP?.version || '0.1.0');
  $('#aboutVer').textContent = SNAP?.version || '0.1.0';
  $('#aboutPlat').textContent = SNAP?.platform || '-';
}
function renderHome() {
  const st = SNAP?.state || {}; const cfg = SNAP?.cfg || {};
  $('#stToday').textContent = (st.todayTasks != null) ? st.todayTasks : ((st.pending || 0) + (st.running || 0));
  $('#stSkills').textContent = (SNAP?.skills || []).length;
  $('#stProjects').textContent = (cfg.projects || []).length;
  const box = $('#logBox');
  box.innerHTML = (st.log || []).map((l) => '<div>' + esc(new Date(l.t).toLocaleTimeString()) + ' · ' + esc(l.line) + '</div>').join('') || '<div>暂无日志</div>';
  api.tasks().then((r) => {
    const items = (r && r.data && r.data.items) || [];
    $('#homeTasks').innerHTML = items.slice(0, 5).map((t) => `<div class="item" onclick="go('tasks')"><div class="t"><b>${esc(t.title)}</b><span>${fmtTime(t.created_at)}</span></div><span class="badge ${t.status === 'done' ? 'ok' : 'run'}">${esc(t.status)}</span></div>`).join('') || '<div class="sub">还没有任务</div>';
  });
}
function renderProjects() {
  const cfg = SNAP?.cfg || {};
  $('#projectGrid').innerHTML = (cfg.projects || []).map((p) => `<div class="project" data-id="${p.id}"><b>${esc(p.name)}</b><div class="path">${esc(p.dir)}</div><div class="ops"><button class="btn ghost" data-open="${p.id}">浏览文件</button><button class="btn ghost" data-del="${p.id}">移除</button></div></div>`).join('') || '<div class="sub">还没有项目，点右上角「添加项目」把文件夹登记进来</div>';
  $$('[data-open]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); openProject(b.dataset.open); });
  $$('[data-del]').forEach((b) => b.onclick = async (e) => { e.stopPropagation(); await api.removeProject(b.dataset.del); await refresh(); toast('已移除'); });
}
async function openProject(id) {
  const p = (SNAP?.cfg?.projects || []).find((x) => x.id === id); if (!p) return;
  curProject = p; curRel = '.';
  $('#fileCard').style.display = 'block';
  $('#fileTitle').textContent = p.name;
  await loadFiles();
  $('#fileCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function loadFiles() {
  if (!curProject) return;
  const r = await api.listFiles({ dir: curProject.dir, rel: curRel });
  const box = $('#fileList');
  if (!r.ok) { box.innerHTML = '<div class="sub">读取失败：' + esc(r.error) + '</div>'; return; }
  if (curRel !== '.') box.innerHTML = '<div class="file" id="upRow">📂 ..</div>';
  box.innerHTML += r.items.map((f) => `<div class="file" data-name="${esc(f.name)}" data-dir="${f.dir ? 1 : 0}">${f.dir ? '📁' : '📄'} <span>${esc(f.name)}</span><span class="sz">${f.dir ? '' : fmtSize(f.size)}</span></div>`).join('');
  $$('#fileList .file').forEach((el) => el.onclick = () => {
    const name = el.dataset.name; const isDir = el.dataset.dir === '1';
    if (isDir) { curRel = curRel === '.' ? name : curRel + '/' + name; loadFiles(); }
    else { toast('双击可在本地打开，或让 AI 处理'); }
  });
  $('#btnOpenFinder').onclick = () => api.openInFinder(curProject.dir);
  $('#btnUp').onclick = () => { curRel = '.'; loadFiles(); };
}
async function loadTasks() {
  const r = await api.tasks(); curTasks = (r && r.data && r.data.items) || [];
  $('#taskHint').textContent = '共 ' + curTasks.length + ' 条 · 来自云端';
  $('#taskList').innerHTML = curTasks.map((t) => `<div class="item" data-task="${t.id}"><div class="t"><b>${esc(t.title)}</b><span>${fmtTime(t.created_at)}</span></div><span class="badge ${t.status === 'done' ? 'ok' : 'run'}">${esc(t.status)}</span></div>`).join('') || '<div class="sub">暂无任务</div>';
  $$('[data-task]').forEach((el) => el.onclick = () => showTask(el.dataset.task));
}
function showTask(id) {
  const t = curTasks.find((x) => x.id === id); if (!t) return;
  $('#taskDetailCard').style.display = 'block';
  $('#tdTitle').textContent = t.title || '任务';
  $('#tdMeta').innerHTML = `<span class="badge ${t.status === 'done' ? 'ok' : 'run'}">${esc(t.status)}</span><span class="badge">${id.slice(0, 10)}</span><span class="badge">${fmtTime(t.created_at)}</span>`;
  $('#tdSteps').innerHTML = '<div class="tl"><b>任务创建</b><span>' + fmtTime(t.created_at) + '</span></div>' + (t.status === 'done' ? '<div class="tl"><b>执行完成</b><span>结果已回传云端</span></div>' : '<div class="tl"><b>执行中…</b></div>');
}
async function loadSkills() {
  const r = await api.skills(); curSkills = (r && r.data && r.data.items) || [];
  $('#skillList').innerHTML = curSkills.map((s) => `<div class="item"><div class="t"><b>${esc(s.name)}</b><span>v${s.version || 1} · 云端下发</span></div><span class="badge ok">已同步</span></div><div class="sub" style="white-space:pre-wrap;padding:0 12px 10px">${esc((s.content || '').slice(0, 200))}</div>`).join('') || '<div class="sub">还没有技能，先去云端技能库添加</div>';
}
async function refresh() {
  SNAP = await api.snapshot();
  renderConn(); renderHome(); renderProjects();
}
function fillSettings() {
  const c = SNAP?.cfg || {};
  $('#cfgServer').value = c.serverUrl || '';
  $('#cfgKey').value = c.apiKey || '';
  $('#cfgName').value = c.employeeName || '';
  $('#cfgRoot').value = c.projectRoot || '';
  $('#cfgAllowCmd').checked = !!c.allowCommand;
  $('#cfgWhitelist').value = (c.cmdWhitelist || []).join(',');
}
function bind() {
  $$('.nav-item').forEach((b) => b.onclick = () => go(b.dataset.view));
  $$('[data-view]').forEach((b) => { if (b.classList.contains('link') || b.tagName === 'BUTTON' && !b.classList.contains('nav-item')) b.onclick = () => go(b.dataset.view); });
  $('#btnRefresh').onclick = async () => { await api.heartbeat(); await refresh(); toast('已刷新'); };
  $('#btnQuick').onclick = () => go('projects');
  $$('[data-quick]').forEach((b) => b.onclick = () => { go('projects'); toast('选一个项目，然后开始「' + (b.textContent || '').trim() + '」'); });
  $('#btnAddProject').onclick = async () => {
    const dir = await api.pickFolder(); if (!dir) return;
    const name = prompt('给这个项目起个名字：', dir.split(/[\\/]/).pop()) || dir;
    await api.addProject({ name, dir }); await refresh(); toast('已添加项目');
  };
  $('#btnClearLog').onclick = () => { if (SNAP) { SNAP.state.log = []; } $('#logBox').innerHTML = ''; };
  $('#btnRunCmd').onclick = async () => {
    const cmd = $('#consoleCmd').value.trim(); if (!cmd) return;
    const out = $('#consoleOut'); out.textContent += '\n$ ' + cmd;
    const r = await api.runCmd({ cmd, cwd: curProject ? curProject.dir : undefined });
    out.textContent += '\n' + (r.ok ? r.output : '[错误] ' + r.error);
    out.scrollTop = out.scrollHeight;
  };
  $('#consoleCmd').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnRunCmd').click(); });
  $('#btnSaveConn').onclick = async () => {
    await api.saveConfig({ serverUrl: $('#cfgServer').value.trim(), apiKey: $('#cfgKey').value.trim(), employeeName: $('#cfgName').value.trim() });
    await api.heartbeat(); await refresh(); toast('连接设置已保存');
  };
  $('#btnPickRoot').onclick = async () => { const d = await api.pickFolder(); if (d) { $('#cfgRoot').value = d; await api.saveConfig({ projectRoot: d }); } };
  $('#btnSaveSec').onclick = async () => {
    await api.saveConfig({ allowCommand: $('#cfgAllowCmd').checked, cmdWhitelist: $('#cfgWhitelist').value.split(',').map((s) => s.trim()).filter(Boolean) });
    await refresh(); toast('安全设置已保存');
  };
  $('#btnSyncSkills').onclick = async () => { await api.heartbeat(); await loadSkills(); toast('技能已同步'); };
  $('#btnRunLocal').onclick = () => toast('本地执行：下一步接执行器');
  api.onState && api.onState((d) => { SNAP = d; renderConn(); renderHome(); renderProjects(); });
  api.onLog && api.onLog((rec) => { if (SNAP?.state) { SNAP.state.log.unshift(rec); renderHome(); } });
  api.onGoto && api.onGoto((v) => go(v));
}
(async function boot() {
  bind();
  await refresh();
  const h = (location.hash || '').replace('#', '');
  go(h || 'home');
  window.addEventListener('hashchange', () => go((location.hash || '').replace('#', '') || 'home'));
})();
