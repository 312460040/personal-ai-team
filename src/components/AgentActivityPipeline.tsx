import React from 'react';
import {
  Bot,
  Briefcase,
  GraduationCap,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  GitMerge,
  Layers,
} from 'lucide-react';
import { AgentActivityLog, AgentId } from '../types';

interface AgentActivityPipelineProps {
  logs: AgentActivityLog[];
  isThinking?: boolean;
  activeDelegatedAgents?: AgentId[];
  compact?: boolean;
}

const getAgentBadge = (agentId?: AgentId) => {
  switch (agentId) {
    case 'manager':
      return {
        name: 'Manager Agent',
        role: '總管',
        icon: Bot,
        color: 'bg-[#E8EFEB] text-[#2D4835] border-[#BCD2C3]',
        dot: 'bg-[#385244]',
      };
    case 'work':
      return {
        name: 'Work Agent',
        role: '工作',
        icon: Briefcase,
        color: 'bg-[#EBF1EC] text-[#2D4835] border-[#C6DAC9]',
        dot: 'bg-[#4E6B56]',
      };
    case 'study':
      return {
        name: 'Study Agent',
        role: '課業',
        icon: GraduationCap,
        color: 'bg-[#FAF0E6] text-[#7D3E1B] border-[#ECD1BA]',
        dot: 'bg-[#B36534]',
      };
    default:
      return {
        name: 'AI Agent',
        role: '專家',
        icon: Sparkles,
        color: 'bg-[#EFECE5] text-[#3F4440] border-[#DDD8CE]',
        dot: 'bg-[#7D7569]',
      };
  }
};

export const AgentActivityPipeline: React.FC<AgentActivityPipelineProps> = ({
  logs,
  isThinking = false,
  activeDelegatedAgents = [],
  compact = false,
}) => {
  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-[#6B726C] bg-[#FAF8F5] rounded-xl border border-[#E5E2DC]">
        <Layers className="w-8 h-8 mb-2 text-[#A39E93] animate-pulse" />
        <p className="text-sm font-medium">尚無進行中的 Agent 協作任務</p>
        <p className="text-xs text-[#8C938D] mt-1">
          在聊天對話框向 Manager Agent 提出工作與課業需求即可觸發多 Agent 協調流程
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${compact ? '' : 'p-4 bg-[#FFFFFF] rounded-xl border border-[#E5E2DC] shadow-xs'}`}>
      {/* Header Pipeline Summary Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-[#EBE8E1]">
        <div className="flex items-center space-x-2">
          <GitMerge className="w-4 h-4 text-[#385244]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#3F4440] font-mono">
            Multi-Agent Execution Pipeline ({logs.length} 步驟)
          </span>
        </div>
        {isThinking && (
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-[#E8EFEB] border border-[#BCD2C3] text-[11px] text-[#2D4835] font-mono animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#385244] animate-ping" />
            <span>Agent 並行協同處理中...</span>
          </div>
        )}
      </div>

      {/* Visual Flow Steps */}
      <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-[#385244] before:via-[#4E6B56] before:to-[#B36534]">
        {logs.map((log, index) => {
          const fromBadge = getAgentBadge(log.fromAgent);
          const toBadge = log.toAgent ? getAgentBadge(log.toAgent) : null;
          const FromIcon = fromBadge.icon;
          const ToIcon = toBadge?.icon;

          return (
            <div
              key={log.id || index}
              className="relative group bg-[#FFFFFF] hover:bg-[#FAF8F5] p-3 rounded-lg border border-[#E5E2DC] transition-all shadow-2xs"
            >
              {/* Step indicator circle on timeline */}
              <div className="absolute -left-[27px] top-3.5 flex items-center justify-center w-5 h-5 rounded-full bg-[#FFFFFF] border border-[#BCD2C3] text-[10px] font-mono text-[#385244] font-bold">
                {index + 1}
              </div>

              {/* Step Header */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${fromBadge.color}`}
                  >
                    <FromIcon className="w-3 h-3 mr-1" />
                    {fromBadge.name}
                  </span>

                  {toBadge && (
                    <>
                      <ArrowRight className="w-3 h-3 text-[#8C938D]" />
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${toBadge.color}`}
                      >
                        {ToIcon && <ToIcon className="w-3 h-3 mr-1" />}
                        {toBadge.name}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-[11px] font-mono text-[#6B726C]">
                  <span className="flex items-center text-[#4E6B56] font-medium">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {log.action}
                  </span>
                  {log.durationMs && (
                    <span className="text-[#8C938D] flex items-center">
                      <Clock className="w-2.5 h-2.5 mr-0.5" />
                      {log.durationMs}ms
                    </span>
                  )}
                  <span className="text-[#A39E93]">{log.timestamp}</span>
                </div>
              </div>

              {/* Summary Text */}
              <p className="text-xs font-semibold text-[#2D322E] mb-0.5">
                {log.summary}
              </p>

              {/* Detail description */}
              {log.detail && (
                <p className="text-xs text-[#4A504B] leading-relaxed font-sans bg-[#F8F7F4] p-2 rounded border border-[#E5E2DC] mt-1.5">
                  {log.detail}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
