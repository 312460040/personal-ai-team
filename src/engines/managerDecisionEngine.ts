import type { TodayTimeBlock, WorkTask, StudyTask } from '../types';
import type { ExecutionPlan, ExecutionPlanStep } from './taskPlanningEngine';
import type { ExecutionState } from './executionEngine';

export interface ExecutionDecision {
  action: 'start-now' | 'prepare-next' | 'protect-focus' | 'wait';
  title: string;
  reason: string;
  step?: ExecutionPlanStep;
  block?: TodayTimeBlock;
  urgency: 'high' | 'medium' | 'low';
}

function parseTimeRange(timeRange: string): { start: number; end: number } | null {
  const matches = timeRange.match(/(\d{1,2}):(\d{2})\s*(?:-|~|–|—)\s*(\d{1,2}):(\d{2})/);
  if (!matches) return null;
  const start = Number(matches[1]) * 60 + Number(matches[2]);
  const end = Number(matches[3]) * 60 + Number(matches[4]);
  return { start, end: end >= start ? end : end + 24 * 60 };
}

function blockMatchesTask(block: TodayTimeBlock, task: WorkTask | StudyTask): boolean {
  const taskIsWork = 'projectId' in task;
  if (taskIsWork) return block.type === 'work' || block.agentOwner === 'work' || block.agentOwner === 'manager';
  return block.type === 'study' || block.agentOwner === 'study' || block.agentOwner === 'manager';
}

function getReadyStep(plan: ExecutionPlan, state?: ExecutionState): ExecutionPlanStep | undefined {
  if (!state) return plan.steps.find(step => step.dependsOn.length === 0);
  return plan.steps.find(step => !state.completedStepIds.includes(step.id)
    && !state.runningStepId
    && step.dependsOn.every(dep => state.completedStepIds.includes(dep)));
}

export function decideNextExecution(input: {
  task: WorkTask | StudyTask;
  plan?: ExecutionPlan;
  state?: ExecutionState;
  todayBlocks: TodayTimeBlock[];
  now?: Date;
  activeFocus?: boolean;
}): ExecutionDecision {
  const now = input.now ?? new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const taskIsWork = 'projectId' in input.task;
  const relevantBlocks = input.todayBlocks
    .filter(block => block.source === 'user' && !block.completed && blockMatchesTask(block, input.task))
    .map(block => ({ block, range: parseTimeRange(block.timeRange) }))
    .filter(item => item.range !== null) as { block: TodayTimeBlock; range: { start: number; end: number } }[];

  const currentBlock = relevantBlocks.find(item => currentMinutes >= item.range.start && currentMinutes < item.range.end)?.block;
  const nextBlock = relevantBlocks
    .filter(item => item.range.start > currentMinutes)
    .sort((a, b) => a.range.start - b.range.start)[0]?.block;

  const step = input.plan ? getReadyStep(input.plan, input.state) : undefined;

  if (input.activeFocus) {
    return { action: 'protect-focus', title: '保護目前 Focus', reason: '目前已有工作正在執行，Manager 暫不切換任務。', step, urgency: 'medium' };
  }

  if (currentBlock) {
    return {
      action: 'start-now',
      title: `現在適合執行「${input.task.title}」`,
      reason: `目前位於 ${currentBlock.timeRange} 的${taskIsWork ? '工作' : '學習'}時段「${currentBlock.title}」，Manager 建議直接處理下一個可執行步驟。`,
      step,
      block: currentBlock,
      urgency: input.task.priority === 'high' ? 'high' : 'medium',
    };
  }

  if (nextBlock) {
    return {
      action: 'prepare-next',
      title: `準備下一個${taskIsWork ? '工作' : '學習'}時段`,
      reason: `下一個適合處理此任務的時段是 ${nextBlock.timeRange}「${nextBlock.title}」。現在先準備必要資料，不提前切換 Focus。`,
      step,
      block: nextBlock,
      urgency: input.task.priority === 'high' ? 'high' : 'low',
    };
  }

  return {
    action: 'wait',
    title: '目前沒有合適的執行時段',
    reason: 'Manager 找不到今天尚未完成且與此任務相符的時間區塊，因此不自行猜測新的時間。',
    step,
    urgency: input.task.priority === 'high' ? 'high' : 'low',
  };
}
