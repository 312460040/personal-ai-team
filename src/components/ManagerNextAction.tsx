import React, { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { usePlanManager } from '../hooks/usePlanManager';
import type { WorkTask, StudyTask } from '../types';
import type { ExecutionPlanStep } from '../engines/taskPlanningEngine';
import { createFocusSession, finishFocusSession, getElapsedMinutes } from '../engines/focusEngine';
import type { FocusSession } from '../engines/focusEngine';
import { diagnoseBehavior } from '../engines/diagnosisEngine';
import { buildAdaptiveProposals } from '../engines/adaptivePlanningEngine';
import type { ManagerMemory } from '../engines/memoryEngine';

const FOCUS_KEY = 'ait_focus_sessions_v1';
const ACTIVE_FOCUS_KEY = 'ait_active_focus_session_v1';
const MEMORY_KEY = 'ait_manager_memories_v2';
const AUTO_PLAN_KEY = 'ait_manager_auto_plan_v1';
const FOCUS_CHANGED_EVENT = 'ait:focus-changed';

function deadlineValue(deadline?: string) {
  if (!deadline) return Number.MAX_SAFE_INTEGER;
  const value = new Date(deadline).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function priorityValue(priority?: string) {
  return priority === 'high' ? 2 : priority === 'medium' ? 1 : 0;
}

function isPending<T extends { status: string; source?: string }>(task: T) {
  return task.source === 'user' && task.status !== 'completed';
}

function loadActiveFocus(): FocusSession | null {
  try { const raw = localStorage.getItem(ACTIVE_FOCUS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function saveActiveFocus(session: FocusSession | null) {
  if (session) localStorage.setItem(ACTIVE_FOCUS_KEY, JSON.stringify(session));
  else localStorage.removeItem(ACTIVE_FOCUS_KEY);
  window.dispatchEvent(new Event(FOCUS_CHANGED_EVENT));
}

function appendFinishedFocus(session: FocusSession) {
  try {
    const current = JSON.parse(localStorage.getItem(FOCUS_KEY) || '[]') as FocusSession[];
    localStorage.setItem(FOCUS_KEY, JSON.stringify([session, ...current].slice(0, 100)));
  } catch { localStorage.setItem(FOCUS_KEY, JSON.stringify([session])); }
}

function loadMemories(): ManagerMemory[] {
  try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]'); } catch { return []; }
}

const ManagerNextAction: React.FC = () => {
  const { workProjects, workTasks, studyTasks, todayBlocks, currentContext } = useAppData();
  const planManager = usePlanManager({ workProjects, workTasks, studyTasks, todayBlocks });
  const [activeFocus, setActiveFocus] = useState<FocusSession | null>(() => loadActiveFocus());
  const [elapsed, setElapsed] = useState(0);
  const [memories, setMemories] = useState<ManagerMemory[]>(() => loadMemories());
  const [nowTick, setNowTick] = useState(Date.now());
  const [autoPlanMessage, setAutoPlanMessage] = useState<string | null>(null);

  useEffect(() => { const id = window.setInterval(() => setNowTick(Date.now()), 30000); return () => window.clearInterval(id); }, []);
  useEffect(() => { localStorage.setItem(MEMORY_KEY, JSON.stringify(memories)); }, [memories]);
  useEffect(() => {
    const sync = () => { setActiveFocus(loadActiveFocus()); setMemories(loadMemories()); };
    window.addEventListener(FOCUS_CHANGED_EVENT, sync); window.addEventListener('storage', sync);
    return () => { window.removeEventListener(FOCUS_CHANGED_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  useEffect(() => {
    if (!activeFocus) { setElapsed(0); return; }
    const tick = () => setElapsed(getElapsedMinutes(activeFocus)); tick();
    const id = window.setInterval(tick, 1000); return () => window.clearInterval(id);
  }, [activeFocus]);

  const scopedWorkTasks = useMemo(() => workTasks.filter(task => isPending(task) && task.workspaceId === currentContext.workspaceId && task.projectId === currentContext.projectId), [workTasks, currentContext]);
  const scopedStudyTasks = useMemo(() => studyTasks.filter(task => isPending(task)), [studyTasks]);
  const candidateTasks = useMemo(() => currentContext.workspaceId === 'work' ? scopedWorkTasks : [...scopedWorkTasks, ...scopedStudyTasks], [currentContext.workspaceId, scopedStudyTasks, scopedWorkTasks]);

  const sessions = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(FOCUS_KEY) || '[]') as FocusSession[]; } catch { return []; }
  }, [nowTick, activeFocus]);
  const diagnosis = useMemo(() => diagnoseBehavior({ workTasks: scopedWorkTasks, studyTasks: scopedStudyTasks, focusSessions: sessions }), [scopedWorkTasks, scopedStudyTasks, sessions]);
  const adaptive = useMemo(() => buildAdaptiveProposals({ workTasks: scopedWorkTasks, studyTasks: scopedStudyTasks, focusSessions: sessions, memories }), [scopedWorkTasks, scopedStudyTasks, sessions, memories]);

  const candidate = useMemo<WorkTask | StudyTask | undefined>(() => [...candidateTasks].sort((a, b) => {
    const riskA = diagnosis.some(x => x.level === 'danger' && x.id.includes(a.id)) ? 1 : 0;
    const riskB = diagnosis.some(x => x.level === 'danger' && x.id.includes(b.id)) ? 1 : 0;
    if (riskB !== riskA) return riskB - riskA;
    const priorityDiff = priorityValue(b.priority) - priorityValue(a.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return deadlineValue(a.deadline) - deadlineValue(b.deadline);
  })[0], [candidateTasks, diagnosis]);

  const visiblePlans = useMemo(() => planManager.activePlans.filter(plan => currentContext.workspaceId === 'work' ? plan.projectId === currentContext.projectId : true), [planManager.activePlans, currentContext]);
  const current = planManager.nextActions.find(item => item.plan.id === visiblePlans[0]?.id) ?? planManager.nextActions.find(item => visiblePlans.some(plan => plan.id === item.plan.id));
  const adaptiveAction = adaptive[0];
  const diagnosisAction = diagnosis[0];

  // Manager 只自動建立「計畫」，不自動開始 Focus，也不修改原始 Task。
  // sessionStorage 避免同一頁面在 React re-render 時重複建立；sourceTaskId 則提供跨重新載入的冪等判斷。
  useEffect(() => {
    if (!candidate || current || activeFocus) return;
    const marker = localStorage.getItem(AUTO_PLAN_KEY);
    if (marker === candidate.id) return;
    const result = planManager.ensurePlanForTask(candidate);
    localStorage.setItem(AUTO_PLAN_KEY, candidate.id);
    if (result.created) setAutoPlanMessage(`Manager 已自動為「${candidate.title}」建立執行計畫。`);
  }, [candidate, current, activeFocus, planManager.ensurePlanForTask]);

  const createPlan = () => { if (candidate) planManager.createPlanForTask(candidate); };
  const formatMinutes = (hours: number) => { const minutes = Math.round(hours * 60); return minutes >= 60 ? `${Math.floor(minutes / 60)} 小時 ${minutes % 60 ? `${minutes % 60} 分` : ''}`.trim() : `${minutes} 分鐘`; };
  const stepStatus = (step: ExecutionPlanStep, state?: { runningStepId?: string; completedStepIds: string[] }) => { if (!state) return 'ready'; if (state.completedStepIds.includes(step.id)) return 'completed'; if (state.runningStepId === step.id) return 'running'; return step.dependsOn.every(id => state.completedStepIds.includes(id)) ? 'ready' : 'locked'; };

  const startStep = (planId: string, step: ExecutionPlanStep) => {
    if (activeFocus) { window.alert(`目前已有 Focus：「${activeFocus.taskTitle}」，請先完成或結束目前工作。`); return; }
    const started = planManager.start(planId, step.id); if (!started) return;
    const session = createFocusSession({ taskId: step.id, taskTitle: step.title, plannedMinutes: Math.max(1, Math.round(step.estimatedHours * 60)) });
    saveActiveFocus(session); setActiveFocus(session);
  };

  const completeStep = (planId: string, step: ExecutionPlanStep) => {
    const completed = planManager.complete(planId, step.id); if (!completed) return;
    if (activeFocus?.taskId === step.id) { const finished = finishFocusSession(activeFocus, { completed: true }); appendFinishedFocus(finished); saveActiveFocus(null); setActiveFocus(null); }
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-500">Manager Decision Layer</p><h2 className="mt-1 text-xl font-bold text-slate-900">🎯 Manager 下一步</h2><p className="mt-1 text-sm text-slate-500">不只看優先級，也會參考 Diagnosis、歷史行為與 Adaptive Planning。</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{visiblePlans.length} 個進行中計畫</span></div>

    {(diagnosisAction || adaptiveAction) && <div className="mt-5 grid gap-3 md:grid-cols-2">
      {diagnosisAction && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">🔍 Diagnosis</p><p className="mt-1 font-semibold text-slate-800">{diagnosisAction.title}</p><p className="mt-1 text-sm text-slate-600">{diagnosisAction.recommendation}</p></div>}
      {adaptiveAction && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">🔄 Adaptive Planning</p><p className="mt-1 font-semibold text-slate-800">{adaptiveAction.title}</p><p className="mt-1 text-sm text-slate-600">{adaptiveAction.suggestedAction}</p></div>}
    </div>}

    {autoPlanMessage && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">✓ {autoPlanMessage}</div>}
    {activeFocus && <div className="mt-5 rounded-xl border border-slate-300 bg-slate-50 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold text-emerald-600">🟢 Focus 執行中</p><h3 className="mt-1 font-bold text-slate-900">{activeFocus.taskTitle}</h3><p className="mt-1 text-sm text-slate-500">已執行 {elapsed} 分鐘 · 預估 {formatMinutes(activeFocus.plannedMinutes / 60)}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">Execution + Focus</span></div></div>}

    {!current && !candidate && <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">目前沒有可建立執行計畫的 User Task。新增任務後，Manager 會在這裡提供下一步。</div>}
    {!current && candidate && <div className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold text-slate-400">Manager 建議先處理</p><h3 className="mt-1 text-lg font-bold text-slate-900">{candidate.title}</h3><p className="mt-1 text-sm text-slate-500">優先級：{candidate.priority === 'high' ? '高' : candidate.priority === 'medium' ? '中' : '低'}{candidate.deadline ? ` · 截止 ${candidate.deadline.replace('T', ' ')}` : ''}</p></div><button onClick={createPlan} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">建立執行計畫</button></div>}

    {current && <div className="mt-5 rounded-xl border border-slate-200 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold text-slate-400">目前計畫</p><h3 className="mt-1 text-lg font-bold text-slate-900">{current.plan.title.replace('｜執行計畫', '')}</h3><p className="mt-1 text-sm text-slate-500">進度 {current.state?.completedStepIds.length ?? 0} / {current.plan.steps.length} · 預估 {formatMinutes(current.plan.totalEstimatedHours)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{current.plan.status === 'executing' ? '執行中' : current.plan.status === 'ready' ? '待執行' : current.plan.status === 'blocked' ? '受阻' : '草稿'}</span></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${Math.round(((current.state?.completedStepIds.length ?? 0) / current.plan.steps.length) * 100)}%` }} /></div><div className="mt-5 space-y-2">{current.plan.steps.map(step => { const status = stepStatus(step, current.state); const isActionable = status === 'ready' || status === 'running'; return <div key={step.id} className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${status === 'running' ? 'border-slate-400 bg-slate-50' : 'border-slate-200'}`}><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{step.order}</span><div className="min-w-0"><p className={`font-semibold ${status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{step.title}</p><p className="mt-1 text-xs text-slate-500">{formatMinutes(step.estimatedHours)} · {status === 'locked' ? '等待前一步完成' : status === 'running' ? '執行中' : status === 'completed' ? '已完成' : '可以開始'}</p></div></div>{isActionable && <button disabled={status === 'ready' && Boolean(activeFocus)} onClick={() => status === 'running' ? completeStep(current.plan.id, step) : startStep(current.plan.id, step)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === 'running' ? '完成並記錄 Focus' : '開始執行'}</button>}</div>; })}</div></div>}

    {visiblePlans.length > 1 && <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-semibold text-slate-400">其他進行中計畫</p><div className="mt-2 grid gap-2 md:grid-cols-2">{visiblePlans.slice(1, 3).map(plan => <div key={plan.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-700">{plan.title.replace('｜執行計畫', '')}</p><p className="mt-1 text-xs text-slate-500">{plan.steps.length} 個步驟 · {formatMinutes(plan.totalEstimatedHours)}</p></div>)}</div></div>}
  </section>;
};

export default ManagerNextAction;
