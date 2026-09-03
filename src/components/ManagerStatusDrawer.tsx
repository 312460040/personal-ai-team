import React from 'react';
import { Bot, Briefcase, GraduationCap, X, Clock3, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeAgentsCount: number;
  totalAgentsCount: number;
  workPendingCount: number;
  studyPendingCount: number;
}

export default function ManagerStatusDrawer({
  isOpen,
  onClose,
  activeAgentsCount,
  totalAgentsCount,
  workPendingCount,
  studyPendingCount,
}: Props) {
  if (!isOpen) return null;

  const totalPending = workPendingCount + studyPendingCount;

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      <aside
        className="absolute right-0 top-0 h-full w-[360px] max-w-[90vw] bg-[#FDFCFB] border-l border-[#E5E2DC] shadow-2xl flex flex-col"
        onClick={event => event.stopPropagation()}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#E5E2DC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#385244] flex items-center justify-center text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#2D322E]">Manager Agent</div>
              <div className="text-[10px] text-[#6F7771] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6E9A79]" /> Online · AI 總管
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F0EEE9] text-[#68716A]" aria-label="關閉 Manager 狀態">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <section className="rounded-2xl border border-[#E5E2DC] bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#929892] mb-3">AI Team Status</div>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#EEF4F0]">
                <Bot className="w-4 h-4 text-[#385244]" />
                <div className="flex-1"><div className="text-xs font-semibold">Manager Agent</div><div className="text-[10px] text-[#778078]">總管 · 調度與決策</div></div>
                <span className="text-[10px] font-semibold text-[#385244]">Ready</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl border border-[#E8E5DF]">
                <Briefcase className="w-4 h-4 text-[#4E6B56]" />
                <div className="flex-1"><div className="text-xs font-semibold">Work Agent</div><div className="text-[10px] text-[#778078]">工作專案與任務</div></div>
                <span className="text-[10px] text-[#4E6B56]">Ready</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-xl border border-[#E8E5DF]">
                <GraduationCap className="w-4 h-4 text-[#A66A3D]" />
                <div className="flex-1"><div className="text-xs font-semibold">Study Agent</div><div className="text-[10px] text-[#778078]">課業與研究學習</div></div>
                <span className="text-[10px] text-[#A66A3D]">Ready</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[#EEEAE4] text-[10px] text-[#7C837D]">{activeAgentsCount}/{totalAgentsCount} 個 Agent 在線</div>
          </section>

          <section>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#929892] mb-3">Today</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#E5E2DC] bg-white p-4">
                <Briefcase className="w-4 h-4 text-[#4E6B56] mb-2" />
                <div className="text-xl font-bold">{workPendingCount}</div>
                <div className="text-[10px] text-[#7C837D]">Work 待處理</div>
              </div>
              <div className="rounded-2xl border border-[#E5E2DC] bg-white p-4">
                <GraduationCap className="w-4 h-4 text-[#A66A3D] mb-2" />
                <div className="text-xl font-bold">{studyPendingCount}</div>
                <div className="text-[10px] text-[#7C837D]">Study 待處理</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E5E2DC] bg-white p-4">
            <div className="flex items-center gap-2 mb-3"><Clock3 className="w-4 h-4 text-[#68716A]" /><span className="text-xs font-bold">目前 Focus</span></div>
            <div className="text-xs text-[#69716B]">尚未開始 Focus Session</div>
            <div className="text-[10px] text-[#8A908B] mt-1">開始工作後，Manager 會根據實際狀態判斷是否需要提醒你。</div>
          </section>

          <section className={`rounded-2xl border p-4 ${totalPending > 4 ? 'border-[#E5C9B2] bg-[#FFF8F1]' : 'border-[#DDE7DF] bg-[#F7FAF8]'}`}>
            <div className="flex items-center gap-2 mb-2">
              {totalPending > 4 ? <AlertTriangle className="w-4 h-4 text-[#B36534]" /> : <CheckCircle2 className="w-4 h-4 text-[#4E6B56]" />}
              <span className="text-xs font-bold">Manager 觀察</span>
            </div>
            <div className="text-xs text-[#4F5751]">
              {totalPending > 4 ? '目前待處理事項較多，Manager 會協助你安排優先順序。' : '目前沒有明顯的工作量警訊。需要安排事情時，直接告訴 Manager 即可。'}
            </div>
          </section>
        </div>

        <div className="px-5 py-4 border-t border-[#E5E2DC] text-[10px] text-[#858C86]">👑 Owner 是最高決策者 · Manager 負責調度 AI Team</div>
      </aside>
    </div>
  );
}
