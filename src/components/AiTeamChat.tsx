import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Briefcase, GraduationCap, BookOpen, Copy, Check, ShieldCheck, PlusCircle } from 'lucide-react';
import type { ChatMessage, AgentInfo, StructuredTimeBlock, WorkTask, StudyTask, WorkProject, StudySubject, AgentActivityLog, AgentId, AgentExecutionAudit, Person } from '../types';
import { apiUrl } from '../services/apiBase';
import EmployeeMentionInput from './EmployeeMentionInput';

interface AiTeamChatProps {
  messages: ChatMessage[]; onSendMessage: (text: string) => void; isLoading: boolean;
  onApplyScheduleToToday: (blocks: StructuredTimeBlock[]) => void; currentActiveAgents: string[];
  allowedAgentIds?: string[]; agentRegistry?: AgentInfo[]; workTasks?: WorkTask[]; studyTasks?: StudyTask[];
  workProjects?: WorkProject[]; studySubjects?: StudySubject[]; people?: Person[];
  onToggleWorkTask?: (id: string) => void; onToggleStudyTask?: (id: string) => void;
  onUpdateWorkTask?: (task: WorkTask) => void; onUpdateStudyTask?: (task: StudyTask) => void;
  onAddWorkTask?: (task: any) => void; onAddStudyTask?: (task: any) => void; chatRoomId?: string;
}

