import React, { useState } from 'react';
import {
  Bot,
  Briefcase,
  GraduationCap,
  CalendarDays,
  Activity,
  Users,
  RotateCcw,
  Sparkles,
  Trash2,
  Database,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'chat' | 'activity' | 'work' | 'study' | 'today' | 'agents';
  onTabChange: (tab: 'chat' | 'activity' | 'work' | 'study' | 'today' | 'agents') => void;
  onClearDemoData: () => void;
  onLoadDemoData: () => void;
  onClearAllData: () => void;
  activeAgentsCount: number;
  totalAgentsCount: number;
  workTasksCount: number;
  studyTasksCount: number;
  onOpenAgentsModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  onClearDemoData,
  onLoadDemoData,
  onClearAllData,
  activeAgentsCount,
  totalAgentsCount,
  workTasksCount,
  studyTasksCount,
  onOpenAgentsModal,
}) => {
  const [showDataMenu, setShowDataMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E5E2DC] bg-[#FDFCFB]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-[#385244] via-[#4A6857] to-[#5C7C66] shadow-sm text-white">
              <Bot className="w-5 h-5 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5C7C66] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4A6857] ring-2 ring-[#FDFCFB]"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold tracking-tight text-[#2D322E] sm:text-lg">
                  Personal AI Team
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9]">
                  <Sparkles className="w-3 h-3 mr-1 text-[#4E6B56]" />
                  多 Agent 協作架構
                </span>
              </div>
              <p className="text-xs text-[#6B726C] font-mono hidden md:block">
                Manager Agent 總管 · Work & Study Agents 專項分工
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-1.5 p-1 bg-[#EFECE5] rounded-xl border border-[#DDD8CE]">
            <button
              id="nav-tab-chat"
              onClick={() => onTabChange('chat')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'chat'
                  ? 'bg-[#385244] text-white shadow-sm'
                  : 'text-[#5C645D] hover:text-[#2D322E] hover:bg-[#E4DFD6]'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>AI 對話總管</span>
            </button>

            <button
              id="nav-tab-activity"
              onClick={() => onTabChange('activity')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'activity'
                  ? 'bg-[#385244] text-white shadow-sm'
                  : 'text-[#5C645D] hover:text-[#2D322E] hover:bg-[#E4DFD6]'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>協作動態</span>
            </button>

            <button
              id="nav-tab-work"
              onClick={() => onTabChange('work')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'work'
                  ? 'bg-[#4E6B56] text-white shadow-sm'
                  : 'text-[#5C645D] hover:text-[#2D322E] hover:bg-[#E4DFD6]'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Work</span>
              <span className="hidden sm:inline-block ml-1 text-xs opacity-80 font-mono">
                ({workTasksCount})
              </span>
            </button>

            <button
              id="nav-tab-study"
              onClick={() => onTabChange('study')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'study'
                  ? 'bg-[#B36534] text-white shadow-sm'
                  : 'text-[#5C645D] hover:text-[#2D322E] hover:bg-[#E4DFD6]'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Study</span>
              <span className="hidden sm:inline-block ml-1 text-xs opacity-80 font-mono">
                ({studyTasksCount})
              </span>
            </button>

            <button
              id="nav-tab-today"
              onClick={() => onTabChange('today')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'today'
                  ? 'bg-[#385244] text-white shadow-sm'
                  : 'text-[#5C645D] hover:text-[#2D322E] hover:bg-[#E4DFD6]'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Today</span>
            </button>
          </nav>

          {/* Right Action Tools */}
          <div className="flex items-center space-x-2">
            <button
              id="btn-open-agents-registry"
              onClick={onOpenAgentsModal}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#DDD8CE] text-xs text-[#4A504B] hover:text-[#2D322E] hover:bg-[#F4F0E8] transition-colors shadow-2xs"
              title="查看團隊成員與擴充架構"
            >
              <Users className="w-3.5 h-3.5 text-[#4E6B56]" />
              <span className="hidden md:inline font-medium">AI 團隊成員</span>
              <span className="px-1.5 py-0.2 rounded bg-[#EBF1EC] text-[#2D4835] font-mono text-[10px] font-semibold">
                {activeAgentsCount}/{totalAgentsCount}
              </span>
            </button>

            {/* Data Management Dropdown */}
            <div className="relative">
              <button
                id="btn-data-management-menu"
                onClick={() => setShowDataMenu(!showDataMenu)}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#DDD8CE] text-[#5C645D] hover:text-[#2D322E] hover:bg-[#F4F0E8] transition-colors shadow-2xs text-xs font-medium"
                title="資料管理與測試模式"
              >
                <Database className="w-3.5 h-3.5 text-[#4E6B56]" />
                <span className="hidden sm:inline">資料管理</span>
              </button>

              {showDataMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDataMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-lg py-1.5 z-50 text-xs">
                    <button
                      onClick={() => {
                        setShowDataMenu(false);
                        onClearDemoData();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#FAF8F5] flex items-center space-x-2 text-[#8C6B3E]"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#B36534]" />
                      <div>
                        <div className="font-semibold">清除所有示範資料</div>
                        <div className="text-[10px] text-[#6B726C]">完整保留我的資料 (User Data)</div>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setShowDataMenu(false);
                        onLoadDemoData();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#FAF8F5] flex items-center space-x-2 text-[#2D322E]"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#385244]" />
                      <div>
                        <div className="font-semibold">載入 Demo 示範資料</div>
                        <div className="text-[10px] text-[#6B726C]">加入示範工作與課業資料</div>
                      </div>
                    </button>

                    <div className="my-1 border-t border-[#EBE8E1]" />

                    <button
                      onClick={() => {
                        setShowDataMenu(false);
                        onClearAllData();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#FAF0E6] flex items-center space-x-2 text-[#B36534]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <div>
                        <div className="font-semibold">清空所有資料庫</div>
                        <div className="text-[10px] text-[#8C938D]">測試全空資料/反捏造模式</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
