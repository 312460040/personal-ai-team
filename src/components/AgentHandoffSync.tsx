import React, { useEffect, useRef } from 'react';
import { useAppData } from '../context/AppDataContext';
import { apiUrl } from '../services/apiBase';

const OWNER_ID = 'personal-owner';
const SEEN_KEY = 'ait_handoff_sync_v3';
const AGENTS = new Set(['work', 'study', 'research']);

export default function AgentHandoffSync() {
  const { messages } = useAppData();
  const seen = useRef<Set<string>>(new Set());
  const running = useRef<Set<string>>(new Set());

  useEffect(() => {
    try { const raw = localStorage.getItem(SEEN_KEY); if (raw) JSON.parse(raw).forEach((id: string) => seen.current.add(id)); } catch {}
  }, []);

  useEffect(() => {
    const sync = async () => {
      for (const message of messages) {
        if (message.sender !== 'manager' || seen.current.has(message.id) || running.current.has(message.id)) continue;
        const delegated = Array.isArray(message.delegatedAgents) ? message.delegatedAgents.filter(id => AGENTS.has(id)) : [];
        if (!delegated.length) continue;
        running.current.add(message.id);
        try {
          const title = message.text.replace(/[#*_`]/g, '').replace(/\s+/g, ' ').slice(0, 100) || 'Manager 分派任務';
          const results = await Promise.allSettled(delegated.map(async (toAgent) => {
            const agentName = toAgent === 'work' ? 'Work Agent' : toAgent === 'study' ? 'Study Agent' : 'Research Agent';
            const department = toAgent === 'work' ? '工作部' : toAgent === 'study' ? '課業部' : '研究部';
            const createResponse = await fetch(apiUrl('/api/persistence/organization/handoffs'), {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Owner-Id': OWNER_ID },
              body: JSON.stringify({
                fromAgent: 'manager', toAgent,
                title: `${department}：${title}`,
                reason: `Manager 分流結果：將此需求交由 ${agentName} 專責處理。`,
                priority: 'medium',
                payload: {
                  sourceMessageId: message.id,
                  sourceSessionId: (message as any).chatRoomId || (message as any).sessionId || 'room-public',
                  intentType: message.intentType || null,
                  sourceText: message.text.slice(0, 3000),
                },
              }),
            });
            if (!createResponse.ok) throw new Error(`handoff create ${createResponse.status}`);
            const created = await createResponse.json();
            const handoffId = created?.handoff?.id;
            if (!handoffId) throw new Error('handoff id missing');
            const executeResponse = await fetch(apiUrl(`/api/persistence/organization/handoffs/${encodeURIComponent(handoffId)}/execute`), {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Owner-Id': OWNER_ID },
            });
            if (!executeResponse.ok) throw new Error(`handoff execute ${executeResponse.status}`);
            const execution = await executeResponse.json();
            const result = String(execution?.executionResult || '').trim();
            const sessionId = String(message.chatRoomId || (message as any).sessionId || 'room-public');
            if (result) {
              await fetch(apiUrl('/api/persistence/conversations'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Owner-Id': OWNER_ID },
                body: JSON.stringify({
                  sessionId,
                  role: 'assistant',
                  agentId: toAgent,
                  content: `【${agentName} 回報 Manager】\n\n${result}`,
                }),
              });
            }
            return execution;
          }));
          if (results.some(result => result.status === 'fulfilled')) {
            seen.current.add(message.id);
            try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen.current).slice(-200))); } catch {}
          }
        } finally {
          running.current.delete(message.id);
        }
      }
    };
    void sync();
  }, [messages]);
  return null;
}