type DirectAgent = { id: string; name: string; role: string; icon: React.ReactNode };
const defaultAgents: DirectAgent[] = [
  { id: 'manager', name: 'Manager', role: 'AI 總管', icon: <Bot className="w-3.5 h-3.5" /> },
  { id: 'work', name: 'Work Agent', role: '工作管理員', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { id: 'study', name: 'Study Agent', role: '課業管理員', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { id: 'research', name: 'Research Agent', role: '調研分析員', icon: <BookOpen className="w-3.5 h-3.5" /> },
];
const ROOM_STORAGE_KEY = 'ait_agent_chat_rooms_v2';
const loadRooms = (): Record<string, ChatMessage[]> => { try { return JSON.parse(localStorage.getItem(ROOM_STORAGE_KEY) || '{}'); } catch { return {}; } };
const loadPeople = (): Person[] => { try { const v = JSON.parse(localStorage.getItem('ait_people_v2') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const agentLabel = (id: string) => id === 'work' ? 'Work Agent' : id === 'study' ? 'Study Agent' : id === 'research' ? 'Research Agent' : 'Manager Agent';
const auditSummary = (audit?: AgentExecutionAudit) => audit ? `${audit.executionMode === 'parallel_specialists_then_manager' ? 'Work + Study → Manager' : audit.finalAgent === 'manager' ? 'Manager' : agentLabel(audit.finalAgent)}｜寫入權限 ${audit.writeAuthorized ? '允許' : '未授權'}｜AI 提案 ${audit.requested}｜接受 ${audit.accepted}｜攔截 ${audit.rejected}` : '';
const messageKey = (m: ChatMessage) => `${m.sender === 'user' ? 'user' : 'assistant'}|${m.agentId || ''}|${m.text}`;
const timeNow = () => new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
const fromDb = (row: any): ChatMessage => ({ id: `db-conversation-${row.id}`, sender: row.role === 'user' ? 'user' : 'agent', agentId: row.agent_id || undefined, agentName: row.agent_id === 'manager' ? 'Manager' : row.agent_id === 'work' ? 'Work Agent' : row.agent_id === 'study' ? 'Study Agent' : row.agent_id === 'research' ? 'Research Agent' : undefined, agentRole: row.agent_id === 'manager' ? 'AI 總管' : row.agent_id === 'work' ? '工作管理員' : row.agent_id === 'study' ? '課業管理員' : row.agent_id === 'research' ? '調研分析員' : undefined, text: String(row.content || ''), timestamp: row.created_at ? new Date(row.created_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '' });

export const AiTeamChat: React.FC<AiTeamChatProps> = ({ messages, onSendMessage, isLoading, onApplyScheduleToToday, currentActiveAgents, allowedAgentIds, agentRegistry = [], workTasks = [], studyTasks = [], workProjects = [], studySubjects = [], people = [], onUpdateWorkTask = () => {}, onUpdateStudyTask = () => {}, onAddWorkTask = () => {}, onAddStudyTask = () => {}, chatRoomId = 'room-public' }) => {
  const [inputText, setInputText] = useState('');
  const [directAgentId, setDirectAgentId] = useState('manager');
  const [roomMessages, setRoomMessages] = useState<Record<string, ChatMessage[]>>(loadRooms);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const allowed = allowedAgentIds || currentActiveAgents;
  const selectableAgents = useMemo(() => [...defaultAgents.filter(a => allowed.includes(a.id)), ...agentRegistry.filter(a => allowed.includes(a.id) && !defaultAgents.some(x => x.id === a.id)).map(a => ({ id: a.id, name: a.name, role: a.roleName, icon: <Bot className="w-3.5 h-3.5" /> }))], [allowed.join(','), agentRegistry]);
  const selectedAgent = selectableAgents.find(a => a.id === directAgentId) || selectableAgents[0] || defaultAgents[0];
  const roomKey = chatRoomId;
  const displayMessages = [...messages, ...(roomMessages[roomKey] || [])];
  const busy = loading || isLoading;

  useEffect(() => { if (!selectableAgents.some(a => a.id === directAgentId)) setDirectAgentId(selectableAgents[0]?.id || 'manager'); }, [selectableAgents, directAgentId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [displayMessages.length, busy]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${apiUrl('/api/persistence/conversations')}?sessionId=${encodeURIComponent(roomKey)}&limit=200`, { headers: { 'X-Owner-Id': 'personal-owner' } });
        if (!r.ok || cancelled) return;
        const data = await r.json(); const db = Array.isArray(data.messages) ? data.messages.map(fromDb) : [];
        const local = loadRooms()[roomKey] || []; const keys = new Set(db.map(messageKey));
        setRoomMessages(prev => ({ ...prev, [roomKey]: [...db, ...local.filter(m => !keys.has(messageKey(m)))] }));
      } catch { /* local history remains available */ }
    })();
    return () => { cancelled = true; };
  }, [roomKey]);
  const refreshRoomFromDb = async () => {
    try {
      const r = await fetch(`${apiUrl('/api/persistence/conversations')}?sessionId=${encodeURIComponent(roomKey)}&limit=200`, { headers: { 'X-Owner-Id': 'personal-owner' } });
      if (!r.ok) return;
      const data = await r.json();
      const db = Array.isArray(data.messages) ? data.messages.map(fromDb) : [];
      const local = loadRooms()[roomKey] || [];
      const keys = new Set(db.map(messageKey));
      setRoomMessages(prev => ({ ...prev, [roomKey]: [...db, ...local.filter(m => !keys.has(messageKey(m)))] }));
    } catch { /* keep current room state */ }
  };

  useEffect(() => {
    const timer = window.setInterval(() => { void refreshRoomFromDb(); }, 8000);
    return () => window.clearInterval(timer);
  }, [roomKey]);
  const append = (items: ChatMessage[]) => setRoomMessages(prev => { const next = { ...prev, [roomKey]: [...(prev[roomKey] || []), ...items] }; try { localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(next)); } catch {} return next; });
  const persist = async (m: ChatMessage, role: 'user' | 'assistant') => { try { await fetch(apiUrl('/api/persistence/conversations'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Owner-Id': 'personal-owner' }, body: JSON.stringify({ sessionId: roomKey, role, agentId: role === 'assistant' ? (m.agentId || selectedAgent.id) : null, content: m.text }) }); } catch {} };
  const mentionedPerson = (text: string) => { const m = text.match(/(?:^|\s)@([^\s@]+)/); if (!m) return undefined; const name = m[1].replace(/[，。！？、,:：;；]+$/, ''); const pool = people.length ? people : loadPeople(); return pool.find(p => p.name === name); };
  const applyActions = (actions: any[], person?: Person) => {
    const ids: string[] = [];
    actions.forEach(action => {
      const domain = action.domain === 'study' ? 'study' : 'work'; const assignee = person?.name;
      if (action.action === 'create' && action.task) {
        const task = assignee ? { ...action.task, assignee, notes: `${action.task.notes || ''}${action.task.notes ? '\n' : ''}[指派人員] ${assignee}` } : action.task;
        domain === 'study' ? onAddStudyTask({ ...task, source: 'user', createdBy: 'user' }) : onAddWorkTask({ ...task, source: 'user', createdBy: 'user' });
        ids.push(String(task.id)); return;
      }
      const source = domain === 'study' ? studyTasks.find(t => t.id === action.taskId) : workTasks.find(t => t.id === action.taskId); if (!source) return;
      const next: any = { ...source, ...(action.updates || {}) }; if (assignee) { next.assignee = assignee; next.notes = `${source.notes || ''}${source.notes ? '\n' : ''}[指派人員] ${assignee}`; }
      domain === 'study' ? onUpdateStudyTask(next) : onUpdateWorkTask(next); ids.push(String(action.taskId));
    }); return ids;
  };
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault(); const prompt = inputText.trim(); if (!prompt || busy) return; setInputText('');
    const person = mentionedPerson(prompt); const user: ChatMessage = { id: `direct-user-${Date.now()}`, sender: 'user', text: prompt, timestamp: timeNow(), chatRoomId: roomKey }; append([user]); setLoading(true); void persist(user, 'user');
    try {
      const response = await fetch(apiUrl('/api/agent/direct/chat'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, agentId: selectedAgent.id, agentName: selectedAgent.name, agentRole: selectedAgent.role, history: [...messages, ...(roomMessages[roomKey] || []), user], context: { workProjects, workTasks, studySubjects, studyTasks, people: people.length ? people : loadPeople(), mentionedAssignee: person?.name || null, currentContext: { workspaceId: selectedAgent.id === 'study' ? 'study' : selectedAgent.id === 'work' ? 'work' : 'manager', chatRoomId: roomKey } } }) });
      if (!response.ok) throw new Error(`AI 員工回應 ${response.status}`);
      const data = await response.json(); const actions = Array.isArray(data.actions) ? data.actions : []; const ids = applyActions(actions, person);
      const assignment = person ? `\n\n> 👤 **已指派：${person.name}**${person.role ? `（${person.role}）` : ''}` : '';
      const activityLogs: AgentActivityLog[] = [{ id: `act-${Date.now()}`, timestamp: new Date().toISOString(), stepIndex: 1, fromAgent: (data.agentId || selectedAgent.id) as AgentId, action: actions.length ? '分析 → 寫入 Task' : '分析需求', summary: actions.length ? `已套用 ${ids.length} 筆任務${person ? `，指派給 ${person.name}` : ''}` : '已完成 AI 分析', status: 'completed', durationMs: 0 }];
      const reply: ChatMessage = { id: `direct-agent-${Date.now()}`, sender: 'agent', chatRoomId: roomKey, agentId: data.agentId || selectedAgent.id, agentName: data.agentName || selectedAgent.name, agentRole: data.agentRole || selectedAgent.role, text: `${data.text || data.reply || '我有收到。'}${assignment}`, timestamp: timeNow(), delegatedAgents: data.routing?.delegatedAgents || [], activityLogs, executionAudit: data.executionAudit, executionVerified: actions.length ? ids.length === actions.length : undefined };
      append([reply]); void persist(reply, 'assistant');
    } catch (error: any) { const reply: ChatMessage = { id: `direct-error-${Date.now()}`, sender: 'agent', chatRoomId: roomKey, agentId: selectedAgent.id, agentName: selectedAgent.name, agentRole: selectedAgent.role, text: `目前 AI 員工執行失敗：${error?.message || '未知錯誤'}。`, timestamp: timeNow() }; append([reply]); void persist(reply, 'assistant'); }
    finally { setLoading(false); }
  };
  const copy = (id: string, text: string) => { void navigator.clipboard?.writeText(text); setCopiedId(id); window.setTimeout(() => setCopiedId(null), 1500); };
  return <div className="flex flex-col h-full w-full px-2 sm:px-4 py-3">
    <div className="mb-3 px-4 py-3 bg-white rounded-xl border border-[#E5E2DC] shadow-xs"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="p-1.5 rounded-lg bg-[#E8EFEB] text-[#385244]">{selectedAgent.icon}</div><div><div className="text-sm font-bold">{selectedAgent.name}</div><div className="text-[10px] text-[#8C938D]">{selectedAgent.role}</div></div></div><select value={selectedAgent.id} onChange={e => setDirectAgentId(e.target.value)} className="px-3 py-2 rounded-lg border border-[#E1DDD4] bg-white text-xs">{selectableAgents.map(a => <option key={a.id} value={a.id}>{a.name} · {a.role}</option>)}</select></div>{selectedAgent.id === 'manager' && <div className="mt-2 text-[10px] text-[#6D756F] flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Manager 會先判斷需求，再交給專業 Agent 處理。</div>}</div>
    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-4">{displayMessages.map(msg => { const isUser = msg.sender === 'user'; const open = expanded[msg.id] ?? false; return <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}><div className={`max-w-[95%] sm:max-w-[88%] rounded-2xl p-4 sm:p-5 shadow-xs ${isUser ? 'bg-[#385244] text-white rounded-tr-none' : 'bg-white border border-[#E5E2DC] text-[#2D322E]'}`}><div className={`flex items-center justify-between gap-3 pb-2 mb-2 border-b ${isUser ? 'border-[#4E6B56]' : 'border-[#EBE8E1]'}`}><div className="flex items-center gap-2"><div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isUser ? 'bg-[#2B4035] text-white' : 'bg-[#E8EFEB] text-[#385244]'}`}>{isUser ? <User className="w-4 h-4"/> : <Bot className="w-4 h-4"/>}</div><div><div className="text-xs font-bold">{isUser ? '你' : (msg.agentName || 'AI 員工')}</div><div className={`text-[9px] ${isUser ? 'text-white/70' : 'text-[#8C938D]'}`}>{msg.timestamp}</div></div></div>{!isUser && <button onClick={() => copy(msg.id, msg.text)} className="p-1.5 rounded hover:bg-[#F3F1ED]">{copiedId === msg.id ? <Check className="w-3.5 h-3.5"/> : <Copy className="w-3.5 h-3.5"/>}</button>}</div><div className="prose prose-sm max-w-none"><ReactMarkdown>{msg.text}</ReactMarkdown></div>{!isUser && msg.executionAudit && <div className="mt-3 rounded-lg bg-[#F7F6F2] border border-[#E6E2D9] p-2.5 text-[10px] text-[#66706A]"><div className="font-semibold"><ShieldCheck className="w-3 h-3 inline"/> 執行稽核</div><div className="mt-1">{auditSummary(msg.executionAudit)}</div></div>}{!isUser && msg.activityLogs?.length ? <div className="mt-3"><button onClick={() => setExpanded(p => ({ ...p, [msg.id]: !open }))} className="w-full text-left px-3 py-2 rounded-lg border border-[#E5E1D9] bg-[#FAF9F6] text-[10px] text-[#59615C]">Agent 執行流程（{msg.activityLogs.length} 步）<span className="float-right">{open ? '收起' : '展開'}</span></button>{open && <div className="mt-2 space-y-1.5">{msg.activityLogs.map(log => <div key={log.id} className="px-3 py-2 rounded-lg bg-white border border-[#ECE8E0] text-[10px]"><b>{log.stepIndex}. {log.action}</b><div className="text-[#6E766F]">{log.summary}</div></div>)}</div>}</div> : null}</div></div>; })}<div ref={endRef}/></div>
    <form onSubmit={handleSend} className="mt-3"><EmployeeMentionInput people={people.length ? people : loadPeople()} value={inputText} onChange={setInputText} placeholder="告訴 Manager 或專業 Agent… 輸入 @ 可指定員工處理" /></form>
    <div className="mt-2 text-[9px] text-[#9A9F9B] flex items-center gap-1"><PlusCircle className="w-3 h-3"/>輸入 @員工 → AI 仍負責分析，但系統會以真實員工姓名寫入 Task assignee。</div>
  </div>;
};
