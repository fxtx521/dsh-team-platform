import { apply } from './reporter.js';
import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';

const QUEUE='/tmp/t2_queue.jsonl', LOG='/tmp/t2.log', SKILLS='/tmp/t2_skills';
for (const p of [QUEUE, LOG]) { try { rmSync(p, {force:true}); } catch {} }
try { rmSync(SKILLS, { recursive: true, force: true }); } catch {}
writeFileSync('/tmp/t2_artifact.txt', 'DSH 产物测试 ' + new Date().toISOString());

let handler=null;
const ctx={ on:(n,fn)=>{ if(n==='session/event') handler=fn; }, effect:(fn)=>fn() };
apply(ctx, { enabled:true, serverUrl:'http://8.140.227.88:18000', apiKey:'demo-key-0001',
  skillsDir: SKILLS, queueFile: QUEUE, logFile: LOG, flushMs: 800, heartbeatMs: 1500 });

const session={ id:'t2-session' };
const ev=(type,data)=>handler(session,{type,data,time:Date.now()});
ev('turn/start',{turn:1});
ev('user/message',{content:[{type:'text',text:'测试产物回流'}]});
ev('deliverables/presented',{files:[{path:'/tmp/t2_artifact.txt'}]});
ev('turn/end',{turn:1,reason:{kind:'completed'}});
await new Promise(r=>setTimeout(r,7000));
console.log('技能目录:', existsSync(SKILLS)? readdirSync(SKILLS).join(','):'(空)');
console.log('DSH 技能目录出现客户核查SOP:', existsSync(process.env.HOME+'/.dsh/skills/客户核查 SOP（v2）/SKILL.md'));
console.log('日志:', readFileSync(LOG,'utf8').trim().split('\n').slice(-4).join(' | '));
process.exit(0);
