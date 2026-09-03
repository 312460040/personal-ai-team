import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Bot,
  User,
  Briefcase,
  GraduationCap,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CalendarCheck,
  Zap,
  Clock,
  Layers,
  CheckCircle2,
  Copy,
  Check,
  Flame,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  ChatMessage,
  AgentActivityLog,
  StructuredTimeBlock,
  TodayTimeBlock,
} from '../types';
import { AgentActivityPipeline } from './AgentActivityPipeline';

interface AiTeamChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  onApplyScheduleToToday: (blocks: StructuredTimeBlock[]) => void;
  currentActiveAgents: string[];
}

const PRESET_PROMPTS = [
  {
    label: '🔥 複合調度範例',
    text: '我明天有很多工作，而且晚上還要讀資料結構，幫我安排。',
  },
  {
    label: '💼 工作優先級與拆解',
    text: '幫我分析目前手上的電商核心重構與客戶提案工作，評估優先順序並拆解具體執行步驟。',
  },
  {
    label: '🎓 課業按表操課衝刺',
    text: '資料結構期中考快到了，請 Study Agent 幫我制定圖論（BFS/DFS、Dijkstra）按表操課的專注複習計畫。',
  },
  {
    label: '⏱️ 今日時間衝突檢核',
    text: '檢視我今天的工作與課業負荷，幫我找出時間衝突並給予精力分配的整合建議。',
  },
];

