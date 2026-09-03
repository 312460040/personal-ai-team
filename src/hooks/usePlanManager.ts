import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WorkProject, WorkTask, StudyTask, TodayTimeBlock } from '../types';
import type { ExecutionPlan } from '../engines/taskPlanningEngine';
import type { ExecutionState } from '../engines/executionEngine';
import { createExecutionState, startStep, completeStep, syncPlanStatus, getNextReadyStep } from '../engines/executionEngine';
import { decomposeTask } from '../engines/taskPlanningEngine';
import { loadPlans, loadExecutionStates, savePlans, saveExecutionStates } from '../stores/planStore';

export function usePlanManager(input: { workProjects: WorkProject[]; workTasks: WorkTask[]; studyTasks: StudyTask[]; todayBlocks: TodayTimeBlock[] }) {
  const [plans, setPlans] = useState<ExecutionPlan[]>(() => loadPlans());
  const [executionStates, setExecutionStates] = useState<Record<string, ExecutionState>>(() => loadExecutionStates());
  useEffect(() => { savePlans(plans); }, [plans]);
  useEffect(() => { saveExecutionStates(executionStates); }, [executionStates]);

  const createPlanForTask = useCallback((task: WorkTask | StudyTask, objective?: string) => {
    const project = 'projectId' in task ? input.workProjects.find(p => p.id === task.projectId) : undefined;
    const plan = decomposeTask({ title: task.title, objective, taskType: 'projectId' in task ? 'work' : 'study', project, sourceTask: task });
    setPlans(prev => [plan, ...prev.filter(p => p.id !== plan.id)]);
    setExecutionStates(prev => ({ ...prev, [plan.id]: createExecutionState(plan) }));
    return plan;
  }, [input.workProjects]);

  const ensurePlanForTask = useCallback((task: WorkTask | StudyTask, objective?: string) => {
    const existing = plans.find(plan => plan.sourceTaskId === task.id && plan.status !== 'completed');
    if (existing) return { plan: existing, created: false };
    return { plan: createPlanForTask(task, objective), created: true };
  }, [plans, createPlanForTask]);

  const start = useCallback((planId: string, stepId: string) => {
    const plan = plans.find(p => p.id === planId); const state = executionStates[planId];
    if (!plan || !state) return false;
    const next = startStep(plan, state, stepId);
    setExecutionStates(prev => ({ ...prev, [planId]: next }));
    setPlans(prev => prev.map(p => p.id === planId ? syncPlanStatus(p, next) : p));
    return next !== state;
  }, [plans, executionStates]);

  const complete = useCallback((planId: string, stepId: string, note?: string) => {
    const plan = plans.find(p => p.id === planId); const state = executionStates[planId];
    if (!plan || !state) return false;
    const next = completeStep(plan, state, stepId, note);
    setExecutionStates(prev => ({ ...prev, [planId]: next }));
    setPlans(prev => prev.map(p => p.id === planId ? syncPlanStatus(p, next) : p));
    return next !== state;
  }, [plans, executionStates]);

  const activePlans = useMemo(() => plans.filter(p => p.status !== 'completed'), [plans]);
  const nextActions = useMemo(() => activePlans.map(plan => ({ plan, state: executionStates[plan.id], nextStep: executionStates[plan.id] ? getNextReadyStep(plan, executionStates[plan.id]) : undefined })), [activePlans, executionStates]);
  return { plans, executionStates, activePlans, nextActions, createPlanForTask, ensurePlanForTask, start, complete };
}
