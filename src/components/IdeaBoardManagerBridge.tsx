import { useEffect } from 'react';
import { apiUrl } from '../services/apiBase';

const MESSAGE_KEY = 'ait_messages_v2';

export function IdeaBoardManagerBridge() {
  useEffect(() => {
    const handler = async (event: Event) => {
      const detail = (event as CustomEvent).detail as { prompt?: string } | undefined;
      const prompt = String(detail?.prompt || '').trim();
      if (!prompt) return;
      try {
        const response = await fetch(apiUrl('/api/agent/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Owner-Id': 'personal-owner' },
          body: JSON.stringify({ message: prompt, context: { currentContext: { workspaceId: 'work', projectId: null } } }),
        });
        if (!response.ok) return;
        const data = await response.json();
        const text = data.finalSynthesisMarkdown || 'Manager 已收到今天的想法整理需求。';
        const now = new Date();
        const messages = JSON.parse(localStorage.getItem(MESSAGE_KEY) || '[]');
        const user = { id: `user-idea-review-${Date.now()}`, sender: 'user', text: prompt, timestamp: now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) };
        const manager = { id: `manager-idea-review-${Date.now()}`, sender: 'manager', text, timestamp: now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }), intentType: data.intentType, delegatedAgents: data.delegatedAgents, activityLogs: data.activityLogs || [] };
        localStorage.setItem(MESSAGE_KEY, JSON.stringify([...messages, user, manager].slice(-200)));
        window.dispatchEvent(new CustomEvent('ait:idea-review-complete'));
      } catch (error) {
        console.warn('[IdeaBoardManagerBridge] daily review failed', error);
      }
    };
    window.addEventListener('ait:manager-idea-review', handler);
    return () => window.removeEventListener('ait:manager-idea-review', handler);
  }, []);
  return null;
}
export default IdeaBoardManagerBridge;