export const AiTeamChat: React.FC<AiTeamChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onApplyScheduleToToday,
  currentActiveAgents,
}) => {
  const [inputText, setInputText] = useState('');
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [expandedSubAgents, setExpandedSubAgents] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedMessageId, setAppliedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleApplySchedule = (msgId: string, blocks?: StructuredTimeBlock[]) => {
    if (!blocks || blocks.length === 0) return;
    onApplyScheduleToToday(blocks);
    setAppliedMessageId(msgId);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.85 },
      colors: ['#6366f1', '#10b981', '#f59e0b'],
    });
    setTimeout(() => {
      setAppliedMessageId(null);
    }, 4000);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleActivity = (id: string) => {
    setExpandedActivities((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleSubAgentReports = (id: string) => {
    setExpandedSubAgents((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-5xl mx-auto w-full px-2 sm:px-4 py-3">
      {/* Top Banner: Multi-Agent Collaboration Rule */}
      <div className="mb-3 px-4 py-2.5 bg-[#FFFFFF] rounded-xl border border-[#E5E2DC] shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-[#E8EFEB] text-[#385244]">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-[#2D322E]">Manager Agent (AI 總管) 待命中</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9]">
                ● 3 Agent Ready
              </span>
            </div>
            <p className="text-[11px] text-[#6B726C]">
              你只需與總管溝通，Manager Agent 會根據需求即時調派 Work Agent 與 Study Agent 並整合排程。
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-xs font-mono">
          <span className="px-2 py-0.5 rounded bg-[#E8EFEB] text-[#2D4835] border border-[#BCD2C3]">
            🤖 Manager
          </span>
          <span className="text-[#8C938D]">➔</span>
          <span className="px-2 py-0.5 rounded bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9]">
            💼 Work
          </span>
          <span className="text-[#8C938D]">+</span>
          <span className="px-2 py-0.5 rounded bg-[#FAF0E6] text-[#7D3E1B] border border-[#ECD1BA]">
            🎓 Study
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2 custom-scrollbar">
        {messages.map((msg) => {
          const isManager = msg.sender === 'manager';
          const hasDelegated = msg.delegatedAgents && msg.delegatedAgents.length > 0;
          const isActivityOpen = expandedActivities[msg.id] ?? false;
          const isSubAgentOpen = expandedSubAgents[msg.id] ?? false;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isManager ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[95%] sm:max-w-[88%] rounded-2xl p-4 sm:p-5 shadow-xs transition-all ${
                  isManager
                    ? 'bg-[#FFFFFF] border border-[#E5E2DC] text-[#2D322E]'
                    : 'bg-[#385244] text-white rounded-tr-none'
                }`}
              >
                {/* Header info */}
                <div className={`flex items-center justify-between gap-2 pb-2 mb-2 border-b ${isManager ? 'border-[#EBE8E1]' : 'border-[#4E6B56]'}`}>
                  <div className="flex items-center space-x-2">
                    <div
                      className={`flex items-center justify-center w-7 h-7 rounded-lg ${
                        isManager
                          ? 'bg-[#385244] text-white shadow-xs'
                          : 'bg-[#2B4035] text-[#DCE7DF]'
                      }`}
                    >
                      {isManager ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-xs font-bold ${isManager ? 'text-[#2D322E]' : 'text-white'}`}>
                          {isManager ? 'Manager Agent (AI 總管)' : '你 (User)'}
                        </span>
                        {isManager && hasDelegated && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#E8EFEB] text-[#2D4835] border border-[#BCD2C3]">
                            協同調度：
                            {msg.delegatedAgents?.map((a) =>
                              a === 'work' ? ' 💼 Work Agent' : ' 🎓 Study Agent'
                            )}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-mono ${isManager ? 'text-[#8C938D]' : 'text-[#DCE7DF]'}`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>

                  {isManager && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="p-1 rounded text-[#8C938D] hover:text-[#2D322E] hover:bg-[#F4F0E8] text-xs transition-colors"
                        title="複製內容"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-[#4E6B56]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Collapsible Agent Activity Step Details */}
                {isManager && msg.activityLogs && msg.activityLogs.length > 0 && (
                  <div className="mb-3 rounded-xl bg-[#F8F7F4] border border-[#E5E2DC] overflow-hidden">
                    <button
                      onClick={() => toggleActivity(msg.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-[#4A504B] hover:bg-[#EFECE5] transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Zap className="w-3.5 h-3.5 text-[#385244]" />
                        <span className="font-mono text-[#385244] font-semibold">
                          Agent 協作執行流程 ({msg.activityLogs.length} 步驟完成)
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-[#6B726C] text-[11px]">
                        <span>{isActivityOpen ? '收起動態' : '展開檢視'}</span>
                        {isActivityOpen ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </button>

                    {isActivityOpen && (
                      <div className="p-3 border-t border-[#E5E2DC] bg-[#FAF8F5]">
                        <AgentActivityPipeline logs={msg.activityLogs} compact />
                      </div>
                    )}
                  </div>
                )}

                {/* Main Message Text (Markdown for Manager) */}
                <div className={`prose prose-sm max-w-none leading-relaxed break-words ${isManager ? 'text-[#2D322E]' : 'text-white'}`}>
                  {isManager ? (
                    <ReactMarkdown
                      components={{
                        h3: ({ node, ...props }) => (
                          <h3
                            className="text-base font-bold text-[#2D322E] mt-3 mb-2 flex items-center gap-1.5 border-b border-[#E5E2DC] pb-1"
                            {...props}
                          />
                        ),
                        h4: ({ node, ...props }) => (
                          <h4
                            className="text-sm font-semibold text-[#385244] mt-2.5 mb-1.5"
                            {...props}
                          />
                        ),
                        p: ({ node, ...props }) => (
                          <p className="mb-2 text-xs sm:text-sm text-[#3F4440] leading-relaxed" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul className="list-disc pl-5 mb-2 space-y-1 text-xs sm:text-sm text-[#3F4440]" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol className="list-decimal pl-5 mb-2 space-y-1 text-xs sm:text-sm text-[#3F4440]" {...props} />
                        ),
                        table: ({ node, ...props }) => (
                          <div className="overflow-x-auto my-3 rounded-lg border border-[#E5E2DC] bg-[#FAF8F5]">
                            <table className="min-w-full divide-y divide-[#E5E2DC] text-xs text-left" {...props} />
                          </div>
                        ),
                        th: ({ node, ...props }) => (
                          <th className="px-3 py-2 bg-[#EFECE5] font-semibold text-[#2D322E]" {...props} />
                        ),
                        td: ({ node, ...props }) => (
                          <td className="px-3 py-2 border-t border-[#E5E2DC] text-[#3F4440] font-mono" {...props} />
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-sm text-white whitespace-pre-wrap">{msg.text}</p>
                  )}
                </div>

                {/* Sub-Agent Reports Tab/Drawer */}
                {isManager && (msg.workOutput || msg.studyOutput) && (
                  <div className="mt-3 pt-3 border-t border-[#EBE8E1]">
                    <button
                      onClick={() => toggleSubAgentReports(msg.id)}
                      className="text-xs flex items-center justify-between w-full py-1.5 px-2.5 rounded-lg bg-[#F8F7F4] hover:bg-[#EFECE5] text-[#3F4440] border border-[#E5E2DC] transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Layers className="w-3.5 h-3.5 text-[#B36534]" />
                        <span className="font-medium">檢視 Work Agent 與 Study Agent 專項原始報告</span>
                      </div>
                      {isSubAgentOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#6B726C]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#6B726C]" />
                      )}
                    </button>

                    {isSubAgentOpen && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2.5">
                        {msg.workOutput && (
                          <div className="p-3 rounded-lg bg-[#F4F8F5] border border-[#C6DAC9] text-xs">
                            <div className="flex items-center space-x-1.5 text-[#2D4835] font-bold mb-1.5 pb-1 border-b border-[#C6DAC9]">
                              <Briefcase className="w-3.5 h-3.5 text-[#4E6B56]" />
                              <span>Work Agent 工作報告</span>
                            </div>
                            <div className="text-[#3F4440] space-y-1 whitespace-pre-wrap leading-relaxed font-sans">
                              {msg.workOutput}
                            </div>
                          </div>
                        )}

                        {msg.studyOutput && (
                          <div className="p-3 rounded-lg bg-[#FCF6F0] border border-[#ECD1BA] text-xs">
                            <div className="flex items-center space-x-1.5 text-[#7D3E1B] font-bold mb-1.5 pb-1 border-b border-[#ECD1BA]">
                              <GraduationCap className="w-3.5 h-3.5 text-[#B36534]" />
                              <span>Study Agent 課業報告</span>
                            </div>
                            <div className="text-[#3F4440] space-y-1 whitespace-pre-wrap leading-relaxed font-sans">
                              {msg.studyOutput}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Apply Schedule Action Button */}
                {isManager && msg.proposedTimeBlocks && msg.proposedTimeBlocks.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#EBE8E1] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-1.5 text-xs text-[#5C645D]">
                      <CalendarCheck className="w-4 h-4 text-[#4E6B56]" />
                      <span>已為你生成 {msg.proposedTimeBlocks.length} 個結構化時間區塊</span>
                    </div>

                    <button
                      id={`btn-apply-schedule-${msg.id}`}
                      onClick={() => handleApplySchedule(msg.id, msg.proposedTimeBlocks)}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        appliedMessageId === msg.id
                          ? 'bg-[#4E6B56] text-white shadow-xs'
                          : 'bg-[#385244] hover:bg-[#2B4035] text-white shadow-xs'
                      }`}
                    >
                      {appliedMessageId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>已同步至 Today 儀表板！</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>一鍵套用至今日日程 (Today)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Real-time Multi-Agent Thinking / Dispatched State */}
        {isLoading && (
          <div className="flex items-start space-x-3 p-4 rounded-2xl bg-[#FFFFFF] border border-[#BCD2C3] shadow-sm">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#E8EFEB] text-[#385244] ring-2 ring-[#BCD2C3] animate-pulse">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-[#2D322E]">Manager Agent 正在調度團隊...</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5C7C66] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4E6B56]"></span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-[#E8EFEB] text-[#2D4835] border border-[#BCD2C3] animate-pulse">
                  1. 意圖識別 (Intent Analysis)
                </span>
                <ArrowRight className="w-3 h-3 text-[#8C938D]" />
                <span className="px-2 py-0.5 rounded bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9] animate-pulse">
                  2. Work Agent 任務拆解
                </span>
                <ArrowRight className="w-3 h-3 text-[#8C938D]" />
                <span className="px-2 py-0.5 rounded bg-[#FAF0E6] text-[#7D3E1B] border border-[#ECD1BA] animate-pulse">
                  3. Study Agent 按表操課
                </span>
                <ArrowRight className="w-3 h-3 text-[#8C938D]" />
                <span className="px-2 py-0.5 rounded bg-[#EFECE5] text-[#2D322E] border border-[#DDD8CE] animate-pulse">
                  4. 時間衝突仲裁與整合
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Prompt Suggestions */}
      <div className="mt-2 mb-2">
        <div className="flex items-center space-x-1.5 mb-1.5 px-1">
          <Sparkles className="w-3 h-3 text-[#385244]" />
          <span className="text-[11px] font-semibold text-[#6B726C]">快速試用多 Agent 協作情境：</span>
        </div>
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {PRESET_PROMPTS.map((preset, idx) => (
            <button
              key={idx}
              id={`preset-prompt-${idx}`}
              onClick={() => onSendMessage(preset.text)}
              disabled={isLoading}
              className="flex-shrink-0 text-left px-2.5 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#F8F7F4] border border-[#DDD8CE] hover:border-[#BCD2C3] text-xs text-[#3F4440] hover:text-[#2D322E] transition-all disabled:opacity-50 shadow-2xs"
            >
              <span className="font-semibold text-[#385244]">{preset.label}</span>
              <span className="text-[#6B726C] ml-1.5 text-[11px] truncate max-w-[200px] inline-block align-bottom">
                {preset.text}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="relative mt-1">
        <div className="flex items-center bg-[#FFFFFF] border border-[#DDD8CE] focus-within:border-[#385244] focus-within:ring-1 focus-within:ring-[#385244] rounded-xl shadow-xs overflow-hidden transition-all">
          <input
            id="chat-input-textarea"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="告訴 Manager Agent 你的工作與課業需求（例如：我明天有很多工作，晚上要讀資料結構...）"
            disabled={isLoading}
            className="flex-1 bg-transparent px-4 py-3 text-sm text-[#2D322E] placeholder-[#8C938D] focus:outline-none disabled:opacity-50 font-sans"
          />
          <button
            id="btn-send-chat-message"
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="mr-2 px-4 py-2 rounded-lg bg-[#385244] hover:bg-[#2B4035] disabled:bg-[#EFECE5] text-white disabled:text-[#A39E93] font-semibold text-xs transition-colors flex items-center space-x-1.5 shadow-xs"
          >
            <span>發送給總管</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
