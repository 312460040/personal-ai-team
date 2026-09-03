import React, { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { usePlanManager } from '../hooks/usePlanManager';
import type { WorkTask, StudyTask } from '../types';
import type { ExecutionPlanStep } from '../engines/taskPlanningEngine';

function deadlineValue(deadline?: string) {
  if (!deadline) return Number.MAX_SAFE_INTEGER;
  const value = new Date(deadline).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function priorityValue(priority?: string) {
  return priority === 'high' ? 0 : priority === 'medium' ? 1 : 2;
}

function isPending<T extends { status: string; source?: string }>(task: T) {
  return task.source === 'user' && task.status !== 'completed';
}

const ManagerNextAction: React.FC = () => {
  const { workProjects, workTasks, studyTasks, todayBlocks, currentContext } = useAppData();
  const planManager = usePlanManager({ workProjects, workTasks, studyTasks, todayBlocks });

  const scopedWorkTasks = useMemo(() => workTasks.filter(task =>
    isPending(task) &&
    task.workspaceId === currentContext.workspaceId &&
    task.projectId === currentContext.projectId
  ), [workTasks, currentContext]);

  const scopedStudyTasks = useMemo(() => studyTasks.filter(task => isPending(task)), [studyTasks]);

  const candidate = useMemo<WorkTask | StudyTask | undefined>(() => {
    const candidates = currentContext.workspaceId === 'work' ? scopedWorkTasks : [...scopedWorkTasks, ...scopedStudyTasks];
    return [...candidates].sort((a, b) => {
      const priorityDiff = priorityValue(b.priority) - priorityValue(a.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return deadlineValue(a.deadline) - deadlineValue(b.deadline);
    })[0];
  }, [currentContext.workspaceId, scopedStudyTasks, scopedWorkTasks]);

  const visiblePlans = useMemo(() => planManager.activePlans.filter(plan => {
    if (currentContext.workspaceId === 'work') return plan.projectId === currentContext.projectId;
    return true;
  }), [planManager.activePlans, currentContext]);

  const current = planManager.nextActions.find(item => item.plan.id === visiblePlans[0]?.id) ??
    planManager.nextActions.find(item => visiblePlans.some(plan => plan.id === item.plan.id));

  const createPlan = () => {
    if (!candidate) return;
    planManager.createPlanForTask(candidate);
  };

  const formatMinutes = (hours: number) => {
    const minutes = Math.round(hours * 60);
    return minutes >= 60 ? `${Math.floor(minutes / 60)} 小時 ${minutes % 60 ? `${minutes % 60} 分` : ''}`.trim() : `${minutes} 分鐘`;
  };

  const stepStatus = (step: ExecutionPlanStep, state?: { runningStepId?: string; completedStepIds: string[] }) => {
    if (!state) return 'ready';
    if (state.completedStepIds.includes(step.id)) return 'completed';
    if (state.runningStepId === step.id) return 'running';
    return step.dependsOn.every(id => state.completedStepIds.includes(id)) ? 'ready' : 'locked';
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Task Planning + Execution Engine</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">🎯 Manager 下一步</h2>
          <p className="mt-1 text-sm text-slate-500">Manager 把任務拆成可執行步驟，並依依賴關係逐步解鎖。</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{visiblePlans.length} 個進行中計畫</span>
      </div>

      {!current && !candidate && (
        <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
          目前沒有可建立執行計畫的 User Task。新增任務後，Manager 會在這裡提供下一步。
        </div>
      )}

      {!current && candidate && (
        <div className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">建議先處理</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{candidate.title}</h3>
            <p className="mt-1 text-sm text-slate-500">優先級：{candidate.priority === 'high' ? '高' : candidate.priority === 'medium' ? '中' : '低'}{candidate.deadline ? ` · 截止 ${candidate.deadline.replace('T', ' ')}` : ''}</p>
          </div>
          <button onClick={createPlan} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">建立執行計畫</button>
        </div>
      )}

      {current && (
        <div className="mt-5 rounded-xl border border-slate-200 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400">目前計畫</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">{current.plan.title.replace('｜執行計畫', '')}</h3>
              <p className="mt-1 text-sm text-slate-500">進度 {current.state?.completedStepIds.length ?? 0} / {current.plan.steps.length} · 預估 {formatMinutes(current.plan.totalEstimatedHours)}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{current.plan.status === 'executing' ? '執行中' : current.plan.status === 'ready' ? '待執行' : current.plan.status === 'blocked' ? '受阻' : '草稿'}</span>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${Math.round(((current.state?.completedStepIds.length ?? 0) / current.plan.steps.length) * 100)}%` }} />
          </div>

          <div className="mt-5 space-y-2">
            {current.plan.steps.map(step => {
              const status = stepStatus(step, current.state);
              const isActionable = status === 'ready' || status === 'running';
              return (
                <div key={step.id} className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${status === 'running' ? 'border-slate-400 bg-slate-50' : 'border-slate-200'}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold">{step.order}</span>
                    <div className="min-w-0">
                      <p className={`font-semibold ${status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{step.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatMinutes(step.estimatedHours)} · {status === 'locked' ? '等待前一步完成' : status === 'running' ? '執行中' : status === 'completed' ? '已完成' : '可以開始'}</p>
                    </div>
                  </div>
                  {isActionable && (
                    <button onClick={() => status === 'running' ? planManager.complete(current.plan.id, step.id) : planManager.start(current.plan.id, step.id)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                      {status === 'running' ? '完成' : '開始執行'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {visiblePlans.length > 1 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-400">其他進行中計畫</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {visiblePlans.slice(1, 3).map(plan => (
              <div key={plan.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-700">{plan.title.replace('｜執行計畫', '')}</p>
                <p className="mt-1 text-xs text-slate-500">{plan.steps.length} 個步驟 · {formatMinutes(plan.totalEstimatedHours)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default ManagerNextAction;
