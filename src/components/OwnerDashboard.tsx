import React, { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { analyzeManagerState } from '../engines/managerEngine';
import type { RescheduleProposal } from '../engines/managerEngine';
import { analyzeAdaptivePatterns } from '../engines/adaptiveEngine';
import { calculateFocusMetrics, createFocusSession, finishFocusSession, getElapsedMinutes, shouldManagerInterrupt } from '../engines/focusEngine';
import type { FocusSession } from '../engines/focusEngine';
import { consolidateMemories, createMemory } from '../engines/memoryEngine';
import type { ManagerMemory } from '../engines/memoryEngine';

const insightStyles = { danger: 'border-red-200 bg-red-50', warning: 'border-amber-200 bg-amber-50', normal: 'border-emerald-200 bg-emerald-50' };
const FOCUS_KEY = 'ait_focus_sessions_v1';
const MEMORY_KEY = 'ait_manager_memories_v2';

const OwnerDashboard: React.FC = () => {
  const { workTasks, studyTasks, todayBlocks, updateWorkTask, updateStudyTask } = useAppData();
  const [sessions, setSessions] = useState<FocusSession[]>(() => { try { return JSON.parse(localStorage.getItem(FOCUS_KEY) || '[]'); } catch { return []; } });
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [memories, setMemories] = useState<ManagerMemory[]>(() => { try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]'); } catch { return []; } });

  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setNowTick(Date.now()), 30000); return () => window.clearInterval(id); }, []);
  const now = useMemo(() => new Date(nowTick), [nowTick]);

  const managerAnalysis = useMemo(() => analyzeManagerState({ workTasks, studyTasks, todayBlocks, now }), [workTasks, studyTasks, todayBlocks, now]);
  const adaptiveInsights = useMemo(() => analyzeAdaptivePatterns(workTasks, studyTasks, sessions), [workTasks, studyTasks, sessions]);
  const metrics = useMemo(() => calculateFocusMetrics(sessions), [sessions]);
  const activeProposals = managerAnalysis.rescheduleProposals.filter((p) => !dismissed.includes(p.id));

  useEffect(() => { localStorage.setItem(FOCUS_KEY, JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { localStorage.setItem(MEMORY_KEY, JSON.stringify(memories)); }, [memories]);
  useEffect(() => {
    if (!activeSession) return;
    const timer = window.setInterval(() => setElapsed(getElapsedMinutes(activeSession)), 1000);
    return () => window.clearInterval(timer);
  }, [activeSession]);

  const workStats = useMemo(() => { const t = workTasks.filter(x => x.source === 'user'); return { total: t.length, completed: t.filter(x => x.status === 'completed').length }; }, [workTasks]);
  const studyStats = useMemo(() => { const t = studyTasks.filter(x => x.source === 'user'); return { total: t.length, completed: t.filter(x => x.status === 'completed').length }; }, [studyTasks]);
  const total = workStats.total + studyStats.total;
  const completed = workStats.completed + studyStats.completed;
  const rate = total ? Math.round(completed / total * 100) : 0;

  const addMemory = (type: ManagerMemory['type'], content: string, confidence = 1, source: ManagerMemory['source'] = 'observed') => {
    setMemories(prev => consolidateMemories([createMemory({ type, content, confidence, source }), ...prev]).slice(0, 100));
  };

  const startFocus = () => {
    if (activeSession) return;
    const block = managerAnalysis.currentBlock;
    const task = block ? [...workTasks, ...studyTasks].find(t => t.title === block.title && t.source === 'user') : undefined;
    const session = createFocusSession({ taskId: task?.id, taskTitle: block?.title || '自由 Focus', plannedMinutes: block?.targetDurationMin || 25 });
    setActiveSession(session); setElapsed(0);
  };

  const stopFocus = (wasCompleted: boolean) => {
    if (!activeSession) return;
    const finished = finishFocusSession(activeSession, { completed: wasCompleted });
    setSessions(prev => [finished, ...prev].slice(0, 100));
    addMemory('focus', `Focus「${finished.taskTitle}」${wasCompleted ? '完成' : '提前結束'}，實際 ${getElapsedMinutes(finished)} 分鐘。`);
    setActiveSession(null); setElapsed(0);
  };

  const nextImportantBlock = useMemo(() => todayBlocks.filter(b => b.source === 'user' && b.startTime > now.toISOString() && !b.completed).sort((a,b) => a.startTime.localeCompare(b.startTime))[0], [todayBlocks, now]);
  const focusState = activeSession ? shouldManagerInterrupt({ elapsedMinutes: elapsed, plannedMinutes: activeSession.plannedMinutes, hasUpcomingImportantBlock: Boolean(nextImportantBlock) }) : 'continue';

  const findTask = (p: RescheduleProposal) => p.taskType === 'work' ? workTasks.find(t => t.id === p.taskId) : studyTasks.find(t => t.id === p.taskId);
  const acceptProposal = (p: RescheduleProposal) => {
    const value = window.prompt(`Owner 決定新的截止時間：\n${p.taskTitle}\n格式 YYYY-MM-DD HH:mm`);
    if (!value) return;
    const normalized = value.trim().replace(' ', 'T');
    if (Number.isNaN(new Date(normalized).getTime())) return window.alert('日期格式無法辨識。');
    if (p.taskType === 'work') {
      const task = workTasks.find(t => t.id === p.taskId); if (!task) return;
      updateWorkTask({ ...task, deadline: normalized });
    } else {
      const task = studyTasks.find(t => t.id === p.taskId); if (!task) return;
      updateStudyTask({ ...task, deadline: normalized });
    }
    addMemory('decision', `Owner 接受 Manager 建議，將「${p.taskTitle}」重新安排至 ${normalized}。`);
    setDismissed(x => [...x, p.id]);
  };
  const rejectProposal = (p: RescheduleProposal) => { addMemory('decision', `Owner 拒絕 Manager 對「${p.taskTitle}」的重新排程建議。`); setDismissed(x => [...x, p.id]); };

  return <div className="min-h-full bg-slate-50 p-6"><div className="mx-auto max-w-7xl space-y-6">
    <section><p className="text-sm font-medium text-slate-500">{now.toLocaleDateString('zh-TW')}</p><h1 className="mt-1 text-3xl font-bold text-slate-900">👑 Owner Dashboard</h1><p className="mt-2 text-slate-500">你是 Personal AI Organization 的 Owner。Manager 負責管理與建議，重大決策仍由你確認。</p></section>

    {activeProposals.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-amber-700">需要 Owner 決策</p><h2 className="mt-1 text-xl font-bold">🧭 Manager 重新排程建議</h2></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">{activeProposals.length} 項</span></div><div className="mt-5 space-y-3">{activeProposals.map(p => <div key={p.id} className="rounded-xl border border-amber-200 bg-white p-5"><div className="flex flex-col gap-4 lg:flex-row lg:justify-between"><div><h3 className="font-bold">{p.taskTitle}</h3><p className="mt-2 text-sm text-slate-600">{p.reason}</p><p className="mt-2 text-sm font-medium">💡 {p.suggestedAction}</p></div><div className="flex gap-2"><button onClick={() => acceptProposal(p)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">接受並重新安排</button><button onClick={() => rejectProposal(p)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-600">忽略</button></div></div></div>)}</div></section>}

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xl">👑</div><div><h2 className="text-lg font-bold">Manager 今日簡報</h2><p className="text-sm text-slate-500">{managerAnalysis.dailySummary}</p></div></div><div className="mt-5 space-y-3">{managerAnalysis.insights.map(item => <div key={item.id} className={`rounded-xl border p-4 ${insightStyles[item.level]}`}><div className="flex gap-3"><span>{item.level === 'danger' ? '🔴' : item.level === 'warning' ? '🟡' : '🟢'}</span><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.description}</p></div></div></div>)}</div></section>

    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">現在</p><h2 className="mt-1 text-xl font-bold">🍅 Current Focus</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">Focus Engine</span></div><div className="mt-6 rounded-xl bg-slate-50 p-5"><p className="text-sm text-slate-500">{activeSession ? '執行中' : managerAnalysis.currentBlock ? '目前時間區塊' : '自由 Focus'}</p><h3 className="mt-2 text-xl font-bold">{activeSession?.taskTitle || managerAnalysis.currentBlock?.title || '自由 Focus'}</h3><p className="mt-2 text-sm text-slate-500">{activeSession ? `${elapsed} / ${activeSession.plannedMinutes} 分鐘` : managerAnalysis.currentBlock?.timeRange || '25 分鐘'}</p>{activeSession && focusState !== 'continue' && <p className="mt-3 text-sm font-semibold text-amber-700">{focusState === 'check-in' ? '⏰ 已達預定時間，Manager 正在詢問是否繼續。' : '⚠️ 下一個時間區塊即將到來，建議檢查是否需要切換。'}</p>}</div>{activeSession ? <div className="mt-4 flex gap-2"><button onClick={() => stopFocus(true)} className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">完成 Focus</button><button onClick={() => stopFocus(false)} className="rounded-xl border px-4 py-3 text-sm font-semibold">提前結束</button></div> : <button onClick={startFocus} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">開始 Focus</button>}</section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">今日進度</p><h2 className="mt-1 text-xl font-bold">📊 今日完成度</h2><div className="mt-6 flex items-end gap-3"><span className="text-5xl font-bold">{rate}%</span><span className="mb-2 text-sm text-slate-500">{completed} / {total} 項任務</span></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${rate}%` }} /></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">工作</p><p className="mt-1 text-lg font-bold">{workStats.completed}/{workStats.total}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">學習</p><p className="mt-1 text-lg font-bold">{studyStats.completed}/{studyStats.total}</p></div></div></section>
    </div>

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">🧠 Manager Engine</h2><div className="mt-5 grid gap-4 md:grid-cols-4"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">待處理</p><p className="mt-1 text-2xl font-bold">{managerAnalysis.totalPendingTasks}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">已完成</p><p className="mt-1 text-2xl font-bold">{managerAnalysis.totalCompletedTasks}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">預估剩餘</p><p className="mt-1 text-2xl font-bold">{managerAnalysis.estimatedPendingHours}<span className="ml-1 text-sm">小時</span></p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Focus 累積</p><p className="mt-1 text-2xl font-bold">{metrics.totalFocusMinutes}<span className="ml-1 text-sm">分</span></p></div></div></section>

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">Adaptive Engine</p><h2 className="mt-1 text-xl font-bold">🔄 從歷史行為調整未來規劃</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{adaptiveInsights.length} 項發現</span></div>{adaptiveInsights.length === 0 ? <p className="mt-4 text-sm text-slate-500">目前資料不足，Manager 會在累積更多 Task 與 Focus 歷史後開始辨識模式。</p> : <div className="mt-4 space-y-3">{adaptiveInsights.map(x => <div key={x.id} className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">{x.title}</p><p className="mt-1 text-sm text-slate-600">{x.description}</p></div>)}</div>}</section>

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">🧠 Personal Manager Memory</h2><span className="text-xs text-slate-500">最近 {memories.length} 筆</span></div>{memories.length === 0 ? <p className="mt-4 text-sm text-slate-500">Manager 尚未累積 Owner 決策或 Focus 行為。</p> : <div className="mt-4 max-h-56 space-y-2 overflow-auto">{memories.slice(0, 8).map(item => <div key={item.id} className="rounded-lg bg-slate-50 p-3"><div className="flex justify-between"><span className="text-xs font-semibold uppercase text-slate-400">{item.type}</span><span className="text-xs text-slate-400">信心 {Math.round(item.confidence * 100)}%</span></div><p className="mt-1 text-sm text-slate-600">{item.content}</p></div>)}</div>}</section>

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Personal AI Organization</p><h2 className="mt-1 text-xl font-bold">🤖 AI Team</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{[['👑','Manager'],['💼','Work Agent'],['📚','Study Agent']].map(([icon,name]) => <div key={name} className="rounded-xl border p-4"><div className="flex items-center gap-3"><span className="text-2xl">{icon}</span><div><p className="font-semibold">{name}</p><p className="text-xs text-emerald-600">● Online</p></div></div></div>)}</div></section>
  </div></div>;
};

export default OwnerDashboard;
