import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Briefcase, GraduationCap, Sparkles, CalendarCheck, Zap, Layers, Copy, Check, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { ChatMessage, AgentInfo, StructuredTimeBlock, WorkTask, StudyTask } from '../types';
import { AgentActivityPipeline } from './AgentActivityPipeline';

interface AiTeamChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onApplyScheduleToToday: (blocks: StructuredTimeBlock[]) => void;
  currentActiveAgents: string[];
  agentRegistry?: AgentInfo[];
  workTasks?: WorkTask[];
  studyTasks?: StudyTask[];
}

type DirectAgent = { id: string; name: string; role: string; icon: React.ReactNode };

const PRESET_PROMPTS = [
  { label: '🔥 複合調度範例', text: '我明天有很多工作，而且晚上還要讀資料結構，幫我安排。' },
  { label: '💼 工作優先級與拆解', text: '幫我分析目前手上的工作，評估優先順序並拆解具體執行步驟。' },
  { label: '🎓 課業衝刺', text: '請幫我制定接下來的複習計畫。' },
  { label: '⏱️ 今日衝突檢核', text: '檢視我今天的工作與課業負荷，幫我找出時間衝突。' },
];

const defaultAgents: DirectAgent[] = [
  { id: 'manager', name: 'Manager Agent', role: 'AI 總管', icon: <Bot className="w-3.5 h-3.5" /> },
  { id: 'work', name: 'Work Agent', role: '工作管理員', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { id: 'study', name: 'Study Agent', role: '課業管理員', icon: <GraduationCap className="w-3.5 h-3.5" /> },
];

export const AiTeamChat: React.FC<AiTeamChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onApplyScheduleToToday,
  currentActiveAgents,
  agentRegistry = [],
  workTasks = [],
  studyTasks = [],
}) => {
  const [inputText, setInputText] = useState('');
  const [directAgentId, setDirectAgentId] = useState('manager');
  const [directMessages, setDirectMessages] = useState<ChatMessage[]>([]);
  const [directLoading, setDirectLoading] = useState(false);
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [expandedSubAgents, setExpandedSubAgents] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedMessageId, setAppliedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const availableAgents = defaultAgents.filter((agent) => currentActiveAgents.includes(agent.id));
  const registryAgents = agentRegistry.filter((agent) => currentActiveAgents.includes(agent.id) && !defaultAgents.some((a) => a.id === agent.id));
  const selectableAgents = [...availableAgents, ...registryAgents.map((a) => ({ id: a.id, name: a.name, role: a.roleName, icon: <Bot className="w-3.5 h-3.5" /> }))];
  const selectedAgent = selectableAgents.find((a) => a.id === directAgentId) || availableAgents[0] || defaultAgents[0];
  const isDirectEmployee = selectedAgent.id !== 'manager';
  const displayMessages = isDirectEmployee ? directMessages : messages;
  const busy = isDirectEmployee ? directLoading : isLoading;

  useEffect(() => {
    if (!selectableAgents.some((a) => a.id === directAgentId)) setDirectAgentId(selectableAgents[0]?.id || 'manager');
  }, [currentActiveAgents.join(','), agentRegistry.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, busy]);

  const handleDirectSend = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || directLoading) return;
    const userMessage: ChatMessage = { id: `direct-user-${Date.now()}`, sender: 'user', text: prompt, timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) };
    const history = [...directMessages, userMessage];
    setDirectMessages((prev) => [...prev, userMessage]);
    setDirectLoading(true);
    try {
      const response = await fetch('/api/agent/direct/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          agentId: selectedAgent.id,
          agentName: selectedAgent.name,
          agentRole: selectedAgent.role,
          history,
          context: { workTasks, studyTasks, currentContext: { workspaceId: selectedAgent.id === 'study' ? 'study' : 'work' } },
        }),
      });
      if (!response.ok) throw new Error(`Direct agent chat returned ${response.status}`);
      const data = await response.json();
      const agentMessage: ChatMessage = {
        id: `direct-agent-${Date.now()}`,
        sender: 'agent',
        agentId: data.agentId || selectedAgent.id,
        agentName: data.agentName || selectedAgent.name,
        agentRole: data.agentRole || selectedAgent.role,
        text: data.text || '我有收到，你可以繼續說。',
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }),
      };
      setDirectMessages((prev) => [...prev, agentMessage]);
    } catch (error) {
      console.error('Direct employee chat failed:', error);
      setDirectMessages((prev) => [...prev, { id: `direct-error-${Date.now()}`, sender: 'agent', agentId: selectedAgent.id, agentName: selectedAgent.name, agentRole: selectedAgent.role, text: '目前無法連線到這位 AI 員工。請稍後再試。', timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) }]);
    } finally {
      setDirectLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || busy) return;
    const text = inputText.trim();
    setInputText('');
    if (isDirectEmployee) handleDirectSend(text); else onSendMessage(text);
  };

  const handleApplySchedule = (msgId: string, blocks?: StructuredTimeBlock[]) => {
    if (!blocks?.length) return;
    onApplyScheduleToToday(blocks);
    setAppliedMessageId(msgId);
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.85 }, colors: ['#6366f1', '#10b981', '#f59e0b'] });
    setTimeout(() => setAppliedMessageId(null), 4000);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-5xl mx-auto w-full px-2 sm:px-4 py-3">
      <div className="mb-3 px-4 py-3 bg-white rounded-xl border border-[#E5E2DC] shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#E8EFEB] text-[#385244]">{selectedAgent.icon}</div>
            <div>
              <div className="text-xs font-bold text-[#2D322E]">與 AI 員工對話</div>
              <p className="text-[11px] text-[#6B726C]">你可以直接選擇員工，也可以交給 Manager 統籌。</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {selectableAgents.map((agent) => (
              <button key={agent.id} onClick={() => { setDirectAgentId(agent.id); setDirectMessages([]); }} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${directAgentId === agent.id ? 'bg-[#385244] text-white border-[#385244]' : 'bg-white text-[#4A504B] border-[#DDD8CE] hover:bg-[#F4F0E8]'}`}>
                {agent.icon}<span>{agent.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 px-3 py-2 rounded-lg bg-[#F8F7F4] text-[11px] text-[#5C645D]">
          {isDirectEmployee ? `目前是「${selectedAgent.name}」直接對話。這個對話會保留上下文，你可以自然地說「那剛才第二個呢？」、「繼續」或「我不同意」。` : '目前由 Manager Agent 接手。Manager 會判斷是否需要調派 Work Agent / Study Agent。'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2 custom-scrollbar">
        {displayMessages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isAgent = msg.sender === 'agent';
          const isManager = msg.sender === 'manager';
          const hasDelegated = msg.delegatedAgents && msg.delegatedAgents.length > 0;
          const isActivityOpen = expandedActivities[msg.id] ?? false;
          const isSubAgentOpen = expandedSubAgents[msg.id] ?? false;
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[95%] sm:max-w-[88%] rounded-2xl p-4 sm:p-5 shadow-xs ${isUser ? 'bg-[#385244] text-white rounded-tr-none' : 'bg-white border border-[#E5E2DC] text-[#2D322E]'}`}>
                <div className={`flex items-center justify-between gap-2 pb-2 mb-2 border-b ${isUser ? 'border-[#4E6B56]' : 'border-[#EBE8E1]'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${isUser ? 'bg-[#2B4035] text-[#DCE7DF]' : 'bg-[#E8EFEB] text-[#385244]'}`}>
                      {isUser ? <User className="w-4 h-4" /> : isAgent ? <Briefcase className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${isUser ? 'text-white' : 'text-[#2D322E]'}`}>{isUser ? '你' : isAgent ? `${msg.agentName || 'AI 員工'}${msg.agentRole ? ` · ${msg.agentRole}` : ''}` : 'Manager Agent (AI 總管)'}</div>
                      <span className={`text-[10px] font-mono ${isUser ? 'text-[#DCE7DF]' : 'text-[#8C938D]'}`}>{msg.timestamp}</span>
                    </div>
                  </div>
                  {!isUser && <button onClick={() => handleCopy(msg.id, msg.text)} className="p-1 rounded text-[#8C938D] hover:bg-[#F4F0E8]" title="複製內容">{copiedId === msg.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button>}
                </div>

                {isManager && msg.activityLogs && msg.activityLogs.length > 0 && (
                  <div className="mb-3 rounded-xl bg-[#F8F7F4] border border-[#E5E2DC] overflow-hidden">
                    <button onClick={() => setExpandedActivities((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-[#4A504B]"><span className="inline-flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-[#385244]" />Agent 協作執行流程 ({msg.activityLogs.length} 步驟)</span><span>{isActivityOpen ? '收起' : '展開'}</span></button>
                    {isActivityOpen && <div className="p-3 border-t border-[#E5E2DC]"><AgentActivityPipeline logs={msg.activityLogs} compact /></div>}
                  </div>
                )}

                <div className={`prose prose-sm max-w-none leading-relaxed break-words ${isUser ? 'text-white' : 'text-[#2D322E]'}`}>
                  {isUser ? <p className="text-sm whitespace-pre-wrap">{msg.text}</p> : <ReactMarkdown>{msg.text}</ReactMarkdown>}
                </div>

                {isManager && (msg.workOutput || msg.studyOutput) && (
                  <div className="mt-3 pt-3 border-t border-[#EBE8E1]"><button onClick={() => setExpandedSubAgents((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))} className="text-xs flex items-center justify-between w-full py-1.5 px-2.5 rounded-lg bg-[#F8F7F4] text-[#3F4440] border border-[#E5E2DC]"><span className="inline-flex items-center gap-2"><Layers className="w-3.5 h-3.5" />檢視 Work / Study Agent 原始報告</span><span>{isSubAgentOpen ? '收起' : '展開'}</span></button>{isSubAgentOpen && <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">{msg.workOutput&&<div className="p-3 rounded-lg bg-[#F4F8F5] text-xs whitespace-pre-wrap">{msg.workOutput}</div>}{msg.studyOutput&&<div className="p-3 rounded-lg bg-[#FCF6F0] text-xs whitespace-pre-wrap">{msg.studyOutput}</div>}</div>}</div>
                )}

                {isManager && msg.proposedTimeBlocks && msg.proposedTimeBlocks.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#EBE8E1] flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-xs text-[#5C645D]"><CalendarCheck className="w-4 h-4" />已生成 {msg.proposedTimeBlocks.length} 個時間區塊</div><button onClick={() => handleApplySchedule(msg.id, msg.proposedTimeBlocks)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#385244] text-white">{appliedMessageId===msg.id?<><Check className="w-3.5 h-3.5"/>已同步</>:<><Sparkles className="w-3.5 h-3.5"/>套用至 Today</>}</button></div>
                )}
              </div>
            </div>
          );
        })}

        {busy && <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-[#BCD2C3] shadow-sm"><div className="w-8 h-8 rounded-lg bg-[#E8EFEB] text-[#385244] flex items-center justify-center animate-pulse"><Bot className="w-4 h-4"/></div><div className="flex-1"><div className="text-xs font-bold text-[#2D322E]">{isDirectEmployee ? `${selectedAgent.name} 正在回覆...` : 'Manager Agent 正在調度團隊...'}</div>{!isDirectEmployee&&<div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-mono"><span className="px-2 py-0.5 rounded bg-[#E8EFEB]">1. 意圖識別</span><ArrowRight className="w-3 h-3"/><span className="px-2 py-0.5 rounded bg-[#EBF1EC]">2. Agent 協作</span><ArrowRight className="w-3 h-3"/><span className="px-2 py-0.5 rounded bg-[#EFECE5]">3. 結果整合</span></div>}</div></div>}
        <div ref={messagesEndRef} />
      </div>

      {!isDirectEmployee && <div className="mt-2 mb-2"><div className="flex items-center gap-1.5 mb-1.5 px-1"><Sparkles className="w-3 h-3 text-[#385244]"/><span className="text-[11px] font-semibold text-[#6B726C]">快速試用 Manager 協作：</span></div><div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">{PRESET_PROMPTS.map((preset,idx)=><button key={idx} onClick={()=>onSendMessage(preset.text)} disabled={busy} className="flex-shrink-0 text-left px-2.5 py-1 rounded-lg bg-white hover:bg-[#F8F7F4] border border-[#DDD8CE] text-xs text-[#3F4440]"><span className="font-semibold text-[#385244]">{preset.label}</span></button>)}</div></div>}

      <form onSubmit={handleSubmit} className="relative mt-1"><div className="flex items-center bg-white border border-[#DDD8CE] focus-within:border-[#385244] focus-within:ring-1 focus-within:ring-[#385244] rounded-xl shadow-xs overflow-hidden"><input id="chat-input-textarea" type="text" value={inputText} onChange={(e)=>setInputText(e.target.value)} placeholder={isDirectEmployee?`跟 ${selectedAgent.name} 說點什麼...`:'告訴 Manager 你的工作與課業需求...'} disabled={busy} className="flex-1 bg-transparent px-4 py-3 text-sm text-[#2D322E] placeholder-[#8C938D] focus:outline-none disabled:opacity-50"/><button id="btn-send-chat-message" type="submit" disabled={!inputText.trim()||busy} className="mr-2 px-4 py-2 rounded-lg bg-[#385244] disabled:bg-[#EFECE5] text-white disabled:text-[#A39E93] font-semibold text-xs flex items-center gap-1.5"><span>{isDirectEmployee?'發送給員工':'發送給總管'}</span><Send className="w-3.5 h-3.5"/></button></div></form>
    </div>
  );
};
