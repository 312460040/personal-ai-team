import React, { useEffect, useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { usePlanManager } from '../hooks/usePlanManager';
import type { WorkTask, StudyTask } from '../types';
import type { ExecutionPlanStep } from '../engines/taskPlanningEngine';
import { createFocusSession, finishFocusSession, getElapsedMinutes } from '../engines/focusEngine';
import type { FocusSession } from '../engines/focusEngine';
import { diagnoseBehavior } from '../engines/diagnosisEngine';
import { buildAdaptiveProposals } from '../engines/adaptivePlanningEngine';
import { decideNextExecution } from '../engines/managerDecisionEngine';
import type { ManagerMemory } from '../engines/memoryEngine';
import { persistFocusSession } from '../services/persistenceApi';

const FOCUS_KEY = 'ait_focus_sessions_v1';
const ACTIVE_FOCUS_KEY = 'ait_active_focus_session_v1';
const MEMORY_KEY = 'ait_manager_memories_v2';
const AUTO_PLAN_KEY = 'ait_manager_auto_plan_v1';
const REMINDER_KEY = 'ait_manager_execution_reminder_v1';
const FOCUS_CHANGED_EVENT = 'ait:focus-changed';
const REMINDER_GRACE_MINUTES = 10;

function deadlineValue(deadline?: string) { if (!deadline) return Number.MAX_SAFE_INTEGER; const value = new Date(deadline).getTime(); return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value; }
function priorityValue(priority?: string) { return priority === 'high' ? 2 : priority === 'medium' ? 1 : 0; }
function isPending<T extends { status: string; source?: string }>(task: T) { return task.source === 'user' && task.status !== 'completed'; }
function loadActiveFocus(): FocusSession | null { try { const raw = localStorage.getItem(ACTIVE_FOCUS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function saveActiveFocus(session: FocusSession | null) { if (session) localStorage.setItem(ACTIVE_FOCUS_KEY, JSON.stringify(session)); else localStorage.removeItem(ACTIVE_FOCUS_KEY); window.dispatchEvent(new Event(FOCUS_CHANGED_EVENT)); }
function appendFinishedFocus(session: FocusSession) { try { const current = JSON.parse(localStorage.getItem(FOCUS_KEY) || '[]') as FocusSession[]; localStorage.setItem(FOCUS_KEY, JSON.stringify([session, ...current].slice(0, 100))); } catch { localStorage.setItem(FOCUS_KEY, JSON.stringify([session])); } }
function loadMemories(): ManagerMemory[] { try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]'); } catch { return []; } }
type ReminderState = { taskId: string; blockId: string; remindedAt: number; followUpSent: boolean };
function loadReminder(): ReminderState | null { try { const raw = localStorage.getItem(REMINDER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function saveReminder(value: ReminderState | null) { if (value) localStorage.setItem(REMINDER_KEY, JSON.stringify(value)); else localStorage.removeItem(REMINDER_KEY); }

const ManagerNextAction: React.FC = () => {
  const { workProjects, workTasks, studyTasks, todayBlocks, currentContext } = useAppData();
  const planManager = usePlanManager({ workProjects, workTasks, studyTasks, todayBlocks });
  const [activeFocus, setActiveFocus] = useState<FocusSession | null>(() => loadActiveFocus());
  const [elapsed, setElapsed] = useState(0);
  const [memories, setMemories] = useState<ManagerMemory[]>(() => loadMemories());
  const [nowTick, setNowTick] = useState(Date.now());
  const [autoPlanMessage, setAutoPlanMessage] = useState<string | null>(null);
  const [reminder, setReminder] = useState<string | null>(null);

  useEffect(() => { const id = window.setInterval(() => setNowTick(Date.now()), 30000); return () => window.clearInterval(id); }, []);
  useEffect(() => { localStorage.setItem(MEMORY_KEY, JSON.stringify(memories)); }, [memories]);
  useEffect(() => { const sync = () => { setActiveFocus(loadActiveFocus()); setMemories(loadMemories()); }; window.addEventListener(FOCUS_CHANGED_EVENT, sync); window.addEventListener('storage', sync); return () => { window.removeEventListener(FOCUS_CHANGED_EVENT, sync); window.removeEventListener('storage', sync); }; }, []);
  useEffect(() => { if (!activeFocus) { setElapsed(0); return; } const tick = () => setElapsed(getElapsedMinutes(activeFocus)); tick(); const id = window.setInterval(tick, 1000); return () => window.clearInterval(id); }, [activeFocus]);

  const scopedWorkTasks = useMemo(() => workTasks.filter(task => isPending(task) && task.workspaceId === currentContext.workspaceId && task.projectId === currentContext.projectId), [workTasks, currentContext]);
  const scopedStudyTasks = useMemo(() => studyTasks.filter(task => isPending(task)), [studyTasks]);
  const candidateTasks = useMemo(() => currentContext.workspaceId === 'work' ? scopedWorkTasks : [...scopedWorkTasks, ...scopedStudyTasks], [currentContext.workspaceId, scopedStudyTasks, scopedWorkTasks]);
  const sessions = useMemo(() => { try { return JSON.parse(localStorage.getItem(FOCUS_KEY) || '[]') as FocusSession[]; } catch { return []; } }, [nowTick, activeFocus]);
  const diagnosis = useMemo(() => diagnoseBehavior({ workTasks: scopedWorkTasks, studyTasks: scopedStudyTasks, focusSessions: sessions }), [scopedWorkTasks, scopedStudyTasks, sessions]);
  const adaptive = useMemo(() => buildAdaptiveProposals({ workTasks: scopedWorkTasks, studyTasks: scopedStudyTasks, focusSessions: sessions, memories }), [scopedWorkTasks, scopedStudyTasks, sessions, memories]);
  const candidate = useMemo<WorkTask | StudyTask | undefined>(() => [...candidateTasks].sort((a, b) => { const riskA = diagnosis.some(x => x.level === 'danger' && x.id.includes(a.id)) ? 1 : 0; const riskB = diagnosis.some(x => x.level === 'danger' && x.id.includes(b.id)) ? 1 : 0; if (riskB !== riskA) return riskB - riskA; const priorityDiff = priorityValue(b.priority) - priorityValue(a.priority); if (priorityDiff !== 0) return priorityDiff; return deadlineValue(a.deadline) - deadlineValue(b.deadline); })[0], [candidateTasks, diagnosis]);
  const visiblePlans = useMemo(() => planManager.activePlans.filter(plan => currentContext.workspaceId === 'work' ? plan.projectId === currentContext.projectId : true), [planManager.activePlans, currentContext]);
  const current = planManager.nextActions.find(item => item.plan.id === visiblePlans[0]?.id) ?? planManager.nextActions.find(item => visiblePlans.some(plan => plan.id === item.plan.id));
  const adaptiveAction = adaptive[0];
  const diagnosisAction = diagnosis[0];

  useEffect(() => { if (!candidate || current || activeFocus) return; const marker = localStorage.getItem(AUTO_PLAN_KEY); if (marker === candidate.id) return; const result = planManager.ensurePlanForTask(candidate); localStorage.setItem(AUTO_PLAN_KEY, candidate.id); if (result.created) setAutoPlanMessage(`Manager 已自動為「${candidate.title}」建立執行計畫。`); }, [candidate, current, activeFocus, planManager.ensurePlanForTask]);
  const executionDecision = useMemo(() => candidate ? decideNextExecution({ task: candidate, plan: current?.plan, state: current?.state, todayBlocks, now: new Date(nowTick), activeFocus: Boolean(activeFocus) }) : undefined, [candidate, current, todayBlocks, nowTick, activeFocus]);
  useEffect(() => { if (!candidate || !executionDecision || activeFocus || executionDecision.action !== 'start-now' || !executionDecision.block) return; const blockId = executionDecision.block.id; const existing = loadReminder(); const markerMatches = existing?.taskId === candidate.id && existing.blockId === blockId; const now = Date.now(); if (!markerMatches) { saveReminder({ taskId: candidate.id, blockId, remindedAt: now, followUpSent: false }); setReminder(`現在是適合處理「${candidate.title}」的時間。Manager 建議開始下一步：${executionDecision.step?.title ?? '執行目前計畫'}。`); return; } if (existing && !existing.followUpSent && now - existing.remindedAt >= REMINDER_GRACE_MINUTES * 60 * 1000) { saveReminder({ ...existing, followUpSent: true }); setReminder(`你還沒有開始「${candidate.title}」。Manager 發現已經延遲約 ${REMINDER_GRACE_MINUTES} 分鐘，建議現在開始；如果遇到問題，可以直接告訴 Manager。`); } }, [candidate, executionDecision, activeFocus, nowTick]);
  useEffect(() => { if (activeFocus || executionDecision?.action !== 'start-now') { setReminder(null); if (activeFocus || executionDecision?.action !== 'start-now') saveReminder(null); } }, [activeFocus, executionDecision?.action]);

  const createPlan = () => { if (candidate) planManager.createPlanForTask(candidate); };
  const formatMinutes = (hours: number) => { const minutes = Math.round(hours * 60); return minutes >= 60 ? `${Math.floor(minutes / 60)} 小時 ${minutes % 60 ? `${minutes % 60} 分` : ''}`.trim() : `${minutes} 分鐘`; };
  const stepStatus = (step: ExecutionPlanStep, state?: { runningStepId?: string; completedStepIds: string[] }) => { if (!state) return 'ready'; if (state.completedStepIds.includes(step.id)) return 'completed'; if (state.runningStepId === step.id) return 'running'; return step.dependsOn.every(id => state.completedStepIds.includes(id)) ? 'ready' : 'locked'; };
  const startStep = (planId: string, step: ExecutionPlanStep) => { if (activeFocus) { window.alert(`目前已有 Focus：「${activeFocus.taskTitle}」，請先完成或結束目前工作。`); return; } const started = planManager.start(planId, step.id); if (!started) return; const session = createFocusSession({ taskId: step.id, taskTitle: step.title, plannedMinutes: Math.max(1, Math.round(step.estimatedHours * 60)) }); saveActiveFocus(session); setActiveFocus(session); setReminder(null); saveReminder(null); };
  const completeStep = (planId: string, step: ExecutionPlanStep) => { const completed = planManager.complete(planId, step.id); if (!completed) return; if (activeFocus?.taskId === step.id) { const finished = finishFocusSession(activeFocus, { completed: true }); appendFinishedFocus(finished); void persistFocusSession({ taskId: finished.taskId, plannedMinutes: finished.plannedMinutes, actualMinutes: finished.actualMinutes, startedAt: finished.startedAt, endedAt: finished.endedAt, completed: finished.completed, interruptionCount: finished.interruptionCount }); saveActiveFocus(null); setActiveFocus(null); } };

  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-500">Manager Decision Layer</p><h2 className="mt-1 text-xl font-bold text-slate-900">🎯 Manager 下一步</h2><p className="mt-1 text-sm text-slate-500">不只看優先級，也會參考 Diagnosis、歷史行為與 Adaptive Planning。</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{visiblePlans.length} 個進行中計畫</span></div>
    {(diagnosisAction || adaptiveAction) && <div className="mt-5 grid gap-3 md:grid-cols-2">{diagnosisAction && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-700">🔍 Diagnosis</p><p className="mt-1 font-semibold text-slate-800">{diagnosisAction.title}</p><p className="mt-1 text-sm text-slate-600">{diagnosisAction.recommendation}</p></div>}{adaptiveAction && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">🔄 Adaptive Planning</p><p className="mt-1 font-semibold text-slate-800">{adaptiveAction.title}</p><p className="mt-1 text-sm text-slate-600">{adaptiveAction.suggestedAction}</p></div>}</div>}
    {autoPlanMessage && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">✓ {autoPlanMessage}</div>}
    {reminder && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">⏰ {reminder}</div>}
    {activeFocus && <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-500">FOCUS SESSION</p><h3 className="mt-1 text-lg font-bold text-slate-900">{activeFocus.taskTitle}</h3></div><span className="text-2xl font-bold tabular-nums text-slate-900">{Math.floor(elapsed / 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')}</span></div><p className="mt-2 text-sm text-slate-500">預計 {activeFocus.plannedMinutes} 分鐘 · 進行中</p></div>}
    {!activeFocus && candidate && <div className="mt-5 rounded-xl border border-slate-200 p-5"><p className="text-xs font-semibold text-slate-500">NEXT BEST ACTION</p><h3 className="mt-1 text-lg font-bold text-slate-900">{candidate.title}</h3><p className="mt-2 text-sm text-slate-600">{executionDecision?.reason || 'Manager 正在評估下一步。'}</p>{executionDecision?.step && <p className="mt-2 text-sm text-slate-500">下一步：{executionDecision.step.title} · {formatMinutes(executionDecision.step.estimatedHours)}</p>}</div>}
    {visiblePlans.map(plan => { const state = planManager.executionStates[plan.id]; return <div key={plan.id} className="mt-5 rounded-xl border border-slate-200 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-500">EXECUTION PLAN</p><h3 className="mt-1 font-bold text-slate-900">{plan.title}</h3></div><button className="rounded-lg border px-3 py-2 text-sm" onClick={createPlan}>重新建立</button></div><div className="mt-4 space-y-2">{plan.steps.map(step => { const status = stepStatus(step, state); return <div key={step.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3"><div><p className="font-medium text-slate-800">{step.order}. {step.title}</p><p className="text-xs text-slate-500">{formatMinutes(step.estimatedHours)} · {status}</p></div>{status === 'ready' && <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={() => startStep(plan.id, step)}>開始 Focus</button>}{status === 'running' && <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => completeStep(plan.id, step)}>完成</button>}</div>; })}</div></div>; })}
    {!candidate && !activeFocus && <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">目前沒有可立即執行的使用者任務。Manager 會持續根據你的資料與行程判斷下一步。</div>}
  </section>;
};

export default ManagerNextAction;
