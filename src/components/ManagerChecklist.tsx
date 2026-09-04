import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Sun, Moon, ArrowRight, Clock3, PauseCircle, Check, Sparkles } from 'lucide-react';
import type { WorkTask, StudyTask } from '../types';

type Task = (WorkTask | StudyTask) & { _domain?: string };
type Mode = 'daily-review' | 'tomorrow-plan';
type Decision = 'continue' | 'delay' | 'pause' | 'complete';
interface Props { mode: Mode; workTasks: WorkTask[]; studyTasks: StudyTask[]; onConfirm: (message: string) => void; }
const weight: Record<string, number> = { high: 3, medium: 2, low: 1 };
const meta: Record<Decision, { label: string; icon: React.ReactNode }> = { continue:{label:'明天繼續',icon:<Check className="w-3 h-3"/>}, delay:{label:'延後',icon:<Clock3 className="w-3 h-3"/>}, pause:{label:'暫停',icon:<PauseCircle className="w-3 h-3"/>}, complete:{label:'完成',icon:<CheckCircle2 className="w-3 h-3"/>} };
const delayOptions = [1,3,7,14];

function urgency(task: Task) {
  const deadline = new Date(task.deadline || '9999-12-31').getTime();
  const days = (deadline - Date.now()) / 86400000;
  if (task.status === 'delayed' || days <= 1) return 'high';
  if (days <= 3) return 'medium';
  return task.priority || 'medium';
}
function managerRecommendation(task: Task): Decision {
  if (task.status === 'delayed') return 'continue';
  if (task.status === 'in_progress') return 'continue';
  if (task.status === 'todo' && urgency(task) === 'high') return 'continue';
  return 'continue';
}

