import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { buildTeamExecutionPlan, routeManagerRequest, AgentId } from './agentTeam';

const router = express.Router();
const AGENTS: Record<string, { name: string; role: string; specialty: string }> = {
  manager: { name: 'Manager Agent', role: 'AI 總管', specialty: '統籌、決策、工作與課業協調、時間安排與任務管理' },
  work: { name: 'Work Agent', role: '工作管理員', specialty: '工作專案、任務優先級、截止日、工時、拆解與執行阻礙' },
  study: { name: 'Study Agent', role: '課業管理員', specialty: '課業、研究、複習、考試與學習進度' },
};

function userOnly(items: any[] = []) {
  return items.filter((item) => {
    if (!item || item.source === 'demo') return false;
    if (item.source === 'user') return true;
    const id = String(item.id || '');
    const title = String(item.title || '');
    return id.includes('user') || id.startsWith('w-task-') || id.startsWith('s-task-') || id.startsWith('proj-') || !title.includes('【Demo】');
  });
}
function agentProfile(id: string, name?: string, role?: string) {
  return AGENTS[id] || { name: name || 'AI 員工', role: role || '專案助理', specialty: '依 Owner 指派的專業工作提供協助' };
}
const ALLOWED_STATUS = new Set(['todo', 'in_progress', 'completed', 'delayed']);
const ALLOWED_PRIORITY = new Set(['low', 'medium', 'high']);
const ALLOWED_COLOR = new Set(['green', 'purple', 'blue', 'orange', 'pink', 'gray']);
const ALLOWED_CATEGORY = new Set(['work', 'study', 'research', 'admin', 'personal']);

