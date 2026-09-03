/**
 * Central API routing for the split deployment:
 * GitHub Pages hosts the React UI; Render hosts the Express/Agent API.
 */
const configuredBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
export const API_BASE_URL = configuredBase;

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

function taskLists(body: any) {
  const context = body?.context || {};
  const work = Array.isArray(context.workTasks) ? context.workTasks.filter((t: any) => t?.source === 'user' && t?.status !== 'completed') : [];
  const study = Array.isArray(context.studyTasks) ? context.studyTasks.filter((t: any) => t?.source === 'user' && t?.status !== 'completed') : [];
  return { work, study, all: [...work.map((t: any) => ({ ...t, domain: '工作' })), ...study.map((t: any) => ({ ...t, domain: '課業／研究' }))] };
}

function isGlobalTaskReview(text: string): boolean {
  return /(目前|現在|所有|全部|現有).{0,12}(任務|待辦|工作|課業)|整理.{0,12}(所有|全部|目前|現在).{0,12}(任務|待辦)|任務.{0,12}(整理|清單|盤點).{0,12}(審核|留下|刪除|保留)|給我.{0,12}(審核|檢視).{0,12}(任務|待辦)/i.test(text);
}

function managerMode(text: string): 'daily_review' | 'tomorrow_plan' | null {
  if (/每日覆盤|今日覆盤|今天覆盤|我要複盤|我要覆盤|幫我複盤|回顧今天|今日回顧|每天覆盤|日終覆盤/i.test(text)) return 'daily_review';
  if (/隔日規劃|明日規劃|明天規劃|安排明天|規劃明天|明日安排|明天安排/i.test(text)) return 'tomorrow_plan';
  return null;
}

function statusLabel(status: string): string {
  return ({ todo: '待辦', in_progress: '進行中', delayed: '延遲', completed: '已完成' } as Record<string, string>)[status] || status || '未設定';
}

function buildChecklistRows(all: any[]): string {
  if (!all.length) return '- [ ] 目前沒有未完成的使用者任務。';
  const weights: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const sorted = [...all].sort((a: any, b: any) => (weights[b.priority] || 0) - (weights[a.priority] || 0) || ((a.deadline ? new Date(a.deadline).getTime() : Infinity) - (b.deadline ? new Date(b.deadline).getTime() : Infinity)));
  return sorted.map((t: any, i: number) => `- [ ] **${i + 1}. ${t.title || '未命名任務'}**\n  - 類別：${t.domain}${t.projectName ? `｜專案：${t.projectName}` : ''}${t.subjectName ? `｜科目：${t.subjectName}` : ''}\n  - 狀態：${statusLabel(t.status)}｜優先級：${t.priority || '未設定'}｜預估：${t.estimatedHours ?? '未設定'}h｜截止：${t.deadline || '未設定'}\n  - 🆔 ${t.id || '無 ID'}`).join('\n\n');
}

