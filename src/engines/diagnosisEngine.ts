import type { WorkTask, StudyTask } from '../types';
import type { FocusSession } from './focusEngine';

export type DiagnosisLevel = 'info' | 'warning' | 'danger';

export interface DiagnosisFinding {
  id: string;
  level: DiagnosisLevel;
  title: string;
  evidence: string;
  recommendation: string;
  category: 'time' | 'focus' | 'planning' | 'problem';
  confidence: number;
}

/**
 * Diagnosis Engine：不直接改資料，只從歷史行為找「反覆發生的問題」。
 * 它是 Adaptive Planning 的前置層。
 */
export function diagnoseBehavior(input: {
  workTasks: WorkTask[];
  studyTasks: StudyTask[];
  focusSessions: FocusSession[];
}): DiagnosisFinding[] {
  const findings: DiagnosisFinding[] = [];
  const tasks = [...input.workTasks.filter(t => t.source === 'user'), ...input.studyTasks.filter(t => t.source === 'user')];
  const completed = tasks.filter(t => t.status === 'completed' && t.actualHours != null && t.estimatedHours > 0);

  if (completed.length >= 3) {
    const ratios = completed.map(t => (t.actualHours as number) / t.estimatedHours);
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    if (avg >= 1.25) {
      findings.push({
        id: 'diagnosis-estimation-overrun', level: 'warning', category: 'time', confidence: Math.min(0.95, 0.55 + completed.length * 0.05),
        title: '任務工時經常低估',
        evidence: `${completed.length} 個已完成任務的平均實際工時約為預估的 ${Math.round(avg * 100)}%。`,
        recommendation: '後續規劃可提高同類任務的預估工時，並保留緩衝時間。',
      });
    }
  }

  const finishedFocus = input.focusSessions.filter(s => s.endedAt);
  if (finishedFocus.length >= 5) {
    const interrupted = finishedFocus.filter(s => s.interruptionCount > 0).length;
    const rate = interrupted / finishedFocus.length;
    if (rate >= 0.4) {
      findings.push({
        id: 'diagnosis-focus-interruption', level: 'warning', category: 'focus', confidence: Math.min(0.95, 0.55 + finishedFocus.length * 0.04),
        title: 'Focus 容易被中斷',
        evidence: `最近 ${finishedFocus.length} 次 Focus 中，有 ${Math.round(rate * 100)}% 曾發生中斷。`,
        recommendation: 'Manager 可在安排深度工作時減少切換，並優先保留完整 Focus 區塊。',
      });
    }
  }

  const pending = tasks.filter(t => t.status !== 'completed');
  const overdue = pending.filter(t => new Date(t.deadline).getTime() < Date.now());
  if (overdue.length >= 2) {
    findings.push({
      id: 'diagnosis-repeated-overdue', level: 'danger', category: 'planning', confidence: Math.min(0.95, 0.6 + overdue.length * 0.05),
      title: '存在反覆逾期風險',
      evidence: `目前有 ${overdue.length} 個使用者任務已超過截止時間。`,
      recommendation: 'Manager 應檢查任務拆分、估時與可用時間，而不是單純要求增加工作時間。',
    });
  }

  return findings.sort((a, b) => ({ danger: 3, warning: 2, info: 1 }[b.level] - { danger: 3, warning: 2, info: 1 }[a.level]));
}
