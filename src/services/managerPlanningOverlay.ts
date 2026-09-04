import type { StructuredTimeBlock } from '../types';

type PlannedTask = { id: string; title: string; category: 'work' | 'study'; priority?: 'high' | 'medium' | 'low'; estimatedHours?: number; status?: string; deadline?: string };

type Recommendation = { decision: 'continue' | 'delay' | 'pause'; reason: string };

const inferSteps = (title: string, category: 'work' | 'study'): string[] => {
  if (category === 'work') {
    if (/(影片|短影音|video|reel|剪輯)/i.test(title)) return ['確認目標與素材', '腳本／剪輯初版', '檢查與修改', '輸出／發布'];
    if (/(企劃|提案|proposal|plan)/i.test(title)) return ['釐清目標', '蒐集資料', '建立初版', '檢查與定稿'];
    if (/(分析|資料|報告|研究|report)/i.test(title)) return ['確認分析問題', '整理資料', '進行分析', '檢查結果'];
    return ['確認需求', '準備資料', '執行主要工作', '檢查結果', '完成回報'];
  }
  if (/(論文|研究|paper)/i.test(title)) return ['確認研究問題', '整理文獻', '分析／撰寫', '檢查論證與格式'];
  if (/(考試|複習|exam)/i.test(title)) return ['確認範圍', '整理重點', '練習題目', '錯題與弱點複習'];
  return ['確認學習目標', '理解核心內容', '練習與應用', '檢查理解程度'];
};

function priorityWeight(priority?: string) { return priority === 'high' ? 3 : priority === 'low' ? 1 : 2; }
function parseClock(value: string) { const m = String(value || '').match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
function formatClock(minutes: number) { const h = Math.floor(minutes / 60) % 24; return `${String(h).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }

function recommendation(task: PlannedTask): Recommendation {
  const deadline = task.deadline ? new Date(task.deadline).getTime() : NaN;
  const days = Number.isFinite(deadline) ? (deadline - Date.now()) / 86400000 : Infinity;
  if (task.status === 'delayed') return { decision: 'continue', reason: '已延遲，Manager 優先拉回處理，避免再次堆積。' };
  if (task.status === 'in_progress') return { decision: 'continue', reason: '已在進行中，優先完成可降低切換成本。' };
  if (task.priority === 'high' || days <= 1) return { decision: 'continue', reason: '優先級高或即將到期，建議優先安排。' };
  if (days <= 3) return { decision: 'continue', reason: '截止時間接近，建議近期完成。' };
  if (task.priority === 'low' && days > 7) return { decision: 'delay', reason: '低優先且期限較遠，可讓出近期專注時間。' };
  return { decision: 'continue', reason: '目前沒有足夠理由延後，先保留在計畫中。' };
}

function planBlocks(tasks: PlannedTask[], todayBlocks: any[]): StructuredTimeBlock[] {
  const busy: Array<[number, number]> = [];
  (Array.isArray(todayBlocks) ? todayBlocks : []).forEach((block: any) => {
    const p = String(block?.timeRange || block?.time || '').split(/\s*[-~–—]\s*/);
    if (p.length !== 2) return;
    const s = parseClock(p[0]); const e = parseClock(p[1]);
    if (s !== null && e !== null && e > s) busy.push([s, e]);
  });
  const result: StructuredTimeBlock[] = [];
  let cursor = 9 * 60;
  [...tasks].sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority)).forEach((task) => {
    const duration = Math.max(30, Math.round((task.estimatedHours || 1) * 60));
    for (let minute = cursor; minute <= 21 * 60 - duration; minute += 15) {
      const end = minute + duration;
      const conflict = busy.some(([s, e]) => minute < e && end > s) || result.some((b) => {
        const p = String(b.time).split('-'); const s = parseClock(p[0]); const e = parseClock(p[1]);
        return s !== null && e !== null && minute < e && end > s;
      });
      if (conflict) continue;
      result.push({ time: `${formatClock(minute)}-${formatClock(end)}`, type: task.category === 'work' ? 'work' : 'study', title: task.title, agentOwner: task.category === 'work' ? 'work' : 'study', duration: `${(duration / 60).toFixed(2).replace(/\.00$/, '')}h`, priority: task.priority || 'medium', tips: 'Manager 依優先級、預估工時與既有時間塊提出建議；尚未寫入 Today。' } as StructuredTimeBlock);
      cursor = end + 15;
      break;
    }
  });
  return result;
}

function parseLocalArrangement(payload: any): PlannedTask[] {
  const text = String(payload?.finalSynthesisMarkdown || '');
  const tasks: PlannedTask[] = [];
  let category: 'work' | 'study' = 'work';
  text.split('\n').forEach((line) => {
    if (/^####\s*💼/.test(line)) category = 'work';
    if (/^####\s*🎓/.test(line)) category = 'study';
    const match = line.match(/^-\s*\*\*(.+?)\*\*｜/);
    if (!match) return;
    const title = match[1].trim();
    if (title) tasks.push({ id: `planned-${tasks.length}-${title}`, title, category, priority: /｜high｜/i.test(line) ? 'high' : /｜low｜/i.test(line) ? 'low' : 'medium', estimatedHours: 1 });
  });
  return tasks;
}

function planningMarkdown(tasks: PlannedTask[], blocks: StructuredTimeBlock[], isFuture: boolean) {
  const lines = tasks.map((task) => {
    const label = task.category === 'work' ? '💼 工作' : '🎓 課業／研究';
    const r = recommendation(task);
    const steps = inferSteps(task.title, task.category);
    return `#### ${label}｜${task.title}\n- Manager 決策：**${r.decision === 'continue' ? '明天繼續' : r.decision === 'delay' ? '延後' : '暫停'}**\n- 判斷理由：${r.reason}\n- 優先級：**${task.priority || 'medium'}**｜預估 **${task.estimatedHours || 1}h**\n- 執行拆解：${steps.map((s, i) => `${i + 1}. ${s}`).join(' → ')}`;
  }).join('\n\n');
  const schedule = blocks.length ? blocks.map((b) => `- **${b.time}**｜${b.title}｜${b.agentOwner === 'work' ? 'Work Agent' : 'Study Agent'}｜${b.priority || 'medium'} 優先`).join('\n') : '- 目前沒有可安全配置的空檔，Manager 會等待重新排程。';
  return `### 🧠 Manager 主動規劃\n\n我已替你完成 **理解 → 分類 → 優先級 → 決策 → 執行拆解 → 時間配置**。${isFuture ? '這是明日／未來計畫，不會誤寫進今天。' : ''}\n\n${lines}\n\n### 🗓️ ${isFuture ? '建議執行時段' : '今日建議執行時間'}\n${schedule}\n\n> Manager 先提出決策與排程；涉及實際日程異動時，仍需 Owner 確認。`;
}

