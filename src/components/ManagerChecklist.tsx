import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Sun, Moon, ArrowRight } from 'lucide-react';
import type { WorkTask, StudyTask } from '../types';

type Task = WorkTask | StudyTask;
type Mode = 'daily-review' | 'tomorrow-plan';

interface Props {
  mode: Mode;
  workTasks: WorkTask[];
  studyTasks: StudyTask[];
  onConfirm: (message: string) => void;
}

const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
const statusLabel: Record<string, string> = {
  todo: '待辦',
  in_progress: '進行中',
  delayed: '延遲',
  completed: '已完成',
};

function formatDeadline(value: string) {
  if (!value) return '未設定';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

export const ManagerChecklist: React.FC<Props> = ({ mode, workTasks, studyTasks, onConfirm }) => {
  const tasks = useMemo<Task[]>(() => {
    const all = [
      ...workTasks.filter(t => t.source === 'user').map(t => ({ ...t, _domain: '💼 工作' })),
      ...studyTasks.filter(t => t.source === 'user').map(t => ({ ...t, _domain: '🎓 課業／研究' })),
    ] as Task[];
    return all.sort((a, b) => {
      const p = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (p) return p;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [workTasks, studyTasks]);

  const pending = tasks.filter(t => t.status !== 'completed');
  const completed = tasks.filter(t => t.status === 'completed');
  const defaultSelected = new Set(pending.map(t => t.id));
  const [selected, setSelected] = useState<Set<string>>(defaultSelected);
  const [confirmed, setConfirmed] = useState(false);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setConfirmed(false);
  };

  const selectAll = () => {
    setSelected(new Set(pending.map(t => t.id)));
    setConfirmed(false);
  };

  const clearAll = () => {
    setSelected(new Set());
    setConfirmed(false);
  };

  const confirm = () => {
    const selectedTasks = pending.filter(t => selected.has(t.id));
    const prefix = mode === 'daily-review' ? '我確認每日覆盤結果，明天繼續處理：' : '我確認明日規劃，明天安排：';
    const detail = selectedTasks.length
      ? selectedTasks.map(t => `${t.title}（${t.id}）`).join('、')
      : '沒有任務需要安排';
    setConfirmed(true);
    onConfirm(`${prefix}${detail}`);
  };

  return (
    <section className="mt-3 rounded-2xl border-2 border-[#C9DCCF] bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-[#EAF2EC] border-b border-[#D5E3D9] flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#385244] text-white flex items-center justify-center">
          {mode === 'daily-review' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm text-[#26362C]">{mode === 'daily-review' ? '🌙 每日覆盤｜明日待辦確認' : '☀️ 隔日規劃｜Owner 審核清單'}</div>
          <div className="text-[10px] text-[#6B726C] mt-0.5">{mode === 'daily-review' ? 'Manager 已盤點目前 User Tasks；勾選明天要繼續的項目。' : 'Manager 依優先級與截止時間整理候選任務；勾選後才送出確認。'}</div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-xl bg-[#F7F5F1] p-2.5 text-center"><div className="text-lg font-bold text-[#385244]">{completed.length}</div><div className="text-[10px] text-[#7A837D]">今日已完成</div></div>
          <div className="rounded-xl bg-[#F7F5F1] p-2.5 text-center"><div className="text-lg font-bold text-[#7D3E1B]">{pending.length}</div><div className="text-[10px] text-[#7A837D]">待處理</div></div>
          <div className="rounded-xl bg-[#F7F5F1] p-2.5 text-center"><div className="text-lg font-bold text-[#385244]">{selected.size}</div><div className="text-[10px] text-[#7A837D]">已勾選</div></div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#3F4440]">{mode === 'daily-review' ? '未完成／延遲任務' : '明日候選任務'}</span>
          <div className="flex gap-1.5">
            <button type="button" onClick={selectAll} className="px-2 py-1 rounded-md border border-[#D8D4CC] text-[10px] text-[#555D57]">全選</button>
            <button type="button" onClick={clearAll} className="px-2 py-1 rounded-md border border-[#D8D4CC] text-[10px] text-[#555D57]">清除</button>
          </div>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {pending.length === 0 ? (
            <div className="py-5 text-center text-xs text-[#6B726C]">🎉 目前沒有未完成的 User Task。</div>
          ) : pending.map(task => (
            <label key={task.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selected.has(task.id) ? 'border-[#BCD2C3] bg-[#F4F8F5]' : 'border-[#E5E2DC] bg-white hover:bg-[#FAF8F5]'}`}>
              <input type="checkbox" checked={selected.has(task.id)} onChange={() => toggle(task.id)} className="mt-0.5 w-4 h-4 accent-[#385244]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-[#2D322E]">{task.title}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#EFECE5] text-[#6B726C]">{'_domain' in task ? (task as any)._domain : '任務'}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FAF0E6] text-[#7D3E1B]">{statusLabel[task.status] || task.status}</span>
                </div>
                <div className="mt-1 text-[10px] text-[#7A837D]">優先級：{task.priority}　·　截止：{formatDeadline(task.deadline)}　·　預估：{task.estimatedHours}h</div>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-[#EBE8E1]">
          <div className="text-[10px] text-[#7A837D] flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5" /> 勾選只代表「建議保留」，不會直接修改任務。</div>
          <button type="button" onClick={confirm} disabled={confirmed} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#385244] text-white text-xs font-semibold disabled:opacity-60">
            {confirmed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            {confirmed ? '已送出確認' : '送出審核結果'}
          </button>
        </div>
      </div>
    </section>
  );
};
