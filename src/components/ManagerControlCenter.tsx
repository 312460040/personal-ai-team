import React from 'react';
import { Bot, CalendarDays, ListTodo, MessageSquarePlus, CircleHelp, ArrowRight } from 'lucide-react';

interface ManagerControlCenterProps {
  onCommand: (prompt: string) => void;
  isLoading?: boolean;
}

const COMMANDS = [
  { icon: CalendarDays, label: '安排今天', prompt: '幫我檢查今天的工作與課業，安排最適合的時間與優先順序。' },
  { icon: ListTodo, label: '我現在該做什麼？', prompt: '檢查我目前所有需要處理的事情，告訴我現在最應該做什麼，以及原因。' },
  { icon: MessageSquarePlus, label: '幫我記一件事', prompt: '我想記錄一件新的事情，請先告訴我可以直接說內容給你。' },
  { icon: CircleHelp, label: '我卡住了', prompt: '我現在卡住了，請幫我判斷可能的問題，並找出最適合協助我的 Agent。' },
];

export const ManagerControlCenter: React.FC<ManagerControlCenterProps> = ({ onCommand, isLoading }) => {
  return (
    <section className="mx-auto max-w-4xl px-3 sm:px-6 pt-5 pb-0">
      <div className="flex items-center gap-3 mb-3 px-1">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#385244] text-white shadow-sm">
          <Bot className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#2D322E]">Manager</h2>
            <span className="text-[10px] text-[#5C7C66] font-semibold">Online</span>
          </div>
          <p className="text-[11px] text-[#7A817B]">你的 AI 總管，直接用對話交辦即可</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-12">
        {COMMANDS.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            type="button"
            disabled={isLoading}
            onClick={() => onCommand(prompt)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#DDD8CE] text-[11px] text-[#59615B] hover:border-[#AFC5B5] hover:bg-[#F4F8F5] hover:text-[#385244] transition-all disabled:opacity-50"
          >
            <Icon className="w-3 h-3" />
            <span>{label}</span>
            <ArrowRight className="w-2.5 h-2.5 opacity-50" />
          </button>
        ))}
      </div>
    </section>
  );
};

export default ManagerControlCenter;
