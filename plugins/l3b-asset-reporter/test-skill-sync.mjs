import { apply } from './reporter.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const SKILLS = '/tmp/test_skills_dir';
import { rmSync } from 'node:fs';
try { rmSync(SKILLS, { recursive: true, force: true }); } catch {}

let handler = null;
const ctx = { on: (n, fn) => { if (n === 'session/event') handler = fn; }, effect: (fn) => fn() };
apply(ctx, {
  enabled: true,
  serverUrl: 'http://8.140.227.88:18000',
  apiKey: 'demo-key-0001',
  skillsDir: SKILLS,
  queueFile: '/tmp/test_skills_queue.jsonl',
  logFile: '/tmp/test_skills.log',
  heartbeatMs: 3000,
});

await new Promise(r => setTimeout(r, 6000));
console.log('技能目录存在:', existsSync(SKILLS));
if (existsSync(SKILLS)) {
  for (const f of readdirSync(SKILLS)) {
    console.log(' 条目:', f);
  }
  const idx = SKILLS + '/.index.json';
  console.log('索引:', existsSync(idx) ? readFileSync(idx, 'utf8') : '(无)');
}
console.log('日志:', readFileSync('/tmp/test_skills.log', 'utf8').trim().split('\n').slice(-3).join(' | '));
process.exit(0);
