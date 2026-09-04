import express from 'express';

const router = express.Router();
type Block = { time: string; type: 'work' | 'study' | 'rest' | 'buffer'; agentOwner: 'work' | 'study' | 'manager'; title: string; duration: string; priority?: 'high' | 'medium' | 'low'; tips?: string };

function minutes(value: string) { const m = value.match(/(\d+(?:\.\d+)?)\s*(?:小時|hr|h)/i); return m ? Math.max(30, Math.round(Number(m[1]) * 60)) : 60; }
function configured() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }
async function supabase(path: string) { const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)return null;const r=await fetch(`${base}/rest/v1/${path}`,{headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'}});if(!r.ok)throw new Error(`Supabase ${r.status}: ${await r.text()}`);return r.json(); }
async function loadCalendar(ownerId:string,targetDate:string){ if(!configured())return []; const users=await supabase(`users?external_id=eq.${encodeURIComponent(ownerId)}&select=id&limit=1`) as any[];const userId=users?.[0]?.id;if(!userId)return [];const from=new Date(`${targetDate}T00:00:00+08:00`).toISOString();const to=new Date(`${targetDate}T23:59:59+08:00`).toISOString();return await supabase(`calendar_events?user_id=eq.${encodeURIComponent(userId)}&start_at=lt.${encodeURIComponent(to)}&end_at=gt.${encodeURIComponent(from)}&select=title,start_at,end_at&order=start_at.asc`) || []; }

function buildSchedule(context: any, message: string, calendarEvents: any[] = []): { blocks: Block[]; targetDate: string; summary: string } {
  const now = new Date(); const target = /明天|明日/i.test(message) ? new Date(now.getTime()+86400000) : now; const targetDate=target.toISOString().slice(0,10);
  const work=Array.isArray(context?.workTasks)?context.workTasks.filter((t:any)=>t?.source==='user'&&t?.status!=='completed'):[];
  const study=Array.isArray(context?.studyTasks)?context.studyTasks.filter((t:any)=>t?.source==='user'&&t?.status!=='completed'):[];
  const sort=(a:any,b:any)=>{const pw:any={high:3,medium:2,low:1};const deadline=(x:any)=>x?.deadline?new Date(x.deadline).getTime():Number.MAX_SAFE_INTEGER;return((pw[b.priority]||1)-(pw[a.priority]||1))||(deadline(a)-deadline(b));}; work.sort(sort);study.sort(sort);
  const events=(calendarEvents||[]).map((e:any)=>{const s=new Date(e.start_at||e.startAt),f=new Date(e.end_at||e.endAt);return{title:e.title||'Calendar 行程',start:s.getHours()*60+s.getMinutes(),end:f.getHours()*60+f.getMinutes()};});
  const blocks:Block[]=[]; const occupied=(start:number,end:number)=>events.some(e=>start<e.end&&end>e.start); const nextFree=(start:number,dur:number,limit:number)=>{let s=start;while(s+dur<=limit){const conflict=events.find(e=>s<e.end&&s+dur>e.start);if(!conflict)return s;s=Math.max(s+10,conflict.end);}return null;};
  const fmt=(n:number)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  const addTask=(task:any,type:'work'|'study',start:number)=>{const dur=Math.min(minutes(String(task.estimatedHours||1)+'h'),type==='work'?150:120);const free=nextFree(start,dur,type==='work'?18*60:22*60);if(free===null)return null;const end=free+dur;blocks.push({time:`${fmt(free)} - ${fmt(end)}`,type,agentOwner:type,title:task.title,duration:`${dur} 分鐘`,priority:task.priority||'medium',tips:type==='work'?`專案：${task.projectName||'工作'}｜截止：${task.deadline||'未設定'}`:`科目：${task.subjectName||'學習'}｜截止：${task.deadline||'未設定'}`});return end;};
  let cursor=9*60; for(const task of work.slice(0,3)){const end=addTask(task,'work',cursor);if(end===null)break;cursor=end+10;if(cursor>=720)break;}
  blocks.push({time:'12:00 - 13:00',type:'rest',agentOwner:'manager',title:'午餐與休息',duration:'60 分鐘',tips:'Manager 保留恢復時間，不排工作。'});
  cursor=13*60+30; for(const task of work.slice(3)){if(cursor>=18*60)break;const end=addTask(task,'work',cursor);if(end===null)break;cursor=end+10;}
  if(study.length){blocks.push({time:'18:00 - 19:00',type:'rest',agentOwner:'manager',title:'晚餐與切換緩衝',duration:'60 分鐘',tips:'工作 → 學習模式切換。'});cursor=19*60;for(const task of study.slice(0,2)){const end=addTask(task,'study',cursor);if(end===null)break;cursor=end+10;if(cursor>=22*60)break;}}
  if(blocks.length)blocks.push({time:'22:00 - 22:20',type:'buffer',agentOwner:'manager',title:'今日覆盤與明日調整',duration:'20 分鐘',tips:'記錄實際工時與延遲原因，供 Manager 下一次排程適性化。'});
  const calendarNote=events.length?`另外避開 ${events.length} 筆 Google Calendar 行程。`:'目前沒有可用的 Calendar 行程資料。';
  return{blocks,targetDate,summary:`已依優先級、截止時間、預估工時與 Calendar 限制安排 ${work.length} 筆工作與 ${study.length} 筆課業資料。${calendarNote}`};
}

router.post('/',async(req,res)=>{try{const message=String(req.body?.message||'').trim();if(!message)return res.status(400).json({error:'Message cannot be empty'});const target=new Date(/明天|明日/i.test(message)?Date.now()+86400000:Date.now()).toISOString().slice(0,10);const calendarEvents=await loadCalendar(String(req.header('x-owner-id')||'personal-owner'),target);const result=buildSchedule(req.body?.context||{},message,calendarEvents);res.json({ok:true,executed:true,targetDate:result.targetDate,blocks:result.blocks,summary:result.summary,calendarEventsUsed:calendarEvents.length});}catch(error:any){res.status(500).json({error:'排程執行失敗',details:error?.message||String(error)})}});
export default router;
