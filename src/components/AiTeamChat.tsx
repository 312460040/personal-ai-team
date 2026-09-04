import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Briefcase, GraduationCap, Sparkles, Copy, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ChatMessage, AgentInfo, StructuredTimeBlock, WorkTask, StudyTask, WorkProject, StudySubject } from '../types';
import { AgentActivityPipeline } from './AgentActivityPipeline';
import { ChatTaskChecklist } from './ChatTaskChecklist';
import { apiUrl } from '../services/apiBase';

interface AiTeamChatProps {
  messages: ChatMessage[]; onSendMessage: (text: string) => void; isLoading: boolean;
  onApplyScheduleToToday: (blocks: StructuredTimeBlock[]) => void; currentActiveAgents: string[]; agentRegistry?: AgentInfo[];
  workTasks?: WorkTask[]; studyTasks?: StudyTask[]; workProjects?: WorkProject[]; studySubjects?: StudySubject[];
  onToggleWorkTask?: (id: string) => void; onToggleStudyTask?: (id: string) => void;
  onUpdateWorkTask?: (task: WorkTask) => void; onUpdateStudyTask?: (task: StudyTask) => void;
}
type DirectAgent = { id: string; name: string; role: string; icon: React.ReactNode };
const defaultAgents: DirectAgent[] = [
  { id: 'manager', name: 'Manager', role: 'AI 總管', icon: <Bot className="w-3.5 h-3.5" /> },
  { id: 'work', name: 'Work Agent', role: '工作管理員', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { id: 'study', name: 'Study Agent', role: '課業管理員', icon: <GraduationCap className="w-3.5 h-3.5" /> },
];

export const AiTeamChat: React.FC<AiTeamChatProps> = ({ messages, onSendMessage, isLoading, onApplyScheduleToToday, currentActiveAgents, agentRegistry = [], workTasks = [], studyTasks = [], workProjects = [], studySubjects = [], onToggleWorkTask = () => {}, onToggleStudyTask = () => {}, onUpdateWorkTask = () => {}, onUpdateStudyTask = () => {} }) => {
  const [inputText, setInputText] = useState(''); const [directAgentId, setDirectAgentId] = useState('manager');
  const [directMessages, setDirectMessages] = useState<ChatMessage[]>([]); const [directLoading, setDirectLoading] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]); const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({}); const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const availableAgents = defaultAgents.filter(agent => currentActiveAgents.includes(agent.id));
  const registryAgents = agentRegistry.filter(agent => currentActiveAgents.includes(agent.id) && !defaultAgents.some(a => a.id === agent.id));
  const selectableAgents = [...availableAgents, ...registryAgents.map(a => ({ id: a.id, name: a.name, role: a.roleName, icon: <Bot className="w-3.5 h-3.5" /> }))];
  const selectedAgent = selectableAgents.find(a => a.id === directAgentId) || defaultAgents[0];
  const displayMessages = directMessages.length ? directMessages : (selectedAgent.id === 'manager' ? messages : []); const busy = directLoading || isLoading;
  useEffect(() => { if (!selectableAgents.some(a => a.id === directAgentId)) setDirectAgentId(selectableAgents[0]?.id || 'manager'); }, [currentActiveAgents.join(','), agentRegistry.length]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [displayMessages, busy]);

  const applyActions = (actions: any[]) => actions.forEach(action => {
    const domain = action.domain === 'study' ? 'study' : 'work'; const sourceTask = domain === 'study' ? studyTasks.find(t => t.id === action.taskId) : workTasks.find(t => t.id === action.taskId); if (!sourceTask) return;
    const updates = action.updates || {}; const next: any = { ...sourceTask, ...updates, source: sourceTask.source, createdBy: sourceTask.createdBy };
    if (domain === 'study') onUpdateStudyTask(next as StudyTask); else onUpdateWorkTask(next as WorkTask);
  });

  const handleDirectSend = async (text: string) => {
    const prompt = text.trim(); if (!prompt || directLoading) return;
    const userMessage: ChatMessage = { id: `direct-user-${Date.now()}`, sender: 'user', text: prompt, timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) };
    const history = [...directMessages, userMessage]; setDirectMessages(prev => [...prev, userMessage]); setDirectLoading(true);
    try {
      const response = await fetch(apiUrl('/api/agent/direct/chat'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, agentId: selectedAgent.id, agentName: selectedAgent.name, agentRole: selectedAgent.role, history, context: { workProjects, workTasks, studySubjects, studyTasks, selectedTaskIds, currentContext: { workspaceId: selectedAgent.id === 'study' ? 'study' : 'work' } } }) });
      if (!response.ok) throw new Error(`Direct agent chat returned ${response.status}`); const data = await response.json();
      if (Array.isArray(data.actions) && data.actions.length) { applyActions(data.actions); setSelectedTaskIds(prev => prev.filter(id => !data.actions.some((a: any) => a.taskId === id))); confetti({ particleCount: 30, spread: 55, origin: { y: 0.85 } }); }
      setDirectMessages(prev => [...prev, { id: `direct-agent-${Date.now()}`, sender: 'agent', agentId: data.agentId || selectedAgent.id, agentName: data.agentName || selectedAgent.name, agentRole: data.agentRole || selectedAgent.role, text: data.text || '我有收到，你可以繼續說。', timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) }]);
    } catch (error) { console.error('Direct employee chat failed:', error); setDirectMessages(prev => [...prev, { id: `direct-error-${Date.now()}`, sender: 'agent', agentId: selectedAgent.id, agentName: selectedAgent.name, agentRole: selectedAgent.role, text: '目前無法連線到 AI 員工。請確認 Render Backend 與 Gemini API 是否正常。', timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) }]); }
    finally { setDirectLoading(false); }
  };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!inputText.trim() || busy) return; const text = inputText.trim(); setInputText(''); if (/\b(安排|排程|排定|規劃).{0,20}(今天|明天|時間|時段)/i.test(text) && selectedAgent.id === 'manager') onSendMessage(text); else handleDirectSend(text); };
  const handleCopy = (id: string, text: string) => { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
  return <div className="flex flex-col h-full w-full px-2 sm:px-4 py-3">
    <div className="mb-3 px-4 py-3 bg-white rounded-xl border border-[#E5E2DC] shadow-xs shrink-0"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><div className="p-1.5 rounded-lg bg-[#E8EFEB] text-[#385244]">{selectedAgent.icon}</div><div><div className="text-xs font-bold text-[#2D322E]">和 AI 員工直接對話</div><p className="text-[11px] text-[#6B726C]">直接說人話。AI 會理解上下文、判斷你的意思，必要時直接修改清單。</p></div></div><div className="flex flex-wrap gap-1.5">{selectableAgents.map(agent => <button key={agent.id} onClick={() => { setDirectAgentId(agent.id); setDirectMessages([]); setSelectedTaskIds([]); }} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] ${directAgentId === agent.id ? 'bg-[#385244] text-white border-[#385244]' : 'bg-white text-[#4A504B] border-[#DDD8CE] hover:bg-[#F4F0E8]'}`}>{agent.icon}<span>{agent.name}</span></button>)}</div></div></div>
    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1"><ChatTaskChecklist workTasks={workTasks} studyTasks={studyTasks} selectedTaskIds={selectedTaskIds} onSelectionChange={setSelectedTaskIds} onToggleWorkTask={onToggleWorkTask} onToggleStudyTask={onToggleStudyTask} /><div className="space-y-4">{displayMessages.map(msg => { const isUser = msg.sender === 'user'; const isManager = msg.sender === 'manager'; const open = expandedActivities[msg.id] ?? false; return <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}><div className={`max-w-[95%] sm:max-w-[88%] rounded-2xl p-4 sm:p-5 shadow-xs ${isUser ? 'bg-[#385244] text-white rounded-tr-none' : 'bg-white border border-[#E5E2DC] text-[#2D322E]'}`}><div className={`flex items-center justify-between gap-2 pb-2 mb-2 border-b ${isUser ? 'border-[#4E6B56]' : 'border-[#EBE8E1]'}`}><div className="flex items-center gap-2"><div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isUser ? 'bg-[#2B4035] text-white' : 'bg-[#E8EFEB] text-[#385244]'}`}>{isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}</div><div><div className={`text-xs font-bold ${isUser ? 'text-white' : 'text-[#2D322E]'}`}>{isUser ? '你' : `${msg.agentName || (isManager ? 'Manager' : 'AI 員工')}${msg.agentRole ? ` · ${msg.agentRole}` : ''}`}</div><span className={`text-[10px] font-mono ${isUser ? 'text-[#DCE7DF]' : 'text-[#8C938D]'}`}>{msg.timestamp}</span></div></div>{!isUser && <button onClick={() => handleCopy(msg.id, msg.text)} className="p-1 rounded text-[#8C938D] hover:bg-[#F4F0E8]">{copiedId === msg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button>}</div>{isManager && msg.activityLogs?.length ? <div className="mb-3 rounded-xl bg-[#F8F7F4] border border-[#E5E2DC] overflow-hidden"><button onClick={() => setExpandedActivities(p => ({ ...p, [msg.id]: !p[msg.id] }))} className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#4A504B]"><span>Agent 協作執行流程（{msg.activityLogs.length} 步驟）</span><span>{open ? '收起' : '展開'}</span></button>{open && <div className="p-3 border-t border-[#E5E2DC]"><AgentActivityPipeline logs={msg.activityLogs} compact /></div>}</div> : null}<div className={`prose prose-sm max-w-none leading-relaxed break-words ${isUser ? 'text-white' : 'text-[#2D322E]'}`}>{isUser ? <p className="text-sm whitespace-pre-wrap">{msg.text}</p> : <ReactMarkdown>{msg.text}</ReactMarkdown>}</div>{isManager && msg.proposedTimeBlocks?.length ? <button onClick={() => onApplyScheduleToToday(msg.proposedTimeBlocks!)} className="mt-3 px-3 py-1.5 rounded-lg bg-[#385244] text-white text-xs">套用時間安排</button> : null}</div></div>; })}{busy && <div className="p-4 rounded-2xl bg-white border border-[#BCD2C3] shadow-sm text-xs text-[#4A504B]"><Sparkles className="inline w-4 h-4 mr-2 animate-pulse" />{selectedAgent.name} 正在理解你的意思…</div>}<div ref={messagesEndRef} /></div></div>
    <form onSubmit={handleSubmit} className="relative mt-2 shrink-0"><div className="flex items-center bg-white border border-[#DDD8CE] focus-within:border-[#385244] focus-within:ring-1 focus-within:ring-[#385244] rounded-xl shadow-xs overflow-hidden"><input id="chat-input-textarea" type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder={`跟 ${selectedAgent.name} 說你想做什麼…`} disabled={busy} className="flex-1 bg-transparent px-4 py-3 text-sm text-[#2D322E] placeholder-[#8C938D] focus:outline-none disabled:opacity-50"/><button id="btn-send-chat-message" type="submit" disabled={!inputText.trim() || busy} className="mr-2 px-4 py-2 rounded-lg bg-[#385244] disabled:bg-[#EFECE5] text-white disabled:text-[#A39E93] font-semibold text-xs flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /><span>送出</span></button></div></form>
  </div>;
};
