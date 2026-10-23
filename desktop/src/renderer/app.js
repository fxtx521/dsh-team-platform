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
  chat: async (m) => ({ ok: true, data: { reply: '（预览模式）收到：' + m, elapsed_ms: 3200 } }),
  listTextFiles: async () => ({ ok: true, items: [{ name: '招标文件摘要.txt', path: '/tmp/a.txt' }, { name: '客户资料.csv', path: '/tmp/b.csv' }] }),
  runTask: async () => ({ ok: true, data: { task_id: 'mock-task', elapsed_ms: 7600, reply: '（预览模式）这是一份按 SOP 生成的示例结果。' } }),
  saveOutput: async () => ({ ok: true, path: '/tmp/out.md' }),
  uploadArtifact: async () => ({ ok: true }),
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

let _nameCb = null;
function askName(title, suggest, cb) {
  _nameCb = cb;
  $('#nmTitle').textContent = title || '起个名字';
  $('#nmInput').value = suggest || '';
  $('#nameModal').classList.add('show');
  setTimeout(() => { const el = $('#nmInput'); el.focus(); el.select(); }, 50);
}
function bindNameModal() {
  const close = () => $('#nameModal').classList.remove('show');
  $('#nmClose').onclick = close;
  $('#nmCancel').onclick = close;
  $('#nmOk').onclick = () => { const v = $('#nmInput').value.trim(); close(); if (_nameCb) { const cb = _nameCb; _nameCb = null; cb(v); } };
  $('#nmInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#nmOk').click(); });
}

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200); }
function go(view) {
  curView = view;
  if (location.hash.replace('#', '') !== view) history.replaceState(null, '', '#' + view);
  $$('.view').forEach((v) => v.classList.remove('active'));
  const el = $('#view-' + view); if (el) el.classList.add('active');
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('#crumb').textContent = { home: '概览', chat: '对话', projects: '我的项目', tasks: '任务', skills: '技能库', console: '终端', settings: '设置' }[view] || '';
  if (view === 'chat') bindChat();
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

// ── 执行任务弹窗 ────────────────────────────────────────
const TEMPLATES = {
  verify: { name: '客户资料核查', params: [{ key: '公司名称', ph: '例如：山东鼎晟机械工程有限公司' }] },
  ledger: { name: '台账整理', params: [{ key: '数据说明', ph: '例如：本月客户台账 87 行，含公司名/金额/日期' }] },
  bid: { name: '标书初稿', params: [{ key: '项目名称', ph: '例如：某园区户外餐车采购' }, { key: '招标要求', ph: '例如：需 CE 认证，30 天交付 6 台' }] },
};
let mTpl = 'verify', mResult = null, mTaskId = '';
function openTaskModal(tpl) {
  mTpl = tpl || 'verify'; mResult = null; mTaskId = '';
  const t = TEMPLATES[mTpl];
  $('#mTitle').textContent = '执行任务 · ' + t.name;
  const cfg = SNAP?.cfg || {};
  const sel = $('#mProject');
  sel.innerHTML = (cfg.projects || []).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">（请先添加项目）</option>';
  $('#mParams').innerHTML = t.params.map((p) => `<label class="field"><span>${esc(p.key)}</span><input data-param="${esc(p.key)}" placeholder="${esc(p.ph || '')}" /></label>`).join('');
  $('#mResult').style.display = 'none'; $('#mResult').textContent = '';
  $('#mSave').style.display = 'none'; $('#mUpload').style.display = 'none';
  $('#mRun').textContent = '开始执行'; $('#mRun').disabled = false;
  $('#taskModal').classList.add('show');
  loadAttachFiles();
}
async function loadAttachFiles() {
  const box = $('#mFiles'); box.innerHTML = '<span class="sub">加载中…</span>';
  const pid = $('#mProject').value;
  const p = (SNAP?.cfg?.projects || []).find((x) => x.id === pid);
  if (!p) { box.innerHTML = '<span class="sub">先添加项目</span>'; return; }
  const r = await api.listTextFiles ? await api.listTextFiles({ dir: p.dir }) : { ok: false, items: [] };
  const items = (r && r.items) || [];
  box.innerHTML = items.length ? items.map((f) => `<label><input type="checkbox" value="${esc(f.path)}" />${esc(f.name)}</label>`).join('') : '<span class="sub">这个项目里没有可附带的文本文件</span>';
}
async function runTask() {
  const cfg = SNAP?.cfg || {};
  const pid = $('#mProject').value;
  const p = (cfg.projects || []).find((x) => x.id === pid);
  if (!p) { toast('先添加一个项目'); return; }
  const params = {};
  $$('#mParams [data-param]').forEach((el) => { params[el.dataset.param] = el.value.trim(); });
  const missing = TEMPLATES[mTpl].params.filter((x) => !params[x.key]);
  if (missing.length) { toast('请填写：' + missing.map((x) => x.key).join('、')); return; }
  const picked = $$('#mFiles input:checked').map((el) => el.value);
  const files = [];
  for (const f of picked.slice(0, 10)) {
    const r = await api.readFile({ file: f, max: 20000 });
    if (r.ok) files.push({ name: f.split(/[\\/]/).pop(), content: r.content });
  }
  const btn = $('#mRun'); btn.disabled = true; btn.textContent = '执行中…';
  const res = await api.runTask({ template_id: mTpl, title: TEMPLATES[mTpl].name + ' · ' + p.name, params, files });
  btn.disabled = false; btn.textContent = '重新执行';
  if (res && res.ok) {
    mResult = res.data.reply || '(空回复)'; mTaskId = res.data.task_id || '';
    $('#mResult').style.display = 'block';
    $('#mResult').textContent = mResult;
    $('#mSave').style.display = 'inline-block'; $('#mUpload').style.display = 'inline-block';
    toast('完成 · ' + (res.data.elapsed_ms || 0) + 'ms');
  } else {
    $('#mResult').style.display = 'block';
    $('#mResult').textContent = '执行失败：' + JSON.stringify(res && res.data || {}).slice(0, 300);
    toast('执行失败');
  }
}
function bindModal() {
  $('#mClose').onclick = () => $('#taskModal').classList.remove('show');
  $('#mProject').onchange = loadAttachFiles;
  $('#mRun').onclick = runTask;
  $('#mSave').onclick = async () => {
    const p = (SNAP?.cfg?.projects || []).find((x) => x.id === $('#mProject').value);
    if (!p || !mResult) return;
    const name = TEMPLATES[mTpl].name + '-' + new Date().toISOString().slice(0, 10) + '.md';
    const r = await api.saveOutput({ dir: p.dir, name, content: '# ' + TEMPLATES[mTpl].name + '\n\n' + mResult });
    toast(r.ok ? '已保存到 产出/' + name : '保存失败：' + r.error);
  };
  $('#mUpload').onclick = async () => {
    if (!mTaskId) { toast('没有任务 ID'); return; }
    const name = TEMPLATES[mTpl].name + '.md';
    const r = await api.uploadArtifact({ taskId: mTaskId, name, content: mResult || '' });
    toast(r && r.ok ? '已上传到看板' : '上传失败');
  };
}

// ── 对话 ────────────────────────────────────────────────
let chatMsgs = [];

// ── 会话管理（多会话，持久化到 localStorage）────────────────
const SESS_KEY = 'lishi.sessions.v1';
let sessions = [];
let curSession = null;
function loadSessions() {
  try { sessions = JSON.parse(localStorage.getItem(SESS_KEY) || '[]'); } catch { sessions = []; }
  if (!Array.isArray(sessions) || !sessions.length) sessions = [];
  if (!sessions.length) sessions.push(newSessionObj('新会话'));
  curSession = sessions[0].id;
}
function newSessionObj(title) { return { id: 's' + Date.now().toString(36), title: title || '新会话', msgs: [], createdAt: new Date().toISOString() }; }
function saveSessions() { try { localStorage.setItem(SESS_KEY, JSON.stringify(sessions)); } catch {} }
function getSession() { return sessions.find((s) => s.id === curSession) || sessions[0]; }
function renderSessions() {
  const box = $('#chatSessions'); if (!box) return;
  box.innerHTML = sessions.map((s) => `<div class="sess ${s.id === curSession ? 'active' : ''}" data-sid="${s.id}"><b>${esc(s.title)}</b><span class="del" data-ren="${s.id}" title="重命名">✎</span><span class="del" data-del="${s.id}">✕</span></div>`).join('');
  box.querySelectorAll('[data-sid]').forEach((el) => {
    el.onclick = (e) => {
      if (e.target.dataset.del) return;
      curSession = el.dataset.sid; saveSessions(); renderSessions(); renderChat();
    };
  });
  box.querySelectorAll('[data-ren]').forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation();
      const id = el.dataset.ren;
      const s = sessions.find((x) => x.id === id); if (!s) return;
      askName('重命名会话', s.title, (v) => { if (v) { s.title = v; saveSessions(); renderSessions(); } });
    };
  });
  box.querySelectorAll('[data-del]').forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation();
      const id = el.dataset.del;
      sessions = sessions.filter((s) => s.id !== id);
      if (!sessions.length) sessions.push(newSessionObj('新会话'));
      if (curSession === id) curSession = sessions[0].id;
      saveSessions(); renderSessions(); renderChat();
    };
  });
}
function renderChat() {
  const s = getSession(); if (!s) return;
  const box = $('#chatBody');
  box.innerHTML = (s.msgs || []).map((m) => `<div class="msg ${m.role}">${esc(m.text)}${m.meta ? `<span class="meta">${esc(m.meta)}</span>` : ''}</div>`).join('');
  if (!s.msgs || !s.msgs.length) box.innerHTML = '<div class="msg ai">你好，我是团队 AI 助理。<br>直接说你要做什么——比如「把项目里的报价单整理成表」，我会在你本地文件夹里读写文件。</div>';
  box.scrollTop = box.scrollHeight;
  renderSessions();
}
async function sendChat() {
  const inp = $('#chatInput');
  const text = (inp.value || '').trim();
  if (!text) return;
  inp.value = '';
  const s = getSession();
  if (!s.msgs || !s.msgs.length) s.title = text.slice(0, 18);
  s.msgs.push({ role: 'user', text });
  saveSessions();
  renderChat();
  const box = $('#chatBody');
  const tip = document.createElement('div');
  tip.className = 'typing'; tip.textContent = '助理思考中…'; box.appendChild(tip); box.scrollTop = box.scrollHeight;
  const r = await api.chat(text, s.id);
  tip.remove();
  const sess = getSession();
  if (r && r.ok) sess.msgs.push({ role: 'ai', text: r.data.reply || '(空)', meta: (r.data.elapsed_ms || 0) + 'ms' });
  else sess.msgs.push({ role: 'ai', text: '出错了：' + JSON.stringify((r && r.data) || {}).slice(0, 200) });
  saveSessions();
  renderChat();
}
function bindChat() {
  if (!sessions.length) loadSessions();
  const nb = $('#btnNewChat');
  if (nb && !nb._bound) {
    nb._bound = true;
    nb.onclick = () => { sessions.unshift(newSessionObj('新会话')); curSession = sessions[0].id; saveSessions(); renderSessions(); renderChat(); };
  }
  const sel = $('#chatProject');
  const cfg = SNAP?.cfg || {};
  sel.innerHTML = (cfg.projects || []).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">（先添加项目）</option>';
  $('#chatSend').onclick = sendChat;
  $('#chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  renderChat();
}
function bind() {
  bindModal();
  bindNameModal();
  bindChat();
  $$('.nav-item').forEach((b) => b.onclick = () => go(b.dataset.view));
  $$('[data-view]').forEach((b) => { if (b.classList.contains('link') || b.tagName === 'BUTTON' && !b.classList.contains('nav-item')) b.onclick = () => go(b.dataset.view); });
  $('#btnRefresh').onclick = async () => { await api.heartbeat(); await refresh(); toast('已刷新'); };
  $('#btnQuick').onclick = () => openTaskModal('verify');
  $$('[data-quick]').forEach((b) => b.onclick = () => openTaskModal(b.dataset.quick || 'verify'));
  $('#btnAddProject').onclick = async () => {
    const dir = await api.pickFolder(); if (!dir) return;
    const suggest = dir.split(/[\\/]/).pop() || '新项目';
    askName('项目名称', suggest, async (name) => {
      await api.addProject({ name: name || suggest, dir });
      await refresh();
      toast('已添加项目：' + (name || suggest));
    });
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
  loadSessions();
  bind();
  await refresh();
  const h = (location.hash || '').replace('#', '');
  go(h || 'chat');
  if (location.search.includes('modal=1')) openTaskModal(location.search.includes('tpl=ledger') ? 'ledger' : (location.search.includes('tpl=bid') ? 'bid' : 'verify'));
  window.addEventListener('hashchange', () => go((location.hash || '').replace('#', '') || 'home'));
})();
