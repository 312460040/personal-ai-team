import React from 'react';
import {
  X,
  Bot,
  Briefcase,
  GraduationCap,
  Calendar,
  Search,
  Lightbulb,
  Mail,
  DollarSign,
  Share2,
  HeartPulse,
  Sparkles,
  CheckCircle2,
  Lock,
  Layers,
} from 'lucide-react';
import { AGENT_REGISTRY } from '../data/agentRegistry';
import { AgentInfo } from '../types';

interface AgentRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAgentToChat?: (agent: AgentInfo) => void;
}

const getAgentIcon = (iconName: string) => {
  switch (iconName) {
    case 'Bot':
      return Bot;
    case 'Briefcase':
      return Briefcase;
    case 'GraduationCap':
      return GraduationCap;
    case 'Calendar':
      return Calendar;
    case 'Search':
      return Search;
    case 'Lightbulb':
      return Lightbulb;
    case 'Mail':
      return Mail;
    case 'DollarSign':
      return DollarSign;
    case 'Share2':
      return Share2;
    case 'HeartPulse':
      return HeartPulse;
    default:
      return Sparkles;
  }
};

export const AgentRegistryModal: React.FC<AgentRegistryModalProps> = ({
  isOpen,
  onClose,
  onSelectAgentToChat,
}) => {
  if (!isOpen) return null;

  const activeAgents = AGENT_REGISTRY.filter((a) => a.status === 'active');
  const upcomingAgents = AGENT_REGISTRY.filter((a) => a.status === 'upcoming');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-[#FFFFFF] border border-[#E5E2DC] rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#EBE8E1] flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#EBF1EC] text-[#385244]">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2D322E]">Personal AI Team 團隊成員與擴充架構</h2>
              <p className="text-xs text-[#6B726C]">
                模組化多 Agent 註冊中心：目前第一階段啟用 3 名核心 Agent，架構已預留未來 7 項專項 Agent 擴充接口。
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#6B726C] hover:text-[#2D322E] hover:bg-[#EFECE5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 custom-scrollbar pr-2">
          {/* Section 1: Active Core Agents (Phase 1) */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4E6B56]" />
              <h3 className="text-sm font-bold text-[#2D322E] uppercase tracking-wider font-mono">
                第一階段已上線核心 Agent ({activeAgents.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeAgents.map((agent) => {
                const IconComponent = getAgentIcon(agent.avatarIcon);
                return (
                  <div
                    key={agent.id}
                    className="p-4 rounded-2xl border border-[#E5E2DC] bg-[#FFFFFF] shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                            agent.id === 'manager'
                              ? 'bg-[#385244]'
                              : agent.id === 'work'
                              ? 'bg-[#4A6857]'
                              : 'bg-[#B36534]'
                          }`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9]">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          ACTIVE
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-[#2D322E]">{agent.name}</h4>
                      <span className="text-xs font-semibold text-[#4E6B56] block mb-1">
                        {agent.roleName}
                      </span>
                      <p className="text-xs text-[#6B726C] leading-relaxed mb-3">
                        {agent.description}
                      </p>
                    </div>

                    <div>
                      <div className="border-t border-[#EBE8E1] pt-2.5">
                        <span className="text-[11px] font-mono text-[#8C938D] block mb-1 font-semibold">
                          職責清單：
                        </span>
                        <ul className="space-y-1">
                          {agent.responsibilities.slice(0, 3).map((r, idx) => (
                            <li
                              key={idx}
                              className="text-[11px] text-[#4A504B] flex items-start space-x-1"
                            >
                              <span className="text-[#385244] font-bold">•</span>
                              <span className="line-clamp-1">{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Upcoming Extensible Agents (Phase 2+) */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#B36534]" />
              <h3 className="text-sm font-bold text-[#2D322E] uppercase tracking-wider font-mono">
                未來擴充專項 Agent 註冊表 (Architecture Ready: {upcomingAgents.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {upcomingAgents.map((agent) => {
                const IconComponent = getAgentIcon(agent.avatarIcon);
                return (
                  <div
                    key={agent.id}
                    className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E5E2DC] hover:border-[#4E6B56]/50 transition-all flex flex-col justify-between shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className="p-1.5 rounded-lg bg-[#EFECE5] text-[#385244]"
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#EFECE5] text-[#6B726C] border border-[#DDD8CE]">
                          PROPOSED
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[#2D322E]">{agent.name}</h4>
                      <span className="text-[11px] text-[#6B726C] block mb-1">
                        {agent.roleName}
                      </span>
                      <p className="text-[11px] text-[#6B726C] line-clamp-2">
                        {agent.tagline}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#EBE8E1] text-[10px] text-[#8C938D] font-mono">
                      <span>支援 Manager 智慧路由</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-[#EBE8E1] flex items-center justify-between text-xs text-[#8C938D] flex-shrink-0">
          <span>Personal AI Team Orchestration Architecture v1.0</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#385244] hover:bg-[#2B4035] text-white font-medium shadow-xs transition-colors"
          >
            關閉檢視
          </button>
        </div>
      </div>
    </div>
  );
};
