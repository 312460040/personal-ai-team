import type { ExecutionPlan } from '../engines/taskPlanningEngine';
import type { ExecutionState } from '../engines/executionEngine';

export const PLANS_STORAGE_KEY = 'ait_plans_v1';
export const EXECUTION_STORAGE_KEY = 'ait_execution_states_v1';

export function loadPlans(): ExecutionPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Error reading ${PLANS_STORAGE_KEY}`, error);
    return [];
  }
}

export function savePlans(plans: ExecutionPlan[]): void {
  localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
}

export function loadExecutionStates(): Record<string, ExecutionState> {
  try {
    const raw = localStorage.getItem(EXECUTION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error(`Error reading ${EXECUTION_STORAGE_KEY}`, error);
    return {};
  }
}

export function saveExecutionStates(states: Record<string, ExecutionState>): void {
  localStorage.setItem(EXECUTION_STORAGE_KEY, JSON.stringify(states));
}

export function upsertPlan(plan: ExecutionPlan): ExecutionPlan[] {
  const plans = loadPlans();
  const index = plans.findIndex(item => item.id === plan.id);
  if (index < 0) return [plan, ...plans];
  const next = [...plans];
  next[index] = plan;
  return next;
}

export function upsertExecutionState(state: ExecutionState): Record<string, ExecutionState> {
  const states = loadExecutionStates();
  return { ...states, [state.planId]: state };
}
