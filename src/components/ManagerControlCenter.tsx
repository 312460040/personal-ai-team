import React from 'react';
import { Bot, CalendarDays, ListTodo, MessageSquarePlus, CircleHelp, ArrowRight } from 'lucide-react';

interface ManagerControlCenterProps {
  onCommand: (prompt: string) => void;
  isLoading?: boolean;
}

const COMMANDS = [
  {
    icon: CalendarDays,
    title: '幫我安排今天',
    description: '檢查工作、課業與時間衝突',
    prompt: '幫我檢查今天的工作與課業，安排最適合的時間與優先順序。',
  },
  {
    icon: ListTodo,
    title: '我現在該做什麼？',
    description: 'Manager 判斷下一個最佳行動',
    prompt: '檢查我目前所有需要處理的事情，告訴我現在最應該做什麼，以及原因。',
  },
  {
    icon: MessageSquarePlus,
    title: '幫我記一件事',
    description: '用自然語言告訴 Manager',
    prompt: '我想記錄一件新的事情，請先告訴我可以直接說內容給你。',
  },
  {
    icon: CircleHelp,
    title: '我卡住了',
    description: '讓 Manager 找出問題並協助處理',
    prompt: '我現在卡住了，請幫我判斷可能的問題，並找出最適合協助我的 Agent。',
  },
];

export const ManagerControlCenter: React.FC<ManagerControlCenterProps> = ({ onCommand, isLoading }) => {
  return (
    <section className="mx-auto max-w-5xl px-2 sm:px-4 pt-4 pb-1">
      <div className="rounded-2xl border border-[#D9E3DC] bg-[#F2F6F3] shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 border-b border-[#D9E3DC]">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#385244] text-white shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#2D322E]">Manager 控制中心</h2>
                <span className="px-1.5 py-0.5 rounded-full bg-[#E0ECE4] text-[#2D4835] border border-[#C6DAC9] text-[10px] font-semibold">
                  ONLINE
                </span>
              </div>
              <p className="text-xs text-[#667068] mt-0.5">
                你不需要自己管理 Task。直接告訴總管你想做什麼。
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[#68716A]">
            <span>Owner</span><ArrowRight className="w-3 h-3" /><span>Manager</span><ArrowRight className="w-3 h-3" /><span>Agents</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 p-3 sm:p-4">
          {COMMANDS.map(({ icon: Icon, title, description, prompt }) => (
            <button
              key={title}
              type="button"
              disabled={isLoading}
              onClick={() => onCommand(prompt)}
              className="group text-left p-3 rounded-xl bg-white border border-[#E0E3DF] hover:border-[#AFC5B5] hover:bg-[#FBFCFB] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#E8EFEB] text-[#385244]">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#A2AAA4] group-hover:text-[#385244] transition-colors" />
              </div>
              <div className="text-xs font-bold text-[#303631]">{title}</div>
              <div className="text-[11px] text-[#7A817B] mt-0.5 leading-relaxed">{description}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ManagerControlCenter;
