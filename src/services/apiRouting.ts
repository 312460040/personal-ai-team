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

function isTaskArrangement(text: string): boolean {
  return /(?:幫我|請幫我|請|麻煩)?(?:安排|建立|新增|記下|加入|排定|排進|規劃).{0,60}(?:任務|待辦|工作|課業|事情|這些|明天|今天)/i.test(text) ||
    /(?:明天|今天|今晚).{0,60}(?:完成|要做|要處理|還有).{0,60}(?:剪輯|發文|分析|作業|論文|研究|工作|任務)/i.test(text);
}

function parseArrangementTasks(text: string, body: any) {
  const context = body?.context || {};
  const userProjects = Array.isArray(context.workProjects) ? context.workProjects.filter((p: any) => p?.source === 'user') : [];
  const userSubjects = Array.isArray(context.studySubjects) ? context.studySubjects.filter((s: any) => s?.source === 'user') : [];
  const existingTitles = new Set([
    ...(Array.isArray(context.workTasks) ? context.workTasks : []),
    ...(Array.isArray(context.studyTasks) ? context.studyTasks : []),
  ].map((t: any) => String(t?.title || '').trim().toLowerCase()));
  const chunks = text
    .replace(/[，。！？；]/g, ',')
    .split(/,|、|\s*並且\s*|\s*還有\s*|\s*另外\s*|\s*以及\s*|\s*同時\s*/)
    .map((s: string) => s.trim())
    .filter(Boolean);
  const rawTasks = chunks.filter((chunk: string) => /(?:完成|處理|整理|準備|寫|做|剪輯|發文|分析|研究|論文|作業|複習|排定|安排|建立|新增|要做|需要)/i.test(chunk));
  const deadlineBase = /明天/i.test(text) ? new Date(Date.now() + 24 * 60 * 60 * 1000) : new Date();
  const dateMatch = text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
  if (dateMatch) {
    const [y, m, d] = dateMatch[1].replace(/\//g, '-').split('-').map(Number);
    deadlineBase.setFullYear(y, m - 1, d);
  }
  deadlineBase.setHours(18, 0, 0, 0);
  const deadline = deadlineBase.toISOString().replace(/\.000Z$/, '');
  const workProject = userProjects.length === 1 ? userProjects[0] : null;
  const studySubject = userSubjects.length === 1 ? userSubjects[0] : null;
  const work: any[] = [];
  const study: any[] = [];
  const blocked: any[] = [];
  rawTasks.slice(0, 8).forEach((raw: string, index: number) => {
    const title = raw.replace(/^(我明天|明天|今天|今晚|幫我|請幫我|我要|我需要|我還要|幫我安排任務|安排任務)\s*/i, '').trim();
    if (title.length < 2) return;
    const lower = title.toLowerCase();
    if (existingTitles.has(lower)) return;
    const isStudy = /課業|作業|考試|複習|讀書|念書|論文|文獻|研究|統計分析|科目|學習|study|exam/i.test(title);
    const isWork = /工作|公司|客戶|主管|專案|提案|簡報|行銷|社群|粉專|廣告|影片|短影音|剪輯|發文|開發|程式|程式碼|bug|api|部署|會議|業務|work|project/i.test(title);
    const category = isStudy && !isWork ? 'study' : isWork && !isStudy ? 'work' : 'work';
    const priority = /高優先|緊急|最優先/i.test(text) ? 'high' : /低優先|次要/i.test(text) ? 'low' : 'medium';
    const common = {
      title,
      status: 'todo',
      priority,
      estimatedHours: 1,
      startDate: new Date().toISOString().slice(0, 10),
      deadline,
      assignee: '本人',
      notes: `由 Owner 透過 Manager 對話建立。原始指令：「${text.trim()}」`,
      tags: ['AI-Manager-Created', 'User-Created'],
      source: 'user',
      createdBy: 'user',
    };
    if (category === 'study') {
      if (!studySubject) {
        blocked.push({ title, category, reason: userSubjects.length === 0 ? '尚未建立 User Study Subject。' : '目前有多個 User Study Subject，請指定科目。' });
        return;
      }
      study.push({ id: `s-task-user-${Date.now()}-${index}`, subjectId: studySubject.id, subjectName: studySubject.name, type: 'study_task', progress: 0, ...common });
    } else {
      if (!workProject) {
        blocked.push({ title, category, reason: userProjects.length === 0 ? '尚未建立 User Work Project。' : '目前有多個 User Work Project，請指定專案。' });
        return;
      }
      work.push({ id: `w-task-user-${Date.now()}-${index}`, workspaceId: workProject.workspaceId || 'work', projectId: workProject.id, projectName: workProject.title, isUrgent: priority === 'high', ...common });
    }
  });
  return { work, study, blocked };
}

function buildTaskArrangementResponse(body: any, text: string): Response {
  const { work, study, blocked } = parseArrangementTasks(text, body);
  if (typeof window !== 'undefined' && (work.length || study.length)) {
    window.dispatchEvent(new CustomEvent('ait:manager-task-arranged', { detail: { work, study } }));
  }
  const grouped = [
    work.length ? `#### 💼 工作\n${work.map((t: any) => `- **${t.title}**｜${t.projectName}｜${t.priority}｜截止 ${t.deadline}`).join('\n')}` : '',
    study.length ? `#### 🎓 課業／研究\n${study.map((t: any) => `- **${t.title}**｜${t.subjectName}｜${t.priority}｜截止 ${t.deadline}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
  const blockedText = blocked.length ? `\n\n### ⚠️ 尚未建立\n${blocked.map((b: any) => `- **${b.title}**｜${b.category === 'study' ? '課業／研究' : '工作'}：${b.reason}`).join('\n')}` : '';
  const total = work.length + study.length;
  const markdown = `### 📋 Manager 已安排新任務\n\n我已將你這次說的事情拆開、分類，並建立成正式 User Task。\n\n${grouped || '目前沒有可安全建立的任務。'}${blockedText}\n\n- 💼 工作：**${work.length}** 筆\n- 🎓 課業／研究：**${study.length}** 筆\n- 🗄️ 已建立：**${total}** 筆\n\n> Manager 只建立你這次明確交辦的事項，不會拿 Demo 資料補任務。`;
  return new Response(JSON.stringify({ intentType: 'TASK_ARRANGEMENT_LOCAL', delegatedAgents: [...new Set([...work.map(() => 'work'), ...study.map(() => 'study')])], activityLogs: [{ id: `act-task-arrangement-${Date.now()}`, timestamp: new Date().toISOString(), stepIndex: 1, fromAgent: 'manager', action: '拆分新任務並分類建立', summary: `建立 ${total} 筆 User Task`, detail: '瀏覽器端 Manager 任務收件與分類備援。', status: 'completed', durationMs: 0 }], workOutput: work.map((t: any) => t.title).join('\n'), studyOutput: study.map((t: any) => t.title).join('\n'), finalSynthesisMarkdown: markdown, proposedTimeBlocks: [], createdTaskPayload: null, durationTotalMs: 0, publicIntake: { category: 'global', confidence: 'high', method: 'rule_fallback', projectId: null, reason: 'Owner 明確要求安排新任務' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
  return new Response(JSON.stringify({ intentType: mode === 'daily_review' ? 'DAILY_REVIEW' : 'TOMORROW_PLAN', delegatedAgents: ['work', 'study'], activityLogs: [{ id: `act-${mode}-${Date.now()}`, timestamp: new Date().toISOString(), stepIndex: 1, fromAgent: 'manager', action: title, summary: '跨工作與課業整理 User Tasks', detail: 'Manager-level 唯讀分析；等待 Owner 審核後才進入安排。', status: 'completed', durationMs: 0 }], workOutput: markdown, studyOutput: '', finalSynthesisMarkdown: markdown, proposedTimeBlocks: [], createdTaskPayload: null, durationTotalMs: 0, publicIntake: { category: 'global', confidence: 'high', method: 'rule_fallback', projectId: null, reason: mode === 'daily_review' ? '每日覆盤' : '隔日規劃' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
          if (isTaskArrangement(text)) return Promise.resolve(buildTaskArrangementResponse(body, text));
        }
      } catch (_) { /* fall through to the real API */ }
    }
    if (typeof input === 'string' && input.startsWith('/api/')) return originalFetch(apiUrl(input), init);
    if (input instanceof URL && input.pathname.startsWith('/api/')) return originalFetch(new URL(apiUrl(`${input.pathname}${input.search}`)), init);
    if (input instanceof Request && new URL(input.url).pathname.startsWith('/api/')) { const u = new URL(input.url); return originalFetch(new Request(apiUrl(`${u.pathname}${u.search}`), input)); }
    return originalFetch(input, init);
  };
}
