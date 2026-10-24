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
  cfg: { serverUrl: 'http://8.140.227.88:18000', apiKey: 'demo-key-0001', token: 'preview-token', employeeName: '演示员工', projectRoot: '~/Documents/砺项目',
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
  login: async () => ({ ok: true, user: { display_name: '演示员工' } }),
  octopSkills: async () => ({ ok: true, items: [
    { name: '备忘录', desc: '在 macOS 上创建、搜索和编辑 Apple 备忘录' },
    { name: '提醒事项', desc: '管理提醒事项' },
  ] }),
  experts: async () => ({ ok: true, data: { items: [
    { id: 'general-assistant', name: '小通 · 通用助手' },
    { id: 'business-operations', name: '业务流程专家' },
    { id: 'ai-coding-coach', name: 'AI 编程实战导师' },
  ] } }),
  logout: async () => ({ ok: true }),
  me: async () => ({ ok: true, data: { user: { username: 'u1', display_name: '演示员工', role: 'reviewer', dept: '' }, terminal: { id: 't1', hostname: 'demo-pc', employee_no: 'ZY-0001' }, permissions: ['experience.approve', 'task.run', 'skill.sync'] } }),
  expAction: async () => ({ ok: true }),
  mySummary: async () => ({ ok: true, data: {
    experiences: [
      { id: 'e1', title: '客户核查 · 可固化', status: 'pending', brief: '适用场景：客户核查\n执行链路：web.search → octop.agent' },
      { id: 'e2', title: '台账整理 · 可固化', status: 'approved', brief: '适用场景：台账整理…' },
    ],
    stats: { total_tasks: 102, today_tasks: 59, skills: 7, experiences: 61, pending_experience: 6 },
    tasks: [
      { id: 't1', title: '客户资料核查 · 山东鼎晟机械', status: 'done', created_at: new Date().toISOString() },
      { id: 't2', title: '台账整理 · 本月客户台账', status: 'done', created_at: new Date().toISOString() },
      { id: 't3', title: '标书初稿 · 某园区餐车采购', status: 'done', created_at: new Date().toISOString() },
    ],
    tools: [{ tool: 'local_read_file', n: 18 }, { tool: 'local_write_file', n: 9 }, { tool: 'local_list_dir', n: 7 }, { tool: 'local_run_cmd', n: 3 }],
  } }),
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
let ME = null;  // 当前员工身份与权限
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
function showText(title, text) {
  $('#pvTitle').textContent = title || '输出';
  $('#pvBody').textContent = text || '（无输出）';
  $('#pvBody').dataset.file = '';
  $('#previewModal').classList.add('show');
}
async function previewFile(file, title) {
  const r = await api.readFile({ file, max: 60000 });
  $('#pvTitle').textContent = title || (file || '').split(/[\\/]/).pop() || '文件预览';
  $('#pvBody').textContent = r && r.ok ? (r.content || '（空文件）') : ('读取失败：' + ((r && r.error) || ''));
  $('#pvBody').dataset.file = file || '';
  $('#previewModal').classList.add('show');
}
async function loadSkillPicker() {
  const exSel = $('#chatExpert');
  const r = await api.octopSkills({ expertId: exSel ? exSel.value : '' });
  const items = (r && r.items) || [];
  const box = $('#skList');
  if (!box) return;
  box.innerHTML = items.map((s) => `<label class="skrow"><input type="checkbox" value="${esc(s.slug || s.name)}" ${pickedSkills.includes(s.slug || s.name) ? 'checked' : ''} /><div><b>${esc(s.name)}</b><span>${esc((s.desc || '').slice(0, 80))}</span></div></label>`).join('') || '<div class="sub">这个助理还没有技能</div>';
  box.querySelectorAll('input[type=checkbox]').forEach((cb) => {
    cb.onchange = () => {
      const v = cb.value;
      if (cb.checked) { if (!pickedSkills.includes(v)) pickedSkills.push(v); }
      else pickedSkills = pickedSkills.filter((x) => x !== v);
      renderSkillCount();
    };
  });
}
function renderSkillCount() {
  const el = $('#skillCount');
  if (el) el.textContent = String(pickedSkills.length);
}
function bindSkillsModal() {
  const open = async () => { await loadSkillPicker(); $('#skillsModal').classList.add('show'); };
  const close = () => $('#skillsModal').classList.remove('show');
  const b = $('#btnSkills');
  if (b) b.onclick = open;
  const c = $('#skClose'); if (c) c.onclick = close;
  const ok = $('#skOk'); if (ok) ok.onclick = close;
  const cl = $('#skClear'); if (cl) cl.onclick = () => { pickedSkills = []; loadSkillPicker(); renderSkillCount(); };
}

function bindPreviewModal() {
  const close = () => $('#previewModal').classList.remove('show');
  $('#pvClose').onclick = close;
  $('#pvOk').onclick = close;
  $('#pvReveal').onclick = () => { const f = $('#pvBody').dataset.file; if (f) api.reveal(f); };
}

function bindBriefModal() {
  const close = () => $('#briefModal').classList.remove('show');
  $('#brClose').onclick = close;
  $('#brCancel').onclick = close;
  $('#brOk').onclick = async () => {
    const dir = $('#brText').dataset.dir;
    const r = await api.saveBrief({ dir, content: $('#brText').value });
    close();
    toast(r && r.ok ? '项目简报已保存' : '保存失败');
  };
}

function bindLogin() {
  const doLogin = async () => {
    const u = ($('#lgUser').value || '').trim();
    const p = $('#lgPass').value || '';
    $('#lgErr').textContent = '';
    if (!u || !p) { $('#lgErr').textContent = '请输入账号和密码'; return; }
    $('#lgOk').textContent = '登录中…';
    const r = (api.octopLogin ? await api.octopLogin(u, p) : await api.login(u, p));
    $('#lgOk').textContent = '登录';
    if (r && r.ok) {
      $('#loginModal').classList.remove('show');
      await refresh();
      await loadMe();
      toast('欢迎，' + ((r.user && r.user.display_name) || u) + (r.agentId ? ' · 助理已就绪' : ''));
      go('chat');
    } else {
      $('#lgErr').textContent = (r && r.error) || '登录失败';
    }
  };
  $('#lgOk').onclick = doLogin;
  $('#lgPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
}
function requireLogin() {
  if (SNAP && SNAP.cfg && SNAP.cfg.token) return true;
  $('#loginModal').classList.add('show');
  return false;
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
  $('#crumb').textContent = { home: '概览', chat: '对话', projects: '我的项目', tasks: '任务', experiences: '经验', capabilities: '云端能力', skills: '技能库', console: '终端', settings: '设置' }[view] || '';
  if (view === 'chat') bindChat();
  if (view === 'tasks') loadTasks();
  if (view === 'experiences') loadExperiences();
  if (view === 'capabilities') loadCapabilities();
  if (view === 'skills') loadSkills();
  if (view === 'settings') fillSettings();
}
function renderConn() {
  const pill = $('#connPill'); const st = SNAP?.state || {};
  pill.className = 'conn ' + (st.online ? 'on' : 'off');
  pill.querySelector('span').textContent = st.online ? '已连接云端' : '未连接';
  $('#whoBox').textContent = ME ? (ME.user.display_name + ' · ' + ({ employee: '员工', reviewer: '主管', admin: '管理员' }[ME.user.role] || ME.user.role)) : (SNAP?.cfg?.employeeName || '未设置员工');
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
  $('#projectGrid').innerHTML = (cfg.projects || []).map((p) => `<div class="project" data-id="${p.id}"><b>${esc(p.name)}</b><div class="path">${esc(p.dir)}</div><div class="ops"><button class="btn ghost" data-open="${p.id}">浏览文件</button><button class="btn ghost" data-brief="${p.id}">简报</button><button class="btn ghost" data-del="${p.id}">移除</button></div></div>`).join('') || '<div class="sub">还没有项目，点右上角「添加项目」把文件夹登记进来</div>';
  $$('[data-open]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); openProject(b.dataset.open); });
  $$('[data-brief]').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation();
    const p = (SNAP?.cfg?.projects || []).find((x) => x.id === b.dataset.brief);
    if (!p) return;
    const r = await api.readBrief({ dir: p.dir });
    $('#brTitle').textContent = '项目简报 · ' + p.name;
    $('#brText').value = (r && r.content) || '';
    $('#brText').dataset.dir = p.dir;
    $('#briefModal').classList.add('show');
  });
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
    else {
      const full = curRel === '.' ? (curProject.dir + '/' + name) : (curProject.dir + '/' + curRel + '/' + name);
      previewFile(full, name);
    }
  });
  $('#btnOpenFinder').onclick = () => api.openInFinder(curProject.dir);
  $('#btnUp').onclick = () => { curRel = '.'; loadFiles(); };
}
async function loadTasks() {
  const r = await api.mySummary ? await api.mySummary() : { ok: false };
  const d = (r && r.data) || {};
  curTasks = d.tasks || [];
  const st = d.stats || {};
  $('#taskHint').textContent = '今日 ' + (st.today_tasks || 0) + ' 条 · 累计 ' + (st.total_tasks || 0) + ' 条';
  const statsHtml = `<div class="row-stats">
    <span>技能 <b>${st.skills || 0}</b></span>
    <span>经验 <b>${st.experiences || 0}</b>（待审 ${st.pending_experience || 0}）</span>
  </div>`;
  const toolsHtml = (d.tools || []).length ? '<div class="sub" style="margin-top:10px">本地工具使用：' +
    (d.tools || []).slice(0, 6).map((x) => x.tool + '×' + x.n).join('、') + '</div>' : '';
  $('#taskList').innerHTML = statsHtml + (curTasks.map((t) => `<div class="item" data-task="${t.id}"><div class="t"><b>${esc(cleanTitle(t.title))}</b><span>${fmtTime(t.created_at)}</span></div><span class="badge ${t.status === 'done' ? 'ok' : 'run'}">${esc(t.status)}</span></div>`).join('') || '<div class="sub">还没有任务</div>') + toolsHtml;
  $$('[data-task]').forEach((el) => el.onclick = () => showTask(el.dataset.task));
}
function cleanTitle(t) {
  return String(t || '').replace('（飞书消息 · 回复直接发回飞书 · 简短口语化）', '').trim().slice(0, 60);
}
function showTask(id) {
  const t = curTasks.find((x) => x.id === id); if (!t) return;
  $('#taskDetailCard').style.display = 'block';
  $('#tdTitle').textContent = t.title || '任务';
  $('#tdMeta').innerHTML = `<span class="badge ${t.status === 'done' ? 'ok' : 'run'}">${esc(t.status)}</span><span class="badge">${id.slice(0, 10)}</span><span class="badge">${fmtTime(t.created_at)}</span>`;
  $('#tdSteps').innerHTML = '<div class="tl"><b>任务创建</b><span>' + fmtTime(t.created_at) + '</span></div>' + (t.status === 'done' ? '<div class="tl"><b>执行完成</b><span>结果已回传云端</span></div>' : '<div class="tl"><b>执行中…</b></div>');
}
async function loadCapabilities() {
  if (!api.octopCapabilities) { $('#capsBody').innerHTML = '<div class="sub">当前版本不支持</div>'; return; }
  $('#capsBody').innerHTML = '<div class="sub">加载中…</div>';
  const c = await api.octopCapabilities();
  loadCapabilitiesWith(c);
}

