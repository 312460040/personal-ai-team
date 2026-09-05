import './managerOnboarding';
import { routeManagerRequest } from './agentTeam';

export type MemoryDomain = 'manager' | 'work' | 'study' | 'research';

type MemoryRow = {
  domain?: string;
  type?: string;
  content?: string;
  confidence?: number;
  updated_at?: string;
};

const MEMORY_DOMAINS = new Set<MemoryDomain>(['manager', 'work', 'study', 'research']);

function supabaseConfig() {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  return { base, key };
}

function configured() {
  const { base, key } = supabaseConfig();
  return Boolean(base && key);
}

async function supabase(path: string, options: RequestInit = {}) {
  const { base, key } = supabaseConfig();
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

async function resolveUserId(ownerId: string) {
  const rows = await supabase(`users?external_id=eq.${encodeURIComponent(ownerId)}&select=id&limit=1`);
  if (Array.isArray(rows) && rows[0]?.id) return String(rows[0].id);
  const created = await supabase('users', {
    method: 'POST',
    body: JSON.stringify({ external_id: ownerId, display_name: ownerId }),
  });
  return Array.isArray(created) && created[0]?.id ? String(created[0].id) : null;
}

function safeDomain(value: string): MemoryDomain {
  return MEMORY_DOMAINS.has(value as MemoryDomain) ? value as MemoryDomain : 'manager';
}

function requestedDomains(agentId: string, message: string): MemoryDomain[] {
  if (agentId === 'manager') {
    const route = routeManagerRequest(message);
    const domains: MemoryDomain[] = ['manager'];
    route.delegatedAgents.forEach((id) => {
      if (id === 'work' || id === 'study' || id === 'research') domains.push(id);
    });
    return [...new Set(domains)];
  }
  if (agentId === 'work' || agentId === 'study' || agentId === 'research') return [agentId];
  return ['manager'];
}

export async function loadAgentMemories(ownerId: string, agentId: string, message: string, limitPerDomain = 8) {
  if (!configured()) return [];
  const userId = await resolveUserId(ownerId);
  if (!userId) return [];
  const domains = requestedDomains(agentId, message);
  const results = await Promise.all(domains.map(async (domain) => {
    const rows = await supabase(
      `memories?user_id=eq.${encodeURIComponent(userId)}&domain=eq.${encodeURIComponent(domain)}&select=id,domain,type,content,confidence,updated_at&order=updated_at.desc&limit=${Math.min(Math.max(limitPerDomain, 1), 20)}`,
    );
    return (Array.isArray(rows) ? rows : []).map((row: MemoryRow) => ({
      domain: safeDomain(String(row.domain || domain)),
      type: row.type || 'semantic',
      content: String(row.content || '').trim(),
      confidence: Number(row.confidence ?? 0.5),
      updatedAt: row.updated_at || null,
    })).filter((row) => row.content);
  }));
  return results.flat();
}

function normalize(text: string) {
  return text.replace(/\s+/g, '').replace(/[「」『』“”\"'，。！？!?、；;：:（）()【】\[\]]/g, '').toLowerCase();
}

function memoryCandidates(message: string, response: any) {
  const text = message.trim();
  const responseText = typeof response?.finalSynthesisMarkdown === 'string' ? response.finalSynthesisMarkdown : typeof response?.reply === 'string' ? response.reply : '';
  const persistentCue = /記住|記得|以後|往後|之後都|不要再|不用再|偏好|習慣|固定|我通常|我希望|我們決定|決定採用|確定採用|目前研究|研究方向|研究題目|專案是|這個專案|我的工作方式/i.test(text);
  const writeAction = Array.isArray(response?.actions) && response.actions.some((a: any) => a?.action === 'create' || a?.action === 'update');
  const createdTasks = [...(Array.isArray(response?.createdWorkTasks) ? response.createdWorkTasks : []), ...(Array.isArray(response?.createdStudyTasks) ? response.createdStudyTasks : [])];
  const candidates: Array<{ type: string; content: string; confidence: number; domains?: MemoryDomain[] }> = [];

  if (persistentCue) {
    candidates.push({ type: 'semantic', content: `Owner 長期資訊：${text.slice(0, 1000)}`, confidence: 0.92 });
  }
  if (/我們決定|決定採用|確定採用|研究方向|研究題目|研究設計|研究方法/i.test(text)) {
    candidates.push({ type: 'decision', content: `重要決策：${text.slice(0, 1000)}`, confidence: 0.95, domains: ['manager', 'research', 'study'] });
  }
  if (writeAction && responseText) {
    candidates.push({ type: 'interaction', content: `最近執行結果：${responseText.replace(/<!--AIT_TASK_BATCH:[\s\S]*?-->/g, '').trim().slice(0, 1000)}`, confidence: 0.78 });
  }
  if (createdTasks.length) {
    createdTasks.slice(0, 10).forEach((task: any) => {
      const domain: MemoryDomain = task?.subjectId || task?.subjectName ? 'study' : 'work';
      candidates.push({ type: 'task_context', content: `已建立任務「${String(task.title || '未命名任務').slice(0, 200)}」${task.projectName ? `，專案：${String(task.projectName).slice(0, 120)}` : ''}${task.subjectName ? `，科目：${String(task.subjectName).slice(0, 120)}` : ''}${task.deadline ? `，截止：${String(task.deadline).slice(0, 80)}` : ''}。`, confidence: 0.9, domains: [domain] });
    });
  }
  return candidates;
}

export async function saveAgentMemories(ownerId: string, agentId: string, message: string, response: any) {
  if (!configured()) return { saved: 0, configured: false };
  const userId = await resolveUserId(ownerId);
  if (!userId) return { saved: 0, configured: true };
  const baseDomains = requestedDomains(agentId, message);
  const candidates = memoryCandidates(message, response);
  if (!candidates.length) return { saved: 0, configured: true };

  const recent = await Promise.all(baseDomains.map(async (domain) => {
    const rows = await supabase(`memories?user_id=eq.${encodeURIComponent(userId)}&domain=eq.${encodeURIComponent(domain)}&select=content&order=updated_at.desc&limit=100`);
    return { domain, contents: (Array.isArray(rows) ? rows : []).map((r: any) => normalize(String(r.content || ''))) };
  }));
  const savedKeys = new Set(recent.flatMap((item) => item.contents.map((content) => `${item.domain}:${content}`)));
  let saved = 0;

  for (const candidate of candidates.slice(0, 12)) {
    const domains = candidate.domains?.length ? candidate.domains : baseDomains;
    for (const domain of domains) {
      const content = candidate.content.trim().slice(0, 2000);
      const key = `${domain}:${normalize(content)}`;
      if (!content || savedKeys.has(key)) continue;
      await supabase('memories', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, domain, type: candidate.type, content, source: 'agent-memory', confidence: candidate.confidence, evidence_count: 1 }),
      });
      savedKeys.add(key);
      saved += 1;
    }
  }
  return { saved, configured: true };
}

