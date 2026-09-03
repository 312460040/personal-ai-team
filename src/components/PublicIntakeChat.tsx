import React, { useState } from 'react';
import { ArrowRight, Inbox, Sparkles, Moon, Sun } from 'lucide-react';
import type { WorkTask, StudyTask } from '../types';
import { ManagerChecklist } from './ManagerChecklist';

type Props = {
  onSend: (text: string) => void;
  isLoading: boolean;
  workTasks: WorkTask[];
  studyTasks: StudyTask[];
};

export const PublicIntakeChat: React.FC<Props> = ({ onSend, isLoading, workTasks, studyTasks }) => {
  const [text, setText] = useState('');
  const [checklistMode, setChecklistMode] = useState<'daily-review' | 'tomorrow-plan' | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || isLoading) return;
    const wantsReview = /(每日覆盤|今天覆盤|今日覆盤|回顧今天|今日回顧)/i.test(value);
    const wantsTomorrow = /(明日規劃|明天規劃|安排明天|規劃明天)/i.test(value);
    setChecklistMode(wantsReview ? 'daily-review' : wantsTomorrow ? 'tomorrow-plan' : null);
    onSend(value);
    setText('');
  };

  const useExample = (value: string) => {
    if (isLoading) return;
    setText(value);
  };

  const openChecklist = (mode: 'daily-review' | 'tomorrow-plan') => {
    setChecklistMode(mode);
    onSend(mode === 'daily-review' ? '幫我做今天的每日覆盤，並列出明天需要繼續處理的任務。' : '幫我規劃明天，列出建議安排的任務。');
  };

  return (
    <section className="mx-auto max-w-7xl px-2 sm:px-4 pt-3">
      <div className="rounded-2xl border-2 border-[#C9DCCF] bg-white shadow-md overflow-hidden">
        <div className="px-4 sm:px-6 py-4 bg-[#EAF2EC] border-b border-[#D5E3D9] flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#385244] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Inbox className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-[#26362C]">把事情直接交給 Manager</h2>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-[#C9DCCF] text-[10px] font-semibold text-[#385244]">
                <Sparkles className="w-3 h-3" /> AI 自動分流
              </span>
            </div>
            <p className="text-xs text-[#5F6C63] mt-1">不用分類、不用找 Agent。直接說你現在要完成什麼，Manager 會理解後交給正確的 AI 員工。</p>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 bg-[#FCFDFB]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <button type="button" onClick={() => openChecklist('daily-review')} disabled={isLoading} className="flex items-center gap-3 p-3 rounded-xl border border-[#D8E3DB] bg-white hover:bg-[#F4F8F5] text-left disabled:opacity-50">
              <span className="w-9 h-9 rounded-lg bg-[#EEF4EF] text-[#385244] flex items-center justify-center"><Moon className="w-4 h-4" /></span>
              <span className="min-w-0"><span className="block text-xs font-bold text-[#2D322E]">每日覆盤</span><span className="block text-[10px] text-[#7A837D]">盤點完成、延遲與明日待辦</span></span>
            </button>
            <button type="button" onClick={() => openChecklist('tomorrow-plan')} disabled={isLoading} className="flex items-center gap-3 p-3 rounded-xl border border-[#D8E3DB] bg-white hover:bg-[#F4F8F5] text-left disabled:opacity-50">
              <span className="w-9 h-9 rounded-lg bg-[#FFF5EA] text-[#B36534] flex items-center justify-center"><Sun className="w-4 h-4" /></span>
              <span className="min-w-0"><span className="block text-xs font-bold text-[#2D322E]">隔日規劃</span><span className="block text-[10px] text-[#7A837D]">Manager 提出候選，你勾選確認</span></span>
            </button>
          </div>

          <form onSubmit={submit} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }}
              rows={2}
              disabled={isLoading}
              placeholder="例如：今天晚上前幫我整理好廣告預算規劃表"
              className="flex-1 min-h-[72px] resize-none rounded-xl border border-[#D4D0C8] bg-white px-4 py-3 text-sm text-[#2D322E] outline-none focus:border-[#789581] focus:ring-2 focus:ring-[#789581]/10 disabled:bg-[#F4F2EE]"
            />
            <button type="submit" disabled={!text.trim() || isLoading} className="h-11 sm:h-[72px] px-5 rounded-xl bg-[#385244] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2D4638] disabled:opacity-40 disabled:cursor-not-allowed shrink-0">
              {isLoading ? 'Manager 處理中…' : '交給 Manager'}
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold text-[#7A837D]">快速試試：</span>
            <button type="button" onClick={() => useExample('幫我檢查今天有哪些工作需要優先處理')} className="px-2.5 py-1.5 rounded-lg bg-white border border-[#DDD9D1] text-[10px] text-[#555D57] hover:bg-[#F3F1ED]">檢查今天工作</button>
            <button type="button" onClick={() => useExample('幫我安排今天的課業與工作時間')} className="px-2.5 py-1.5 rounded-lg bg-white border border-[#DDD9D1] text-[10px] text-[#555D57] hover:bg-[#F3F1ED]">安排今天時間</button>
            <button type="button" onClick={() => useExample('我有一個新的工作想法，幫我判斷應該放在哪裡')} className="px-2.5 py-1.5 rounded-lg bg-white border border-[#DDD9D1] text-[10px] text-[#555D57] hover:bg-[#F3F1ED]">丟一個新想法</button>
          </div>

          <p className="mt-2 text-[10px] text-[#8C938D]">Manager 會自動判斷：💼 工作　🎓 課業／研究　🧭 個人規劃，必要時再交給 Work Agent／Study Agent。</p>

          {checklistMode && (
            <ManagerChecklist
              mode={checklistMode}
              workTasks={workTasks}
              studyTasks={studyTasks}
              onConfirm={(message) => onSend(message)}
            />
          )}
        </div>
      </div>
    </section>
  );
};
