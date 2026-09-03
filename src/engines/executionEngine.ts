import type { WorkTask, StudyTask } from '../types';
import type { ExecutionPlan, ExecutionPlanStep } from './taskPlanningEngine';

export interface StepExecution {
  id: string;
  planId: string;
  stepId: string;
  taskId?: string;
  startedAt?: string;
  endedAt?: string;
  status: 'locked' | 'ready' | 'running' | 'completed' | 'blocked';
  actualMinutes?: number;
  note?: string;
}

export interface ExecutionState {
  planId: string;
  completedStepIds: string[];
  executions: StepExecution[];
  updatedAt: string;
}

export function createExecutionState(plan: ExecutionPlan, now = new Date()): ExecutionState {
  const executions = plan.steps.map(step => ({
    id: `exec-${plan.id}-${step.id}`,
    planId: plan.id,
    stepId: step.id,
    status: step.dependsOn.length === 0 ? 'ready' : 'locked',
  }));
  return { planId: plan.id, completedStepIds: [], executions, updatedAt: now.toISOString() };
}

export function refreshExecutionState(plan: ExecutionPlan, state: ExecutionState, now = new Date()): ExecutionState {
  const completed = new Set(state.completedStepIds);
  const executions = state.executions.map(execution => {
    if (completed.has(execution.stepId) || execution.status === 'completed') return { ...execution, status: 'completed' as const };
    const step = plan.steps.find(x => x.id === execution.stepId);
    if (!step) return { ...execution, status: 'blocked' as const };
    const ready = step.dependsOn.every(dep => completed.has(dep));
    if (execution.status === 'running') return execution;
    return { ...execution, status: ready ? 'ready' as const : 'locked' as const };
  });
  return { ...state, executions, updatedAt: now.toISOString() };
}

export function startStep(plan: ExecutionPlan, state: ExecutionState, stepId: string, now = new Date()): ExecutionState {
  const refreshed = refreshExecutionState(plan, state, now);
  const target = refreshed.executions.find(x => x.stepId === stepId);
  if (!target || target.status !== 'ready') return refreshed;
  return {
    ...refreshed,
    executions: refreshed.executions.map(x => x.stepId === stepId ? { ...x, status: 'running' as const, startedAt: now.toISOString() } : x),
    updatedAt: now.toISOString(),
  };
}

export function completeStep(plan: ExecutionPlan, state: ExecutionState, stepId: string, note?: string, now = new Date()): ExecutionState {
  const refreshed = refreshExecutionState(plan, state, now);
  const target = refreshed.executions.find(x => x.stepId === stepId);
  if (!target || (target.status !== 'running' && target.status !== 'ready')) return refreshed;
  const started = target.startedAt ? new Date(target.startedAt).getTime() : now.getTime();
  const actualMinutes = Math.max(0, Math.round((now.getTime() - started) / 60000));
  const completedStepIds = Array.from(new Set([...refreshed.completedStepIds, stepId]));
  const next = {
    ...refreshed,
    completedStepIds,
    executions: refreshed.executions.map(x => x.stepId === stepId ? { ...x, status: 'completed' as const, endedAt: now.toISOString(), actualMinutes, note } : x),
    updatedAt: now.toISOString(),
  };
  return refreshExecutionState(plan, next, now);
}

export function getNextReadyStep(plan: ExecutionPlan, state: ExecutionState): ExecutionPlanStep | undefined {
  const refreshed = refreshExecutionState(plan, state);
  return plan.steps.find(step => refreshed.executions.some(x => x.stepId === step.id && x.status === 'ready'));
}

export function syncPlanStatus(plan: ExecutionPlan, state: ExecutionState): ExecutionPlan {
  const refreshed = refreshExecutionState(plan, state);
  if (refreshed.executions.some(x => x.status === 'blocked')) return { ...plan, status: 'blocked' };
  if (refreshed.completedStepIds.length === plan.steps.length && plan.steps.length > 0) return { ...plan, status: 'completed' };
  if (refreshed.executions.some(x => x.status === 'running')) return { ...plan, status: 'executing' };
  return { ...plan, status: refreshed.executions.some(x => x.status === 'ready') ? 'ready' : 'draft' };
}

/** 將執行結果對應回原始 Task；不直接寫入 Context，交由上層 Action Guard 決定。 */
export function executionProgressPercent(plan: ExecutionPlan, state: ExecutionState): number {
  if (!plan.steps.length) return 0;
  return Math.round(state.completedStepIds.length / plan.steps.length * 100);
}

export function findExecutionTask(tasks: Array<WorkTask | StudyTask>, execution: StepExecution): WorkTask | StudyTask | undefined {
  return execution.taskId ? tasks.find(task => task.id === execution.taskId) : undefined;
}
