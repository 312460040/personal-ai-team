import type { WorkTask, StudyTask } from '../types';
import type { FocusSession } from './focusEngine';
import type { ManagerMemory } from './memoryEngine';

export interface AdaptiveProposal {
  id: string;
  type: 'time-buffer' | 'focus-protection' | 'priority-review' | 'task-breakdown';
  title: string;
  reason: string;
  suggestedAction: string;
  confidence: number;
  sourceIds: string[];
}

function elapsed(session: FocusSession): number {
  if (!session.endedAt) return 0;
  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.endedAt).getTime();
  return Number.isNaN(start) || Number.isNaN(end) ? 0 : Math.max(0, Math.floor((end - start) / 60000));
}

export function buildAdaptiveProposals(input: {
  workTasks: WorkTask[];
  studyTasks: StudyTask[];
  focusSessions: FocusSession[];
  memories: ManagerMemory[];
}): AdaptiveProposal[] {
  const proposals: AdaptiveProposal[] = [];
  const completedFocus = input.focusSessions.filter(s => s.endedAt);
  const overruns = completedFocus.filter(s => elapsed(s) > s.plannedMinutes * 1.25);
  const interrupted = completedFocus.filter(s => s.interruptionCount > 0);
  const delayed = [...input.workTasks, ...input.studyTasks].filter(t => t.source === 'user' && t.status === 'delayed');

  if (overruns.length >= 3 && overruns.length / completedFocus.length >= 0.5) {
    proposals.push({
      id: 'adaptive-time-buffer',
      type: 'time-buffer',
      title: '下次排程增加時間緩衝',
      reason: `近期 ${overruns.length}/${completedFocus.length} 次 Focus 明顯超出預估。`,
      suggestedAction: '相似任務下次預估時間增加約 25%，先作為建議，不直接修改任務。',
      confidence: Math.min(0.95, 0.55 + overruns.length * 0.08),
      sourceIds: overruns.map(s => s.id),
    });
  }

  if (interrupted.length >= 3 && interrupted.length / completedFocus.length >= 0.4) {
    proposals.push({
      id: 'adaptive-focus-protection',
      type: 'focus-protection',
      title: '保護高專注時段',
      reason: `近期 ${interrupted.length}/${completedFocus.length} 次 Focus 曾被中斷。`,
      suggestedAction: '下一次安排重要工作時，盡量避免在 Focus 期間插入非必要提醒。',
      confidence: Math.min(0.9, 0.55 + interrupted.length * 0.07),
      sourceIds: interrupted.map(s => s.id),
    });
  }

  if (delayed.length >= 2) {
    proposals.push({
      id: 'adaptive-priority-review',
      type: 'priority-review',
      title: '重新檢查延遲任務優先級',
      reason: `目前有 ${delayed.length} 個 User Task 處於延遲狀態。`,
      suggestedAction: 'Manager 應先檢查卡點、依賴與截止日，再提出重新排程方案。',
      confidence: 0.75,
      sourceIds: delayed.map(t => t.id),
    });
  }

  const hasRepeatedProblem = input.memories.some(m => m.type === 'pattern' || m.type === 'problem');
  if (hasRepeatedProblem) {
    proposals.push({
      id: 'adaptive-task-breakdown',
      type: 'task-breakdown',
      title: '重複卡點任務改用更細的步驟',
      reason: 'Memory 已記錄問題或重複模式。',
      suggestedAction: '下次建立執行計畫時優先拆成較小步驟，降低一次卡住整個任務的風險。',
      confidence: 0.7,
      sourceIds: input.memories.filter(m => m.type === 'pattern' || m.type === 'problem').map(m => m.id),
    });
  }

  return proposals;
}