function loadCapabilitiesWith(c) {
  const box = $('#capsBody');
  const sec = (title, body) => '<div style="margin:14px 0 6px;font-weight:600">' + title + '</div>' + body;
  let html = '';
  const pm = c.pluginMarket || {};
  html += sec('插件市场（' + (pm.count || 0) + '）', (pm.items || []).map((p) => '<div class="item"><div class="t"><b>' + esc(p.name) + '</b><span>' + esc(p.kind + ' · ' + p.group + ' · ' + p.desc) + '</span></div></div>').join('') || '<div class="sub">无</div>');
  const cc = c.connectorCatalog || {};
  html += sec('连接器目录（' + (cc.count || 0) + '）', (cc.items || []).map((k) => '<div class="item"><div class="t"><b>' + esc(k.name) + '</b><span>' + esc(k.kind + ' · ' + k.auth) + '</span></div></div>').join('') || '<div class="sub">无</div>');
  const at = c.agentTools || {};
  html += sec('助理已装工具（' + (at.count || 0) + '）', (at.items || []).map((t) => '<div class="item"><div class="t"><b>' + esc(t.name) + '</b><span>' + esc(t.desc) + '</span></div></div>').join('') || '<div class="sub">未安装工具插件</div>');
  const us = c.users || {};
  html += sec('账号（' + (us.count || 0) + '）', (us.items || []).map((u) => '<div class="item"><div class="t"><b>' + esc(u.name || u.username) + '</b><span>' + esc(u.username) + '</span></div><span class="badge ok">' + esc(u.role) + '</span></div>').join('') || '<div class="sub">无</div>');
  const bk = c.backupState || {};
  html += sec('备份', '<div class="sub">' + (bk.busy ? '正在备份…' : '空闲') + ' · 备份文件 ' + (bk.count || 0) + ' 个' + (bk.latest ? ' · 最近：' + esc(bk.latest) : '') + '</div>');
  const pl = c.plugins || {};
  html += sec('插件（' + (pl.count || 0) + '）', (pl.items || []).map((p) => '<div class="item"><div class="t"><b>' + esc(p.name || p.id) + '</b></div>' + (p.enabled === false ? '' : '<span class="badge ok">启用</span>') + '</div>').join('') || '<div class="sub">未安装插件</div>');
  const asub = c.agentSubagents || {};
  html += sec('当前助理的子代理（' + ((asub.items || []).length) + '）',
    (asub.items || []).map((s) => '<div class="item"><div class="t"><b>' + esc(s.name || s.slug) + '</b><span>' + esc(s.desc || '') + '</span></div></div>').join('') || '<div class="sub">无</div>');
  const ck = c.channelKinds || {};
  html += sec('可接入渠道类型（' + ((ck.items || []).length) + '）',
    (ck.items || []).map((k) => '<div class="item"><div class="t"><b>' + esc(k.name || k.kind) + '</b></div></div>').join('') || '<div class="sub">当前 Octop 未启用渠道插件</div>');
  const bs = c.browserSessions || {};
  html += sec('浏览器会话', '<div class="sub">环境：' + esc(bs.environment || '-') + ' · 会话数 ' + (bs.count || 0) + '</div>');
  const kb = c.knowledge || {};
  html += sec('知识库（' + (kb.count || 0) + '）',
    ((kb.items || []).map((k) => '<div class="item"><div class="t"><b>' + esc(k.name || k.id) + '</b><span>文档 ' + (k.docs || 0) + '</span></div><button class="mini" data-kbup="' + esc(k.id) + '">上传本地文件</button></div>').join('') || '<div class="sub">还没有知识库</div>') +
    '<div class="sub" style="margin-top:6px">能力状态：' + (kb.usable ? '可用' : '未启用（需要先在 Octop 里配置向量模型）') + '</div>');
  const subs = c.subagents || {};
  html += sec('子代理（' + (subs.count || 0) + '）',
    (subs.sample || []).slice(0, 8).map((s) => '<div class="item"><div class="t"><b>' + esc(s.name || s.slug) + '</b><span>' + esc(s.div || '') + '</span></div></div>').join('') || '<div class="sub">无</div>');
  const prov = c.providers || {};
  html += sec('模型供应商', (prov.items || []).map((p) => '<div class="item"><div class="t"><b>' + esc(p.name || p.id) + '</b></div>' + (p.active ? '<span class="badge ok">使用中</span>' : '') + '</div>').join('') || '<div class="sub">无</div>');
  const ch = c.channels || {};
  html += sec('渠道（当前助理）', (ch.items || []).length ? (ch.items || []).map((x) => '<div class="item"><div class="t"><b>' + esc(x.name || x.kind) + '</b></div></div>').join('') : '<div class="sub">未配置渠道（下一步接入扫码/机器人创建）</div>');
  const sh = c.skillhub || {};
  html += sec('技能市场（搜索）',
    '<div style="display:flex;gap:8px;margin-bottom:8px"><input id="hubQ" placeholder="搜技能包，如 SOP / 台账" style="flex:1;border:1px solid #dfe3ea;border-radius:10px;padding:8px 10px;font-size:13px" /><button class="btn ghost" id="hubGo">搜索</button></div>' +
    ((sh.items || []).map((s) => '<div class="item"><div class="t"><b>' + esc(s.name) + '</b><span>' + esc(s.category) + ' · ' + esc(s.desc) + '</span></div></div>').join('') || '<div class="sub">输入关键词搜索</div>'));
  const br = c.browser || {};
  html += sec('浏览器自动化', '<div class="sub">' + esc(JSON.stringify(br.data || {}).slice(0, 200)) + '</div>');
  const tm = c.terminal || {};
  html += sec('终端', '<div class="sub">' + esc(JSON.stringify(tm.data || {}).slice(0, 200)) + '</div>');
  box.innerHTML = html;
  const b = $('#btnCapsRefresh'); if (b) b.onclick = loadCapabilities;
  $$('[data-kbup]').forEach((btn) => {
    btn.onclick = async () => {
      const p = (SNAP?.cfg?.projects || [])[0];
      if (!p) { toast('先添加一个项目'); return; }
      const rf = await api.listTextFiles({ dir: p.dir });
      const items = (rf && rf.items) || [];
      if (!items.length) { toast('项目里没有文本文件'); return; }
      askName('上传哪个文件？（输入序号 1-' + items.length + '）', '1', async (v) => {
        const f = items[parseInt(v, 10) - 1];
        if (!f) { toast('序号不对'); return; }
        const rd = await api.readFile({ file: f.path, max: 200000 });
        if (!rd || !rd.ok) { toast('读取失败'); return; }
        const up = await api.octopKbUpload({ kbId: btn.dataset.kbup, name: f.name, content: rd.content, format: 'md' });
        toast(up && up.ok ? '已上传到知识库' : ('上传失败: ' + JSON.stringify((up && up.data) || {}).slice(0, 80)));
        loadCapabilities();
      });
    };
  });
  const go = $('#hubGo');
  if (go) go.onclick = async () => {
    const q = ($('#hubQ') || {}).value || 'SOP';
    box.innerHTML = '<div class="sub">搜索中…</div>';
    const c2 = await api.octopCapabilities({ search: q });
    // 直接重渲染
    loadCapabilitiesWith(c2);
  };
}

