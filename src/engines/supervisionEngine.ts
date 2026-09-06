import type { TodayTimeBlock, WorkTask, StudyTask } from '../types';

export type SupervisionState = 'idle' | 'current' | 'late-start' | 'overdue' | 'missed-schedule' | 'next';

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

  // 先處理已經錯過、但沒有完成的行程：這是 Manager 督促最重要的情境。
  const missed = blocks
    .filter(b => !b.completed)
    .map(b => ({ block: b, range: parseRange(b.timeRange) }))
    .filter(x => x.range && x.range.end <= minute)
    .sort((a, b) => (b.range!.end - a.range!.end));
  if (missed.length) {
    const { block } = missed[0];
    const task = taskForBlock(block, input.workTasks, input.studyTasks);
    return {
      state: 'missed-schedule',
      title: `行程「${block.title}」尚未完成`,
      message: `原定 ${block.timeRange}，現在已超過時段。Manager 不建議直接跳過，請回報進度；如果來不及，現在就重新安排。`,
      action: 'reschedule',
      taskId: task?.id,
      blockId: block.id,
    };
  }

  const current = blocks.find(b => { const r = parseRange(b.timeRange); return r && minute >= r.start && minute < r.end; });
  if (current) {
    const task = taskForBlock(current, input.workTasks, input.studyTasks);
    if (current.completed) return { state: 'current', title: '目前時段已完成', message: `「${current.title}」已完成，Manager 會等待下一個時間區塊。`, action: 'none', blockId: current.id };
    const r = parseRange(current.timeRange)!;
    const lateBy = Math.max(0, minute - r.start);
    if (lateBy >= 10) return { state: 'late-start', title: `你可能晚開始了 ${lateBy} 分鐘`, message: `現在仍在「${current.title}」的時間區塊內。Manager 要你現在開始；如果這個時段已經不合理，立即重新排程。`, action: 'start', taskId: task?.id, blockId: current.id };
    return { state: 'current', title: `現在是「${current.title}」`, message: task ? `這是你現在的安排（${current.timeRange}）。Manager 建議現在開始「${task.title}」，完成後回報。` : `這是你現在的安排（${current.timeRange}）。Manager 建議現在開始，完成後回報。`, action: 'check-in', taskId: task?.id, blockId: current.id };
  }

  const upcoming = blocks.filter(b => { const r = parseRange(b.timeRange); return r && r.start > minute && !b.completed; }).sort((a,b) => parseRange(a.timeRange)!.start - parseRange(b.timeRange)!.start)[0];
  if (upcoming) {
    const r = parseRange(upcoming.timeRange)!;
    const delta = r.start - minute;
    if (delta <= 15) return { state: 'next', title: `準備下一個行程：${upcoming.title}`, message: `約 ${delta} 分鐘後開始（${upcoming.timeRange}）。Manager 提醒你先收尾目前的事情，準備切換到下一項。`, action: 'none', blockId: upcoming.id };
  }

  const overdue = [...input.workTasks, ...input.studyTasks].filter(t => t.source === 'user' && t.status !== 'completed' && new Date(t.deadline).getTime() < now.getTime()).sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];
  if (overdue) return { state: 'overdue', title: `「${overdue.title}」已超過截止時間`, message: 'Manager 建議先確認是否要延長期限或重新安排其他工作。', action: 'reschedule', taskId: overdue.id };
  return { state: 'idle', title: '目前沒有需要你立即處理的時段', message: 'Manager 會持續根據 Today 行程、任務與截止時間督促下一步。', action: 'none' };
}
