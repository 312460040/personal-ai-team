import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { routeManagerRequest } from './agentTeam';

const router = express.Router();
const AGENTS: Record<string, { name: string; role: string; specialty: string }> = {
  manager: { name: 'Manager Agent', role: 'AI 總管', specialty: '統籌、決策、工作與課業協調、時間安排與任務管理' },
  work: { name: 'Work Agent', role: '工作管理員', specialty: '工作專案、任務優先級、截止日、工時、拆解與執行阻礙' },
  study: { name: 'Study Agent', role: '課業管理員', specialty: '課業、研究、複習、考試與學習進度' },
};
function userOnly(items: any[] = []) { return items.filter((item) => { if (!item || item.source === 'demo') return false; if (item.source === 'user') return true; const id = String(item.id || ''); const title = String(item.title || ''); return id.includes('user') || id.startsWith('w-task-') || id.startsWith('s-task-') || id.startsWith('proj-') || !title.includes('【Demo】'); }); }
function agentProfile(id: string, name?: string, role?: string) { return AGENTS[id] || { name: name || 'AI 員工', role: role || '專案助理', specialty: '依 Owner 指派的專業工作提供協助' }; }
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

router.post('/chat', async (req, res) => {
  const { message, agentId, agentName, agentRole, history = [], context = {} } = req.body || {};
  const prompt = String(message || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Message cannot be empty' });

  // Manager 是公開入口：當前端沒有指定專業 Agent 時，先做一次確定性的分流。
  // mixed/general 仍由 Manager 自己處理；單一領域則交給對應專業 Agent。
  const requestedAgentId = String(agentId || 'manager');
  const routing = requestedAgentId === 'manager' ? routeManagerRequest(prompt) : {
    primaryAgent: requestedAgentId === 'work' || requestedAgentId === 'study' ? requestedAgentId : 'manager',
    delegatedAgents: requestedAgentId === 'work' || requestedAgentId === 'study' ? [requestedAgentId] : [],
    intent: requestedAgentId === 'work' || requestedAgentId === 'study' ? requestedAgentId : 'general',
    reason: 'Owner 已直接指定專業 Agent。',
    requiresDataWrite: /新增|建立|修改|更新|刪除|完成|取消|安排|排程|排定|加入|移除|標記|改成|調整/i.test(prompt),
  } as const;
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

  const routingLabel = routing.intent === 'work' ? '工作 → Work Agent' : routing.intent === 'study' ? '課業／研究 → Study Agent' : routing.intent === 'mixed' ? '工作＋課業 → Manager 協調 Work Agent + Study Agent' : '一般需求 → Manager Agent';
  const systemPrompt = `你是 Personal AI Team 的長期 AI 員工。你不是客服，也不是只會回覆固定模板的聊天機器人；你要像一位真的和 Owner 長期合作的同事。
目前身份：${profile.name}（${profile.role}）。專長：${profile.specialty}。

【Manager 分流結果】
- 本次需求：${routingLabel}
- 分流理由：${routing.reason}
- 是否可能需要資料寫入：${routing.requiresDataWrite ? '是' : '否'}
- 已委派：${routing.delegatedAgents.join(', ') || '無'}

【團隊協作規則】
- Manager 是唯一總管。當需求明確屬於單一專業領域時，由該專業 Agent 執行；不要讓 Manager 與專業 Agent 重複做同一件事。
- 工作需求由 Work Agent 處理；課業／研究需求由 Study Agent 處理；同時涉及兩者時由 Manager 協調兩邊。
- 如果是一般聊天、討論或無法安全分類的需求，由 Manager 自己處理。
- 不要因為訊息出現「報告」就一律判成工作；要依上下文判斷。這一輪的分流結果已由系統提供，請尊重它。

【自然對話】
- 用自然、口語、成熟的繁體中文回應，像真的人在一起工作。
- 記得前面的對話，不要每一輪重新自我介紹，也不要重複解釋系統架構。
- 能理解「那個」「剛剛的」「第一個」「這幾個」「全部」「選中的」「先不要」「算了」「繼續」「我覺得太多了」等上下文。
- 不要只把 Owner 的話改寫一次就結束；要理解意圖、做判斷，必要時主動提出合理下一步。
- Owner 只是閒聊、抱怨、詢問或想討論時，就正常聊天，不要硬把事情變成 Task。
- 如果資訊不足，只問最關鍵的一個問題。不要一次問一堆。
- 如果你已經真的產生 actions，回覆要自然告訴 Owner 做了什麼；沒有 actions 就不能聲稱已修改。

【你可以真的操作清單】
當 Owner 明確要求修改任務時，產生 actions。可以修改 title、status、priority、deadline、estimatedHours、notes、tags、category、color。
status：todo / in_progress / completed / delayed。
priority：low / medium / high。
category：work / study / research / admin / personal。
color：green / purple / blue / orange / pink / gray。
- 「加標籤」代表保留原有 tags 並加入新標籤；除非 Owner 明確要求「把標籤改成／清掉」，不要覆蓋既有 tags。
- 「改分類」與「改顏色」可以同時執行。
- 若 Owner 說「選中的」，只能操作 selectedTaskIds。
- 若 selectedTaskIds 有值但 Owner 的指令沒有要求操作任務，可以正常聊天，不要自動修改。
- 若同名任務有多筆且無法唯一判斷，不要猜，actions 留空並請 Owner 指定。
- 只修改必要欄位，不要無故改 deadline、title 或其他欄位。

【目前選取】
${JSON.stringify(selectedTaskIds)}

【User Data】
${JSON.stringify({ workProjects, workTasks, studySubjects, studyTasks }, null, 2)}

【最近對話】
${JSON.stringify(safeHistory, null, 2)}

只回傳 JSON：
{
  "reply": "給 Owner 的自然語言回覆",
  "actions": [
    { "taskId": "唯一 Task ID", "domain": "work 或 study", "updates": { "title": "可選", "status": "可選", "priority": "可選", "deadline": "可選", "estimatedHours": 2, "notes": "可選", "tags": ["可選"], "category": "可選", "color": "可選" } }
  ]
}
不要在 reply 中輸出 JSON。`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: systemPrompt + `\n\nOwner 最新訊息：「${prompt}」`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            actions: { type: 'array', items: { type: 'object', properties: { taskId: { type: 'string' }, domain: { type: 'string', enum: ['work', 'study'] }, updates: { type: 'object', properties: { title: { type: 'string' }, status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'delayed'] }, priority: { type: 'string', enum: ['low', 'medium', 'high'] }, deadline: { type: 'string' }, estimatedHours: { type: 'number' }, notes: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, category: { type: 'string', enum: ['work', 'study', 'research', 'admin', 'personal'] }, color: { type: 'string', enum: ['green', 'purple', 'blue', 'orange', 'pink', 'gray'] } } } }, required: ['taskId', 'domain', 'updates'] } },
          },
          required: ['reply', 'actions'],
        },
      },
    });
    let result: any;
    try { result = JSON.parse(response.text || '{"reply":"我有收到。","actions":[]}'); } catch { result = { reply: response.text || '我有收到。', actions: [] }; }
    const validIds = new Set(allTasks.map(t => String(t.id)));
    const selectedSet = new Set(selectedTaskIds);
    const actions = Array.isArray(result.actions) ? result.actions.filter((a: any) => {
      const id = String(a?.taskId || '');
      return validIds.has(id) && (!selectedTaskIds.length || selectedSet.has(id));
    }).map((a: any) => ({ taskId: String(a.taskId), domain: a.domain === 'study' ? 'study' : 'work', updates: sanitizeUpdates(a.updates) })).filter((a: any) => Object.keys(a.updates).length > 0) : [];
    return res.json({ sender: 'agent', agentId: effectiveAgentId, requestedAgentId, agentName: profile.name, agentRole: profile.role, text: String(result.reply || '我有收到。你可以繼續說。'), actions, routing: { ...routing, effectiveAgentId } });
  } catch (error) {
    console.error('Direct agent chat error:', error);
    return res.status(500).json({ error: 'Direct agent chat failed' });
  }
});
export default router;
