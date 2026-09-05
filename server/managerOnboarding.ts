import express from 'express';

const OWNER_ID = 'personal-owner';
const installedKey = '__personal_ai_manager_onboarding_installed__';

function config() {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  return { base, key };
}

async function supabase(path: string, options: RequestInit = {}) {
  const { base, key } = config();
  if (!base || !key) throw new Error('Supabase is not configured');
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function ensureUser(ownerId: string) {
  const rows = await supabase(`users?external_id=eq.${encodeURIComponent(ownerId)}&select=id&limit=1`, { headers: { Prefer: 'return=representation' } });
  if (Array.isArray(rows) && rows[0]?.id) return String(rows[0].id);
  const created = await supabase('users', {
    method: 'POST',
    body: JSON.stringify({ external_id: ownerId, display_name: ownerId, timezone: 'Asia/Taipei' }),
    headers: { Prefer: 'return=representation' },
  });
  if (!Array.isArray(created) || !created[0]?.id) throw new Error('Unable to create owner');
  return String(created[0].id);
}

function isWorkOnboarding(message: string) {
  const text = message.replace(/\s+/g, '');
  const hasClients = /李總醫療體系|綜合醫院|旅遊業/.test(text);
  const hasOnboardingCue = /長期工作記憶|客戶與工作分類|工作與客戶狀況|記住|安排與分類|筆記複習/.test(text);
  return hasClients && hasOnboardingCue;
}

const projects = [
  {
    id: 'proj-client-li-medical', workspaceId: 'work', title: '李總醫療體系', category: '客戶｜醫療', progress: 0,
    priority: 'medium', deadline: '', description: '李總醫療體系目前的固定維護、短影音與廣告工作。', status: 'in_progress', owner: '本人',
    tags: ['client', 'medical', 'manager-onboarding'], source: 'user', createdBy: 'user',
  },
  {
    id: 'proj-client-general-hospital', workspaceId: 'work', title: '綜合醫院', category: '客戶｜醫療', progress: 0,
    priority: 'medium', deadline: '', description: '綜合醫院目前的行銷診斷、Google 商家、社群與廣告企畫工作。', status: 'in_progress', owner: '本人',
    tags: ['client', 'medical', 'manager-onboarding'], source: 'user', createdBy: 'user',
  },
  {
    id: 'proj-client-travel', workspaceId: 'work', title: '旅遊業的客戶', category: '客戶｜旅遊', progress: 0,
    priority: 'medium', deadline: '', description: '旅遊業案件採事件驅動：新案件到達後建立案件名稱／類別並更新紀錄。', status: 'in_progress', owner: '本人',
    tags: ['client', 'travel', 'case-driven', 'manager-onboarding'], source: 'user', createdBy: 'user',
  },
];

const tasks = [
  {
    id: 'w-task-client-li-monthly-digital-audit', projectId: 'proj-client-li-medical', title: '每月20日｜數位／線上資訊檢查', priority: 'medium', status: 'todo', estimatedHours: 1,
    notes: '[工作分類] 網站管理｜網站維護\n[週期] 每月20日\n檢查所有數位／線上資訊是否需要更新，並確認資訊正確性。\n[Manager筆記] 固定週期工作；到期前應主動排入近期行程。',
    tags: ['routine', 'monthly', 'website-maintenance', 'visual-priority-routine'], isUrgent: false,
  },
  {
    id: 'w-task-client-li-ban-guo-video', projectId: 'proj-client-li-medical', title: '板國影片｜短影音製作', priority: 'medium', status: 'in_progress', estimatedHours: 1,
    notes: '[工作分類] 多媒體短影音｜腳本構想／現場拍攝／後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認\n[目前階段] 未指定，Manager 不猜測。',
    tags: ['video', 'short-video', 'workflow', 'visual-priority-important'], isUrgent: false,
  },
  {
    id: 'w-task-client-li-xin-ren-video', projectId: 'proj-client-li-medical', title: '新仁影片｜短影音製作', priority: 'medium', status: 'in_progress', estimatedHours: 1,
    notes: '[工作分類] 多媒體短影音｜腳本構想／現場拍攝／後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認\n[目前階段] 未指定，Manager 不猜測。',
    tags: ['video', 'short-video', 'workflow', 'visual-priority-important'], isUrgent: false,
  },
  {
    id: 'w-task-client-li-libor-athlete-video', projectId: 'proj-client-li-medical', title: '立博運動員影片｜短影音製作', priority: 'high', status: 'in_progress', estimatedHours: 1,
    notes: '[工作分類] 多媒體短影音｜後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認\n[目前階段] 剪輯\n[Manager筆記] 目前有明確進度，優先追蹤完成剪輯後送確認。',
    tags: ['video', 'short-video', 'editing', 'visual-priority-urgent'], isUrgent: true,
  },
  {
    id: 'w-task-client-li-libor-ad-material', projectId: 'proj-client-li-medical', title: '立博廣告影片素材｜短影音製作', priority: 'medium', status: 'in_progress', estimatedHours: 1,
    notes: '[工作分類] 多媒體短影音｜腳本構想／現場拍攝／後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認\n[目前階段] 未指定，Manager 不猜測。',
    tags: ['video', 'advertising-material', 'visual-priority-important'], isUrgent: false,
  },
  {
    id: 'w-task-client-li-ad-libor', projectId: 'proj-client-li-medical', title: '立博｜廣告投放', priority: 'high', status: 'in_progress', estimatedHours: 1,
    notes: '[工作分類] 行銷企劃｜廣告投放\n[目前狀態] 投放中\n[Manager筆記] 投放中的客戶需持續確認是否正常運作，並保留後續成效追蹤。',
    tags: ['advertising', 'media-buying', 'active', 'visual-priority-urgent'], isUrgent: true,
  },
  {
    id: 'w-task-client-li-ad-banqiao', projectId: 'proj-client-li-medical', title: '板橋｜廣告投放', priority: 'high', status: 'in_progress', estimatedHours: 1,
    notes: '[工作分類] 行銷企劃｜廣告投放\n[目前狀態] 投放中\n[Manager筆記] 投放中的客戶需持續確認是否正常運作。',
    tags: ['advertising', 'media-buying', 'active', 'visual-priority-urgent'], isUrgent: true,
  },
  {
    id: 'w-task-client-li-ad-shibo', projectId: 'proj-client-li-medical', title: '世博｜廣告投放與成效追蹤', priority: 'medium', status: 'in_progress', estimatedHours: 1,
    notes: '[工作分類] 行銷企劃｜廣告投放／成效追蹤\n[目前狀態] 追蹤中\n[Manager筆記] 目前重點是持續追蹤成效，不應視為單次完成任務。',
    tags: ['advertising', 'performance-tracking', 'active', 'visual-priority-important'], isUrgent: false,
  },
  {
    id: 'w-task-client-hospital-marketing-diagnosis', projectId: 'proj-client-general-hospital', title: '行銷診斷', priority: 'medium', status: 'todo', estimatedHours: 1,
    notes: '[工作分類] 行銷企劃｜行銷診斷\n[Manager筆記] 需整理問題、觀察與可執行優化方向。', tags: ['marketing', 'diagnosis', 'visual-priority-important'], isUrgent: false,
  },
  {
    id: 'w-task-client-hospital-google-business', projectId: 'proj-client-general-hospital', title: '優化 Google 商家', priority: 'medium', status: 'todo', estimatedHours: 1,
    notes: '[工作分類] 網站管理｜Google 商務維護\n[Manager筆記] 檢查商家資訊、內容與可優化項目。', tags: ['google-business', 'local-seo', 'visual-priority-important'], isUrgent: false,
  },
  {
    id: 'w-task-client-hospital-groups', projectId: 'proj-client-general-hospital', title: '分享社團', priority: 'low', status: 'todo', estimatedHours: 0.5,
    notes: '[工作分類] 社群管理｜分享社團\n[Manager筆記] 可列入固定社群曝光工作，依內容與頻率安排。', tags: ['social', 'groups', 'visual-priority-routine'], isUrgent: false,
  },
  {
    id: 'w-task-client-hospital-post-comments', projectId: 'proj-client-general-hospital', title: '留言／貼文', priority: 'medium', status: 'todo', estimatedHours: 1,
    notes: '[工作分類] 社群管理｜客服回覆／定期發文\n[Manager筆記] 依實際收到的留言與貼文需求持續處理。', tags: ['social', 'content', 'customer-service', 'visual-priority-normal'], isUrgent: false,
  },
  {
    id: 'w-task-client-hospital-ad-proposal', projectId: 'proj-client-general-hospital', title: '建議投放廣告的企畫書', priority: 'high', status: 'todo', estimatedHours: 2,
    notes: '[工作分類] 行銷企劃｜構想行銷企劃／廣告投放\n[Manager筆記] 需提出投放理由、目標、受眾、素材與預期成效方向；未提供截止日，不自行捏造。',
    tags: ['marketing-plan', 'advertising', 'proposal', 'visual-priority-urgent'], isUrgent: true,
  },
  {
    id: 'w-task-client-travel-document-processing', projectId: 'proj-client-travel', title: '文書處理｜新案件建立與紀錄', priority: 'medium', status: 'todo', estimatedHours: 1,
    notes: '[工作分類] 行銷企劃｜專案管理、進度追蹤\n[工作模式] 事件驅動，不是固定週期。\n[流程] 新案件到達 → 由 Owner 提供案件名稱／類別 → 建立案件 → 更新與記錄。\n[Manager規則] 收到新案件時先建立／更新紀錄，不自行猜測案件名稱或類別。',
    tags: ['case-driven', 'document', 'workflow', 'visual-priority-normal'], isUrgent: false,
  },
];

const memories = [
  { domain: 'manager', type: 'semantic', content: 'Owner 目前有三個主要客戶／工作來源：李總醫療體系、綜合醫院、旅遊業的客戶。Manager 應以客戶 → 工作類型 → 任務 → 狀態的方式整理。', confidence: 0.98 },
  { domain: 'manager', type: 'procedural', content: '工作分類規則：先判斷客戶，再依數位內容創作工作規劃分類；固定工作要記錄週期；事件驅動工作要在新案件到達時建立或更新，不自行捏造缺失資訊。', confidence: 0.98 },
  { domain: 'manager', type: 'preference', content: 'Owner 希望 Manager 不只是回覆「已記住」，而是把工作真正建立、分類、安排、做成可複習筆記，並在後續對話中能回想相關背景。', confidence: 0.99 },
  { domain: 'work', type: 'procedural', content: '李總醫療體系固定工作：每月20日檢查所有數位／線上資訊，確認是否需要更新並驗證正確性。', confidence: 0.99 },
  { domain: 'work', type: 'procedural', content: '短影音標準流程：溝通 → 腳本 → 拍攝 → 剪輯 → 確認。若未提供目前階段，Manager 不自行猜測；目前已知立博運動員影片位於剪輯階段。', confidence: 0.99 },
  { domain: 'work', type: 'semantic', content: '李總醫療體系廣告：立博投放中、板橋投放中、世博追蹤中。', confidence: 0.99 },
  { domain: 'work', type: 'semantic', content: '綜合醫院目前工作：行銷診斷、優化 Google 商家、分享社團、留言／貼文、建議投放廣告的企畫書。', confidence: 0.99 },
  { domain: 'work', type: 'procedural', content: '旅遊業工作流程：新案件到達時由 Owner 提供案件名稱／類別，Manager 建立案件並持續更新與記錄；沒有新案件時不要虛構案件。', confidence: 0.99 },
];

const workRecords = [
  { type: 'note', title: 'Manager 工作 onboarding｜李總醫療體系', content: '已整理固定數位資訊檢查、短影音五階段流程與目前影片／廣告狀態。' },
  { type: 'note', title: 'Manager 工作 onboarding｜綜合醫院', content: '已整理行銷診斷、Google 商家、社團、留言／貼文與廣告企畫書。' },
  { type: 'note', title: 'Manager 工作 onboarding｜旅遊業', content: '已記錄文書處理與新案件事件驅動流程。新案件需由 Owner 提供名稱／類別後建立。' },
];

function mapProject(project: any, userId: string) {
  return { id: project.id, user_id: userId, workspace_id: project.workspaceId, title: project.title, description: project.description, status: project.status, priority: project.priority, deadline: null, source: 'user' };
}
function mapTask(task: any, userId: string) {
  return { id: task.id, user_id: userId, project_id: task.projectId, subject_id: null, domain: 'work', title: task.title, status: task.status, priority: task.priority, start_at: null, deadline: null, estimated_hours: task.estimatedHours, actual_hours: null, progress: 0, notes: task.notes, source: 'user' };
}

async function persistOnboarding(ownerId: string) {
  const userId = await ensureUser(ownerId);
  await supabase('projects', { method: 'POST', body: JSON.stringify(projects.map(p => mapProject(p, userId))) });
  await supabase('tasks', { method: 'POST', body: JSON.stringify(tasks.map(t => mapTask(t, userId))) });
  for (const record of workRecords) {
    await supabase('work_records', { method: 'POST', body: JSON.stringify({ user_id: userId, type: record.type, title: record.title, content: record.content, created_by: 'manager' }) });
  }
  for (const memory of memories) {
    await supabase('memories', { method: 'POST', body: JSON.stringify({ user_id: userId, domain: memory.domain, type: memory.type, content: memory.content, source: 'agent-memory', confidence: memory.confidence, evidence_count: 1 }) });
  }
  return { userId, projects, tasks, memories, workRecords };
}

function marker(snapshot: any) {
  return `<!--AIT_MANAGER_ONBOARDING:${JSON.stringify(snapshot)}-->`;
}

if (!(express.application as any)[installedKey]) {
  (express.application as any)[installedKey] = true;
  const originalPost = express.application.post;
  express.application.post = function managerOnboardingPost(path: any, ...handlers: any[]) {
    if (path !== '/api/agent/chat' || !handlers.length) return originalPost.call(this, path, ...handlers);
    const wrapped = handlers.map((handler: any) => {
      if (typeof handler !== 'function') return handler;
      return async function managerOnboardingHandler(this: any, req: any, res: any, next: any) {
        const message = String(req.body?.message || '').trim();
        if (!isWorkOnboarding(message)) return handler.call(this, req, res, next);
        try {
          const snapshot = await persistOnboarding(String(req.header?.('x-owner-id') || req.headers?.['x-owner-id'] || OWNER_ID));
          const finalText = `### ✅ Manager 已完成工作資料建檔\n\n我已把你先前提供的工作與客戶資訊實際建立到共享資料庫，不只是記在聊天內容裡。\n\n#### 已建立客戶工作區\n- **李總醫療體系**：固定資訊檢查、5 階段短影音流程、3 組廣告狀態\n- **綜合醫院**：行銷診斷、Google 商家、社群、留言／貼文、廣告企畫書\n- **旅遊業的客戶**：文書處理與「新案件到達 → 提供名稱／類別 → 建立／更新紀錄」流程\n\n#### Manager 記憶與複習筆記\n- 已記住固定週期與事件驅動規則\n- 已記住短影音標準流程：溝通 → 腳本 → 拍攝 → 剪輯 → 確認\n- 已記住目前明確進度：立博運動員影片在剪輯\n- 未提供的截止日期／影片階段不自行補值\n\n#### 執行原則\n之後你只要說客戶名稱、影片名稱、廣告名稱或「新案件」，Manager 會先從既有資料判斷這是新增、更新、追蹤還是排程，不會把同一件事當成新任務重複建立。\n\n${marker(snapshot)}`;
          return res.json({
            intentType: 'WORK',
            delegatedAgents: ['work'],
            activityLogs: [{ id: `act-onboarding-${Date.now()}`, timestamp: new Date().toISOString(), stepIndex: 1, fromAgent: 'manager', action: 'Manager 工作資料建檔與長期記憶', summary: `已建立 ${projects.length} 個客戶工作區、${tasks.length} 個工作項目與 ${memories.length} 筆長期記憶`, detail: '資料已直接寫入 Shared Data Store，並建立 Manager / Work 記憶與複習筆記。', status: 'completed', durationMs: 0 }],
            workOutput: finalText,
            studyOutput: '',
            finalSynthesisMarkdown: finalText,
            proposedTimeBlocks: [],
            createdWorkTasks: tasks.map(t => ({ ...t, workspaceId: 'work', projectName: projects.find(p => p.id === t.projectId)?.title || '', source: 'user', createdBy: 'user', deadline: '' })),
            onboardingSnapshot: snapshot,
            durationTotalMs: 0,
          });
        } catch (error) {
          console.error('[Manager Onboarding] persistence failed:', error);
          return res.status(500).json({ error: 'Manager 工作資料建檔失敗', details: error instanceof Error ? error.message : String(error) });
        }
      };
    });
    return originalPost.call(this, path, ...wrapped);
  };
}

export { isWorkOnboarding, persistOnboarding };
