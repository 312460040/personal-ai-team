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

/** Diagnosis 只觀察，不直接修改資料；結果提供給 Adaptive Planning。 */
export function diagnoseBehavior(input: {
  workTasks: WorkTask[];
  studyTasks: StudyTask[];
  focusSessions: FocusSession[];
}): DiagnosisFinding[] {
  const findings: DiagnosisFinding[] = [];
  const tasks = [
    ...input.workTasks.filter(t => t.source === 'user'),
    ...input.studyTasks.filter(t => t.source === 'user'),
  ];
  const delayed = tasks.filter(t => t.status === 'delayed');

  if (delayed.length >= 2) {
    findings.push({
      id: 'diagnosis-delayed-tasks',
      level: 'warning',
      category: 'planning',
      confidence: Math.min(0.95, 0.55 + delayed.length * 0.06),
      title: '任務有反覆延遲現象',
      evidence: `目前有 ${delayed.length} 個使用者任務標記為延遲。`,
      recommendation: 'Manager 應檢查任務拆分、估時、依賴與可用時間，而不是單純增加工作時數。',
    });
  }

  const finishedFocus = input.focusSessions.filter(s => Boolean(s.endedAt));

  if (finishedFocus.length >= 5) {
    const interrupted = finishedFocus.filter(s => s.interruptionCount > 0).length;
    const rate = interrupted / finishedFocus.length;
    if (rate >= 0.4) {
      findings.push({
        id: 'diagnosis-focus-interruption',
        level: 'warning',
        category: 'focus',
        confidence: Math.min(0.95, 0.55 + finishedFocus.length * 0.04),
        title: 'Focus 容易被中斷',
        evidence: `最近 ${finishedFocus.length} 次 Focus 中，有 ${Math.round(rate * 100)}% 曾發生中斷。`,
        recommendation: '安排深度工作時減少切換，優先保留完整 Focus 區塊。',
      });
    }
  }

  // Task 本身沒有 actualHours；改以 Focus Session 的 plannedMinutes vs 實際 elapsed 判斷估時偏差。
  if (finishedFocus.length >= 3) {
    const overPlan = finishedFocus.filter(s => {
      const ended = s.endedAt ? new Date(s.endedAt).getTime() : NaN;
      const started = new Date(s.startedAt).getTime();
      return Number.isFinite(ended) && Number.isFinite(started) &&
        ended - started > s.plannedMinutes * 60000 * 1.25;
    }).length;

    if (overPlan / finishedFocus.length >= 0.5) {
      findings.push({
        id: 'diagnosis-focus-overrun',
        level: 'info',
        category: 'time',
        confidence: 0.75,
        title: 'Focus 常超過原定時間',
        evidence: `最近 ${finishedFocus.length} 次 Focus 中，至少一半實際執行時間超過預定 25%。`,
        recommendation: '未來排程可增加緩衝，避免下一個重要行程被壓縮。',
      });
    }
  }

  const overdue = tasks.filter(t =>
    t.status !== 'completed' && new Date(t.deadline).getTime() < Date.now()
  );

  if (overdue.length >= 2) {
    findings.push({
      id: 'diagnosis-overdue',
      level: 'danger',
      category: 'planning',
      confidence: Math.min(0.95, 0.6 + overdue.length * 0.05),
      title: '存在逾期風險',
      evidence: `目前有 ${overdue.length} 個未完成任務已超過截止時間。`,
      recommendation: '優先重新評估截止日與可用時間，必要時提出 Owner 確認的重新排程方案。',
    });
  }

  const rank: Record<DiagnosisLevel, number> = { danger: 3, warning: 2, info: 1 };
  return findings.sort((a, b) => rank[b.level] - rank[a.level]);
}
