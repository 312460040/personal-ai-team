import type { StructuredTimeBlock } from '../types';

/**
 * Manager 的最後一層「主動規劃」：
 * API 負責理解／分類／建立 Task；這一層把新 Task 轉成可執行的步驟與時間建議。
 * 不直接改動 Today，仍由 Owner 的套用按鈕決定是否寫入日程。
 */

type PlannedTask = {
  id: string;
  title: string;
  category: 'work' | 'study';
  priority?: 'high' | 'medium' | 'low';
  estimatedHours?: number;
};

const inferSteps = (title: string, category: 'work' | 'study'): string[] => {
  if (category === 'work') {
    if (/(影片|短影音|video|reel|剪輯)/i.test(title)) return ['確認目標與素材', '腳本／剪輯初版', '檢查與修改', '輸出／發布'];
    if (/(企劃|提案|proposal|plan)/i.test(title)) return ['釐清目標', '蒐集資料', '建立初版', '檢查與定稿'];
    if (/(分析|資料|報告|研究|report)/i.test(title)) return ['確認分析問題', '整理資料', '進行分析', '檢查結果', '整理結論'];
    return ['確認需求', '準備資料', '執行主要工作', '檢查結果', '完成回報'];
  }
  if (/(論文|研究|paper)/i.test(title)) return ['確認研究問題', '整理文獻', '分析／撰寫', '檢查論證與格式'];
  if (/(考試|複習|exam)/i.test(title)) return ['確認範圍', '整理重點', '練習題目', '錯題與弱點複習'];
  return ['確認學習目標', '理解核心內容', '練習與應用', '檢查理解程度'];
};

function priorityWeight(priority?: string) { return priority === 'high' ? 3 : priority === 'low' ? 1 : 2; }

function parseClock(value: string) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClock(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function planBlocks(tasks: PlannedTask[], todayBlocks: any[]): StructuredTimeBlock[] {
  const busy: Array<[number, number]> = [];
  (Array.isArray(todayBlocks) ? todayBlocks : []).forEach((block: any) => {
    const raw = String(block?.timeRange || block?.time || '');
    const parts = raw.split(/\s*[-~–—]\s*/);
    if (parts.length !== 2) return;
    const start = parseClock(parts[0]);
    const end = parseClock(parts[1]);
    if (start !== null && end !== null && end > start) busy.push([start, end]);
  });
  busy.sort((a, b) => a[0] - b[0]);
  const ordered = [...tasks].sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));
  const result: StructuredTimeBlock[] = [];
  let cursor = 9 * 60;
  ordered.forEach((task) => {
    const duration = Math.max(30, Math.round((task.estimatedHours || 1) * 60));
    let start = cursor;
    let placed = false;
    for (let minute = cursor; minute <= 21 * 60 - duration; minute += 15) {
      const end = minute + duration;
      const conflict = busy.some(([bStart, bEnd]) => minute < bEnd && end > bStart) || result.some((b) => {
        const rs = parseClock(String(b.time).split('-')[0]);
        const re = parseClock(String(b.time).split('-')[1]);
        return rs !== null && re !== null && minute < re && end > rs;
      });
      if (!conflict) { start = minute; placed = true; break; }
    }
    if (!placed) return;
    const end = start + duration;
    result.push({
      time: `${formatClock(start)}-${formatClock(end)}`,
      type: task.category === 'work' ? 'work' : 'study',
      title: task.title,
      agentOwner: task.category === 'work' ? 'Work Agent' : 'Study Agent',
      duration: `${(duration / 60).toFixed(2).replace(/\.00$/, '')}h`,
      tips: 'Manager 依優先級、預估工時與既有時間塊提出建議；尚未寫入 Today。',
    } as StructuredTimeBlock);
    cursor = end + 15;
  });
  return result;
}

function planningMarkdown(tasks: PlannedTask[], blocks: StructuredTimeBlock[]) {
  const lines = tasks.map((task) => {
    const steps = inferSteps(task.title, task.category);
    const label = task.category === 'work' ? '💼 工作' : '🎓 課業／研究';
    return `#### ${label}｜${task.title}\n- 優先級：**${task.priority || 'medium'}**\n- 預估工時：**${task.estimatedHours || 1}h**\n- 執行步驟：${steps.map((s, i) => `${i + 1}. ${s}`).join(' → ')}`;
  }).join('\n\n');
  const schedule = blocks.length ? blocks.map((b) => `- **${b.time}**｜${b.title}｜${b.agentOwner}`).join('\n') : '- 目前沒有可安全放入既有時間塊的空檔，Manager 會等待重新排程。';
  return `### 🧠 Manager 主動規劃\n\nManager 已經替你完成 **理解 → 分類 → 優先級 → 執行拆解 → 時間配置**，不是只把事情記成待辦。\n\n${lines}\n\n### 🗓️ 建議執行時間\n${schedule}\n\n> 這是 Manager 的規劃提案。尚未套用到 Today；你確認後才會寫入日程。`;
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
      const created: PlannedTask[] = [
        ...(Array.isArray(payload.createdWorkTasks) ? payload.createdWorkTasks.map((t: any) => ({ ...t, category: 'work' })) : []),
        ...(Array.isArray(payload.createdStudyTasks) ? payload.createdStudyTasks.map((t: any) => ({ ...t, category: 'study' })) : []),
      ];
      if (!created.length) return response;
      const blocks = planBlocks(created, body?.context?.todayBlocks || []);
      const originalText = String(payload.finalSynthesisMarkdown || '');
      const merged = { ...payload, finalSynthesisMarkdown: `${originalText}\n\n${planningMarkdown(created, blocks)}`, proposedTimeBlocks: blocks };
      return new Response(JSON.stringify(merged), { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch { return response; }
  };
}
