import type { Express, Request, Response } from 'express';

/**
 * Optional Supabase/PostgREST adapter.
 *
 * The browser never receives SUPABASE_SERVICE_ROLE_KEY. This module is intended
 * to run only on the server. Until DATABASE_URL/Supabase is configured, the
 * routes return 503 and the frontend keeps its local fallback.
 */
export function registerPersistenceRoutes(app: Express): void {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const configured = Boolean(supabaseUrl && serviceRoleKey);

  async function postgrest(path: string, init: RequestInit = {}) {
    if (!configured) return null;
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey!}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`PostgREST ${response.status}: ${text}`);
    }
    return response.status === 204 ? [] : response.json();
  }

  function requireDatabase(res: Response): boolean {
    if (configured) return true;
    res.status(503).json({
      ok: false,
      code: 'PERSISTENCE_NOT_CONFIGURED',
      message: 'PostgreSQL persistence is not configured; client offline fallback remains active.',
    });
    return false;
  }

  app.get('/api/persistence/health', (_req: Request, res: Response) => {
    res.json({ ok: true, configured, provider: configured ? 'supabase-postgresql' : 'offline-fallback' });
  });

  app.post('/api/persistence/conversations', async (req: Request, res: Response) => {
    if (!requireDatabase(res)) return;
    try {
      const rows = await postgrest('conversations', { method: 'POST', body: JSON.stringify({
        session_id: req.body.sessionId,
        role: req.body.role,
        agent_id: req.body.agentId ?? null,
        content: req.body.content,
        project_id: req.body.projectId ?? null,
        task_id: req.body.taskId ?? null,
        created_at: req.body.createdAt ?? new Date().toISOString(),
        user_id: req.body.userId,
      }) });
      res.status(201).json({ ok: true, data: rows?.[0] ?? null });
    } catch (error) {
      console.error('[Persistence] conversation write failed', error);
      res.status(500).json({ ok: false, code: 'CONVERSATION_WRITE_FAILED' });
    }
  });

  app.post('/api/persistence/work-records', async (req: Request, res: Response) => {
    if (!requireDatabase(res)) return;
    try {
      const rows = await postgrest('work_records', { method: 'POST', body: JSON.stringify({
        user_id: req.body.userId,
        project_id: req.body.projectId ?? null,
        task_id: req.body.taskId ?? null,
        conversation_id: req.body.conversationId ?? null,
        type: req.body.type,
        title: req.body.title,
        content: req.body.content,
        created_by: req.body.createdBy ?? 'system',
      }) });
      res.status(201).json({ ok: true, data: rows?.[0] ?? null });
    } catch (error) {
      console.error('[Persistence] work record write failed', error);
      res.status(500).json({ ok: false, code: 'WORK_RECORD_WRITE_FAILED' });
    }
  });

  app.post('/api/persistence/focus-sessions', async (req: Request, res: Response) => {
    if (!requireDatabase(res)) return;
    try {
      const rows = await postgrest('focus_sessions', { method: 'POST', body: JSON.stringify({
        user_id: req.body.userId,
        task_id: req.body.taskId ?? null,
        planned_minutes: req.body.plannedMinutes,
        actual_minutes: req.body.actualMinutes ?? null,
        started_at: req.body.startedAt,
        ended_at: req.body.endedAt ?? null,
        completed: Boolean(req.body.completed),
        interruption_count: req.body.interruptionCount ?? 0,
      }) });
      res.status(201).json({ ok: true, data: rows?.[0] ?? null });
    } catch (error) {
      console.error('[Persistence] focus session write failed', error);
      res.status(500).json({ ok: false, code: 'FOCUS_SESSION_WRITE_FAILED' });
    }
  });

  app.post('/api/persistence/memories', async (req: Request, res: Response) => {
    if (!requireDatabase(res)) return;
    try {
      const rows = await postgrest('memories', { method: 'POST', body: JSON.stringify({
        user_id: req.body.userId,
        domain: req.body.domain,
        type: req.body.type,
        content: req.body.content,
        source: req.body.source ?? 'observed',
        confidence: req.body.confidence ?? 0.5,
        project_id: req.body.projectId ?? null,
        task_id: req.body.taskId ?? null,
        evidence_count: req.body.evidenceCount ?? 1,
      }) });
      res.status(201).json({ ok: true, data: rows?.[0] ?? null });
    } catch (error) {
      console.error('[Persistence] memory write failed', error);
      res.status(500).json({ ok: false, code: 'MEMORY_WRITE_FAILED' });
    }
  });

  app.post('/api/persistence/memories/search', async (req: Request, res: Response) => {
    if (!requireDatabase(res)) return;
    try {
      const domain = encodeURIComponent(req.body.domain || 'global');
      const projectId = req.body.projectId;
      const taskId = req.body.taskId;
      const limit = Math.min(Math.max(Number(req.body.limit) || 20, 1), 100);
      const filters = [`domain=eq.${domain}`];
      if (projectId) filters.push(`project_id=eq.${encodeURIComponent(projectId)}`);
      if (taskId) filters.push(`task_id=eq.${encodeURIComponent(taskId)}`);
      const query = `${filters.join('&')}&order=updated_at.desc&limit=${limit}`;
      const rows = await postgrest(`memories?${query}`, { method: 'GET' });
      res.json({ ok: true, data: rows ?? [] });
    } catch (error) {
      console.error('[Persistence] memory search failed', error);
      res.status(500).json({ ok: false, code: 'MEMORY_SEARCH_FAILED' });
    }
  });

  app.get('/api/persistence/calendar-events', async (req: Request, res: Response) => {
    if (!requireDatabase(res)) return;
    try {
      const userId = encodeURIComponent(String(req.query.userId || ''));
      if (!userId) return res.status(400).json({ ok: false, code: 'USER_ID_REQUIRED' });
      const from = req.query.from ? `&start_at=gte.${encodeURIComponent(String(req.query.from))}` : '';
      const to = req.query.to ? `&start_at=lt.${encodeURIComponent(String(req.query.to))}` : '';
      const rows = await postgrest(`calendar_events?user_id=eq.${userId}${from}${to}&order=start_at.asc`, { method: 'GET' });
      res.json({ ok: true, data: rows ?? [] });
    } catch (error) {
      console.error('[Persistence] calendar read failed', error);
      res.status(500).json({ ok: false, code: 'CALENDAR_READ_FAILED' });
    }
  });
}