async function loadExperiences() {
  if (api.octopMemory) {
    const mem = await api.octopMemory();
    const sk = api.octopSkills ? await api.octopSkills() : { items: [] };
    const items = (mem && mem.items) || [];
    const skills = (sk && sk.items) || [];
    $('#expStats').innerHTML = '<span>经验候选 <b>' + items.length + '</b></span><span>技能 <b>' + skills.length + '</b></span>';
    const badge = function (s2) {
      if (s2 === 'approved' || s2 === 'promoted') return '<span class="badge ok">已入库</span>';
      if (s2 === 'rejected') return '<span class="badge err">已驳回</span>';
      return '<span class="badge run">待审</span>';
    };
    const perms = (ME && ME.permissions) || [];
    const canApprove = perms.indexOf('*') >= 0 || perms.indexOf('experience.approve') >= 0;
    $('#expList').innerHTML = items.map(function (e) {
      const title = String(e.title || '').slice(0, 60);
      let btns = '';
      if (canApprove && e.status === 'pending') {
        btns = '<span style="display:inline-flex;gap:6px;margin-top:8px">' +
          '<button class="mini" data-cand="' + e.id + '" data-act="promote">通过</button>' +
          '<button class="mini" data-cand="' + e.id + '" data-act="reject">驳回</button></span>';
      }
      return '<div class="item" style="align-items:flex-start"><div class="t"><b>' + esc(title) + '</b>' +
        '<span style="display:block;margin-top:4px;color:#6b7280">' + esc(e.kind || '') + '</span>' + btns +
        '</div>' + badge(e.status) + '</div>';
    }).join('') || '<div class="sub">还没有经验候选（Octop 会在对话后自动抽取）</div>';
    $('#expList').querySelectorAll('[data-cand]').forEach(function (b) {
      b.onclick = async function () {
        const r = await api.octopCandidateAction({ id: b.dataset.cand, action: b.dataset.act });
        toast(r && r.ok ? '已处理' : ('失败：' + ((r && r.error) || '')));
        loadExperiences();
      };
    });
    const rb = $('#btnRefreshExp');
    if (rb) rb.onclick = loadExperiences;
    return;
  }
}
async function loadSkills() {
  if (api.octopSkills) {
    const r = await api.octopSkills();
    const items = (r && r.items) || [];
    curSkills = items;
    $('#skillList').innerHTML = items.map(function (s) {
      return '<div class="item"><div class="t"><b>' + esc(s.name) + '</b><span>' + esc(s.desc || '') + '</span></div><span class="badge ok">已同步</span></div>';
    }).join('') || '<div class="sub">助理还没有技能</div>';
    return;
  }
  const r = await api.skills();
  curSkills = (r && r.data && r.data.items) || [];
  $('#skillList').innerHTML = curSkills.map(function (s) {
    return '<div class="item"><div class="t"><b>' + esc(s.name) + '</b><span>v' + (s.version || 1) + '</span></div><span class="badge ok">已同步</span></div>';
  }).join('') || '<div class="sub">还没有技能</div>';
}
async function refresh() {
  SNAP = await api.snapshot();
  renderConn(); renderHome(); renderProjects();
}
function fillSettings() {
  const m = (SNAP && SNAP.mcp) || {};
  const mu = $('#mcpUrl'); if (mu) mu.textContent = m.url || '（未启用）';
  const mo = $('#mcpOn'); if (mo) mo.checked = m.enabled !== false;
  const c = SNAP?.cfg || {};
  const co = $('#cfgOctop'); if (co) co.value = c.octopUrl || 'http://192.168.1.239:18090';
  const ow = $('#octopWho'); if (ow) ow.textContent = c.octopToken ? ('已登录：' + (c.employeeName || '未知') + (c.octopAgent ? '（助理 ' + c.octopAgent + '）' : '')) : '未登录';
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
let attachments = [];  // 本轮对话附带的本地文件
let pickedSkills = [];   // 本轮对话启用的技能

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
function newSessionObj(title) {
  const rid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));
  return { id: 's-' + rid, title: title || '新会话', msgs: [], createdAt: new Date().toISOString() };
}
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
// 轻量 Markdown 渲染（先转义，再按行解析：标题/加粗/行内码/代码块/列表/换行）
function md(src) {
  const esc0 = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = (s) => esc0(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  const lines = String(src || '').split('\n');
  let html = '', inCode = false, inList = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^```/.test(line)) {
      if (inCode) { html += '</code></pre>'; inCode = false; }
      else { if (inList) { html += '</ul>'; inList = false; } html += '<pre><code>'; inCode = true; }
      continue;
    }
    if (inCode) { html += esc0(line) + '\n'; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { if (inList) { html += '</ul>'; inList = false; } const lv = Math.min(h[1].length + 2, 5); html += '<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>'; continue; }
    const li = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + inline(li[2]) + '</li>'; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    if (/^\s*[-*_]{3,}\s*$/.test(line)) { html += '<hr/>'; continue; }
    if (!line.trim()) { html += '<div style="height:6px"></div>'; continue; }
    html += '<p>' + inline(line) + '</p>';
  }
  if (inCode) html += '</code></pre>';
  if (inList) html += '</ul>';
  return html;
}

function renderChat() {
  const s = getSession(); if (!s) return;
  const box = $('#chatBody');
  box.innerHTML = (s.msgs || []).map((m, i) => `<div class="msg ${m.role}">${m.role === 'ai' ? md(m.text) : esc(m.text)}${m.role === 'ai' ? `<span class="meta"><button class="mini" data-save="${i}">保存到项目</button>${m.meta ? ' · ' + esc(m.meta) : ''}</span>` : (m.role === 'sys' ? `data-file="${esc(m.file || '')}" data-out="${i}" style="cursor:pointer" title="点开看内容/输出"` : (m.meta ? `<span class="meta">${esc(m.meta)}</span>` : ''))}</div>`).join('');
  if (!s.msgs || !s.msgs.length) box.innerHTML = '<div class="msg ai">你好，我是团队 AI 助理。<br>直接说你要做什么——比如「把项目里的报价单整理成表」，我会在你本地文件夹里读写文件。</div>';
  box.querySelectorAll('[data-file]').forEach((el) => {
    el.onclick = () => {
      const f = el.dataset.file;
      if (f) return previewFile(f, el.textContent.replace(/^[✅❌]\s*/, ''));
      const idx = parseInt(el.dataset.out || '-1', 10);
      const m = idx >= 0 ? (s.msgs || [])[idx] : null;
      if (m && m.out) showText(el.textContent, m.out);
    };
  });
  box.querySelectorAll('[data-save]').forEach((el) => {
    el.onclick = async () => {
      const idx = parseInt(el.dataset.save, 10);
      const msg = (s.msgs || [])[idx]; if (!msg) return;
      const proj = (SNAP?.cfg?.projects || []).find((x) => x.id === ($('#chatProject') || {}).value);
      if (!proj) { toast('先选一个项目'); return; }
      const name = (s.title || '对话') + '-' + new Date().toISOString().slice(0, 10) + '.md';
      const r = await api.saveOutput({ dir: proj.dir, name, content: msg.text });
      toast(r && r.ok ? '已保存到 产出/' + name : '保存失败');
    };
  });
  box.scrollTop = box.scrollHeight;
  renderSessions();
}
async function sendChat() {
  const inp = $('#chatInput');
  const text = (inp.value || '').trim();
  if (!text) return;
  const s = getSession();          // 锁定本次发送所属会话
  const sid = s.id;
  inp.value = '';
  if (!s.msgs || !s.msgs.length) s.title = text.slice(0, 18);
  s.msgs.push({ role: 'user', text });
  saveSessions();
  renderChat();
  const box = $('#chatBody');
  const tip = document.createElement('div');
  tip.className = 'typing'; tip.textContent = '助理思考中…'; box.appendChild(tip); box.scrollTop = box.scrollHeight;
  const proj = $('#chatProject') ? $('#chatProject').value : '';
  const expert = $('#chatExpert') ? $('#chatExpert').value : '';
  let r;
  if (api.octopChat) {
    const res = await api.octopChat({ text, sessionId: sid, agentId: expert || undefined, skills: pickedSkills.slice() });
    r = res && res.ok ? { ok: true, data: { reply: res.reply, elapsed_ms: res.elapsed_ms } } : { ok: false, data: { error: (res && res.error) || '对话失败' } };
  } else {
    r = await api.chat(text, sid, attachments.slice(), proj, expert);
  }
  attachments = []; renderAttach();
  tip.remove();
  // 只写回发起这条消息的会话（即使中途切走了）
  if (r && r.ok) s.msgs.push({ role: 'ai', text: r.data.reply || '(空)', meta: (r.data.elapsed_ms || 0) + 'ms' });
  else s.msgs.push({ role: 'ai', text: '出错了：' + JSON.stringify((r && r.data) || {}).slice(0, 200) });
  saveSessions();
  renderChat();
}
function renderAttach() {
  const box = $('#chatAttach'); if (!box) return;
  box.innerHTML = attachments.map((f, i) => `<span class="chip">📎 <b>${esc(f.name)}</b><span data-rm="${i}">✕</span></span>`).join('');
  box.querySelectorAll('[data-rm]').forEach((el) => { el.onclick = () => { attachments.splice(parseInt(el.dataset.rm, 10), 1); renderAttach(); }; });
}
function bindChat() {
  if (!sessions.length) loadSessions();
  const nb = $('#btnNewChat');
  if (nb && !nb._bound) {
    nb._bound = true;
    nb.onclick = () => { sessions.unshift(newSessionObj('新会话')); curSession = sessions[0].id; saveSessions(); renderSessions(); renderChat(); const i = $('#chatInput'); if (i) i.focus(); };
  }
  // 专家库
  const exSel = $('#chatExpert');
  if (exSel && !exSel._loaded) {
    exSel._loaded = true;
    (async () => {
      const r = (api.octopExperts ? await api.octopExperts() : (api.experts ? await api.experts() : { ok: false }));
      const items = (r && (r.items || (r.data && r.data.items))) || [];
      exSel.innerHTML = '<option value="">默认助理</option>' +
        items.map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
      exSel.onchange = () => { pickedSkills = []; renderSkillCount(); loadSkillPicker(); };
    })();
  }
  const sel = $('#chatProject');
  const cfg = SNAP?.cfg || {};
  sel.innerHTML = (cfg.projects || []).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">（先添加项目）</option>';
  $('#chatSend').onclick = sendChat;
  const ba = $('#btnAttach');
  if (ba && !ba._bound) {
    ba._bound = true;
    ba.onclick = async () => {
      const p = (SNAP?.cfg?.projects || []).find((x) => x.id === ($('#chatProject') || {}).value);
      if (!p) { toast('先添加一个项目'); return; }
      const rf = await api.listTextFiles({ dir: p.dir });
      const items = (rf && rf.items) || [];
      if (!items.length) { toast('这个项目里没有可附带的文本文件'); return; }
      const names = items.map((f) => f.name);
      askName('附带哪个文件？（输入序号）', '1', (v) => {
        const idx = parseInt(v, 10) - 1;
        const f = items[idx];
        if (!f) { toast('序号不对'); return; }
        attachments.push({ name: f.name, path: f.path });
        renderAttach();
        toast('已附带：' + f.name + '（可选 ' + names.length + ' 个：' + names.slice(0, 5).join('、') + '）');
      });
      toast('可附带文件：' + names.slice(0, 6).join('、'));
    };
  }
  renderAttach();
  $('#chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  renderChat();
}
function bind() {
  bindModal();
  bindNameModal();
  bindBriefModal();
  bindPreviewModal();
  bindSkillsModal();
  bindLogin();
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
  const lo = $('#btnLogoutOctop');
  if (lo) lo.onclick = async () => { await api.octopLogout(); await refresh(); $('#loginModal').classList.add('show'); toast('已退出登录'); };
  const bo = $('#btnSaveOctop');
  if (bo) bo.onclick = async () => { await api.saveConfig({ octopUrl: $('#cfgOctop').value.trim() }); await refresh(); toast('Octop 地址已保存'); };
  $('#btnSaveConn').onclick = async () => {
    await api.saveConfig({ serverUrl: $('#cfgServer').value.trim(), apiKey: $('#cfgKey').value.trim(), employeeName: $('#cfgName').value.trim() });
    await api.heartbeat(); await refresh(); toast('连接设置已保存');
  };
  $('#btnPickRoot').onclick = async () => { const d = await api.pickFolder(); if (d) { $('#cfgRoot').value = d; await api.saveConfig({ projectRoot: d }); } };
  $('#btnSaveSec').onclick = async () => {
    await api.saveConfig({ allowCommand: $('#cfgAllowCmd').checked, cmdWhitelist: $('#cfgWhitelist').value.split(',').map((s) => s.trim()).filter(Boolean) });
    await refresh(); toast('安全设置已保存');
  };
  const mo = $('#mcpOn');
  if (mo) mo.onchange = async () => { const r = await api.mcpToggle(mo.checked); toast(r && r.ok ? (mo.checked ? 'MCP 已启用' : 'MCP 已关闭') : '操作失败'); await refresh(); };
  $('#btnSyncSkills').onclick = async () => { await api.heartbeat(); await loadSkills(); toast('技能已同步'); };
  $('#btnRunLocal').onclick = () => toast('本地执行：下一步接执行器');
  api.onTool && api.onTool((d) => {
    const s = getSession();
    if (!s || !s.msgs) return;
    const map = {
      local_list_dir: '📂 浏览目录', local_read_file: '📄 读取文件',
      local_write_file: '✍️ 写入文件', local_run_cmd: '⌨️ 执行命令',
    };
    const label = (map[d.tool] || d.tool) + (d.argsText ? ' · ' + String(d.argsText).split(/[\\/]/).pop() : '') + (d.ms != null ? ' · ' + d.ms + 'ms' : '');
    s.msgs.push({ role: 'sys', text: (d.ok ? '✅ ' : '❌ ') + label,
                  file: (d.tool === 'local_read_file' || d.tool === 'local_write_file') ? d.path : '',
                  out: d.outputPreview || '' });
    saveSessions(); renderChat();
  });
  api.onState && api.onState((d) => { SNAP = d; renderConn(); renderHome(); renderProjects(); });
  api.onLog && api.onLog((rec) => { if (SNAP?.state) { SNAP.state.log.unshift(rec); renderHome(); } });
  api.onGoto && api.onGoto((v) => go(v));
}
async function loadMe() {
  try {
    const r = await api.me ? await api.me() : null;
    if (r && r.ok) { ME = r.data; renderConn(); }
  } catch {}
}

(async function boot() {
  loadSessions();
  bind();
  await loadMe();
  await refresh();
  requireLogin();
  requireLogin();
  const h = (location.hash || '').replace('#', '');
  go(h || 'chat');
  if (location.search.includes('modal=1')) openTaskModal(location.search.includes('tpl=ledger') ? 'ledger' : (location.search.includes('tpl=bid') ? 'bid' : 'verify'));
  window.addEventListener('hashchange', () => go((location.hash || '').replace('#', '') || 'home'));
})();
