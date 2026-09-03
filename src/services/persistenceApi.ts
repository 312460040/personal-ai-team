import type { ChatMessage } from '../types';

const API_BASE = '/api/persistence';

async function request<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      ...options,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // The app intentionally keeps working when the database/API is unavailable.
    return null;
  }
}

export function persistConversation(message: ChatMessage, sessionId: string, context?: { projectId?: string | null; taskId?: string | null }): Promise<{ id: string } | null> {
  return request<{ id: string }>('/conversations', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      role: message.sender,
      agentId: message.sender === 'manager' ? 'manager' : null,
      content: message.text,
      projectId: context?.projectId ?? null,
      taskId: context?.taskId ?? null,
      createdAt: new Date().toISOString(),
    }),
  });
}

export function persistWorkRecord(input: {
  type: string;
  title: string;
  content: string;
  conversationId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
}): Promise<{ id: string } | null> {
  return request<{ id: string }>('/work-records', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function persistFocusSession(input: {
  taskId?: string | null;
  plannedMinutes: number;
  actualMinutes?: number;
  startedAt: string;
  endedAt?: string;
  completed: boolean;
  interruptionCount?: number;
}): Promise<{ id: string } | null> {
  return request<{ id: string }>('/focus-sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getScopedMemories(input: {
  domain: 'global' | 'work' | 'study';
  projectId?: string | null;
  taskId?: string | null;
  query?: string;
  limit?: number;
}): Promise<Array<{ id: string; type: string; content: string; confidence: number; source: string }> > {
  return (await request<Array<{ id: string; type: string; content: string; confidence: number; source: string }>>('/memories', {
    method: 'POST',
    body: JSON.stringify(input),
  })) || [];
}

export async function getCalendarEvents(input?: { from?: string; to?: string }): Promise<Array<{ id: string; title: string; startAt: string; endAt: string; calendarId: string }>> {
  return (await request<Array<{ id: string; title: string; startAt: string; endAt: string; calendarId: string }>>('/calendar-events', {
    method: 'POST',
    body: JSON.stringify(input || {}),
  })) || [];
}