export const ManagerChecklist: React.FC<Props> = ({ mode, workTasks, studyTasks, onConfirm }) => {
  const tasks = useMemo<Task[]>(() => [
    ...workTasks.filter(t => t.source === 'user').map(t => ({ ...t, _domain: '💼 工作' })),
    ...studyTasks.filter(t => t.source === 'user').map(t => ({ ...t, _domain: '🎓 課業／研究' })),
  ].sort((a,b) => (weight[b.priority] || 0) - (weight[a.priority] || 0) || new Date(a.deadline || '9999-12-31').getTime() - new Date(b.deadline || '9999-12-31').getTime()), [workTasks, studyTasks]);
  const pending = tasks.filter(t => t.status !== 'completed');
  const completed = tasks.filter(t => t.status === 'completed');
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [delayDays, setDelayDays] = useState<Record<string, number>>({});
  const [confirmed, setConfirmed] = useState(false);
  const choose = (id:string, decision:Decision) => { setDecisions(p => ({...p, [id]: decision})); if(decision !== 'delay') setDelayDays(p => {const n={...p}; delete n[id]; return n;}); setConfirmed(false); };
  const confirm = () => {
    const groups: Record<Decision,string[]> = {continue:[],delay:[],pause:[],complete:[]};
    pending.forEach(t => groups[decisions[t.id] || managerRecommendation(t)].push(`${t.title}（${t.id}）${decisions[t.id] === 'delay' ? `（延後 ${delayDays[t.id] || 3} 天）` : ''}`));
    const lines = [groups.continue.length ? `明天繼續：${groups.continue.join('、')}` : '', groups.delay.length ? `延後：${groups.delay.join('、')}` : '', groups.pause.length ? `暫停：${groups.pause.join('、')}` : '', groups.complete.length ? `確認完成：${groups.complete.join('、')}` : ''].filter(Boolean).join('；');
    setConfirmed(true);
    onConfirm(mode === 'daily-review' ? `我確認每日覆盤決策。${lines || '沒有需要安排的任務。'}` : `我確認明日規劃。${lines || '沒有需要安排的任務。'}`);
  };
  return <section className="mt-3 rounded-2xl border-2 border-[#C9DCCF] bg-white overflow-hidden shadow-sm">
    <div className="px-4 py-3 bg-[#EAF2EC] border-b border-[#D5E3D9] flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-[#385244] text-white flex items-center justify-center">{mode==='daily-review'?<Moon className="w-4 h-4"/>:<Sun className="w-4 h-4"/>}</div><div className="flex-1"><div className="font-bold text-sm text-[#26362C]">{mode==='daily-review'?'🌙 Manager 每日覆盤':'☀️ Manager 隔日規劃'}</div><div className="text-[10px] text-[#6B726C]">Manager 已先分析；你只需覆核需要調整的決策。</div></div><Sparkles className="w-4 h-4 text-[#385244]"/></div>
    <div className="p-4">
      <div className="grid grid-cols-3 gap-2 mb-3"><div className="rounded-xl bg-[#F7F5F1] p-2 text-center"><div className="text-lg font-bold text-[#385244]">{completed.length}</div><div className="text-[10px] text-[#7A837D]">已完成</div></div><div className="rounded-xl bg-[#F7F5F1] p-2 text-center"><div className="text-lg font-bold text-[#7D3E1B]">{pending.length}</div><div className="text-[10px] text-[#7A837D]">待處理</div></div><div className="rounded-xl bg-[#F7F5F1] p-2 text-center"><div className="text-lg font-bold text-[#385244]">{pending.filter(t => (decisions[t.id] || managerRecommendation(t)) === 'continue').length}</div><div className="text-[10px] text-[#7A837D]">Manager 建議繼續</div></div></div>
      <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-[#3F4440]">Manager 分析結果</span><span className="text-[10px] text-[#7A837D]">可直接接受，也可覆寫</span></div>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">{pending.length===0 ? <div className="py-5 text-center text-xs text-[#6B726C]">🎉 目前沒有未完成的 User Task。</div> : pending.map(task => { const decision=decisions[task.id] || managerRecommendation(task); const u=urgency(task); return <div key={task.id} className="p-3 rounded-xl border border-[#E5E2DC] bg-white"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 flex-wrap"><span className="text-xs font-semibold text-[#2D322E]">{task.title}</span><span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#EFECE5] text-[#6B726C]">{task._domain}</span>{u==='high'&&<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FAE8E1] text-[#9A4A28]">⚠️ 優先處理</span>}</div><div className="mt-1 text-[10px] text-[#7A837D]">原優先級：{task.priority} · 狀態：{task.status} · 截止：{task.deadline || '未設定'} · 預估：{task.estimatedHours}h</div><div className="mt-1 text-[10px] font-semibold text-[#385244]">🤖 Manager 建議：{decision==='continue'?'明天繼續並優先安排':decision==='delay'?'延後處理':decision==='pause'?'暫停':'標記完成'}</div></div></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">{(Object.keys(meta) as Decision[]).map(d=><button key={d} type="button" onClick={()=>choose(task.id,d)} className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-medium ${decision===d?'bg-[#E8EFEB] border-[#9FBEA8] text-[#385244]':'bg-white border-[#DEDAD2] text-[#6B726C]'}`}>{meta[d].icon}{meta[d].label}</button>)}</div>{decision==='delay'&&<div className="mt-2 p-2 rounded-lg bg-[#FAF8F5] border border-[#E5E2DC]"><div className="text-[10px] font-semibold mb-1.5">延後多久？</div><div className="grid grid-cols-4 gap-1.5">{delayOptions.map(d=><button key={d} type="button" onClick={()=>{choose(task.id,'delay');setDelayDays(p=>({...p,[task.id]:d}));}} className={`px-2 py-1.5 rounded-md border text-[10px] ${delayDays[task.id]===d?'bg-[#F4E9DF] border-[#D6B99F] text-[#7D3E1B]':'bg-white border-[#DEDAD2] text-[#6B726C]'}`}>+{d} 天</button>)}</div></div>}</div>; })}</div>
      <div className="mt-3 pt-3 border-t border-[#EBE8E1] flex items-center justify-between gap-2"><div className="text-[10px] text-[#7A837D] flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5"/>Manager 已先做決策，Owner 只負責最後覆核。</div><button type="button" onClick={confirm} disabled={confirmed} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#385244] text-white text-xs font-semibold disabled:opacity-60">{confirmed?<CheckCircle2 className="w-3.5 h-3.5"/>:<ArrowRight className="w-3.5 h-3.5"/>}{confirmed?'已送出確認':'確認 Manager 規劃'}</button></div>
    </div>
  </section>;
};