function buildManagerReviewResponse(body: any, mode: 'daily_review' | 'tomorrow_plan'): Response {
  const { work, study, all } = taskLists(body);
  const today = new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const rows = buildChecklistRows(all);
  const title = mode === 'daily_review' ? '每日覆盤' : '隔日規劃';
  const intro = mode === 'daily_review'
    ? '我先替你把今天仍需要處理的 User Data 整理成清單。你勾選明天要延續的項目後，再由 Manager 安排，不會直接修改任務。'
    : '我先依目前 User Data 整理明天的候選任務。請勾選你要安排的項目；確認後 Manager 才會進入排程，不會自行寫入。';
  const markdown = `### 🧭 Manager Agent｜${title}\n\n📅 ${today}\n\n${intro}\n\n### 📋 Owner 審核清單\n\n- 💼 工作待辦：**${work.length}** 筆\n- 🎓 課業待辦：**${study.length}** 筆\n- 📊 合計未完成：**${all.length}** 筆\n\n${rows}\n\n### ✅ 下一步\n請直接勾選清單，再按「確認${mode === 'daily_review' ? '每日覆盤' : '明日規劃'}」。\n\n> ⚠️ 這一步是唯讀整理；未經 Owner 確認，Manager 不會自動刪除、修改或重新排程任務。`;
  return new Response(JSON.stringify({
    intentType: mode === 'daily_review' ? 'DAILY_REVIEW' : 'TOMORROW_PLAN',
    delegatedAgents: ['work', 'study'],
    activityLogs: [{ id: `act-${mode}-${Date.now()}`, timestamp: new Date().toISOString(), stepIndex: 1, fromAgent: 'manager', action: title, summary: '跨工作與課業整理 User Tasks', detail: 'Manager-level 唯讀分析；等待 Owner 審核後才進入安排。', status: 'completed', durationMs: 0 }],
    workOutput: markdown,
    studyOutput: '',
    finalSynthesisMarkdown: markdown,
    proposedTimeBlocks: [],
    createdTaskPayload: null,
    durationTotalMs: 0,
    publicIntake: { category: 'global', confidence: 'high', method: 'rule_fallback', projectId: null, reason: mode === 'daily_review' ? '每日覆盤' : '隔日規劃' },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function buildGlobalReviewResponse(body: any): Response {
  const { work, study, all } = taskLists(body);
  const weights: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const status: Record<string, string> = { todo: '待辦', in_progress: '進行中', delayed: '延遲', completed: '已完成' };
  all.sort((a: any, b: any) => (weights[b.priority] || 0) - (weights[a.priority] || 0) || ((a.deadline ? new Date(a.deadline).getTime() : Infinity) - (b.deadline ? new Date(b.deadline).getTime() : Infinity)));
  const rows = all.length ? all.map((t: any, i: number) => `${i + 1}. **${t.title || '未命名任務'}**\n   - 類別：${t.domain}${t.projectName ? `｜專案：${t.projectName}` : ''}${t.subjectName ? `｜科目：${t.subjectName}` : ''}\n   - 狀態：**${status[t.status] || t.status || '未設定'}**｜優先級：${t.priority || '未設定'}｜預估：${t.estimatedHours ?? '未設定'}h｜截止：${t.deadline || '未設定'}\n   - 🆔 ${t.id || '無 ID'}`).join('\n\n') : '目前沒有未完成的使用者任務。';
  const markdown = `### 🧭 Manager 分流\n- 類別：**全域任務管理**\n- 信心：**high**\n- 判斷方式：**規則備援**\n- 判斷：這是跨工作與課業的全域任務檢視／整理需求，不需要指定單一 Project。\n\n### 📋 全域任務審核清單\n\n本次為唯讀檢視，不會因為沒有 Project 而停止。\n\n- 💼 工作待辦：**${work.length}** 筆\n- 🎓 課業待辦：**${study.length}** 筆\n- 📊 合計未完成：**${all.length}** 筆\n\n### 任務清單\n\n${rows}\n\n### ✅ 請你審核\n請直接告訴 Manager：\n- 「留下 1、2、4」\n- 「刪除第 3 項」\n- 「第 2 項改成進行中」\n- 「全部保留，但把第 1 項設為 High」\n\n⚠️ 本次只提供清單與建議，不會自動刪除或修改任何任務。`;
  const payload = { intentType: 'GLOBAL_REVIEW', delegatedAgents: ['work', 'study'], activityLogs: [{ id: `act-global-review-${Date.now()}`, timestamp: new Date().toISOString(), stepIndex: 1, fromAgent: 'manager', action: 'Global Task Review', summary: '跨 Workspace 讀取使用者未完成任務', detail: `work=${work.length}; study=${study.length}`, status: 'completed', durationMs: 0 }], workOutput: markdown, studyOutput: '', finalSynthesisMarkdown: markdown, proposedTimeBlocks: [], createdTaskPayload: null, durationTotalMs: 0, publicIntake: { category: 'global', confidence: 'high', method: 'rule_fallback', projectId: null, reason: '跨工作與課業的全域任務檢視／整理需求' } };
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url = '';
    let requestInit = init;
    if (typeof input === 'string') url = input;
    else if (input instanceof URL) url = input.toString();
    else if (input instanceof Request) { url = input.url; requestInit = requestInit || input; }
    if (url.includes('/api/agent/chat')) {
      try {
        const raw = requestInit?.body;
        if (typeof raw === 'string') {
          const body = JSON.parse(raw);
          const text = String(body?.message || '');
          const mode = managerMode(text);
          if (mode) return Promise.resolve(buildManagerReviewResponse(body, mode));
          if (isGlobalTaskReview(text)) return Promise.resolve(buildGlobalReviewResponse(body));
        }
      } catch (_) { /* fall through to the real API */ }
    }
    if (typeof input === 'string' && input.startsWith('/api/')) return originalFetch(apiUrl(input), init);
    if (input instanceof URL && input.pathname.startsWith('/api/')) return originalFetch(new URL(apiUrl(`${input.pathname}${input.search}`)), init);
    if (input instanceof Request && new URL(input.url).pathname.startsWith('/api/')) { const u = new URL(input.url); return originalFetch(new Request(apiUrl(`${u.pathname}${u.search}`), input)); }
    return originalFetch(input, init);
  };
}
