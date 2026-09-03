import { Router, type Request, type Response } from 'express';

const router = Router();

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function supabase(path: string, options: RequestInit = {}) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function ensureUser(ownerId: string) {
  const rows = await supabase(`users?external_id=eq.${encodeURIComponent(ownerId)}&select=id`);
  if (Array.isArray(rows) && rows[0]?.id) return rows[0].id as string;
  const created = await supabase('users', { method: 'POST', body: JSON.stringify({ external_id: ownerId, display_name: ownerId }) });
  return Array.isArray(created) ? created[0]?.id : null;
}

function ownerId(req: Request) {
  return String(req.header('x-owner-id') || 'personal-owner');
}

router.get('/health', (_req, res) => {
  res.json({ configured: configured(), provider: configured() ? 'supabase-postgresql' : 'not-configured' });
});

router.use(async (req, res, next) => {
  if (!configured()) return res.status(503).json({ error: 'Persistence database is not configured' });
  try {
    const userId = await ensureUser(ownerId(req));
    if (!userId) return res.status(500).json({ error: 'Unable to resolve owner' });
    res.locals.userId = userId;
    next();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Read-only database explorer. Keep this whitelist explicit: never expose arbitrary SQL/table access.
const VIEWABLE_TABLES = [
  'users',
  'projects',
  'tasks',
  'conversations',
  'work_records',
  'memories',
  'focus_sessions',
  'calendar_events',
  'diagnosis_records',
  'adaptive_proposals',
] as const;
type ViewableTable = typeof VIEWABLE_TABLES[number];

function isViewableTable(value: string): value is ViewableTable {
  return (VIEWABLE_TABLES as readonly string[]).includes(value);
}

router.get('/tables', async (_req, res) => {
  try {
    const userId = res.locals.userId as string;
    const results = await Promise.all(VIEWABLE_TABLES.map(async (table) => {
      const rows = await supabase(`${table}?user_id=eq.${encodeURIComponent(userId)}&select=*`);
      return { table, count: Array.isArray(rows) ? rows.length : 0 };
    }));
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.get('/tables/:table', async (req, res) => {
  const table = req.params.table;
  if (!isViewableTable(table)) return res.status(400).json({ error: 'Table is not available in the read-only explorer' });
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const userId = res.locals.userId as string;
    const rows = await supabase(`${table}?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=${limit}`);
    res.json({ table, rows: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/conversations', async (req, res) => {
  try {
    const body = req.body || {};
    const rows = await supabase('conversations', { method: 'POST', body: JSON.stringify({ user_id: res.locals.userId, session_id: body.sessionId || 'default', role: body.role || 'user', agent_id: body.agentId || null, content: body.content || '', project_id: body.projectId || null, task_id: body.taskId || null }) });
    res.json({ id: rows?.[0]?.id, record: rows?.[0] });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); }
});

router.post('/work-records', async (req, res) => {
  try {
    const body = req.body || {};
    const rows = await supabase('work_records', { method: 'POST', body: JSON.stringify({ user_id: res.locals.userId, conversation_id: body.conversationId || null, project_id: body.projectId || null, task_id: body.taskId || null, type: body.type || 'note', title: body.title || '工作紀錄', content: body.content || '', created_by: 'system' }) });
    res.json({ id: rows?.[0]?.id, record: rows?.[0] });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); }
});

router.post('/focus-sessions', async (req, res) => {
  try {
    const body = req.body || {};
    const rows = await supabase('focus_sessions', { method: 'POST', body: JSON.stringify({ user_id: res.locals.userId, task_id: body.taskId || null, planned_minutes: Number(body.plannedMinutes) || 1, actual_minutes: body.actualMinutes == null ? null : Number(body.actualMinutes), started_at: body.startedAt, ended_at: body.endedAt || null, completed: Boolean(body.completed), interruption_count: Number(body.interruptionCount) || 0 }) });
    res.json({ id: rows?.[0]?.id, record: rows?.[0] });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); }
});

router.post('/memories', async (req, res) => {
  try {
    const body = req.body || {};
    const domain = body.domain || 'global';
    const project = body.projectId ? `&project_id=eq.${encodeURIComponent(body.projectId)}` : '';
    const task = body.taskId ? `&task_id=eq.${encodeURIComponent(body.taskId)}` : '';
    const query = `user_id=eq.${res.locals.userId}&domain=eq.${encodeURIComponent(domain)}${project}${task}&select=id,type,content,confidence,source,project_id,task_id,evidence_count,updated_at&order=updated_at.desc&limit=${Math.min(Number(body.limit) || 20, 100)}`;
    const rows = await supabase(`memories?${query}`);
    res.json(rows || []);
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); }
});

router.post('/memories/search', async (req, res) => {
  try {
    const body = req.body || {};
    const domain = body.domain || 'global';
    const project = body.projectId ? `&project_id=eq.${encodeURIComponent(body.projectId)}` : '';
    const task = body.taskId ? `&task_id=eq.${encodeURIComponent(body.taskId)}` : '';
    const queryText = String(body.query || '').trim();
    const textFilter = queryText ? `&content=ilike.*${encodeURIComponent(queryText)}*` : '';
    const query = `user_id=eq.${res.locals.userId}&domain=eq.${encodeURIComponent(domain)}${project}${task}${textFilter}&select=id,type,content,confidence,source,project_id,task_id,evidence_count,updated_at&order=updated_at.desc&limit=${Math.min(Number(body.limit) || 20, 100)}`;
    const rows = await supabase(`memories?${query}`);
    res.json(rows || []);
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); }
});

router.get('/calendar-events', async (req, res) => {
  try {
    const from = req.query.from ? `&start_at=gte.${encodeURIComponent(String(req.query.from))}` : '';
    const to = req.query.to ? `&end_at=lte.${encodeURIComponent(String(req.query.to))}` : '';
    const rows = await supabase(`calendar_events?user_id=eq.${res.locals.userId}${from}${to}&select=id,title,start_at,end_at,calendar_id,status&order=start_at.asc&limit=200`);
    res.json((rows || []).map((row: any) => ({ id: row.id, title: row.title, startAt: row.start_at, endAt: row.end_at, calendarId: row.calendar_id, status: row.status })));
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : String(error) }); }
});

export default router;
