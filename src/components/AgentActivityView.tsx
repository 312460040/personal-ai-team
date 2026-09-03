import React, { useState } from 'react';
import {
  Activity,
  Bot,
  Briefcase,
  GraduationCap,
  ArrowRight,
  GitMerge,
  Cpu,
  Clock,
  CheckCircle2,
  Filter,
  Layers,
  Sparkles,
  Zap,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { AgentActivityLog, AgentId } from '../types';

interface AgentActivityViewProps {
  activityLogs: AgentActivityLog[];
  onTriggerDemoFlow: () => void;
  isLoading: boolean;
}

export const AgentActivityView: React.FC<AgentActivityViewProps> = ({
  activityLogs,
  onTriggerDemoFlow,
  isLoading,
}) => {
  const [filterAgent, setFilterAgent] = useState<'ALL' | AgentId>('ALL');

  const filteredLogs = activityLogs.filter((log) => {
    if (filterAgent === 'ALL') return true;
    return log.fromAgent === filterAgent || log.toAgent === filterAgent;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Activity className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-white">Agent 協作動態與調度流 (Agent Activity)</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            視覺化監控 Manager Agent 如何分析意圖、將任務並行分派給 Work Agent 與 Study Agent、收集反饋並完成衝突消解。
          </p>
        </div>

        <button
          id="btn-trigger-demo-pipeline"
          onClick={onTriggerDemoFlow}
          disabled={isLoading}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium text-xs sm:text-sm transition-colors shadow-sm shadow-indigo-500/20 flex-shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>觸發「工作 + 資料結構」協同調度範例</span>
        </button>
      </div>

      {/* Interactive Flowchart Diagram */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <GitMerge className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200">多 Agent 協同架構運作流程 (Orchestration Sequence)</h3>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            ● 即時監控模式 (Live Trace)
          </span>
        </div>

        {/* Nodes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Node 1: User */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold mb-2">
              User
            </div>
            <span className="text-xs font-bold text-slate-200">1. 使用者需求輸入</span>
            <p className="text-[11px] text-slate-400 mt-1">「明天有工作且晚上要讀資料結構」</p>
            <div className="mt-2 text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
              單一窗口溝通
            </div>
          </div>

          {/* Node 2: Manager Agent */}
          <div className="p-4 rounded-xl bg-indigo-950/40 border-2 border-indigo-500/40 flex flex-col items-center text-center relative shadow-lg shadow-indigo-500/10">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white mb-2 shadow-md shadow-indigo-500/30">
              <Bot className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-indigo-200">2. Manager Agent (總管)</span>
            <p className="text-[11px] text-slate-300 mt-1">意圖解析 ➔ 判定為工作 + 課業複合任務</p>
            <div className="mt-2 flex items-center space-x-1 text-[10px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
              <span>並行分派 (Fork)</span>
            </div>
          </div>

          {/* Node 3: Specialized Sub-Agents (Work & Study) */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col space-y-2">
            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center space-x-2">
              <div className="p-1 rounded bg-emerald-600 text-white">
                <Briefcase className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-emerald-300">Work Agent</div>
                <div className="text-[10px] text-slate-400 truncate">專案拆解 & 優先級分析</div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-center space-x-2">
              <div className="p-1 rounded bg-amber-600 text-white">
                <GraduationCap className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-amber-300">Study Agent</div>
                <div className="text-[10px] text-slate-400 truncate">課業衝刺 & 按表操課督促</div>
              </div>
            </div>
          </div>

          {/* Node 4: Synthesis & Output */}
          <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/30 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white mb-2">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-purple-200">4. 整合行動計畫 (Join)</span>
            <p className="text-[11px] text-slate-300 mt-1">消解時間衝突 ➔ 產出今日時間區塊排程</p>
            <div className="mt-2 text-[10px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded">
              自動同步至 Today 儀表板
            </div>
          </div>
        </div>
      </div>

      {/* Activity Logs & Filter List */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">
              協作日誌追蹤清單 ({filteredLogs.length} 條紀錄)
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            {(['ALL', 'manager', 'work', 'study'] as const).map((agent) => (
              <button
                key={agent}
                id={`filter-agent-${agent}`}
                onClick={() => setFilterAgent(agent)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  filterAgent === agent
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {agent === 'ALL'
                  ? '全部'
                  : agent === 'manager'
                  ? 'Manager'
                  : agent === 'work'
                  ? 'Work'
                  : 'Study'}
              </button>
            ))}
          </div>
        </div>

        {/* List of Detailed Logs */}
        {filteredLogs.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs">
            目前暫無符合篩選條件的日誌
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log, idx) => (
              <div
                key={log.id || idx}
                className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        log.fromAgent === 'manager'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : log.fromAgent === 'work'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {log.fromAgent === 'manager'
                        ? 'Manager Agent'
                        : log.fromAgent === 'work'
                        ? 'Work Agent'
                        : 'Study Agent'}
                    </span>

                    {log.toAgent && (
                      <>
                        <ArrowRight className="w-3 h-3 text-slate-600" />
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            log.toAgent === 'manager'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : log.toAgent === 'work'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {log.toAgent === 'manager'
                            ? 'Manager Agent'
                            : log.toAgent === 'work'
                            ? 'Work Agent'
                            : 'Study Agent'}
                        </span>
                      </>
                    )}

                    <span className="text-xs font-medium text-slate-200">
                      【{log.action}】
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-200">{log.summary}</p>
                  {log.detail && (
                    <p className="text-xs text-slate-400 font-sans leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                      {log.detail}
                    </p>
                  )}
                </div>

                <div className="flex sm:flex-col items-end justify-between text-[11px] font-mono text-slate-500 flex-shrink-0">
                  <span>{log.timestamp}</span>
                  {log.durationMs && (
                    <span className="text-emerald-400 font-semibold mt-1">
                      耗時 {log.durationMs}ms
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
