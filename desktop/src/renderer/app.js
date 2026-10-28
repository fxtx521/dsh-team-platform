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
  getPresets: async () => ({ presets: [{ id: "fast", name: "省钱" }, { id: "write", name: "写作" }, { id: "deep", name: "深度分析" }], active: "write" }),
  applyPreset: async () => ({ ok: true }),
  savePresets: async () => ({ ok: true }),
  usageSummary: async () => ({ ok: true, data: { window: "last_30d", total_tokens: 0, input_tokens: 0, output_tokens: 0, cache_hit_percent: 0, model_calls: 0, turns: 0, buckets: [] }, quota: { dailyTokens: 0, monthlyTokens: 0 } }),
  saveQuota: async () => ({ ok: true }),
  auditDays: async () => [new Date().toISOString().slice(0, 10)],
  auditList: async () => [],
  auditExport: async () => ({ ok: true, count: 0 }),
  uploadDocs: async () => ({ ok: true, results: [] }),
  pickFiles: async () => [],
  exportSession: async () => ({ ok: true, file: "preview.md" }),
  channelList: async () => ({ ok: true, list: [] }),
  channelAdd: async () => ({ ok: true }),
  channelRemove: async () => ({ ok: true }),
  guardCheck: async () => ({ blocked: false, block: [], warn: [] }),
  guardConfig: async () => ({ enabled: true, block: [], warn: [] }),
  guardSave: async () => ({ ok: true }),
  onNeedLogin: () => {},
  cronList: async () => ({ ok: true, list: [] }),
  cronCreate: async () => ({ ok: false, error: "预览模式" }),
  cronRemove: async () => ({ ok: false, error: "预览模式" }),
  cronRunNow: async () => ({ ok: false, error: "预览模式" }),
  memoryAtoms: async () => ({ ok: true, list: [] }),
  memoryCandidates: async () => ({ ok: true, list: [] }),
  memoryDecide: async () => ({ ok: false, error: "预览模式" }),
  teamsList: async () => ({ ok: true, list: [] }),
  teamsMembers: async () => [],
  teamsCreate: async () => ({ ok: false, error: "预览模式" }),
  teamsRemove: async () => ({ ok: false, error: "预览模式" }),
  updateCheck: async () => ({ ok: true, current: "preview", latest: "preview", hasUpdate: false }),
  updateDownload: async () => ({ ok: false, error: "预览模式不支持" }),
  updateApply: async () => ({ ok: false, error: "预览模式不支持" }),
  updateConfig: async () => ({ manifestUrl: "", baseUrl: "", mirror: "" }),
  updateSaveConfig: async () => ({ ok: true }),
  channelFeishuStart: async () => ({ ok: false, error: "预览模式" }),
  channelFeishuPoll: async () => ({ ok: true, data: {} }),
  channelFeishuStop: async () => ({ ok: true }),
  appVersion: async () => "preview",
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
  octopMemory: async () => ({ ok: true, items: [
    { id: 'c1', title: '客户核查先查工商再查涉诉', kind: 'Fact', status: 'pending' },
    { id: 'c2', title: '台账判重：同名+同金额+同日期', kind: 'Fact', status: 'approved' },
    { id: 'c3', title: '标书先出目录再填正文', kind: 'Episode', status: 'pending' },
  ] }),
  octopExperts: async () => ({ ok: true, items: [
    { id: 'general-assistant', name: '小通 · 通用助手', desc: '通用任务' },
    { id: 'business-operations', name: '业务流程专家', desc: 'SOP 与流程优化' },
    { id: 'ai-coding-coach', name: 'AI 编程实战导师', desc: '代码与工程' },
    { id: 'office-automation', name: '小办 · 办公自动化', desc: '文档表格批处理' },
    { id: 'design', name: '设计专家', desc: '设计评审与 UX' },
    { id: 'stock-assistant', name: '老钱 · 证券观察员', desc: '行情解读' },
  ] }),
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
  renderCtxChips();
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
  const pvA = $('#pvAttach');
  if (pvA) pvA.onclick = () => {
    const f = $('#pvBody').dataset.file;
    if (!f) { toast('这个内容没有本地文件'); return; }
    const name = f.split(/[\\/]/).pop();
    if (!attachments.some((x) => x.path === f)) attachments.push({ name, path: f });
    renderAttach();
    $('#previewModal').classList.remove('show');
    go('chat');
    toast('已附加到对话：' + name);
  };
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
    const remember = !!($('#lgRemember') || {}).checked;
    const r = (api.octopLogin ? await api.octopLogin(u, p, remember) : await api.login(u, p));
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
  $('#crumb').textContent = { home: '概览', chat: '对话', projects: '我的项目', tasks: '任务', experiences: '经验', capabilities: '诊断', knowledge: '知识库', expertspage: '专家广场', skills: '技能库', console: '终端', settings: '设置', usage: '用量', audit: '审计' }[view] || '';
  if (view === 'usage') loadUsage();
  if (view === 'audit') loadAudit();
  if (view === 'chat') bindChat();
  if (view === 'tasks') { loadTasks(); loadCron(); }
  if (view === 'experiences') { loadExperiences(); loadMemory(); }
  if (view === 'capabilities') loadCapabilities();
  if (view === 'home') renderHomeExperts();
  if (view === 'knowledge') { loadKnowledge(); loadKbDocs(); }
  if (view === 'expertspage') { loadExpertsPage(); loadTeams(); }
  if (view === 'skills') loadSkills();
  if (view === 'settings') { fillSettings(); loadProviders(); }
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
  const today = new Date().toISOString().slice(0, 10);
  let todayCount = 0, steps = 0;
  sessions.forEach(function (s) {
    const msgs = s.msgs || [];
    steps += msgs.filter(function (m) { return m.role === "sys"; }).length;
    const t = s.updatedAt || s.createdAt || "";
    if (t && String(t).slice(0, 10) === today) todayCount += 1;
  });
  const e1 = $("#stToday"), e2 = $("#stSkills"), e3 = $("#stProjects");
  if (e1) e1.textContent = todayCount;
  if (e2) e2.textContent = steps;
  if (e3) e3.textContent = (cfg.projects || []).length;
  const box = $("#logBox");
  if (box) box.innerHTML = (st.log || []).map(function (l) { return "<div>" + esc(new Date(l.t).toLocaleTimeString()) + " · " + esc(l.line) + "</div>"; }).join("") || "<div>暂无日志</div>";
  const list = $("#homeTasks");
  if (!list) return;
  const recent = sessions.slice(0, 5);
  list.innerHTML = recent.map(function (s) {
    const n = (s.msgs || []).length;
    return '<div class="item" data-open-session="' + esc(s.id) + '"><div class="t"><b>' + esc(s.title || "未命名会话") + '</b><span>消息 ' + n + '</span></div><span class="badge ok">继续</span></div>';
  }).join("") || '<div class="sub">还没有会话，点「新建任务」开始</div>';
  $$("[data-open-session]").forEach(function (el) {
    el.onclick = function () { curSession = el.dataset.openSession; saveSessions(); renderSessions(); renderChat(); go("chat"); };
  });
}
async function renderHomeExperts() {
  const box = $('#homeExperts');
  if (!box || !api.octopExperts) return;
  const r = await api.octopExperts();
  const items = ((r && r.items) || []).slice(0, 6);
  box.innerHTML = items.map(function (e) {
    return '<div class="expert-card"><b>' + esc(e.name) + '</b><button class="btn ghost" data-home-expert="' + esc(e.id) + '">开始对话</button></div>';
  }).join('') || '<div class="sub">没有专家</div>';
  $$('[data-home-expert]').forEach(function (b) {
    b.onclick = function () {
      const sel = $('#chatExpert');
      if (sel) { sel.value = b.dataset.homeExpert; pickedSkills = []; renderSkillCount(); }
      go('chat');
    };
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
  $$('[data-del]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); const pid = b.dataset.del; showConfirm('移除项目', '只会取消登记，不会删你的文件。', async () => { await api.removeProject(pid); await refresh(); toast('已移除'); }); });
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
  const box = $("#taskList");
  if (!box) return;
  let totalMsgs = 0, totalSteps = 0;
  const cards = sessions.map(function (s) {
    const msgs = s.msgs || [];
    const steps = msgs.filter(function (m) { return m.role === "sys"; });
    totalMsgs += msgs.length;
    totalSteps += steps.length;
    const t = s.updatedAt || s.createdAt || "";
    const when = t ? new Date(t).toLocaleString("zh-CN", { hour12: false }) : "";
    return '<div class="item" data-rec="' + esc(s.id) + '"><div class="t"><b>' + esc(s.title || "未命名会话") + '</b><span>' + esc(when) + " · 消息 " + msgs.length + " · 执行步骤 " + steps.length + '</span></div><span class="badge ok">本机</span></div>';
  }).join("");
  const hint = $("#taskHint");
  if (hint) hint.textContent = "会话 " + sessions.length + " · 消息 " + totalMsgs + " · 工具执行 " + totalSteps;
  box.innerHTML = cards || '<div class="sub">还没有记录，去「对话」干点活</div>';
  $$("[data-rec]").forEach(function (el) {
    el.onclick = function () {
      const s = sessions.find(function (x) { return x.id === el.dataset.rec; });
      if (!s) return;
      const steps = (s.msgs || []).filter(function (m) { return m.role === "sys"; });
      box.innerHTML = '<div class="sub" style="padding:6px 12px">会话：' + esc(s.title) + ' · 执行步骤 ' + steps.length + '</div>' +
        steps.map(function (m) { return '<div class="item"><div class="t"><b>' + esc(m.text) + '</b></div></div>'; }).join("") +
        '<div style="padding:8px 12px"><button class="btn ghost" id="btnBackRec">返回列表</button></div>';
      const back = $("#btnBackRec");
      if (back) back.onclick = loadTasks;
    };
  });
  loadArtifacts();
}

async function loadArtifacts() {
  const box = $("#artifactList");
  if (!box || !api.listTextFiles) return;
  const proj = (SNAP?.cfg?.projects || [])[0];
  if (!proj) { box.innerHTML = '<div class="sub">先添加一个项目</div>'; return; }
  const r = await api.listTextFiles({ dir: proj.dir + "/产出" });
  const items = (r && r.items) || [];
  box.innerHTML = items.slice(0, 50).map(function (f) {
    return '<div class="item" data-art="' + esc(f.path) + '"><div class="t"><b>' + esc(f.name) + '</b></div><span class="badge ok" data-art-reveal="' + esc(f.path) + '">在访达显示</span></div>';
  }).join("") || '<div class="sub">还没有产物</div>';
  $$("[data-art]").forEach(function (el) {
    el.onclick = function () { previewFile(el.dataset.art, el.textContent.trim()); };
  });
  $$("[data-art-reveal]").forEach(function (el) {
    el.onclick = function (e) { e.stopPropagation(); api.reveal(el.dataset.artReveal); };
  });
  const rb = $("#btnArtifactRefresh");
  if (rb) rb.onclick = loadArtifacts;
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
  html += sec('账号（' + (us.count || 0) + '）',
    (us.items || []).map((u) => '<div class="item"><div class="t"><b>' + esc(u.name || u.username) + '</b><span>' + esc(u.username) + '</span></div><span class="badge ok">' + esc(u.role) + '</span></div>').join('') || '<div class="sub">无</div>') +
    '<div style="margin-top:8px"><input id="nuName" placeholder="新账号用户名" style="border:1px solid #dfe3ea;border-radius:10px;padding:8px 10px;font-size:13px;width:200px" /> <button class="btn ghost" id="btnUserCreate">新建账号</button></div>';
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
  const bEnv = (c.browser && c.browser.data) || {};
  html += sec('浏览器',
    '<div class="sub">环境：' + esc(bs.environment || '-') + ' · 会话数 ' + (bs.count || 0) + '</div>' +
    '<div class="sub">' + (bEnv.browsers_ok ? 'Chromium 已就绪' : ('未安装：' + esc(bEnv.error || ''))) + '</div>' +
    (bEnv.browsers_ok ? '' : '<button class="btn ghost" id="btnBrowserInstall" style="margin-top:8px">安装浏览器运行时</button>'));
  const kb = c.knowledge || {};
  html += sec('知识库（' + (kb.count || 0) + '）',
    ((kb.items || []).map((k) => '<div class="item"><div class="t"><b>' + esc(k.name || k.id) + '</b><span>文档 ' + (k.docs || 0) + '</span></div><button class="mini" data-kbup="' + esc(k.id) + '">上传本地文件</button></div>').join('') || '<div class="sub">还没有知识库</div>') +
    '<div class="sub" style="margin-top:6px">能力状态：' + (kb.usable ? '可用' : '未启用（需要先在 Octop 里配置向量模型）') + '</div>');
  const subs = c.subagents || {};
  html += sec('子代理（' + (subs.count || 0) + '）',
    (subs.sample || []).slice(0, 8).map((s) => '<div class="item"><div class="t"><b>' + esc(s.name || s.slug) + '</b><span>' + esc(s.div || '') + '</span></div></div>').join('') || '<div class="sub">无</div>');
  const ug = c.usage || {};
  const ud = ug.data || {};
  html += sec('用量统计（近 30 天）',
    '<div class="sub">总 tokens ' + (ud.total || 0).toLocaleString() + ' · 输入 ' + (ud.input || 0).toLocaleString() +
    ' · 输出 ' + (ud.output || 0).toLocaleString() + '</div>' +
    '<div class="sub">模型调用 ' + (ud.calls || 0) + ' 次 · 对话轮次 ' + (ud.turns || 0) + ' · 缓存命中 ' + (ud.cache_hit || 0) + '%</div>');
  const mo = c.models || {};
  html += sec('当前模型',
    '<div class="sub">' + esc(((mo.active || {}).provider_name || '-') + ' / ' + ((mo.active || {}).model || '-')) + '</div>' +
    '<div style="display:flex;gap:8px;margin-top:8px"><select id="modelSel" style="border:1px solid #dfe3ea;border-radius:10px;padding:8px 10px;font-size:13px;min-width:260px">' +
    ((mo.items || []).map((m) => '<option value="' + esc(m.provider + '|' + m.model) + '">' + esc(m.name) + '</option>').join('')) +
    '</select><button class="btn ghost" id="btnSetModel">切换模型</button></div>');
  const prov = c.providers || {};
  html += sec('模型供应商', (prov.items || []).map((p) => '<div class="item"><div class="t"><b>' + esc(p.name || p.id) + '</b></div>' + (p.active ? '<span class="badge ok">使用中</span>' : '') + '</div>').join('') || '<div class="sub">无</div>');
  const ch = c.channels || {};
  html += sec('渠道（当前助理）',
    ((ch.items || []).map((x) => '<div class="item"><div class="t"><b>' + esc(x.name || x.kind) + '</b><span>' + esc(x.kind) + '</span></div>' +
      '<button class="mini" data-chtest="' + esc(x.id) + '">测试</button> <button class="mini" data-chdel="' + esc(x.id) + '">删除</button></div>').join('') || '<div class="sub">还没有渠道</div>') +
    '<div style="margin-top:8px"><input id="chKind" placeholder="类型：feishu / wecom / weixin / dingtalk" style="border:1px solid #dfe3ea;border-radius:10px;padding:8px 10px;font-size:13px;width:260px" /> <button class="btn ghost" id="btnChCreate">新建渠道</button></div>' +
    '<div class="sub" style="margin-top:6px">渠道需要凭证（如飞书 app_id/app_secret），创建后在 Octop 控制台补凭证即可连通。</div>');
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
  const cc2 = $('#btnChCreate');
  if (cc2) cc2.onclick = async () => {
    const kind = ($('#chKind') || {}).value || 'feishu';
    const r = await api.octopChannelCreate({ kind, name: kind });
    toast(r && r.ok ? ('已创建渠道: ' + kind) : ('创建失败: ' + ((r && r.error) || '')));
    loadCapabilities();
  };
  $$('[data-chtest]').forEach((b) => b.onclick = async () => {
    const r = await api.octopChannelTest({ id: b.dataset.chtest });
    toast(r && r.ok ? '测试请求已发出' : ('测试失败: ' + ((r && r.error) || '')));
  });
  $$('[data-chdel]').forEach((b) => b.onclick = async () => {
    await api.octopChannelDelete({ id: b.dataset.chdel });
    toast('已删除渠道'); loadCapabilities();
  });
  const uc = $('#btnUserCreate');
  if (uc) uc.onclick = async () => {
    const un = ($('#nuName') || {}).value;
    if (!un) { toast('请填用户名'); return; }
    const r = await api.octopUserCreate({ username: un, password: 'Init-' + Math.random().toString(36).slice(2, 10), role: 'user' });
    toast(r && r.ok ? ('已创建账号: ' + un) : ('创建失败: ' + ((r && r.error) || '')));
    loadCapabilities();
  };
  const bsm = $('#btnSetModel');
  if (bsm) bsm.onclick = async () => {
    const v = ($('#modelSel') || {}).value || '';
    const [provider, model] = v.split('|');
    const r = await api.octopSetActiveModel({ provider, model });
    toast(r && r.ok ? ('已切换模型: ' + model) : '切换失败');
    loadCapabilities();
  };
  $$('[data-sample]').forEach(function (b) {
    b.onclick = function () {
      const i = $('#chatInput');
      if (i) { i.value = b.dataset.sample; i.focus(); }
    };
  });
  const kbc = $('#btnConsoleClear');
  if (kbc) kbc.onclick = function () { const o = $('#consoleOut'); if (o) o.textContent = ''; };
  const cmdEl = $('#consoleCmd');
  if (cmdEl) {
    cmdEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp') { e.preventDefault(); if (cmdHistory.length) { histIdx = Math.max(0, Math.min(histIdx - 1, cmdHistory.length - 1)); cmdEl.value = cmdHistory[histIdx] || ''; } }
      if (e.key === 'ArrowDown') { e.preventDefault(); if (cmdHistory.length) { histIdx = Math.min(histIdx + 1, cmdHistory.length); cmdEl.value = cmdHistory[histIdx] || ''; } }
    });
  }
  const dz = document.querySelector('.chat-card');
  if (dz && !dz._dropBound) {
    dz._dropBound = true;
    dz.addEventListener('dragover', function (e) { e.preventDefault(); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault();
      const files = Array.prototype.slice.call(e.dataTransfer.files || []);
      let added = 0;
      files.forEach(function (f) {
        const p = api.filePathOf ? api.filePathOf(f) : '';
        if (!p) return;
        if (!attachments.some(function (x) { return x.path === p; })) { attachments.push({ name: f.name, path: p }); added += 1; }
      });
      renderAttach();
      if (added) toast('已拖入 ' + added + ' 个文件');
    });
  }
  const cs = $('#chatSearch');
  if (cs) cs.addEventListener('input', renderSessions);
  const kbBtn = $('#btnKbPick');
  if (kbBtn) kbBtn.onclick = async () => {
    const r = await api.octopKbList();
    const items = (r && r.items) || [];
    if (!items.length) { toast('还没有知识库，先去「知识库」页建一个'); return; }
    const list = items.map((k, i) => (i + 1) + '. ' + k.name).join('\n');
    askName('选知识库（序号，可逗号多选）\n' + list, '1', async (v) => {
      const ids = String(v || '').split(/[,，\s]+/).filter(Boolean).map((x) => items[parseInt(x, 10) - 1]).filter(Boolean).map((k) => k.id);
      pickedKbs = ids;
      const el = $('#kbCount'); if (el) el.textContent = String(ids.length);
      renderCtxChips();
      toast(ids.length ? ('已引用 ' + ids.length + ' 个知识库') : '未选择');
    });
  };
  const bi = $('#btnBrowserInstall');
  if (bi) bi.onclick = async () => {
    bi.textContent = '安装中…（几分钟）';
    const r = await api.octopBrowserInstall();
    toast(r && r.ok ? '已在服务端开始安装 Chromium，稍后刷新查看' : '安装请求失败');
    setTimeout(loadCapabilities, 5000);
  };
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

// ── 知识库页 ─────────────────────────────
let curKbId = "";

// ── 右侧上下文面板 ─────────────────────────
let ctxTab = "files";



let confirmCb = null;
function showConfirm(title, text, cb) {
  const m = $("#confirmModal");
  if (!m) { if (cb) cb(); return; }
  const t = $("#cfTitle"), b = $("#cfText");
  if (t) t.textContent = title || "确认";
  if (b) b.textContent = text || "确定吗？";
  confirmCb = cb || null;
  m.classList.add("show");
}
function bindConfirmModal() {
  const close = () => { $("#confirmModal").classList.remove("show"); confirmCb = null; };
  const ok = $("#cfOk"), cancel = $("#cfCancel");
  if (cancel) cancel.onclick = close;
  if (ok) ok.onclick = () => { const cb = confirmCb; close(); if (cb) cb(); };
}


// ── 用量与配额 ──────────────────────────────────────────
let usageRange = 'last_30d';
async function loadUsage() {
  const cards = $('#usageCards'); if (!cards) return;
  cards.innerHTML = '<div class="sub">加载中…</div>';
  const r = await api.usageSummary2({ window: usageRange });
  const d = (r && r.data) || {};
  const q = (r && r.quota) || {};
  const agents = (r && r.agents) || [];
  const models = (r && r.models) || [];
  const days = ((r && r.days) || []).slice().sort((a, b) => String(a.key || "").localeCompare(String(b.key || "")));
  const total = Number(d.total_tokens || 0);
  const today = days.length ? Number((days[days.length - 1] || {}).total_tokens || 0) : 0;
  if (!r || !r.ok) {
    const msg = '<div class="sub">' + esc((r && r.error) || '取不到用量数据') + '</div>';
    ['#usageCards', '#usageBudget', '#usageAgents', '#usageModels', '#usageDays'].forEach((sel) => { const el = $(sel); if (el) el.innerHTML = msg; });
    return;
  }
  const card = (k, v, s) => '<div class="usage-card"><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>';
  cards.innerHTML = [
    card('本周期 token', fmtNum(total), '入 ' + fmtNum(d.input_tokens) + ' / 出 ' + fmtNum(d.output_tokens)),
    card('最近一天', fmtNum(today), days.length ? esc(String(days[days.length - 1].label || '')) : ''),
    card('模型调用', fmtNum(d.model_calls), fmtNum(d.turns) + ' 轮对话'),
    card('每轮平均', fmtNum(d.avg_per_turn), 'token/轮'),
    card('缓存命中', d.cache_hit_percent != null ? (Number(d.cache_hit_percent).toFixed(0) + '%') : '—', '命中越多越省钱'),
  ].join('');
  const monthly = Number(q.monthlyTokens || 0);
  const dailyQuota = Number(q.dailyTokens || 0);
  const monthSpent = Number((r && r.monthTotal) || (d.total_tokens || 0));
  const bBox = $('#usageBudget');
  if (bBox) {
    if (monthly > 0) {
      const pct = Math.round((monthSpent / monthly) * 100);
      const cls = pct >= 100 ? 'danger' : (pct >= 80 ? 'warn' : '');
      const msg = pct >= 100 ? '已超本月额度' : (pct >= 80 ? '已用超八成，注意节奏' : '还在安全区间');
      bBox.innerHTML = '<div style="display:flex;justify-content:space-between;font-size:13px"><b>本月额度（固定近 30 天口径，与上方周期无关）</b><span>' + fmtNum(monthSpent) + ' / ' + fmtNum(monthly) + '（' + pct + '%）</span></div>'
        + '<div class="usage-bar"><i class="' + cls + '" style="width:' + pct + '%"></i></div>'
        + '<div class="sub">' + msg + (dailyQuota > 0 ? '；每日额度 ' + fmtNum(dailyQuota) + '，最近一天用了 ' + Math.round((today / dailyQuota) * 100) + '%' : '') + '；额度在下方设置，提醒不阻断发送</div>';
    } else {
      bBox.innerHTML = '<div class="sub">还没设本月额度，下方填一个数字就能看到进度条</div>';
    }
  }
  const aBox = $('#usageAgents');
  if (aBox) {
    const all = agents.filter((x) => Number(x.total_tokens || 0) > 0).slice().sort((a, b) => Number(b.total_tokens || 0) - Number(a.total_tokens || 0));
    const list = all.slice(0, 5);
    const restTokens = all.slice(5).reduce((s, x) => s + Number(x.total_tokens || 0), 0);
    if (restTokens > 0) list.push({ label: "其他 " + (all.length - 5) + " 个", total_tokens: restTokens });
    const max = list.length ? Number(list[0].total_tokens || 1) : 1;
    aBox.innerHTML = list.length ? list.map((x) => {
      const v = Number(x.total_tokens || 0);
      const w = Math.max(2, Math.round((v / max) * 100));
      return '<div class="usage-rank"><div class="nm">' + esc(String(x.label || x.key || '未知')) + '</div><div class="track"><i style="width:' + w + '%"></i></div><div class="num">' + fmtNum(v) + ' · ' + Math.round((v / total) * 100) + '%</div></div>';
    }).join('') : '<div class="sub">这个周期还没有助理消耗</div>';
  }
  const mBox = $('#usageModels');
  if (mBox) {
    const list = models.filter((x) => Number(x.total_tokens || 0) > 0).sort((a, b) => Number(b.total_tokens || 0) - Number(a.total_tokens || 0));
    const max = list.length ? Number(list[0].total_tokens || 1) : 1;
    mBox.innerHTML = '<div class="sub" style="margin-bottom:8px">模型分布</div>' + (list.length ? list.map((x) => {
      const v = Number(x.total_tokens || 0);
      return '<div class="usage-rank"><div class="nm">' + esc(String(x.label || x.key || '')) + '</div><div class="track"><i style="width:' + Math.max(2, Math.round((v / max) * 100)) + '%"></i></div><div class="num">' + fmtNum(v) + ' · ' + Math.round((v / (total || 1)) * 100) + '%</div></div>';
    }).join('') : '<div class="sub">无数据</div>');
  }
  const dBox = $('#usageDays');
  if (dBox) {
    const byKey = new Map(days.map((x) => [String(x.key || ''), x]));
    const filled = [];
    if (days.length) {
      const lastKey = String(days[days.length - 1].key || '');
      const startMs = new Date(lastKey + 'T00:00:00Z').getTime() - 13 * 86400000;
      for (let i = 0; i < 14; i += 1) {
        const k = new Date(startMs + i * 86400000).toISOString().slice(0, 10);
        filled.push(byKey.get(k) || { key: k, label: k, total_tokens: 0 });
      }
    }
    const series = filled;
    const max = series.length ? Math.max.apply(null, series.map((x) => Number(x.total_tokens || 0))) : 1;
    dBox.innerHTML = '<div class="sub" style="margin-bottom:8px">每日趋势（最近 ' + series.length + ' 天）</div>'
      + (series.length ? '<div class="usage-spark">' + series.map((x) => {
        const v = Number(x.total_tokens || 0);
        const h = Math.max(3, Math.round((v / (max || 1)) * 100));
        return '<i style="height:' + h + '%" title="' + esc(String(x.label || '')) + ' ' + fmtNum(v) + '"></i>';
      }).join('') + '</div>' : '<div class="sub">无数据</div>');
  }
  if ($('#quotaDaily')) $('#quotaDaily').value = Number(q.dailyTokens || 0) || '';
  if ($('#quotaMonthly')) $('#quotaMonthly').value = monthly || '';
}

function fmtNum(n) {
  const v = Number(n) || 0;
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(v);
}

// ── 审计 ────────────────────────────────────────────────
async function loadAudit(day) {
  const box = $("#auditList"); if (!box) return;
  const days = await api.auditDays();
  const sel = $("#auditDay");
  if (sel && days.length) {
    const cur = day || sel.value || days[0];
    sel.innerHTML = days.map((d) => "<option value=\"" + d + "\"" + (d === cur ? " selected" : "") + ">" + d + "</option>").join("");
  }
  const target = day || (sel && sel.value) || "";
  const rows = await api.auditList(target);
  if (!rows.length) { box.innerHTML = '<div class="sub">这一天还没有记录</div>'; return; }
  box.innerHTML = rows.slice().reverse().map((r) => {
    const t = (() => { try { return new Date(r.ts).toLocaleTimeString("zh-CN", { hour12: false }); } catch { return String(r.ts || "").slice(11, 19); } })();
    const icon = r.ok ? "✅" : "❌";
    return "<div class=\"row\"><b>" + esc(t) + " " + esc(r.kind || "") + "</b><span>" + icon + " " + esc(r.action || "") + (r.detail ? " · " + esc(String(r.detail).slice(0, 80)) : "") + (r.ms ? " · " + r.ms + "ms" : "") + "</span></div>";
  }).join("");
}


function applyTheme(theme) {
  const dark = theme === "dark";
  document.body.classList.toggle("dark", dark);
  const cb = $("#cfgDark");
  if (cb) cb.checked = dark;
}


async function loadChannels() {
  const box = $("#channelList"); if (!box) return;
  const r = await api.channelList();
  const list = (r && r.list) || [];
  if (!r || !r.ok) { box.innerHTML = '<div class="sub">' + esc((r && r.error) || "取不到渠道列表") + "</div>"; return; }
  if (!list.length) { box.innerHTML = '<div class="sub">还没有接入任何渠道</div>'; return; }
  box.innerHTML = list.map((c) => {
    const id = c.id || c.channel_id || "";
    const name = c.name || c.channel_type || c.type || "渠道";
    const on = c.enabled === false ? "已停用" : "已启用";
    return '<div class="row"><b>' + esc(String(name)) + '</b><span>' + esc(on) + ' <button class="mini" data-chdel="' + esc(String(id)) + '">删除</button></span></div>';
  }).join("");
  box.querySelectorAll("[data-chdel]").forEach((el) => {
    el.onclick = async () => {
      const ok = await api.channelRemove(el.dataset.chdel);
      toast(ok && ok.ok ? "已删除" : "删除失败");
      loadChannels();
    };
  });
}


// ── 专家团（官方 /api/teams）─────────────────────────────
async function loadTeams() {
  const box = $("#teamList"); if (!box) return;
  const sel = $("#teamMembers");
  if (sel && !sel.options.length) {
    const members = await api.teamsMembers();
    sel.innerHTML = (members || []).map((a) => '<option value="' + esc(a.id) + '">' + esc(a.name) + "</option>").join("");
    sel.size = Math.min(4, Math.max(2, (members || []).length));
  }
  const r = await api.teamsList();
  if (!r || !r.ok) { box.innerHTML = '<div class="sub">' + esc((r && r.error) || "取不到团队") + "</div>"; return; }
  const list = r.list || [];
  if (!list.length) { box.innerHTML = '<div class="sub">还没有专家团，选两个人建一个试试</div>'; return; }
  box.innerHTML = list.map((t) => {
    const id = t.id || t.team_id || "";
    const members = t.member_ids || t.members || t.agent_ids || [];
    return '<div class="row"><b>' + esc(String(t.name || "未命名团")) + "</b><span>" + members.length + " 人 · " + esc(String(t.state || t.status || "可用")) + ' <button class="mini" data-teamuse="' + esc(String(id)) + '">派活</button><button class="mini" data-teamdel="' + esc(String(id)) + '">解散</button></span></div>';
  }).join("");
  box.querySelectorAll("[data-teamuse]").forEach((el) => {
    el.onclick = async () => {
      if (window.__reloadExpertOptions) { try { await window.__reloadExpertOptions(); } catch {} }
      go("chat");
      const sel = $("#chatExpert");
      const tid = el.dataset.teamuse;
      if (sel) {
        if (!Array.prototype.some.call(sel.options, (o) => o.value === tid) && window.__reloadExpertOptions) {
          try { await window.__reloadExpertOptions(); } catch {}
        }
        sel.value = tid;
        if (sel.value !== tid) { toast("团队选项还没刷新，再点一次「派活」"); return; }
        pickedSkills = []; renderSkillCount();
      }
      const inp = $("#chatInput");
      if (inp && !inp.value) inp.value = "请团队分工完成：";
      toast("已选中这个团，把目标写清楚再发");
    };
  });
  box.querySelectorAll("[data-teamdel]").forEach((el) => {
    el.onclick = () => {
      showConfirm('解散专家团', '解散后成员之间不再协作，配置不能恢复。', async () => {
        const r2 = await api.teamsRemove(el.dataset.teamdel);
        toast(r2 && r2.ok ? "已解散" : "解散失败");
        loadTeams();
      });
    };
  });
}


// ── 定时任务（官方 cron）──────────────────────────────────
async function loadCron() {
  const box = $("#cronList"); if (!box) return;
  const r = await api.cronList();
  if (!r || !r.ok) { box.innerHTML = '<div class="sub">' + esc((r && r.error) || "取不到定时任务") + "</div>"; return; }
  const list = r.list || [];
  if (!list.length) { box.innerHTML = '<div class="sub">还没有定时任务</div>'; return; }
  box.innerHTML = list.map((j) => {
    const id = j.id || j.job_id || "";
    const trig = String(j.trigger || "").replace(/^cron:/, "");
    const on = j.enabled === false ? "已停用" : "启用中";
    const next = j.next_run_at ? " · 下次 " + esc(fmtLocal(j.next_run_at)) : "";
    return '<div class="row"><b>' + esc(String(j.name || j.prompt || "任务").slice(0, 24)) + "</b><span>" + esc(trig) + " · " + on + next + ' <button class="mini" data-crontoggle="' + esc(String(id)) + '" data-on="' + (j.enabled === false ? "0" : "1") + '">' + (j.enabled === false ? "启用" : "停用") + '</button><button class="mini" data-cronrun="' + esc(String(id)) + '">立即跑</button><button class="mini" data-crondel="' + esc(String(id)) + '">删除</button></span></div>';
  }).join("");
  box.querySelectorAll("[data-crondel]").forEach((el) => {
    el.onclick = async () => {
      const r2 = await api.cronRemove(el.dataset.crondel);
      toast(r2 && r2.ok ? "已删除" : "删除失败");
      loadCron();
    };
  });
  box.querySelectorAll("[data-crontoggle]").forEach((el) => {
    el.onclick = async () => {
      const enable = el.dataset.on !== "1";
      const r2 = await api.cronSetEnabled({ id: el.dataset.crontoggle, enabled: enable });
      toast(r2 && r2.ok ? (enable ? "已启用" : "已停用") : "操作失败");
      loadCron();
    };
  });
  box.querySelectorAll("[data-cronrun]").forEach((el) => {
    el.onclick = async () => {
      const r2 = await api.cronRunNow(el.dataset.cronrun);
      toast(r2 && r2.ok ? "已触发，结果稍后到" : "触发失败");
    };
  });
}



// ── 全局搜索（会话 + 项目文件 + 知识库）──────────────────
function bindSearchMask() {
  const m = $("#searchModal");
  if (m && !m._maskBound) {
    m._maskBound = true;
    m.addEventListener("click", (e) => { if (e.target === m) closeGlobalSearch(); });
  }
}
async function openGlobalSearch() {
  const m = $("#searchModal"); if (!m) return;
  window.__gsSeq = (window.__gsSeq || 0) + 1;
  bindSearchMask();
  m.classList.remove("hidden");
  const inp = $("#searchInput"); if (inp) { inp.value = ""; inp.focus(); }
  const box = $("#searchResults"); if (box) box.innerHTML = '<div class="sub">输入至少两个字开始搜</div>';
}
function closeGlobalSearch() { window.__gsSeq = (window.__gsSeq || 0) + 1; const m = $("#searchModal"); if (m) m.classList.add("hidden"); }
async function runGlobalSearch() {
  const box = $("#searchResults"); const inp = $("#searchInput");
  if (!box || !inp) return;
  const q = inp.value.trim();
  if (q.length < 2) { window.__gsSeq = (window.__gsSeq || 0) + 1; box.innerHTML = '<div class="sub">输入至少两个字开始搜</div>'; return; }
  const seq = (window.__gsSeq = (window.__gsSeq || 0) + 1);
  box.innerHTML = '<div class="sub">搜索中…</div>';
  const lq = q.toLowerCase();
  const sHits = [];
  for (const s of sessions) {
    const titleHit = String(s.title || "").toLowerCase().includes(lq);
    const msgHit = (s.messages || []).find((m) => m.role === "user" && String(m.text || "").toLowerCase().includes(lq));
    if (titleHit || msgHit) sHits.push({ id: s.id, title: s.title || "未命名会话", snippet: msgHit ? String(msgHit.text).slice(0, 60) : "" });
    if (sHits.length >= 20) break;
  }
  const [fres, kres] = await Promise.all([api.searchFiles(q), api.searchKb(q)]);
  if (seq !== window.__gsSeq) return;
  const fHits = (fres && fres.list) || [];
  const kHits = (kres && kres.list) || [];
  const parts = [];
  if (sHits.length) parts.push('<div class="sub" style="margin:6px 0 4px">会话</div>' + sHits.map((s) => '<div class="row"><b>' + esc(s.title) + "</b><span>" + esc(s.snippet) + ' <button class="mini" data-gs-session="' + esc(s.id) + '">打开</button></span></div>').join(""));
  if (fHits.length) parts.push('<div class="sub" style="margin:6px 0 4px">项目文件</div>' + fHits.map((f) => '<div class="row"><b>' + esc(f.name) + "</b><span>" + esc(String(f.path)) + ' <button class="mini" data-gs-file="' + esc(f.path) + '">打开</button></span></div>').join(""));
  if (kHits.length) parts.push('<div class="sub" style="margin:6px 0 4px">知识库文档</div>' + kHits.map((d) => '<div class="row"><b>' + esc(d.name) + "</b><span>" + esc(d.kbName) + ' <button class="mini" data-gs-kb="' + esc(d.kbId) + '" data-gs-doc="' + esc(String(d.docId || "")) + '">查看</button></span></div>').join(""));
  box.innerHTML = parts.join("") || '<div class="sub">没有找到相关结果</div>';
  box.querySelectorAll("[data-gs-session]").forEach((el) => { el.onclick = () => { curSession = el.dataset.gsSession; renderSessions(); renderChat(); closeGlobalSearch(); go("chat"); }; });
  box.querySelectorAll("[data-gs-file]").forEach((el) => { el.onclick = async () => { const r = await api.openPath(el.dataset.gsFile); toast(r && r.ok ? "已打开" : "打开失败"); }; });
  box.querySelectorAll("[data-gs-kb]").forEach((el) => { el.onclick = () => { curKbId = el.dataset.gsKb; window.__kbHighlight = el.dataset.gsDoc || ""; closeGlobalSearch(); go("knowledge"); }; });
}

function fmtLocal(v) {
  if (!v) return "";
  try { return new Date(v).toLocaleString("zh-CN", { hour12: false }); } catch { return String(v).slice(0, 19).replace("T", " "); }
}

// ── 云端记忆（官方 memory）────────────────────────────────
async function loadMemory() {
  const aBox = $("#memAtoms");
  const cBox = $("#memCandidates");
  if (aBox) {
    const r = await api.memoryAtoms({ limit: 30 });
    const list = (r && r.list) || [];
    aBox.innerHTML = !r || !r.ok
      ? '<div class="sub">' + esc((r && r.error) || "取不到云端记忆") + "</div>"
      : (list.length ? list.map((m) => '<div class="row"><b>' + esc(String(m.assertion || "").slice(0, 60)) + "</b><span>" + esc(fmtLocal(m.occurred_at)) + "</span></div>").join("") : '<div class="sub">云端还没有沉淀的记忆</div>');
  }
  if (cBox) {
    const r = await api.memoryCandidates({ limit: 30, status: "pending" });
    const list = (r && r.list) || [];
    cBox.innerHTML = !r || !r.ok
      ? '<div class="sub">' + esc((r && r.error) || "取不到候选") + "</div>"
      : (list.length ? list.map((m) => '<div class="row"><b>' + esc(String(m.assertion || m.title || "").slice(0, 60)) + '</b><span><button class="mini" data-memok="' + esc(m.id) + '">采纳</button><button class="mini" data-memno="' + esc(m.id) + '">忽略</button></span></div>').join("") : '<div class="sub">没有待定候选</div>');
    cBox.querySelectorAll("[data-memok]").forEach((el) => {
      el.onclick = () => {
        showConfirm('采纳这条记忆', '采纳后会进入云端长期记忆，之后对话会用到它。', async () => {
          el.disabled = true;
          const r2 = await api.memoryDecide({ id: el.dataset.memok, action: "promote" });
          toast(r2 && r2.ok ? "已采纳" : "操作失败");
          loadMemory();
        });
      };
    });
    cBox.querySelectorAll("[data-memno]").forEach((el) => {
      el.onclick = async () => { const r2 = await api.memoryDecide({ id: el.dataset.memno, action: "reject" }); toast(r2 && r2.ok ? "已忽略" : "操作失败"); loadMemory(); };
    });
  }
}


// ── 技能市场 ─────────────────────────────────────────────
async function searchHub() {
  const box = $("#hubList"); if (!box) return;
  const q = (($("#hubQuery") || {}).value || "").trim();
  box.innerHTML = '<div class="sub">搜索中…</div>';
  const r = await api.skillhubSearch(q);
  if (!r || !r.ok) { box.innerHTML = '<div class="sub">' + esc((r && r.error) || "搜索失败") + "</div>"; return; }
  const list = r.list || [];
  if (!list.length) { box.innerHTML = '<div class="sub">没搜到，换个关键词</div>'; return; }
  box.innerHTML = list.slice(0, 30).map((s) => {
    const slug = s.slug || s.name || "";
    const desc = String(s.description || "").slice(0, 60);
    return '<div class="row"><b>' + esc(String(s.displayName || s.display_name || s.name || slug)) + "</b><span>" + esc(desc) + ' <button class="mini" data-hubinstall="' + esc(String(slug)) + '">安装</button></span></div>';
  }).join("");
  box.querySelectorAll("[data-hubinstall]").forEach((el) => {
    el.onclick = () => {
      showConfirm("安装技能", "会把技能装到云端并共享给当前助理。", async () => {
        el.disabled = true;
        const r2 = await api.skillhubInstall({ slug: el.dataset.hubinstall });
        toast(r2 && r2.ok ? "已安装" : ("安装失败：" + ((r2 && r2.error) || "").slice(0, 80)));
        if (r2 && r2.ok) loadSkills();
      });
    };
  });
}

// ── 模型供应商 ───────────────────────────────────────────
async function loadProviders() {
  const box = $("#provList"); if (!box) return;
  const r = await api.providersList();
  if (!r || !r.ok) { box.innerHTML = '<div class="sub">' + esc((r && r.error) || "取不到供应商") + "</div>"; return; }
  const active = await api.providersActive();
  const cur = (active && active.data) || {};
  const list = r.list || [];
  if (!list.length) { box.innerHTML = '<div class="sub">云端没有配置供应商</div>'; return; }
  box.innerHTML = list.map((p) => {
    const opts = (p.models || []).map((m) => '<option value="' + esc(p.name + "|" + m.id) + '"' + (cur.provider_name === p.name && cur.model === m.id ? " selected" : "") + ">" + esc(m.name) + "</option>").join("");
    return '<div class="row"><b>' + esc(p.name) + " · " + esc(p.kind || "") + "</b><span>" + esc(p.keyMasked || "未填密钥") + ' <select class="inp" style="max-width:220px" data-prov="' + esc(p.name) + '">' + opts + '</select></span></div>';
  }).join("");
  box.querySelectorAll("[data-prov]").forEach((sel) => {
    sel.onchange = async () => {
      const parts = String(sel.value).split("|");
      const rr = await api.providersSetActive({ providerName: parts[0], model: parts.slice(1).join("|") });
      toast(rr && rr.ok ? "已切换模型" : "切换失败");
    };
  });
}

function friendlyError(raw) {
  const s = String(raw || "");
  if (!s) return "出了点问题，再试一次";
  if (/unauthor|401|token/i.test(s)) return "登录已过期，请重新登录";
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network|fetch failed/i.test(s)) return "连不上云端（检查网络或 Octop 地址）";
  if (/not running/i.test(s)) return "助理还没启动，稍等几秒再试";
  if (/skill\(s\) not found|disabled/i.test(s)) return "选的技能不可用，换一个试试";
  if (/model/i.test(s) && /fail/i.test(s)) return "模型调用失败，换个模型或稍后再试";
  if (/timeout|超时/i.test(s)) return "这次等的太久，任务可能还在跑，稍后看结果";
  const cut = s.replace(/\{"detail".*$/s, "").replace(/\s+/g, " ").slice(0, 80);
  return "出错了：" + cut;
}

function renderCtxChips() {
  const box = $("#chatCtxChips");
  if (!box) return;
  const chips = [];
  pickedSkills.forEach(function (s) {
    chips.push({ kind: "skill", id: s, label: "技能：" + s });
  });
  pickedKbs.forEach(function (k) {
    chips.push({ kind: "kb", id: k, label: "知识库：" + k });
  });
  box.innerHTML = chips.map(function (c) {
    return '<span class="ctxchip">' + esc(c.label) + '<span data-chip-rm="' + esc(c.kind + ":" + c.id) + '">✕</span></span>';
  }).join("");
  $$("[data-chip-rm]").forEach(function (el) {
    el.onclick = function () {
      const v = el.dataset.chipRm;
      const idx = v.indexOf(":");
      const kind = v.slice(0, idx), id = v.slice(idx + 1);
      if (kind === "skill") pickedSkills = pickedSkills.filter(function (x) { return x !== id; });
      else pickedKbs = pickedKbs.filter(function (x) { return x !== id; });
      renderCtxChips();
      renderSkillCount();
      const kc = $("#kbCount"); if (kc) kc.textContent = String(pickedKbs.length);
    };
  });
}

async function renderContext() {
  const box = $("#ctxBody");
  if (!box) return;
  if (ctxTab === "files") {
    const proj = (SNAP?.cfg?.projects || []).find((p) => p.id === ($("#chatProject") || {}).value) || (SNAP?.cfg?.projects || [])[0];
    if (!proj) { box.innerHTML = '<div class="sub">先添加一个项目</div>'; return; }
    const r = await api.listFiles({ dir: proj.dir, rel: "." });
    const items = (r && r.items) || [];
    box.innerHTML = items.slice(0, 80).map(function (f) {
      const full = proj.dir + '/' + f.name;
      return '<div class="ctx-file" data-ctx-file="' + esc(full) + '"><span class="ic">' + (f.dir ? '📁' : '📄') + '</span><span>' + esc(f.name) + '</span></div>';
    }).join('') || '<div class="sub">项目是空的</div>';
    $$("[data-ctx-file]").forEach((el) => el.onclick = () => previewFile(el.dataset.ctxFile, el.textContent.trim()));
    return;
  }
  if (ctxTab === "kb") {
    const r = api.octopKbList ? await api.octopKbList() : { items: [] };
    const items = (r && r.items) || [];
    box.innerHTML = items.map((k) => '<div class="ctx-file"><span class="ic">📚</span><span>' + esc(k.name) + "（" + (k.docs || 0) + "）</span></div>").join("") || '<div class="sub">还没有知识库</div>';
    return;
  }
  const proj = (SNAP?.cfg?.projects || []).find((p) => p.id === ($("#chatProject") || {}).value) || (SNAP?.cfg?.projects || [])[0];
  if (!proj) { box.innerHTML = '<div class="sub">先添加一个项目</div>'; return; }
  const rf = await api.listTextFiles({ dir: proj.dir + "/产出" });
  const items = (rf && rf.items) || [];
  box.innerHTML = items.slice(0, 60).map((f) => '<div class="ctx-file" data-ctx-file="' + esc(f.path) + '"><span class="ic">🧾</span><span>' + esc(f.name) + "</span></div>").join("") || '<div class="sub">还没有产物（对话里点"保存到项目"）</div>';
  $$("[data-ctx-file]").forEach((el) => el.onclick = () => previewFile(el.dataset.ctxFile, el.textContent.trim()));
}

async function loadKnowledge() {
  const box = $('#kbList');
  if (!api.octopKbList) { box.innerHTML = '<div class="sub">当前版本不支持</div>'; return; }
  const r = await api.octopKbList();
  const items = (r && r.items) || [];
  box.innerHTML = items.map((k) => '<div class="item kb-item" data-kb="' + esc(k.id) + '"><div class="t"><b>' + esc(k.name) + '</b><span>文档 ' + (k.docs || 0) + '</span></div>' + (k.id === curKbId ? '<span class="badge ok">当前</span>' : "") + "</div>").join("") || '<div class="sub">还没有知识库，点右上角新建</div>';
  $$('[data-kb]').forEach((el) => el.onclick = () => { curKbId = el.dataset.kb; loadKnowledge(); loadKbDocs(); });
}
async function loadKbDocs() {
  const box = $('#kbDocs');
  if (!curKbId) { box.innerHTML = '<div class="sub">选一个知识库查看文档</div>'; return; }
  const seq = (window.__kbSeq = (window.__kbSeq || 0) + 1);
  const kbAtStart = curKbId;
  const r = await api.kbListDocs(curKbId);
  if (seq !== window.__kbSeq || kbAtStart !== curKbId) return;
  const items = (r && r.list) || [];
  const title = $("#kbDocsTitle");
  if (title) title.textContent = "文档（" + items.length + "）";
  if (!r || !r.ok) { box.innerHTML = '<div class="sub">' + esc((r && r.error) || "取不到文档") + "</div>"; return; }
  box.innerHTML = items.map((d) => '<div class="row" data-docid="' + esc(String(d.id)) + '"><b>' + esc(d.filename || d.path || "文档") + "</b><span>" + esc(String(d.status || "")) + " · " + Math.round((d.byte_size || 0) / 1024) + "KB · 分片 " + (d.chunk_count || 0) + ' <button class="mini" data-kbopen="' + esc(String(d.id)) + '" data-kbname="' + esc(d.filename || "") + '">打开</button><button class="mini" data-kbrename="' + esc(String(d.id)) + '" data-kbname="' + esc(d.filename || "") + '">改名</button><button class="mini" data-kbreindex="' + esc(String(d.id)) + '">重建索引</button><button class="mini" data-kbdel="' + esc(String(d.id)) + '">删除</button></span></div>').join("") || '<div class="sub">还没有文档，点「上传本地文件」</div>';
  if (window.__kbHighlight) {
    const want = window.__kbHighlight;
    window.__kbHighlight = null;
    const hit = box.querySelector('[data-docid="' + String(want).replace(/"/g, "") + '"]');
    if (hit) {
      hit.style.outline = "2px solid #3b82f6";
      hit.style.outlineOffset = "2px";
      if (hit.scrollIntoView) hit.scrollIntoView({ block: "center" });
    }
  }
  box.querySelectorAll("[data-kbopen]").forEach((el) => {
    el.onclick = async () => {
      toast("正在取文件…");
      const r2 = await api.kbOpenDocFile({ kbId: curKbId, docId: el.dataset.kbopen, name: el.dataset.kbname });
      toast(r2 && r2.ok ? "已用默认程序打开" : ("打开失败：" + ((r2 && r2.error) || "").slice(0, 60)));
    };
  });
  box.querySelectorAll("[data-kbrename]").forEach((el) => {
    el.onclick = () => {
      const nm = prompt("新文件名", el.dataset.kbname || "");
      if (!nm || nm === el.dataset.kbname) return;
      (async () => {
        const r2 = await api.kbRenameDoc({ kbId: curKbId, docId: el.dataset.kbrename, name: nm });
        toast(r2 && r2.ok ? "已改名" : ("改名失败：" + ((r2 && r2.error) || "").slice(0, 60)));
        loadKbDocs();
      })();
    };
  });
  box.querySelectorAll("[data-kbreindex]").forEach((el) => {
    el.onclick = async () => {
      const r2 = await api.kbReindexDoc({ kbId: curKbId, docId: el.dataset.kbreindex });
      toast(r2 && r2.ok ? "已提交重建索引" : "重建失败");
      setTimeout(loadKbDocs, 1500);
    };
  });
  box.querySelectorAll("[data-kbdel]").forEach((el) => {
    el.onclick = () => {
      showConfirm('删除文档', '会从知识库里移除这份文档，云端索引也会删掉。', async () => {
        const r2 = await api.kbDeleteDoc({ kbId: curKbId, docId: el.dataset.kbdel });
        toast(r2 && r2.ok ? "已删除" : "删除失败");
        loadKbDocs();
      });
    };
  });
}

// ── 专家广场页 ───────────────────────────
async function loadExpertsPage() {
  const box = $('#expertGrid');
  if (!api.octopExperts) { box.innerHTML = '<div class="sub">当前版本不支持</div>'; return; }
  const r = await api.octopExperts();
  const items = (r && r.items) || [];
  box.innerHTML = items.map((e) => '<div class="expert-card"><b>' + esc(e.name) + '</b><span>' + esc(e.desc || "") + '</span><button class="btn ghost" data-use-expert="' + esc(e.id) + '">开始对话</button></div>').join("") || '<div class="sub">没有专家</div>';
  $$("[data-use-expert]").forEach((b) => b.onclick = () => {
    const sel = $("#chatExpert");
    if (sel) { sel.value = b.dataset.useExpert; pickedSkills = []; renderSkillCount(); }
    go('chat');
    toast('已选用该专家，直接说要做的事');
  });
}

async function loadSkills() {
  const box = $("#skillList");
  if (!box) return;
  let items = [];
  if (api.octopSkills) {
    const r = await api.octopSkills({ expertId: ($("#chatExpert") || {}).value || "" });
    items = (r && r.items) || [];
  } else if (api.skills) {
    const r = await api.skills();
    items = (r && r.data && r.data.items) || [];
  }
  curSkills = items;
  const hint = $("#skillHint");
  if (hint) hint.textContent = "共 " + items.length + " 个技能（跟随当前助理）";
  box.innerHTML = items.map(function (s) {
    return '<div class="expert-card"><b>' + esc(s.name) + '</b><span>' + esc(s.desc || "") + '</span>' +
      '<button class="btn ghost" data-use-skill="' + esc(s.slug || s.name) + '">用于对话</button></div>';
  }).join("") || '<div class="sub">这个助理还没有技能</div>';
  $$("[data-use-skill]").forEach(function (b) {
    b.onclick = function () {
      const slug = b.dataset.useSkill;
      if (!pickedSkills.includes(slug)) pickedSkills.push(slug);
      renderSkillCount();
      go("chat");
      toast("已启用技能，发送时带上");
    };
  });
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
let pickedKbs = [];      // 本轮对话引用的知识库
let activeTip = null;
let activeSteps = 0;
let activeTool = "";
let cmdHistory = [];     // 终端命令历史
let histIdx = 0;

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
  const q = (($('#chatSearch') || {}).value || '').trim().toLowerCase();
  const list = !q ? sessions : sessions.filter((s) => {
    const t = (s.title || '').toLowerCase();
    const m = (s.msgs || []).some((x) => String(x.text || '').toLowerCase().includes(q));
    return t.includes(q) || m;
  });
  box.innerHTML = list.map((s) => `<div class="sess ${s.id === curSession ? 'active' : ''}" data-sid="${s.id}"><b>${esc(s.title)}</b><span class="del" data-ren="${s.id}" title="重命名">✎</span><span class="del" data-del="${s.id}">✕</span></div>`).join('');
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
      const target = sessions.find((s) => s.id === id);
      showConfirm('删除会话', '「' + ((target && target.title) || '该会话') + '」会被删掉，不能恢复。', () => {
        sessions = sessions.filter((s) => s.id !== id);
        if (!sessions.length) sessions.push(newSessionObj('新会话'));
        if (curSession === id) curSession = sessions[0].id;
        saveSessions(); renderSessions(); renderChat();
        toast('已删除会话');
      });
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
  box.innerHTML = (s.msgs || []).map((m, i) => `<div class="msg ${m.role}">${m.role === 'ai' ? md(m.text) : esc(m.text)}${m.role === 'ai' ? `<span class="meta">${String(m.text || '').startsWith('⚠️') ? `<button class="mini" data-retry="${i}">重试</button>` : ''}<button class="mini" data-copy="${i}">复制</button><button class="mini" data-regen="${i}">重新生成</button><button class="mini" data-speak="${i}">🔊 朗读</button><button class="mini" data-save="${i}">保存到项目</button>${m.meta ? ' · ' + esc(m.meta) : ''}</span>` : (m.role === 'sys' ? `data-file="${esc(m.file || '')}" data-out="${i}" style="cursor:pointer" title="点开看内容/输出"` : (m.meta ? `<span class="meta">${esc(m.meta)}</span>` : ''))}</div>`).join('');
  if (!s.msgs || !s.msgs.length) {
    const samples = [
      '把这个项目里的台账整理成一张表',
      '核查这个客户的工商和涉诉信息',
      '按模板起草一份标书初稿',
      '把项目里的文件按类型分类整理',
    ];
    box.innerHTML = '<div class="msg ai">你好，我是团队 AI 助理。<br>直接说你要做什么，我会在你本地文件夹里读写文件。也可以点下面的例子试试：</div>' +
      '<div class="samples">' + samples.map(function (t) {
        return '<button class="sample" data-sample="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div>';
  }
  box.querySelectorAll('[data-speak]').forEach((el) => {
    el.onclick = async () => {
      const idx = parseInt(el.dataset.speak, 10);
      const msg = (s.msgs || [])[idx];
      if (!msg) return;
      el.textContent = '生成中…';
      const r = await api.octopTts({ text: msg.text.slice(0, 800) });
      el.textContent = '🔊 朗读';
      if (r && r.ok) { await api.playAudio({ file: r.file }); toast('正在朗读（' + Math.round((r.bytes || 0) / 1024) + 'KB）'); }
      else toast('朗读失败: ' + ((r && r.error) || ''));
    };
  });
  box.querySelectorAll('[data-file]').forEach((el) => {
    el.onclick = () => {
      const f = el.dataset.file;
      if (f) return previewFile(f, el.textContent.replace(/^[✅❌]\s*/, ''));
      const idx = parseInt(el.dataset.out || '-1', 10);
      const m = idx >= 0 ? (s.msgs || [])[idx] : null;
      if (m && m.out) showText(el.textContent, m.out);
    };
  });
  box.querySelectorAll('[data-retry]').forEach((el) => {
    el.onclick = () => {
      const idx = parseInt(el.dataset.retry, 10);
      const msgs = s.msgs || [];
      let u = -1;
      for (let k = idx - 1; k >= 0; k -= 1) { if (msgs[k].role === 'user') { u = k; break; } }
      if (u < 0) return;
      const text = msgs[u].text;
      msgs.splice(u);
      saveSessions(); renderChat();
      const inp = $('#chatInput'); if (inp) inp.value = text;
      sendChat();
    };
  });
  box.querySelectorAll('[data-copy]').forEach((el) => {
    el.onclick = async () => {
      const idx = parseInt(el.dataset.copy, 10);
      const msg = (s.msgs || [])[idx]; if (!msg) return;
      try { await navigator.clipboard.writeText(msg.text || ''); toast('已复制'); } catch { toast('复制失败'); }
    };
  });
  box.querySelectorAll('[data-regen]').forEach((el) => {
    el.onclick = () => {
      const idx = parseInt(el.dataset.regen, 10);
      const msgs = s.msgs || [];
      if (!msgs[idx]) return;
      let u = -1;
      for (let k = idx - 1; k >= 0; k -= 1) { if (msgs[k].role === 'user') { u = k; break; } }
      if (u < 0) return;
      const text = msgs[u].text;
      msgs.splice(u);
      saveSessions(); renderChat();
      const inp = $('#chatInput'); if (inp) inp.value = text;
      sendChat();
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
  try {
    const g = await api.guardCheck(text);
    if (g && g.blocked) {
      toast('含敏感词：' + (g.block || []).join('、') + '，已拦下不发送');
      return;
    }
    if (g && g.warn && g.warn.length) toast('提醒：内容含 ' + g.warn.join('、') + '，已照常发送');
  } catch {}
  const s = getSession();          // 锁定本次发送所属会话
  const sid = s.id;
  inp.value = '';
  if (!s.msgs || !s.msgs.length) s.title = text.slice(0, 18);
  s.msgs.push({ role: 'user', text });
  saveSessions();
  renderChat();
  const box = $('#chatBody');
  const tip = document.createElement('div');
  tip.className = 'typing';
  let waited = 0;
  const paint = () => { tip.innerHTML = '助理思考中 ' + waited + 's<i></i><i></i><i></i>'; };
  paint();
  const tipTimer = setInterval(() => { if (tip._tick) tip._tick(); }, 1000);
  tip._timer = tipTimer;
  tip._paint = () => {
    const extra = activeSteps > 0 ? (" · 第 " + activeSteps + " 步" + (activeTool ? "：" + activeTool : "")) : "";
    tip.innerHTML = "助理思考中 " + waited + "s" + extra + "<i></i><i></i><i></i>";
  };
  tip._waited = () => waited;
  tip._tick = () => { waited += 1; if (tip._paint) tip._paint(); };
  activeTip = tip;
  activeSteps = 0;
  activeTool = "";
  box.appendChild(tip); box.scrollTop = box.scrollHeight;
  const proj = $('#chatProject') ? $('#chatProject').value : '';
  const expert = $('#chatExpert') ? $('#chatExpert').value : '';
  const callOnce = async () => {
    if (api.octopChat) {
      const res = await api.octopChat({ text, sessionId: sid, agentId: expert || undefined, skills: pickedSkills.slice(), kbIds: pickedKbs.slice() });
      return res && res.ok ? { ok: true, data: { reply: res.reply, elapsed_ms: res.elapsed_ms } } : { ok: false, data: { error: (res && res.error) || "对话失败" } };
    }
    return await api.chat(text, sid, attachments.slice(), proj, expert);
  };
  let r = await callOnce();
  if (!r || !r.ok) {
    toast("第一次没成功，正在自动重试…");
    await new Promise((done) => setTimeout(done, 900));
    r = await callOnce();
  }
  attachments = []; renderAttach();
  if (tip._timer) clearInterval(tip._timer);
  if (activeTip === tip) { activeTip = null; activeSteps = 0; activeTool = ""; }
  tip.remove();
  // 只写回发起这条消息的会话（即使中途切走了）
  if (r && r.ok) s.msgs.push({ role: 'ai', text: r.data.reply || '(空)', meta: (r.data.elapsed_ms || 0) + 'ms' });
  else s.msgs.push({ role: 'ai', text: '⚠️ ' + friendlyError((r && r.data && r.data.error) || JSON.stringify((r && r.data) || {})) });
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
    loadExpertOptions();
  }
  async function loadExpertOptions() {
    if (!exSel) return;
    {
      const r = (api.octopExperts ? await api.octopExperts() : (api.experts ? await api.experts() : { ok: false }));
      const items = (r && (r.items || (r.data && r.data.items))) || [];
      let teamOpts = '';
      try {
        const tr = await api.teamsList();
        const teams = (tr && tr.list) || [];
        teamOpts = teams.map((t) => `<option value="${esc(String(t.team_id || t.id))}">团 · ${esc(String(t.name || "团队"))}（${(t.member_ids || t.members || []).length} 人）</option>`).join('');
      } catch {}
      const keep = exSel.value;
      exSel.innerHTML = '<option value="">默认助理</option>' +
        items.map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('') + teamOpts;
      if (keep) exSel.value = keep;
      exSel.onchange = () => { pickedSkills = []; renderSkillCount(); loadSkillPicker(); };
    }
  }
  window.__reloadExpertOptions = loadExpertOptions;
  const sel = $('#chatProject');
  const cfg = SNAP?.cfg || {};
  sel.innerHTML = (cfg.projects || []).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('') || '<option value="">（先添加项目）</option>';
  const mic = $('#btnMic');
  if (mic) mic.onclick = async () => {
    let left = 5;
    mic.textContent = '🔴 ' + left + 's';
    const tick = setInterval(() => { left -= 1; if (left > 0) mic.textContent = '🔴 ' + left + 's'; }, 1000);
    const rec = await api.recordAudio({ seconds: 5 });
    clearInterval(tick);
    if (!rec || !rec.ok) { mic.textContent = '🎤'; toast(rec && rec.error ? rec.error : '录音失败'); return; }
    mic.textContent = '…';
    const st = await api.octopStt({ file: rec.file });
    mic.textContent = '🎤';
    if (st && st.ok) {
      const inp = $('#chatInput');
      inp.value = (inp.value ? inp.value + ' ' : '') + (st.text || '');
      toast('已转文字');
    } else {
      toast('识别失败: ' + ((st && st.error) || ''));
    }
  };
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
  bindConfirmModal();
  bindPreviewModal();
  bindSkillsModal();
  bindLogin();
  bindChat();
  $$('.nav-item').forEach((b) => b.onclick = () => go(b.dataset.view));
  const hashView = (location.hash || '').replace('#', '');
  if (hashView && $('#view-' + hashView)) go(hashView);
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
    cmdHistory.push(cmd); histIdx = cmdHistory.length;
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

  // 知识库 / 专家页 按钮
  const kbNew = $("#btnKbNew");
  if (kbNew) kbNew.onclick = () => askName("知识库名称", "团队知识库", async (name) => {
    const r = await api.octopKbCreate({ name: name || "知识库", description: "" });
    toast(r && r.ok ? "已创建知识库" : ("创建失败: " + ((r && r.error) || "")));
    loadKnowledge();
  });
  const uR = $("#btnUsageRefresh"); if (uR) uR.onclick = loadUsage;
  const qS = $("#btnQuotaSave"); if (qS) qS.onclick = async () => {
    await api.saveQuota({ dailyTokens: Number(($("#quotaDaily") || {}).value) || 0, monthlyTokens: Number(($("#quotaMonthly") || {}).value) || 0 });
    toast("额度已保存"); loadUsage();
  };
  const aR = $("#btnAuditReload"); if (aR) aR.onclick = () => loadAudit();
  const aD = $("#auditDay"); if (aD) aD.onchange = () => loadAudit(aD.value);
  const aE = $("#btnAuditExport"); if (aE) aE.onclick = async () => {
    const d = ($("#auditDay") || {}).value || "";
    const r = await api.auditExport(d);
    toast(r && r.ok ? ("已导出 " + r.count + " 条") : "导出失败");
  };
  const ps = $("#presetSel");
  if (ps) {
    api.getPresets().then((r) => {
      const list = (r && r.presets) || [];
      ps.innerHTML = list.map((p) => "<option value=\"" + p.id + "\"" + (p.id === (r && r.active) ? " selected" : "") + ">" + p.name + "</option>").join("");
      ps.onchange = async () => { const out = await api.applyPreset(ps.value); toast(out && out.ok ? ("已切到" + (((r.presets || []).find((x) => x.id === ps.value) || {}).name || "")) : "切换失败"); };
    }).catch(() => {});
  }
  const chR = $("#btnChannelRefresh"); if (chR) chR.onclick = loadChannels;
  const tR = $("#btnTeamRefresh"); if (tR) tR.onclick = loadTeams;
  const cR = $("#btnCronRefresh"); if (cR) cR.onclick = loadCron;
  const mR = $("#btnMemRefresh"); if (mR) mR.onclick = loadMemory;
  const gsBtn = $("#btnGlobalSearch"); if (gsBtn) gsBtn.onclick = openGlobalSearch;
  const uEx = $("#btnUsageExport");
  if (uEx) uEx.onclick = async () => { toast("正在导出…"); const r = await api.usageExport({ window: usageRange }); toast(r && r.ok ? "已打开导出文件" : ("导出失败：" + ((r && r.error) || "").slice(0, 50))); };
  $$(".usage-range").forEach((b) => {
    b.onclick = () => {
      usageRange = b.dataset.range || "last_30d";
      $$(".usage-range").forEach((x) => x.classList.toggle("active", x === b));
      loadUsage();
    };
  });
  const chatInp = $("#chatInput");
  if (chatInp && !chatInp._pasteBound) {
    chatInp._pasteBound = true;
    chatInp.addEventListener("paste", async (e) => {
      const items = (e.clipboardData && e.clipboardData.items) || [];
      let blob = null;
      for (const it of items) { if (it.type && it.type.startsWith("image/")) { blob = it.getAsFile(); break; } }
      if (!blob) return;
      e.preventDefault();
      toast("正在识别图片…");
      const dataUrl = await new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result || "")); fr.readAsDataURL(blob); });
      const r = await api.imagePaste({ dataUrl, name: "paste" });
      if (!r || !r.ok) { toast("图片处理失败：" + ((r && r.error) || "").slice(0, 40)); return; }
      let up = null;
      try { up = await api.octopUploadLocal({ file: r.path }); } catch {}
      if (!up || !up.ok) toast("原图上传失败（" + ((up && up.error) || "网络问题") + "），已改用本地识别结果");
      const ocr = String(r.text || "").trim();
      const mark = up && up.ok ? "[图片已上传：" + (up.filename || "图片") + "]" : "[本地图片，未上传]";
      const body = ocr ? (mark + " 图中文字：\n" + ocr + "\n（请结合图片内容回答）") : (mark + " 请结合这张图回答下面的问题：");
      chatInp.value = (chatInp.value ? chatInp.value + "\n" : "") + body;
      chatInp.focus();
      if (ocr) toast("已识别图片文字并填入");
      else if (r.ocrError) toast("文字识别失败：" + r.ocrError);
      else toast("图片已附上，但图里没识别到文字");
    });
  }
  const gsC = $("#searchClose"); if (gsC) gsC.onclick = closeGlobalSearch;
  const gsI = $("#searchInput");
  if (gsI) {
    gsI.onkeydown = (e) => { if (e.key === "Enter") runGlobalSearch(); if (e.key === "Escape") closeGlobalSearch(); };
    let gsTimer = null;
    gsI.oninput = () => { clearTimeout(gsTimer); gsTimer = setTimeout(() => { if (gsI.value.trim().length >= 2) runGlobalSearch(); }, 350); };
  }
  const hS = $("#btnHubSearch"); if (hS) hS.onclick = searchHub;
  const hQ = $("#hubQuery"); if (hQ) hQ.onkeydown = (e) => { if (e.key === "Enter") searchHub(); };
  const pR = $("#btnProvRefresh"); if (pR) pR.onclick = loadProviders;


  const cC = $("#btnCronCreate");
  if (cC) cC.onclick = async () => {
    const trigger = (($("#cronTrigger") || {}).value || "").trim();
    const prompt = (($("#cronPrompt") || {}).value || "").trim();
    if (!trigger || !prompt) { toast("触发规则和任务内容都要填"); return; }
    const r = await api.cronCreate({ trigger, prompt });
    toast(r && r.ok ? "已创建" : ("创建失败：" + friendlyError((r && r.error) || "").slice(0, 90)));
    if (r && r.ok) { if ($("#cronPrompt")) $("#cronPrompt").value = ""; loadCron(); }
  };

  const tC = $("#btnTeamCreate");
  if (tC) tC.onclick = async () => {
    const name = (($("#teamName") || {}).value || "").trim();
    const sel = $("#teamMembers");
    const members = sel ? Array.prototype.slice.call(sel.selectedOptions || []).map((o) => o.value) : [];
    if (!name) { toast("先填团队名"); return; }
    if (members.length < 2) { toast("官方要求至少两名成员"); return; }
    const r = await api.teamsCreate({ name, members });
    toast(r && r.ok ? "已建团" : ("建团失败：" + friendlyError((r && r.error) || "").slice(0, 80)));
    if (r && r.ok) { if ($("#teamName")) $("#teamName").value = ""; loadTeams(); if (window.__reloadExpertOptions) window.__reloadExpertOptions(); }
  };

  const upBtn = $("#btnUpdate");
  if (upBtn) upBtn.onclick = async () => {
    const tip = $("#updateTip");
    const show = (t) => { if (tip) tip.textContent = t; };
    upBtn.disabled = true;
    show("正在检查…");
    const r = await api.updateCheck();
    if (!r || !r.ok) { upBtn.disabled = false; show("检查失败：" + ((r && r.error) || "网络问题")); return; }
    if (!r.hasUpdate) { upBtn.disabled = false; show(r.ahead ? ("本地 v" + r.current + " 比更新源 v" + r.latest + " 新，无需更新") : ("已经是最新版 v" + r.current)); return; }
    show("发现新版本 v" + r.latest + "，正在下载（约 " + Math.round((r.size || 0) / 1048576) + "MB）…");
    const d = await api.updateDownload({ url: r.url, name: r.name, size: r.size, sha256: r.sha256 });
    if (!d || !d.ok) { upBtn.disabled = false; show("下载失败：" + ((d && d.error) || "")); return; }
    show("下载完成，正在安装并重启…");
    await api.updateApply({ file: d.file });
  };
  if ($("#curVer")) api.appVersion().then((v) => { $("#curVer").textContent = v || "0"; }).catch(() => {});

  const fa = $("#btnFeishuAuto");
  if (fa) fa.onclick = async () => {
    const tip = $("#channelAuto");
    const t0 = Date.now();
    fa.disabled = true;
    if (tip) tip.textContent = "正在启动官方机器人创建流程…";
    const st = await api.channelFeishuStart();
    if (!st || !st.ok) {
      fa.disabled = false;
      if (tip) tip.textContent = "启动失败：" + ((st && st.error) || "未知原因");
      return;
    }
    const poll = async () => {
      if (Date.now() - t0 > 180000) {
        await api.channelFeishuStop();
        fa.disabled = false;
        if (tip) tip.textContent = "三分钟没完成，已停止；可以改用手填 App ID";
        return;
      }
      const p = await api.channelFeishuPoll();
      const d = (p && p.data) || {};
      if (d.qr_url && tip) tip.innerHTML = "请用飞书扫码授权：<a href=\"" + d.qr_url + "\" target=\"_blank\">打开二维码</a>";
      if (d.status === "succeeded" || (d.app_id && d.app_secret)) {
        if (tip) tip.textContent = "创建成功，正在绑定到云端…";
        const r = await api.channelAdd({ type: "feishu", config: { app_id: d.app_id, app_secret: d.app_secret } });
        fa.disabled = false;
        if (tip) tip.textContent = r && r.ok ? "已创建并绑定" : ("绑定失败：" + ((r && r.error) || ""));
        loadChannels();
        return;
      }
      if (d.status === "failed") {
        fa.disabled = false;
        if (tip) tip.textContent = "创建失败，可改用手填 App ID";
        return;
      }
      setTimeout(() => { setTimeout(poll, 0); }, 2000);
    };
    setTimeout(poll, 0);
  };

  const chA = $("#btnChannelAdd");
  if (chA) chA.onclick = async () => {
    const type = ($("#chType") || {}).value || "feishu";
    const appId = (($("#chAppId") || {}).value || "").trim();
    const secret = (($("#chSecret") || {}).value || "").trim();
    if (!appId || !secret) { toast("App ID 和 Secret 都要填"); return; }
    chA.textContent = "提交中…";
    const r = await api.channelAdd({ type, config: { app_id: appId, app_secret: secret } });
    chA.textContent = "保存并启用";
    if (r && r.ok) { toast("已提交给云端，稍等它验通"); if ($("#chSecret")) $("#chSecret").value = ""; loadChannels(); }
    else toast("云端拒绝了：" + ((r && r.error) || "未知原因").slice(0, 120));
  };
  const exBtn = $("#btnExportSession");
  if (exBtn) exBtn.onclick = async () => {
    const s = getSession();
    const lines = [];
    lines.push("# " + (s.title || "会话"));
    lines.push("");
    (s.msgs || []).forEach((m) => {
      if (m.role === "user") lines.push("**我**：" + (m.text || ""));
      else if (m.role === "ai") lines.push("**助理**：" + (m.text || ""));
      else if (m.role === "sys") lines.push("- " + (m.text || ""));
      lines.push("");
    });
    const r = await api.exportSession({ title: s.title || "会话", content: lines.join("\n") });
    toast(r && r.ok ? ("已导出到下载目录：" + r.file.split("/").pop()) : "导出失败");
  };
  const kbUp = $("#btnKbUpload");
  if (kbUp) kbUp.onclick = async () => {
    if (!curKbId) { toast("先选一个知识库"); return; }
    const files = await api.pickFiles();
    if (!files || !files.length) return;
    toast("正在解析 " + files.length + " 个文件…");
    const r = await api.uploadDocs({ kbId: curKbId, files });
    const okN = ((r && r.results) || []).filter((x) => x.ok).length;
    const bad = ((r && r.results) || []).filter((x) => !x.ok);
    toast("入库成功 " + okN + " 个" + (bad.length ? ("，失败 " + bad.length + "：" + bad[0].error) : ""));
    loadKbDocs(); loadKnowledge();
  };
  const er = $("#btnExpertRefresh");
  if (er) er.onclick = loadExpertsPage;
  const onb = $("#btnOnboardOk");
  const darkCb = $("#cfgDark");
  if (darkCb) {
    darkCb.checked = (SNAP?.cfg?.theme === "dark");
    darkCb.onchange = async () => {
      const theme = darkCb.checked ? "dark" : "light";
      applyTheme(theme);
      await api.saveConfig({ theme });
      toast(theme === "dark" ? "已切到深色" : "已切到浅色");
    };
  }
  if (onb) onb.onclick = async () => {
    await api.saveConfig({ onboarded: true });
    $("#onboardModal").classList.remove("show");
    await refresh();
  };
  const oc = $("#btnOpenCaps");
  if (oc) oc.onclick = () => go("capabilities");

  const ct = $$('.ctx-tab');
  ct.forEach(function (b) { b.onclick = function () {
    ct.forEach(function (x) { x.classList.remove('active'); });
    b.classList.add('active');
    ctxTab = b.dataset.ctx;
    renderContext();
  }; });
  const cproj = $('#chatProject');
  if (cproj) cproj.onchange = function () { renderContext(); };
  renderContext();
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
    activeSteps += 1;
    activeTool = label;
    if (activeTip && activeTip._paint) activeTip._paint();
    s.msgs.push({ role: 'sys', text: (d.ok ? '✅ ' : '❌ ') + label,
                  file: (d.tool === 'local_read_file' || d.tool === 'local_write_file') ? d.path : '',
                  out: d.outputPreview || '' });
    saveSessions(); renderChat();
  });
  api.onNeedLogin && api.onNeedLogin(() => {
    const m = $('#loginModal');
    if (m) m.classList.add('show');
    toast('登录已过期，请重新登录');
  });
  api.onState && api.onState((d) => { SNAP = d; applyTheme((d && d.cfg && d.cfg.theme) || "light"); renderConn(); renderHome(); renderProjects(); });
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
  if (SNAP && SNAP.cfg && SNAP.cfg.onboarded !== true) {
    const om = $("#onboardModal");
    if (om && SNAP.cfg.octopToken) om.classList.add("show");
  }
  if (location.protocol === 'file:') {
    pickedSkills = ['apple-notes'];
    pickedKbs = ['kb-demo'];
    renderCtxChips();
  }
  const h = (location.hash || '').replace('#', '');
  go(h || 'chat');
  if (location.search.includes('modal=1')) openTaskModal(location.search.includes('tpl=ledger') ? 'ledger' : (location.search.includes('tpl=bid') ? 'bid' : 'verify'));
  window.addEventListener('hashchange', () => go((location.hash || '').replace('#', '') || 'home'));
})();


document.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;
  if (meta && e.key.toLowerCase() === "k") {
    e.preventDefault();
    go("chat");
    const box = $("#chatSearch"); if (box) { box.focus(); box.select(); }
    return;
  }
  if (meta && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); openGlobalSearch(); return; }
  if (meta && e.shiftKey && e.key.toLowerCase() === "n") {
    e.preventDefault();
    go("chat");
    const nb = $("#btnNewSession"); if (nb) nb.click();
    return;
  }
  if (meta && e.key === "Enter") {
    if (document.activeElement && document.activeElement.id === "chatInput") {
      e.preventDefault();
      const sb = $("#chatSend"); if (sb) sb.click();
    }
  }
});