export function installManagerPlanningOverlay() {
  if (typeof window === 'undefined') return;
  const marker = '__ait_manager_planning_overlay__';
  if ((window as any)[marker]) return;
  (window as any)[marker] = true;
  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.includes('/api/agent/chat')) return previousFetch(input, init);
    let body: any = null;
    try { body = typeof init?.body === 'string' ? JSON.parse(init.body) : null; } catch { body = null; }
    const response = await previousFetch(input, init);
    if (!body) return response;
    try {
      const payload = await response.clone().json();
      let created: PlannedTask[] = [
        ...(Array.isArray(payload.createdWorkTasks) ? payload.createdWorkTasks.map((t: any) => ({ ...t, category: 'work' })) : []),
        ...(Array.isArray(payload.createdStudyTasks) ? payload.createdStudyTasks.map((t: any) => ({ ...t, category: 'study' })) : []),
      ];
      if (!created.length && payload.intentType === 'TASK_ARRANGEMENT_LOCAL') created = parseLocalArrangement(payload);
      if (!created.length) return response;
      const isFuture = /(明天|後天|下週|下星期|隔日)/i.test(String(body?.message || ''));
      const blocks = planBlocks(created, isFuture ? [] : body?.context?.todayBlocks || []);
      const merged = { ...payload, finalSynthesisMarkdown: `${String(payload.finalSynthesisMarkdown || '')}\n\n${planningMarkdown(created, blocks, isFuture)}`, proposedTimeBlocks: isFuture ? [] : blocks };
      return new Response(JSON.stringify(merged), { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch { return response; }
  };
}
