import express from 'express';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();

const AGENTS: Record<string, { name: string; role: string; specialty: string }> = {
  manager: { name: 'Manager Agent', role: 'AI 總管', specialty: '統籌、決策、跨工作與課業協調' },
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
  return AGENTS[id] || {
    name: name || 'AI 員工',
    role: role || '專案助理',
    specialty: '依 Owner 指派的專業工作提供協助',
  };
}

router.post('/chat', async (req, res) => {
  const { message, agentId, agentName, agentRole, history = [], context = {} } = req.body || {};
  const prompt = String(message || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Message cannot be empty' });

  const profile = agentProfile(String(agentId || 'manager'), agentName, agentRole);
  const client = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { 'User-Agent': 'personal-ai-team' } } }) : null;
  if (!client) return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });

  const safeHistory = Array.isArray(history) ? history.slice(-12).map((m: any) => ({
    role: m?.sender === 'user' ? 'user' : 'assistant',
    content: String(m?.text || '').slice(0, 4000),
  })) : [];

  const workTasks = userOnly(Array.isArray(context.workTasks) ? context.workTasks : []);
  const studyTasks = userOnly(Array.isArray(context.studyTasks) ? context.studyTasks : []);
  const workProjects = userOnly(Array.isArray(context.workProjects) ? context.workProjects : []);
  const studySubjects = userOnly(Array.isArray(context.studySubjects) ? context.studySubjects : []);

  const dataSection = profile.name === 'Work Agent'
    ? { workProjects, workTasks }
    : profile.name === 'Study Agent'
      ? { studySubjects, studyTasks }
      : { workProjects, workTasks, studySubjects, studyTasks };

  const systemPrompt = `你是 Personal AI Team 裡真正可以和 Owner 長期對話的 AI 員工。

你的身份：${profile.name}（${profile.role}）
你的專長：${profile.specialty}

重要行為規則：
1. 你現在是在「直接和 Owner 對話」，不要再把自己說成只是被 Manager 呼叫的工具。
2. 你可以自然接續上一輪對話，理解「那個、剛剛、第二個、繼續、我覺得不行」等上下文。
3. 不要每次都重複自我介紹、Agent 流程、Shared Data Store 或「已調派 Agent」。只有 Owner 問到架構時才談。
4. 回答要像一位熟悉 Owner 工作方式的長期 AI 員工：自然、直接、有上下文。
5. 可以主動追問真正缺少的資訊，但不要為了形式而追問。
6. 涉及使用者資料時，只能使用下方 User Data；不能使用 Demo 資料，也不能捏造不存在的任務、專案、科目或人。
7. 如果 Owner 要你修改資料，先明確理解目標與欄位；本端點目前只負責對話，不要假裝已經寫入資料庫。
8. 全程使用繁體中文。

目前對話歷史：
${JSON.stringify(safeHistory, null, 2)}

目前可參考的 User Data：
${JSON.stringify(dataSection, null, 2)}

目前工作脈絡：${JSON.stringify(context.currentContext || {}, null, 2)}

請直接回答 Owner 最新訊息：「${prompt}」`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: systemPrompt,
    });
    return res.json({
      sender: 'agent',
      agentId: String(agentId || 'manager'),
      agentName: profile.name,
      agentRole: profile.role,
      text: response.text || '我有收到。你可以繼續說，我會接著這個脈絡處理。',
    });
  } catch (error) {
    console.error('Direct agent chat error:', error);
    return res.status(500).json({ error: 'Direct agent chat failed' });
  }
});

export default router;
