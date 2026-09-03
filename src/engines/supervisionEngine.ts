import type { TodayTimeBlock, WorkTask, StudyTask } from '../types';

export type SupervisionState = 'idle' | 'current' | 'late-start' | 'overdue' | 'next';

export interface SupervisionResult {
  state: SupervisionState;
  title: string;
  message: string;
  action: 'start' | 'check-in' | 'reschedule' | 'none';
  taskId?: string;
  blockId?: string;
}

function parseRange(value: string) {
  const [a, b] = value.split('-').map(v => v.trim());
  const parse = (v: string) => { const [h, m] = v.split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null; };
  const start = parse(a); const end = parse(b);
  return start === null || end === null ? null : { start, end };
}

function taskForBlock(block: TodayTimeBlock, workTasks: WorkTask[], studyTasks: StudyTask[]) {
  const all = [...workTasks, ...studyTasks].filter(t => t.source === 'user' && t.status !== 'completed');
  const exact = all.find(t => t.title === block.title);
  return exact ?? all.find(t => (block.type === 'work' ? workTasks : studyTasks).some(x => x.id === t.id));
}

export function superviseNow(input: { todayBlocks: TodayTimeBlock[]; workTasks: WorkTask[]; studyTasks: StudyTask[]; now?: Date }): SupervisionResult {
  const now = input.now ?? new Date();
  const minute = now.getHours() * 60 + now.getMinutes();
  const blocks = input.todayBlocks.filter(b => b.source === 'user');
  const current = blocks.find(b => { const r = parseRange(b.timeRange); return r && minute >= r.start && minute < r.end; });
  if (current) {
    const task = taskForBlock(current, input.workTasks, input.studyTasks);
    if (current.completed) return { state: 'current', title: '目前時段已完成', message: `「${current.title}」已完成，Manager 會等待下一個時間區塊。`, action: 'none', blockId: current.id };
    const r = parseRange(current.timeRange)!;
    const lateBy = Math.max(0, minute - r.start);
    if (lateBy >= 10) return { state: 'late-start', title: `你可能晚開始了 ${lateBy} 分鐘`, message: `現在仍在「${current.title}」的時間區塊內。要現在開始嗎？`, action: 'start', taskId: task?.id, blockId: current.id };
    return { state: 'current', title: `現在是「${current.title}」`, message: task ? `建議開始「${task.title}」，完成後 Manager 會記錄這次執行。` : '如果你已經開始，繼續即可；完成後記得回報 Manager。', action: 'check-in', taskId: task?.id, blockId: current.id };
  }

  const upcoming = blocks.filter(b => { const r = parseRange(b.timeRange); return r && r.start > minute && !b.completed; }).sort((a,b) => parseRange(a.timeRange)!.start - parseRange(b.timeRange)!.start)[0];
  if (upcoming) {
    const r = parseRange(upcoming.timeRange)!;
    const delta = r.start - minute;
    if (delta <= 15) return { state: 'next', title: `下一個時段：${upcoming.title}`, message: `約 ${delta} 分鐘後開始，Manager 建議準備下一項工作。`, action: 'none', blockId: upcoming.id };
  }

  const overdue = [...input.workTasks, ...input.studyTasks].filter(t => t.source === 'user' && t.status !== 'completed' && new Date(t.deadline).getTime() < now.getTime()).sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];
  if (overdue) return { state: 'overdue', title: `「${overdue.title}」已超過截止時間`, message: 'Manager 建議先確認是否要延長期限或重新安排其他工作。', action: 'reschedule', taskId: overdue.id };
  return { state: 'idle', title: '目前沒有需要你立即處理的時段', message: 'Manager 會持續根據 Today、任務與截止時間提供下一步。', action: 'none' };
}
