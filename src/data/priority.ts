import type { TaskPriority } from '../types';

export type AITPriority = 'urgent' | 'important' | 'normal' | 'routine' | 'long-term';

export const PRIORITY_LABELS: Record<AITPriority, string> = {
  urgent: '迫切', important: '重要', normal: '一般', routine: '日常規律', 'long-term': '長期發展',
};

export function normalizePriority(value: unknown): AITPriority {
  const v = String(value ?? '').toLowerCase();
  if (['urgent','high','critical','迫切'].includes(v)) return 'urgent';
  if (['important','medium','重要'].includes(v)) return 'important';
  if (['routine','daily','weekly','日常規律'].includes(v)) return 'routine';
  if (['long-term','longterm','research','長期發展'].includes(v)) return 'long-term';
  return 'normal';
}

export function toLegacyTaskPriority(value: unknown): TaskPriority {
  const p = normalizePriority(value);
  return p === 'urgent' ? 'high' : p === 'important' ? 'medium' : 'low';
}