export function memoryHeader(memories: Array<{ domain: string; type: string; content: string }>) {
  if (!memories.length) return '';
  const grouped = memories.reduce<Record<string, string[]>>((acc, memory) => {
    const key = memory.domain || 'manager';
    (acc[key] ||= []).push(`- [${memory.type}] ${memory.content}`);
    return acc;
  }, {});
  const labels: Record<string, string> = { manager: 'Manager 記憶庫', work: 'Work 記憶庫', study: 'Study 記憶庫', research: 'Research 記憶庫' };
  return `【長期記憶庫（不是本次對話才有的記憶）】\n${Object.entries(grouped).map(([domain, lines]) => `### ${labels[domain] || domain}\n${lines.join('\n')}`).join('\n')}`;
}

let installed = false;

export function installAgentMemoryMiddleware() {
  if (installed) return;
  installed = true;
  const express = require('express');
  const originalPost = express.application.post;
  express.application.post = function agentMemoryPost(path: any, ...handlers: any[]) {
    if (path !== '/api/agent/chat' || !handlers.length) return originalPost.call(this, path, ...handlers);
    const wrapped = handlers.map((handler: any) => {
      if (typeof handler !== 'function') return handler;
      return async function agentMemoryHandler(this: any, req: any, res: any, next: any) {
        const ownerId = String(req.header?.('x-owner-id') || req.headers?.['x-owner-id'] || 'personal-owner');
        const message = String(req.body?.message || '').trim();
        const agentId = String(req.body?.agentId || 'manager');
        try {
          const memories = await loadAgentMemories(ownerId, agentId, message);
          if (memories.length) {
            const history = Array.isArray(req.body?.history) ? req.body.history : [];
            req.body.history = [...history, { sender: 'assistant', text: memoryHeader(memories) }].slice(-20);
            req.body.context = { ...(req.body.context || {}), agentMemoryDomains: [...new Set(memories.map((m) => m.domain))] };
          }
        } catch (error) {
          console.warn('[Agent Memory] load skipped:', error instanceof Error ? error.message : String(error));
        }

        const originalJson = res.json.bind(res);
        res.json = (payload: any) => {
          Promise.resolve(saveAgentMemories(ownerId, agentId, message, payload)).catch((error) => console.warn('[Agent Memory] save skipped:', error instanceof Error ? error.message : String(error)));
          return originalJson(payload);
        };
        return handler.call(this, req, res, next);
      };
    });
    return originalPost.call(this, path, ...wrapped);
  };
}

installAgentMemoryMiddleware();
