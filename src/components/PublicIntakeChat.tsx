import React, { useState } from 'react';
import { ArrowRight, Inbox, Sparkles } from 'lucide-react';

type Props = { onSend: (text: string) => void; isLoading: boolean };

export const PublicIntakeChat: React.FC<Props> = ({ onSend, isLoading }) => {
  const [text, setText] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || isLoading) return;
    onSend(value);
    setText('');
  };

  const useExample = (value: string) => {
    if (isLoading) return;
    setText(value);
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
            <button
              type="submit"
              disabled={!text.trim() || isLoading}
              className="h-11 sm:h-[72px] px-5 rounded-xl bg-[#385244] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#2D4638] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
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
        </div>
      </div>
    </section>
  );
};
