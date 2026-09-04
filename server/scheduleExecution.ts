import express from 'express';

const router = express.Router();

type Block = { time: string; type: 'work' | 'study' | 'rest' | 'buffer'; agentOwner: 'work' | 'study' | 'manager'; title: string; duration: string; priority?: 'high' | 'medium' | 'low'; tips?: string };

function minutes(value: string) {
  const m = value.match(/(\d+(?:\.\d+)?)\s*(?:小時|hr|h)/i);
  return m ? Math.max(30, Math.round(Number(m[1]) * 60)) : 60;
}

function buildSchedule(context: any, message: string): { blocks: Block[]; targetDate: string; summary: string } {
  const now = new Date();
  const target = /明天|明日/i.test(message) ? new Date(now.getTime() + 86400000) : now;
  const targetDate = target.toISOString().slice(0, 10);
  const work = Array.isArray(context?.workTasks) ? context.workTasks.filter((t: any) => t?.source === 'user' && t?.status !== 'completed') : [];
  const study = Array.isArray(context?.studyTasks) ? context.studyTasks.filter((t: any) => t?.source === 'user' && t?.status !== 'completed') : [];
  const sort = (a: any, b: any) => {
    const pw: any = { high: 3, medium: 2, low: 1 };
    const deadline = (x: any) => x?.deadline ? new Date(x.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    return ((pw[b.priority] || 1) - (pw[a.priority] || 1)) || (deadline(a) - deadline(b));
  };
  work.sort(sort); study.sort(sort);
  const blocks: Block[] = [];
  let cursor = 9 * 60;
  const addTask = (task: any, type: 'work' | 'study', start: number) => {
    const dur = Math.min(minutes(String(task.estimatedHours || 1) + 'h'), type === 'work' ? 150 : 120);
    const end = start + dur;
    const fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    blocks.push({ time: `${fmt(start)} - ${fmt(end)}`, type, agentOwner: type, title: task.title, duration: `${dur} 分鐘`, priority: task.priority || 'medium', tips: type === 'work' ? `專案：${task.projectName || '工作'}｜截止：${task.deadline || '未設定'}` : `科目：${task.subjectName || '學習'}｜截止：${task.deadline || '未設定'}` });
    return end;
  };

  // Protect the user's existing fixed meal/rest boundary and keep focused work in the morning.
  for (const task of work.slice(0, 3)) {
    cursor = addTask(task, 'work', cursor);
    if (cursor < 720) cursor += 10;
    if (cursor >= 720) break;
  }
  if (blocks.length) blocks.push({ time: '12:00 - 13:00', type: 'rest', agentOwner: 'manager', title: '午餐與休息', duration: '60 分鐘', tips: 'Manager 保留恢復時間，不排工作。' });
  cursor = 13 * 60 + 30;
  for (const task of work.slice(3)) {
    if (cursor >= 18 * 60) break;
    cursor = addTask(task, 'work', cursor);
    cursor += 10;
  }
  if (study.length) {
    blocks.push({ time: '18:00 - 19:00', type: 'rest', agentOwner: 'manager', title: '晚餐與切換緩衝', duration: '60 分鐘', tips: '工作 → 學習模式切換。' });
    cursor = 19 * 60;
    for (const task of study.slice(0, 2)) {
      cursor = addTask(task, 'study', cursor);
      cursor += 10;
      if (cursor >= 22 * 60) break;
    }
  }
  if (blocks.length) blocks.push({ time: '22:00 - 22:20', type: 'buffer', agentOwner: 'manager', title: '今日覆盤與明日調整', duration: '20 分鐘', tips: '記錄實際工時與延遲原因，供 Manager 下一次排程適性化。' });
  return { blocks, targetDate, summary: `已依優先級、截止時間與預估工時安排 ${work.length} 筆工作與 ${study.length} 筆課業資料。` };
}

router.post('/', (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Message cannot be empty' });
    const result = buildSchedule(req.body?.context || {}, message);
    res.json({ ok: true, executed: true, targetDate: result.targetDate, blocks: result.blocks, summary: result.summary });
  } catch (error: any) {
    res.status(500).json({ error: '排程執行失敗', details: error?.message || String(error) });
  }
});

export default router;
