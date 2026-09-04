import express from 'express';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();
const AGENTS: Record<string, { name: string; role: string; specialty: string }> = {
  manager: { name: 'Manager Agent', role: 'AI 總管', specialty: '統籌、決策、工作與課業協調、時間安排與任務管理' },
  work: { name: 'Work Agent', role: '工作管理員', specialty: '工作專案、任務優先級、截止日、工時、拆解與執行阻礙' },
  study: { name: 'Study Agent', role: '課業管理員', specialty: '課業、研究、複習、考試與學習進度' },
};
function userOnly(items: any[] = []) { return items.filter((item) => { if (!item || item.source === 'demo') return false; if (item.source === 'user') return true; const id = String(item.id || ''); const title = String(item.title || ''); return id.includes('user') || id.startsWith('w-task-') || id.startsWith('s-task-') || id.startsWith('proj-') || !title.includes('【Demo】'); }); }
function agentProfile(id: string, name?: string, role?: string) { return AGENTS[id] || { name: name || 'AI 員工', role: role || '專案助理', specialty: '依 Owner 指派的專業工作提供協助' }; }

router.post('/chat', async (req, res) => {
  const { message, agentId, agentName, agentRole, history = [], context = {} } = req.body || {};
  const prompt = String(message || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Message cannot be empty' });
  const profile = agentProfile(String(agentId || 'manager'), agentName, agentRole);
  const client = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { 'User-Agent': 'personal-ai-team' } } }) : null;
  if (!client) return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });

  const safeHistory = Array.isArray(history) ? history.slice(-16).map((m: any) => ({ role: m?.sender === 'user' ? 'user' : 'assistant', content: String(m?.text || '').slice(0, 5000) })) : [];
  const workTasks = userOnly(Array.isArray(context.workTasks) ? context.workTasks : []);
  const studyTasks = userOnly(Array.isArray(context.studyTasks) ? context.studyTasks : []);
  const workProjects = userOnly(Array.isArray(context.workProjects) ? context.workProjects : []);
  const studySubjects = userOnly(Array.isArray(context.studySubjects) ? context.studySubjects : []);
  const selectedTaskIds = Array.isArray(context.selectedTaskIds) ? context.selectedTaskIds.map(String) : [];
  const allTasks = [...workTasks.map(t => ({ ...t, domain: 'work' })), ...studyTasks.map(t => ({ ...t, domain: 'study' }))];

  const systemPrompt = `你是 Personal AI Team 的長期 AI 員工，而不是客服機器人。
你現在直接和 Owner 對話：${profile.name}（${profile.role}）。你的專長：${profile.specialty}。

【對話方式】
- 像一位真正長期合作的人一樣說話：自然、簡潔、有上下文、有判斷力。
- 不要每輪自我介紹，不要講 Shared Data Store、Agent delegation、Action Guard，除非 Owner 主動問架構。
- 可以理解「那個、剛剛那個、第二個、全部、選中的、先不要、算了、繼續」等上下文。
- 如果資訊不足，問一個最必要的問題；不要一次丟十個問題。
- 可以提出建議與理由，但不要假裝已完成沒有執行的事情。
- 全程繁體中文。

【任務操作】
Owner 可以直接用自然語言管理清單。當需求明確時，請在 actions 中產生要修改的 Task ID；前端會真正寫入資料。
可修改：title、status、priority、deadline、estimatedHours、notes、tags、category、color。
status 只能是 todo / in_progress / completed / delayed；priority 只能是 low / medium / high；color 可用 green / purple / blue / orange / pink / gray。
若 Owner 說「選中的」，只操作 selectedTaskIds。
若同名任務有多筆且無法唯一判斷，不要猜，actions 留空並在 reply 請 Owner 指定。
若只是詢問、討論、分析，actions 留空。

【目前選取】
selectedTaskIds=${JSON.stringify(selectedTaskIds)}

【User Data】
${JSON.stringify({ workProjects, workTasks, studySubjects, studyTasks }, null, 2)}

【對話歷史】
${JSON.stringify(safeHistory, null, 2)}

請回傳 JSON，格式必須符合：
{
  "reply": "給 Owner 的自然語言回覆",
  "actions": [
    { "taskId": "唯一 Task ID", "domain": "work 或 study", "updates": { "title": "可選", "status": "可選", "priority": "可選", "deadline": "可選", "estimatedHours": 2, "notes": "可選", "tags": ["可選"], "category": "可選", "color": "可選" } }
  ]
}
只在真的要修改時產生 actions。不要在 reply 中輸出 JSON。`;

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
            actions: { type: 'array', items: { type: 'object', properties: { taskId: { type: 'string' }, domain: { type: 'string', enum: ['work', 'study'] }, updates: { type: 'object', properties: { title: { type: 'string' }, status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'delayed'] }, priority: { type: 'string', enum: ['low', 'medium', 'high'] }, deadline: { type: 'string' }, estimatedHours: { type: 'number' }, notes: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, category: { type: 'string' }, color: { type: 'string', enum: ['green', 'purple', 'blue', 'orange', 'pink', 'gray'] } } } }, required: ['taskId', 'domain', 'updates'] } },
          },
          required: ['reply', 'actions'],
        },
      },
    });
    let result: any;
    try { result = JSON.parse(response.text || '{"reply":"我有收到。","actions":[]}'); } catch { result = { reply: response.text || '我有收到。', actions: [] }; }
    const validIds = new Set(allTasks.map(t => String(t.id)));
    const actions = Array.isArray(result.actions) ? result.actions.filter((a: any) => validIds.has(String(a?.taskId))).map((a: any) => ({ taskId: String(a.taskId), domain: a.domain === 'study' ? 'study' : 'work', updates: a.updates || {} })) : [];
    return res.json({ sender: 'agent', agentId: String(agentId || 'manager'), agentName: profile.name, agentRole: profile.role, text: String(result.reply || '我有收到。你可以繼續說。'), actions });
  } catch (error) {
    console.error('Direct agent chat error:', error);
    return res.status(500).json({ error: 'Direct agent chat failed' });
  }
});
export default router;
