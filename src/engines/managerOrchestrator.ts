import type { WorkProject, WorkTask, StudyTask, TodayTimeBlock } from '../types';
import { analyzeManagerState, type ManagerAnalysisResult } from './managerEngine';
import { decomposeTask, type ExecutionPlan } from './taskPlanningEngine';
import { diagnoseBehavior, type DiagnosisFinding } from './diagnosisEngine';
import type { FocusSession } from './focusEngine';

export type ManagerIntent = 'create' | 'plan' | 'status' | 'reschedule' | 'problem' | 'general';

export interface ManagerOrchestrationInput {
  text: string;
  workProjects: WorkProject[];
  workTasks: WorkTask[];
  studyTasks: StudyTask[];
  todayBlocks: TodayTimeBlock[];
  focusSessions?: FocusSession[];
  now?: Date;
}

export interface ManagerOrchestrationResult {
  intent: ManagerIntent;
  targetTask?: WorkTask | StudyTask;
  analysis: ManagerAnalysisResult;
  diagnosis: DiagnosisFinding[];
  executionPlan?: ExecutionPlan;
  requiresOwnerConfirmation: boolean;
  recommendedAction: string;
}

function detectIntent(text: string): ManagerIntent {
  if (/(拆解|分解|規劃|計畫|怎麼做|步驟)/i.test(text)) return 'plan';
  if (/(新增|建立|記一下|幫我記|加入)/i.test(text)) return 'create';
  if (/(延後|改到|重新安排|改時間|改期限)/i.test(text)) return 'reschedule';
  if (/(卡住|問題|困難|不會|遇到)/i.test(text)) return 'problem';
  if (/(目前|現在|優先|進度|有哪些|檢查|狀況)/i.test(text)) return 'status';
  return 'general';
}

function findExplicitTarget(text: string, workTasks: WorkTask[], studyTasks: StudyTask[]): WorkTask | StudyTask | undefined {
  const tasks = [...workTasks.filter(t => t.source === 'user'), ...studyTasks.filter(t => t.source === 'user')];
  return tasks.find(task => text.includes(task.title));
}

function buildPlanTarget(target: WorkTask | StudyTask, projects: WorkProject[], now: Date): ExecutionPlan {
  if ('projectId' in target) {
    return decomposeTask({ title: target.title, taskType: 'work', project: projects.find(p => p.id === target.projectId), sourceTask: target, now });
  }
  return decomposeTask({ title: target.title, taskType: 'study', sourceTask: target, now });
}

export function orchestrateManager(input: ManagerOrchestrationInput): ManagerOrchestrationResult {
  const now = input.now ?? new Date();
  const intent = detectIntent(input.text);
  const targetTask = findExplicitTarget(input.text, input.workTasks, input.studyTasks);
  const analysis = analyzeManagerState({ workTasks: input.workTasks, studyTasks: input.studyTasks, todayBlocks: input.todayBlocks, now });
  const diagnosis = diagnoseBehavior({ workTasks: input.workTasks, studyTasks: input.studyTasks, focusSessions: input.focusSessions ?? [] });

  let executionPlan: ExecutionPlan | undefined;
  if (intent === 'plan' && targetTask) executionPlan = buildPlanTarget(targetTask, input.workProjects, now);

  const requiresOwnerConfirmation = intent === 'reschedule' || intent === 'create' || Boolean(executionPlan);
  let recommendedAction = '先讀取目前狀態，再決定下一步。';
  if (intent === 'plan') recommendedAction = targetTask ? '已找到目標任務，可建立執行計畫；建立正式資料前需要 Owner 確認。' : '需要指定明確任務後才能安全拆解，不猜目標。';
  else if (intent === 'status') recommendedAction = analysis.insights[0]?.description ?? '目前沒有偵測到需要立即處理的高風險事項。';
  else if (intent === 'problem') recommendedAction = '記錄問題後，交由 Diagnosis 與對應 Agent 分析原因。';
  else if (analysis.rescheduleProposals.length > 0) recommendedAction = '目前存在重新排程建議，Manager 應先讓 Owner 確認，再修改正式資料。';

  return { intent, targetTask, analysis, diagnosis, executionPlan, requiresOwnerConfirmation, recommendedAction };
}
