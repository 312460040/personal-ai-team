import type { WorkTask, WorkProject, StudyTask } from '../types';

export type PlanTaskType = 'work' | 'study';

export interface TaskDependency { taskId: string; dependsOnTaskId: string; type: 'blocks' | 'related'; }
export interface ExecutionPlanStep { id: string; title: string; taskType: PlanTaskType; estimatedHours: number; priority: 'high' | 'medium' | 'low'; dependsOn: string[]; order: number; reason: string; }
export interface ExecutionPlan {
  id: string; title: string; objective: string; sourceTaskId?: string; projectId?: string; subjectId?: string;
  status: 'draft' | 'ready' | 'executing' | 'completed' | 'blocked'; steps: ExecutionPlanStep[]; totalEstimatedHours: number; createdAt: string;
}
export interface DecompositionInput { title: string; objective?: string; taskType: PlanTaskType; project?: WorkProject; sourceTask?: WorkTask | StudyTask; requestedSteps?: string[]; now?: Date; }

export function decomposeTask(input: DecompositionInput): ExecutionPlan {
  const now = input.now ?? new Date();
  const rawSteps = input.requestedSteps?.map(x => x.trim()).filter(Boolean) ?? [];
  const steps = rawSteps.length > 0 ? rawSteps : inferSteps(input.title, input.taskType);
  const baseHours = Math.max(0.25, input.sourceTask?.estimatedHours ?? 1);
  const perStep = Math.max(0.25, Number((baseHours / steps.length).toFixed(2)));
  const planId = `plan-${input.sourceTask?.id ?? now.getTime()}`;
  const planSteps = steps.map((title, index) => ({
    id: `${planId}-step-${index + 1}`, title, taskType: input.taskType,
    estimatedHours: index === steps.length - 1 ? Math.max(0.25, Number((baseHours - perStep * (steps.length - 1)).toFixed(2))) : perStep,
    priority: input.sourceTask?.priority ?? input.project?.priority ?? 'medium',
    dependsOn: index === 0 ? [] : [`${planId}-step-${index}`], order: index + 1,
    reason: rawSteps.length > 0 ? '依 Owner 提供的執行步驟建立。' : '依任務類型套用保守執行流程。',
  }));
  return {
    id: planId, title: `${input.title}｜執行計畫`, objective: input.objective?.trim() || input.title,
    sourceTaskId: input.sourceTask?.id,
    projectId: input.taskType === 'work' ? (input.sourceTask && 'projectId' in input.sourceTask ? input.sourceTask.projectId : input.project?.id) : undefined,
    subjectId: input.taskType === 'study' ? (input.sourceTask && 'subjectId' in input.sourceTask ? input.sourceTask.subjectId : undefined) : undefined,
    status: 'draft', steps: planSteps,
    totalEstimatedHours: Number(planSteps.reduce((sum, step) => sum + step.estimatedHours, 0).toFixed(2)), createdAt: now.toISOString(),
  };
}

function inferSteps(title: string, taskType: PlanTaskType): string[] {
  const lower = title.toLowerCase();
  if (taskType === 'work') {
    if (/(影片|短影音|video|reel|剪輯)/i.test(lower)) return ['確認需求與目標', '整理素材與參考', '建立腳本／製作草稿', '內部檢查與修改', '提交客戶確認／發布'];
    if (/(企劃|計畫|proposal|plan)/i.test(lower)) return ['釐清目標與限制', '蒐集必要資料', '建立初版方案', '檢查可行性與風險', '整理成正式版本'];
    if (/(資料|分析|研究|report|報告)/i.test(lower)) return ['確認分析問題', '蒐集與整理資料', '進行分析', '檢查結果', '整理結論與輸出'];
    return ['釐清需求', '準備必要資料', '執行主要工作', '檢查結果', '完成與回報'];
  }
  if (/(論文|研究|paper)/i.test(lower)) return ['確認研究問題', '整理文獻與資料', '進行分析／撰寫', '檢查論證與格式', '整理下一步'];
  if (/(考試|exam|複習)/i.test(lower)) return ['確認考試範圍', '建立重點清單', '理解與練習', '錯題／弱點整理', '模擬測驗與複習'];
  return ['確認學習目標', '理解核心內容', '練習與應用', '檢查理解程度', '整理筆記與下一步'];
}

export function validateExecutionPlan(plan: ExecutionPlan): string[] {
  const errors: string[] = [];
  if (!plan.title.trim()) errors.push('計畫缺少標題。');
  if (!plan.objective.trim()) errors.push('計畫缺少目標。');
  if (!plan.steps.length) errors.push('計畫至少需要一個步驟。');
  if (plan.steps.some(step => step.estimatedHours <= 0)) errors.push('所有步驟的預估時間必須大於 0。');
  const ids = new Set(plan.steps.map(step => step.id));
  plan.steps.forEach(step => step.dependsOn.forEach(dep => { if (!ids.has(dep)) errors.push(`步驟「${step.title}」依賴不存在的步驟。`); }));
  return errors;
}
export function getReadySteps(plan: ExecutionPlan, completedStepIds: string[]): ExecutionPlanStep[] {
  const completed = new Set(completedStepIds);
  return plan.steps.filter(step => !completed.has(step.id) && step.dependsOn.every(dep => completed.has(dep)));
}
