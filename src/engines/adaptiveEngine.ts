import type { WorkTask, StudyTask } from '../types';
import type { FocusSession } from './focusEngine';

export interface AdaptiveInsight {
  id: string;
  type: 'estimation' | 'focus' | 'overload' | 'pattern';
  title: string;
  description: string;
  priority: number;
}

export function analyzeAdaptivePatterns(
  workTasks: WorkTask[],
  studyTasks: StudyTask[],
  focusSessions: FocusSession[]
): AdaptiveInsight[] {
  const insights: AdaptiveInsight[] = [];
  const tasks = [...workTasks.filter((t) => t.source === 'user'), ...studyTasks.filter((t) => t.source === 'user')];

  const completed = tasks.filter((task) => task.status === 'completed');
  const focusCompleted = focusSessions.filter((session) => session.completed);

  if (completed.length >= 3 && focusCompleted.length >= 3) {
    const averagePlanned = focusCompleted.reduce((sum, session) => sum + session.plannedMinutes, 0) / focusCompleted.length;
    const averageActual = focusCompleted.reduce((sum, session) => {
      if (!session.endedAt) return sum;
      return sum + (new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000;
    }, 0) / focusCompleted.length;

    if (averageActual > averagePlanned * 1.25) {
      insights.push({
        id: 'adaptive-focus-overrun',
        type: 'estimation',
        title: '最近的 Focus 實際耗時偏高',
        description: `最近完成的 Focus 平均實際時間約 ${Math.round(averageActual)} 分鐘，較原本規劃的 ${Math.round(averagePlanned)} 分鐘高出超過 25%。Manager 下次規劃時應保留緩衝。`,
        priority: 80,
      });
    }
  }

  const pendingHours = tasks.filter((task) => task.status !== 'completed').reduce((sum, task) => sum + task.estimatedHours, 0);
  if (pendingHours >= 8) {
    insights.push({
      id: 'adaptive-heavy-load',
      type: 'overload',
      title: '待處理工作量偏高',
      description: `目前待完成任務預估約 ${pendingHours.toFixed(1)} 小時。Manager 應優先處理截止日期與高優先級任務，而不是平均分配時間。`,
      priority: 70,
    });
  }

  if (focusSessions.length >= 5) {
    const interrupted = focusSessions.filter((session) => session.interruptionCount > 0).length;
    if (interrupted / focusSessions.length >= 0.4) {
      insights.push({
        id: 'adaptive-interruption-pattern',
        type: 'focus',
        title: 'Focus 中斷比例偏高',
        description: `最近 ${focusSessions.length} 次 Focus 中，有 ${interrupted} 次曾被中斷。Manager 可嘗試縮短單次 Focus 或降低切換頻率。`,
        priority: 60,
      });
    }
  }

  return insights.sort((a, b) => b.priority - a.priority);
}
