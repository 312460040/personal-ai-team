import { Router, type Request } from 'express';

const router = Router();
const AGENTS = ['manager','work','study','schedule','research','brainstorm','email','finance','social','hr'];
const DEPARTMENTS = [
  { id: 'management', name: '管理部', headAgent: 'manager', description: '需求判斷、資源調度、跨部門協調與最終決策', agentIds: ['manager'] },
  { id: 'work', name: '工作部', headAgent: 'work', description: '專案、工作任務、截止日與交付管理', agentIds: ['work'] },
  { id: 'study', name: '學習研究部', headAgent: 'study', description: '課業、研究、學習計畫與進度管理', agentIds: ['study'] },
  { id: 'future', name: '支援部門（待啟用）', headAgent: 'schedule', description: '行事曆、調研、創意、郵件、財務、社群與 HR 等專業職能', agentIds: ['schedule','research','brainstorm','email','finance','social','hr'] },
];

function configured() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }
function ownerId(req: Request) { return String(req.header('x-owner-id') || 'personal-owner'); }
async function supabase(path: string, options: RequestInit = {}) {
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  const response = await fetch(`${base}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
async function ensureUser(externalId: string) {
  const rows = await supabase(`users?external_id=eq.${encodeURIComponent(externalId)}&select=id`);
  if (Array.isArray(rows) && rows[0]?.id) return String(rows[0].id);
  const created = await supabase('users', { method: 'POST', body: JSON.stringify({ external_id: externalId, display_name: externalId }) });
  return Array.isArray(created) ? String(created[0]?.id || '') : '';
}
router.use(async (req, res, next) => {
  if (!configured()) return res.status(503).json({ error: 'Organization database is not configured' });
  try { const userId = await ensureUser(ownerId(req)); if (!userId) return res.status(500).json({ error: 'Unable to resolve owner' }); res.locals.userId = userId; next(); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); }
});

router.get('/overview', async (_req, res) => {
  try {
    const userId = res.locals.userId as string;
    const [handoffs, messages, tasks] = await Promise.all([
      supabase(`agent_handoffs?user_id=eq.${encodeURIComponent(userId)}&select=*&order=updated_at.desc&limit=50`),
      supabase(`agent_messages?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=50`),
      supabase(`tasks?user_id=eq.${encodeURIComponent(userId)}&source=eq.user&select=id,title,domain,status,priority,deadline&order=updated_at.desc&limit=100`),
    ]);
    res.json({ ok: true, departments: DEPARTMENTS, agents: AGENTS, handoffs: handoffs || [], messages: messages || [], tasks: tasks || [] });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); }
});

router.post('/handoffs', async (req, res) => {
  try {
    const body = req.body || {};
    const fromAgent = String(body.fromAgent || 'manager'), toAgent = String(body.toAgent || 'work');
    if (!AGENTS.includes(fromAgent) || !AGENTS.includes(toAgent)) return res.status(400).json({ error: 'Unknown agent' });
    if (fromAgent === toAgent) return res.status(400).json({ error: 'Handoff requires different agents' });
    if (!String(body.title || '').trim() || !String(body.reason || '').trim()) return res.status(400).json({ error: 'title and reason are required' });
    const rows = await supabase('agent_handoffs', { method: 'POST', body: JSON.stringify({ user_id: res.locals.userId, from_agent: fromAgent, to_agent: toAgent, task_id: body.taskId || null, project_id: body.projectId || null, title: String(body.title).trim(), reason: String(body.reason).trim(), priority: body.priority || 'medium', deadline: body.deadline || null, status: 'waiting', payload: body.payload || {} }) });
    res.status(201).json({ ok: true, handoff: Array.isArray(rows) ? rows[0] : rows });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); }
});

router.patch('/handoffs/:id', async (req, res) => {
  try {
    const status = String(req.body?.status || 'working');
    if (!['waiting','working','completed','return'].includes(status)) return res.status(400).json({ error: 'Invalid handoff status' });
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    const rows = await supabase(`agent_handoffs?id=eq.${encodeURIComponent(req.params.id)}&user_id=eq.${encodeURIComponent(res.locals.userId as string)}`, { method: 'PATCH', body: JSON.stringify({ status, updated_at: new Date().toISOString(), completed_at: completedAt }) });
    res.json({ ok: true, handoff: Array.isArray(rows) ? rows[0] : rows });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); }
});

router.post('/messages', async (req, res) => {
  try {
    const body = req.body || {};
    const fromAgent = String(body.fromAgent || 'manager'), toAgent = String(body.toAgent || 'work');
    if (!AGENTS.includes(fromAgent) || !AGENTS.includes(toAgent)) return res.status(400).json({ error: 'Unknown agent' });
    const content = String(body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'content is required' });
    const rows = await supabase('agent_messages', { method: 'POST', body: JSON.stringify({ user_id: res.locals.userId, from_agent: fromAgent, to_agent: toAgent, handoff_id: body.handoffId || null, task_id: body.taskId || null, message_type: body.messageType || 'note', content, metadata: body.metadata || {} }) });
    res.status(201).json({ ok: true, message: Array.isArray(rows) ? rows[0] : rows });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); }
});

export default router;
