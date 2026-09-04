import React, { useEffect, useRef } from 'react';
import { useAppData } from '../context/AppDataContext';
import { apiUrl } from '../services/apiBase';

const OWNER_ID = 'personal-owner';
const SEEN_KEY = 'ait_handoff_sync_v1';

export default function AgentHandoffSync() {
  const { messages } = useAppData();
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    try { const raw = localStorage.getItem(SEEN_KEY); if (raw) JSON.parse(raw).forEach((id: string) => seen.current.add(id)); } catch {}
  }, []);
  useEffect(() => {
    const sync = async () => {
      for (const message of messages) {
        if (message.sender !== 'manager' || seen.current.has(message.id)) continue;
        const delegated = Array.isArray(message.delegatedAgents) ? message.delegatedAgents.filter(id => id === 'work' || id === 'study') : [];
        if (!delegated.length) continue;
        const title = message.text.replace(/[#*_`]/g, '').replace(/\s+/g, ' ').slice(0, 100) || 'Manager 分派任務';
        const results = await Promise.allSettled(delegated.map(async (toAgent) => {
          const response = await fetch(apiUrl('/api/persistence/organization/handoffs'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Owner-Id': OWNER_ID }, body: JSON.stringify({ fromAgent: 'manager', toAgent, title: `${toAgent === 'work' ? '工作部' : '學習研究部'}：${title}`, reason: `Manager 分流結果：將此需求交由 ${toAgent === 'work' ? 'Work Agent' : 'Study Agent'} 專責處理。`, priority: 'medium', payload: { sourceMessageId: message.id, intentType: message.intentType || null } }) });
          if (!response.ok) throw new Error(`handoff ${response.status}`);
        }));
        if (results.some(result => result.status === 'fulfilled')) {
          seen.current.add(message.id);
          try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen.current).slice(-200))); } catch {}
        }
      }
    };
    void sync();
  }, [messages]);
  return null;
}
