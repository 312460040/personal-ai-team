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

  return (
    <section className="mx-auto max-w-7xl px-2 sm:px-4 pt-3">
      <div className="rounded-2xl border border-[#D8E4DB] bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-[#F3F7F4] border-b border-[#E3EBE5] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#385244] text-white flex items-center justify-center shrink-0">
            <Inbox className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#2D322E]">公共區｜任務收件匣</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#D8E4DB] text-[10px] text-[#385244]">
                <Sparkles className="w-3 h-3" /> Manager AI
              </span>
            </div>
            <p className="text-[11px] text-[#6B726C] mt-0.5">任何零散任務、想法或需求都可以直接丟進來，Manager 會自己理解並分流。</p>
          </div>
        </div>

        <div className="px-4 py-3 bg-[#FCFDFB]">
          <form onSubmit={submit} className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }}
              rows={2}
              disabled={isLoading}
              placeholder="例如：明天幫我把醫院的行銷報告整理好……"
              className="flex-1 resize-none rounded-xl border border-[#DCD9D1] bg-white px-3 py-2.5 text-sm text-[#2D322E] outline-none focus:border-[#789581] focus:ring-2 focus:ring-[#789581]/10 disabled:bg-[#F4F2EE]"
            />
            <button
              type="submit"
              disabled={!text.trim() || isLoading}
              className="h-11 px-4 rounded-xl bg-[#385244] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#2D4638] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isLoading ? '處理中…' : '交給 Manager'}
              {!isLoading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>
          <p className="mt-2 text-[10px] text-[#8C938D]">Manager 會判斷：💼 工作　🎓 課業／研究　🧭 個人規劃；不需要你先分類。</p>
        </div>
      </div>
    </section>
  );
};