function sanitizeUpdates(raw: any) {
  if (!raw || typeof raw !== 'object') return {};
  const out: any = {};
  if (typeof raw.title === 'string') out.title = raw.title.trim().slice(0, 200);
  if (typeof raw.status === 'string' && ALLOWED_STATUS.has(raw.status)) out.status = raw.status;
  if (typeof raw.priority === 'string' && ALLOWED_PRIORITY.has(raw.priority)) out.priority = raw.priority;
  if (typeof raw.deadline === 'string') out.deadline = raw.deadline.trim().slice(0, 100);
  if (typeof raw.estimatedHours === 'number' && Number.isFinite(raw.estimatedHours)) out.estimatedHours = Math.max(0, Math.min(24, raw.estimatedHours));
  if (typeof raw.notes === 'string') out.notes = raw.notes.slice(0, 2000);
  if (Array.isArray(raw.tags)) out.tags = [...new Set(raw.tags.filter((x: any) => typeof x === 'string').map((x: string) => x.trim()).filter(Boolean).slice(0, 12))];
  if (typeof raw.category === 'string' && ALLOWED_CATEGORY.has(raw.category)) out.category = raw.category;
  if (typeof raw.color === 'string' && ALLOWED_COLOR.has(raw.color)) out.color = raw.color;
  return out;
}
function sanitizeCreate(raw: any, domain: 'work' | 'study', tasks: any[], projects: any[], subjects: any[]) {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : '';
  if (!title) return null;
  const priority = ALLOWED_PRIORITY.has(raw.priority) ? raw.priority : 'medium';
  const deadline = typeof raw.deadline === 'string' ? raw.deadline.trim().slice(0, 100) : '';
  const estimatedHours = typeof raw.estimatedHours === 'number' && Number.isFinite(raw.estimatedHours) ? Math.max(0, Math.min(24, raw.estimatedHours)) : 1;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 100) : `${domain === 'study' ? 's' : 'w'}-task-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (tasks.some(t => String(t.id) === id)) return null;
  if (domain === 'work') {
    const projectId = String(raw.projectId || '');
    const project = projects.find(p => String(p.id) === projectId);
    if (!project) return null;
    return { action: 'create', task: { id, workspaceId: String(raw.workspaceId || 'work'), projectId, projectName: String(project.title || raw.projectName || ''), title, priority, status: ALLOWED_STATUS.has(raw.status) ? raw.status : 'todo', deadline, estimatedHours, notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : '', tags: Array.isArray(raw.tags) ? [...new Set(raw.tags.filter((x: any) => typeof x === 'string').map((x: string) => x.trim()).filter(Boolean).slice(0, 12))] : [], source: 'user', createdBy: 'user' } };
  }
  const subjectId = String(raw.subjectId || '');
  const subject = subjects.find(s => String(s.id) === subjectId);
  if (!subject) return null;
  return { action: 'create', task: { id, subjectId, subjectName: String(subject.name || raw.subjectName || ''), title, type: raw.type === 'exam' ? 'exam' : raw.type === 'assignment' ? 'assignment' : 'study_task', deadline, progress: 0, estimatedHours, priority, status: ALLOWED_STATUS.has(raw.status) ? raw.status : 'todo', notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 2000) : '', source: 'user', createdBy: 'user' } };
}
function parseAgentJson(text: string | undefined) {
  try { return JSON.parse(text || '{"reply":"我有收到。","actions":[]}'); } catch { return { reply: text || '我有收到。', actions: [] }; }
}
async function callGemini(client: GoogleGenAI, systemPrompt: string, prompt: string) {
  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    contents: `${systemPrompt}\n\nOwner 最新訊息：「${prompt}」`,
    config: { responseMimeType: 'application/json', responseSchema: {
      type: 'object', properties: {
        reply: { type: 'string' }, actions: { type: 'array', items: { type: 'object', properties: {
          action: { type: 'string', enum: ['update', 'create'] }, taskId: { type: 'string' }, domain: { type: 'string', enum: ['work', 'study'] },
          updates: { type: 'object', properties: { title: { type: 'string' }, status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'delayed'] }, priority: { type: 'string', enum: ['low', 'medium', 'high'] }, deadline: { type: 'string' }, estimatedHours: { type: 'number' }, notes: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, category: { type: 'string', enum: ['work', 'study', 'research', 'admin', 'personal'] }, color: { type: 'string', enum: ['green', 'purple', 'blue', 'orange', 'pink', 'gray'] } } },
          task: { type: 'object', properties: { id: { type: 'string' }, workspaceId: { type: 'string' }, projectId: { type: 'string' }, projectName: { type: 'string' }, subjectId: { type: 'string' }, subjectName: { type: 'string' }, title: { type: 'string' }, type: { type: 'string', enum: ['study_task', 'assignment', 'exam'] }, deadline: { type: 'string' }, estimatedHours: { type: 'number' }, priority: { type: 'string', enum: ['low', 'medium', 'high'] }, status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'delayed'] }, notes: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } },
        }, required: ['action', 'domain'] } },
      }, required: ['reply', 'actions']
    } }
  });
  return parseAgentJson(response.text);
}
function buildBasePrompt(profile: { name: string; role: string; specialty: string }, routing: any, executionLabel: string, data: any, selectedTaskIds: string[], history: any[]) {
  return `你是 Personal AI Team 的長期 AI 員工。你要像真的同事一樣工作，不是客服。\n目前身份：${profile.name}（${profile.role}）。專長：${profile.specialty}。\n\n【Manager 分流】\n需求類型：${routing.intent}；理由：${routing.reason}；已委派：${routing.delegatedAgents.join(', ') || '無'}；可能寫入：${routing.requiresDataWrite ? '是' : '否'}。\n\n【Team Execution Plan】\n${executionLabel}\n\n【團隊規則】\n- Manager 是唯一總管；單一領域交給對應專業 Agent。\n- Work Agent 只處理工作資料；Study Agent 只處理課業／研究資料。\n- 混合需求必須由 Work Agent 與 Study Agent 分別分析，再交回 Manager 整合。\n- 不得捏造 User Data；資訊不足只問最關鍵的一個問題。\n\n【自然對話】\n用自然、口語、成熟的繁體中文。只有 Owner 明確要求新增或修改任務時才產生 actions。\n\n【任務操作】\n如果 Owner 說「新增／建立／幫我記下／安排一個工作」，使用 action=create，task 必須填完整且只能引用 User Data 中真實存在的 projectId 或 subjectId；若找不到可歸屬的專案／科目，就先問 Owner，不要猜。若是修改既有任務，使用 action=update 並填真實 taskId。\n\n【目前選取】\n${JSON.stringify(selectedTaskIds)}\n\n【User Data】\n${JSON.stringify(data, null, 2)}\n\n【最近對話】\n${JSON.stringify(history, null, 2)}\n\n只回傳 JSON。`;
}
function normalizeActions(rawActions: any[], allTasks: any[], projects: any[], subjects: any[], selectedTaskIds: string[], writeAuthorized: boolean) {
  const raw = Array.isArray(rawActions) ? rawActions : [];
  const validIds = new Set(allTasks.map(t => String(t.id)));
  const selectedSet = new Set(selectedTaskIds);
  const actions: any[] = [];
  let rejected = 0;
  raw.forEach((a: any) => {
    if (!writeAuthorized) { rejected++; return; }
    const domain = a?.domain === 'study' ? 'study' : 'work';
    if (a?.action === 'create') {
      const created = sanitizeCreate(a.task, domain, allTasks, projects, subjects);
      if (created) { actions.push(created); allTasks.push(created.task); } else rejected++;
      return;
    }
    const id = String(a?.taskId || '');
    if (!validIds.has(id) || (selectedTaskIds.length > 0 && !selectedSet.has(id))) { rejected++; return; }
    const updates = sanitizeUpdates(a.updates);
    if (!Object.keys(updates).length) { rejected++; return; }
    actions.push({ action: 'update', taskId: id, domain, updates });
  });
  return { actions, audit: { requested: raw.length, accepted: actions.length, rejected, writeAuthorized } };
}

router.post('/chat', async (req, res) => {
  const { message, agentId, agentName, agentRole, history = [], context = {} } = req.body || {};
  const prompt = String(message || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Message cannot be empty' });
  const requestedAgentId = String(agentId || 'manager');
  const routing = requestedAgentId === 'manager' ? routeManagerRequest(prompt) : {
    primaryAgent: requestedAgentId === 'work' || requestedAgentId === 'study' ? requestedAgentId : 'manager', delegatedAgents: requestedAgentId === 'work' || requestedAgentId === 'study' ? [requestedAgentId] : [], intent: requestedAgentId === 'work' || requestedAgentId === 'study' ? requestedAgentId : 'general', reason: 'Owner 已直接指定專業 Agent。', requiresDataWrite: /新增|建立|修改|更新|刪除|完成|取消|安排|排程|排定|加入|移除|標記|改成|調整|記下/i.test(prompt)
  } as const;
  const executionPlan = buildTeamExecutionPlan(routing);
  const effectiveAgentId = requestedAgentId === 'manager' ? routing.primaryAgent : requestedAgentId;
  const profile = agentProfile(effectiveAgentId, agentName, agentRole);
  const client = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { 'User-Agent': 'personal-ai-team' } } }) : null;
  if (!client) return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  const safeHistory = Array.isArray(history) ? history.slice(-20).map((m: any) => ({ role: m?.sender === 'user' ? 'user' : 'assistant', content: String(m?.text || '').slice(0, 5000) })) : [];
  const workTasks = userOnly(Array.isArray(context.workTasks) ? context.workTasks : []);
  const studyTasks = userOnly(Array.isArray(context.studyTasks) ? context.studyTasks : []);
  const workProjects = userOnly(Array.isArray(context.workProjects) ? context.workProjects : []);
  const studySubjects = userOnly(Array.isArray(context.studySubjects) ? context.studySubjects : []);
  const selectedTaskIds = Array.isArray(context.selectedTaskIds) ? context.selectedTaskIds.map(String) : [];
  const allTasks = [...workTasks.map(t => ({ ...t, domain: 'work' })), ...studyTasks.map(t => ({ ...t, domain: 'study' }))];
  const executionLabel = executionPlan.steps.map((step, index) => `${index + 1}. ${step.agentId === 'manager' ? 'Manager Agent' : step.agentId === 'work' ? 'Work Agent' : 'Study Agent'}：${step.purpose}`).join('\n');
  const data = { workProjects, workTasks, studySubjects, studyTasks };
  try {
    let result: any;
    let finalAgentId: AgentId = effectiveAgentId as AgentId;
    let specialistResults: Record<string, any> = {};
    if (requestedAgentId === 'manager' && routing.intent === 'mixed') {
      const commonRules = '你是被 Manager 委派的專業 Agent。只分析你自己的領域 User Data，提供可供 Manager 決策的事實、風險、優先級與建議。不要替 Manager 做最終回覆，也不要處理另一個領域。';
      const workPrompt = buildBasePrompt(AGENTS.work, routing, executionLabel, { workProjects, workTasks }, selectedTaskIds.filter(id => workTasks.some(t => String(t.id) === id)), safeHistory) + `\n\n【專業委派】\n${commonRules}\n你現在只負責工作領域。`;
      const studyPrompt = buildBasePrompt(AGENTS.study, routing, executionLabel, { studySubjects, studyTasks }, selectedTaskIds.filter(id => studyTasks.some(t => String(t.id) === id)), safeHistory) + `\n\n【專業委派】\n${commonRules}\n你現在只負責課業／研究領域。`;
      const [workResult, studyResult] = await Promise.all([callGemini(client, workPrompt, prompt), callGemini(client, studyPrompt, prompt)]);
      specialistResults = { work: workResult, study: studyResult };
      const managerPrompt = `你是 Manager Agent，是 Personal AI Team 的唯一總管。Owner 的需求同時涉及工作與課業。你已收到 Work Agent 與 Study Agent 的獨立分析，現在整合成最終回覆。\nWork Agent：${JSON.stringify(workResult)}\nStudy Agent：${JSON.stringify(studyResult)}\nUser Data：${JSON.stringify(data)}\n只在 Owner 明確要求修改或新增任務時產生 actions。新增任務請使用 action=create，並從真實 User Data 選擇 projectId/subjectId；找不到就不要猜。用自然繁體中文回答。`;
      result = await callGemini(client, managerPrompt, prompt); finalAgentId = 'manager';
    } else {
      result = await callGemini(client, buildBasePrompt(profile, routing, executionLabel, data, selectedTaskIds, safeHistory), prompt);
    }
    const normalized = normalizeActions(result.actions, allTasks, workProjects, studySubjects, selectedTaskIds, routing.requiresDataWrite);
    const executionAudit = { ...normalized.audit, executionMode: routing.intent === 'mixed' ? 'parallel_specialists_then_manager' : 'single_agent', finalAgent: finalAgentId };
    return res.json({ sender: 'agent', agentId: finalAgentId, requestedAgentId, agentName: AGENTS[finalAgentId]?.name || profile.name, agentRole: AGENTS[finalAgentId]?.role || profile.role, text: String(result.reply || '我有收到。你可以繼續說。'), actions: normalized.actions, routing: { ...routing, effectiveAgentId: finalAgentId }, executionPlan, execution: routing.intent === 'mixed' ? { mode: 'parallel_specialists_then_manager', specialists: ['work', 'study'], specialistResults, finalAgent: 'manager', audit: executionAudit } : { mode: 'single_agent', finalAgent: finalAgentId, audit: executionAudit }, executionAudit });
  } catch (error) {
    console.error('Direct agent chat error:', error);
    return res.status(500).json({ error: 'Direct agent chat failed' });
  }
});
export default router;
