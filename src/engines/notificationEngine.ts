import type { ManagerAnalysisResult } from './managerEngine';
import type { WorkTask, StudyTask } from '../types';

export type NotificationType =
  | 'manager-alert'
  | 'deadline'
  | 'agent-report'
  | 'task-complete'
  | 'owner-confirmation'
  | 'schedule-conflict';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  taskId?: string;
  actionTab?: 'home' | 'chat' | 'work' | 'study' | 'today' | 'activity';
}

const priorityFromInsight = (level: ManagerAnalysisResult['insights'][number]['level']): AppNotification['priority'] =>
  level === 'danger' ? 'critical' : level === 'warning' ? 'high' : 'low';

export function buildNotifications(
  analysis: ManagerAnalysisResult,
  workTasks: WorkTask[],
  studyTasks: StudyTask[],
  previous: AppNotification[] = []
): AppNotification[] {
  const previousById = new Map(previous.map(item => [item.id, item]));
  const notifications: AppNotification[] = [];

  analysis.insights.forEach(insight => {
    const type: NotificationType = insight.sourceType === 'work' || insight.sourceType === 'study' ? 'deadline' : 'manager-alert';
    const id = `manager-insight-${insight.id}`;
    const existing = previousById.get(id);
    notifications.push({
      id,
      type,
      title: insight.title,
      message: insight.description,
      createdAt: existing?.createdAt || new Date().toISOString(),
      read: existing?.read || false,
      priority: priorityFromInsight(insight.level),
      taskId: insight.sourceId,
      actionTab: insight.sourceType === 'work' ? 'work' : insight.sourceType === 'study' ? 'study' : 'home',
    });
  });

  analysis.rescheduleProposals.forEach(proposal => {
    const id = `owner-confirmation-${proposal.id}`;
    const existing = previousById.get(id);
    notifications.push({
      id,
      type: 'owner-confirmation',
      title: `需要你確認：${proposal.taskTitle}`,
      message: proposal.suggestedAction,
      createdAt: existing?.createdAt || new Date().toISOString(),
      read: existing?.read || false,
      priority: 'high',
      taskId: proposal.taskId,
      actionTab: proposal.taskType === 'work' ? 'work' : 'study',
    });
  });

  [...workTasks, ...studyTasks]
    .filter(task => task.source === 'user' && task.status === 'completed')
    .slice(0, 20)
    .forEach(task => {
      const id = `task-complete-${task.id}`;
      const existing = previousById.get(id);
      notifications.push({
        id,
        type: 'task-complete',
        title: `任務已完成：${task.title}`,
        message: 'Manager 已記錄這次完成狀態。',
        createdAt: existing?.createdAt || new Date().toISOString(),
        read: existing?.read || false,
        priority: 'low',
        taskId: task.id,
        actionTab: 'home',
      });
    });

  return notifications
    .sort((a, b) => {
      const rank = { critical: 4, high: 3, medium: 2, low: 1 };
      return rank[b.priority] - rank[a.priority] || b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, 50);
}
