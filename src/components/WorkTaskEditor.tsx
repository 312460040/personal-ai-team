import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronRight, Clock3, Target, X } from 'lucide-react';
import type { WorkTask } from '../types';

export const SHORT_VIDEO_STAGES = ['溝通', '腳本', '拍攝', '剪輯', '確認'] as const;
export type ShortVideoStage = typeof SHORT_VIDEO_STAGES[number];

interface Props {
  task: WorkTask;
  onSave: (task: WorkTask) => void;
  onClose: () => void;
}

const inferShortVideo = (task: WorkTask) => task.workflowType === 'short_video' || /短影音|短視頻|影片|視頻/.test(`${task.title} ${task.notes || ''} ${(task.tags || []).join(' ')}`);
const inferStage = (task: WorkTask): ShortVideoStage => {
  const value = String(task.workflowStage || `${task.title} ${task.notes || ''}`);
  return SHORT_VIDEO_STAGES.find(stage => value.includes(stage)) || '溝通';
};

const dateValue = (value: string | undefined) => String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '';

export const WorkTaskEditor: React.FC<Props> = ({ task, onSave, onClose }) => {
  const [draft, setDraft] = useState<WorkTask>({ ...task });
  const [isShortVideo, setIsShortVideo] = useState(inferShortVideo(task));
  const [stage, setStage] = useState<ShortVideoStage>(inferStage(task));
  useEffect(() => { setDraft({ ...task }); setIsShortVideo(inferShortVideo(task)); setStage(inferStage(task)); }, [task]);
  const stageIndex = useMemo(() => SHORT_VIDEO_STAGES.indexOf(stage), [stage]);
  const set = (key: keyof WorkTask, value: any) => setDraft(prev => ({ ...prev, [key]: value }));

  const save = () => {
    const next: WorkTask = {
      ...draft,
      title: draft.title.trim(),
      deadline: dateValue(draft.deadline),
      startDate: dateValue(draft.startDate),
      description: String((draft as any).description || '').trim(),
      goal: String((draft as any).goal || '').trim(),
      workflowType: isShortVideo ? 'short_video' : undefined,
      workflowStage: isShortVideo ? stage : undefined,
      tags: isShortVideo ? Array.from(new Set([...(draft.tags || []), '短影音'])) : draft.tags,
    } as WorkTask;
    onSave(next);
    onClose();
  };

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-3 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white border border-[#E5E2DC] shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 bg-white/95 backdrop-blur border-b border-[#EBE8E1]">
        <div><div className="text-[10px] text-[#8C938D]">編輯任務</div><h2 className="text-lg font-bold text-[#2D322E]">{task.title || '未命名任務'}</h2></div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-[#F3F1ED]"><X className="w-5 h-5"/></button>
      </header>
      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="md:col-span-2"><span className="block text-xs font-semibold mb-1.5">任務名稱</span><input value={draft.title} onChange={e => set('title', e.target.value)} className="w-full rounded-xl border border-[#DDD8CE] px-3 py-2.5 text-sm outline-none focus:border-[#78927E]" /></label>
          <label><span className="block text-xs font-semibold mb-1.5">開始日期</span><span className="relative block"><CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A837D]"/><input type="date" value={dateValue(draft.startDate)} onChange={e => set('startDate', e.target.value)} className="w-full rounded-xl border border-[#DDD8CE] pl-9 pr-3 py-2.5 text-sm" /></span></label>
          <label><span className="block text-xs font-semibold mb-1.5">截止日期</span><span className="relative block"><CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A837D]"/><input type="date" value={dateValue(draft.deadline)} onChange={e => set('deadline', e.target.value)} className="w-full rounded-xl border border-[#DDD8CE] pl-9 pr-3 py-2.5 text-sm" /></span></label>
          <label><span className="block text-xs font-semibold mb-1.5">優先程度</span><select value={draft.priority} onChange={e => set('priority', e.target.value)} className="w-full rounded-xl border border-[#DDD8CE] px-3 py-2.5 text-sm bg-white"><option value="high">迫切</option><option value="medium">重要</option><option value="low">一般</option></select></label>
          <label><span className="block text-xs font-semibold mb-1.5">狀態</span><select value={draft.status} onChange={e => set('status', e.target.value)} className="w-full rounded-xl border border-[#DDD8CE] px-3 py-2.5 text-sm bg-white"><option value="todo">待辦</option><option value="in_progress">進行中</option><option value="completed">已完成</option><option value="delayed">已延遲</option></select></label>
          <label><span className="block text-xs font-semibold mb-1.5">負責人</span><input value={draft.assignee || ''} onChange={e => set('assignee', e.target.value)} placeholder="例如：本人／小明" className="w-full rounded-xl border border-[#DDD8CE] px-3 py-2.5 text-sm" /></label>
          <label><span className="block text-xs font-semibold mb-1.5">預估工時</span><span className="relative block"><Clock3 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A837D]"/><input type="number" min="0" step="0.5" value={draft.estimatedHours} onChange={e => set('estimatedHours', Number(e.target.value) || 0)} className="w-full rounded-xl border border-[#DDD8CE] pl-9 pr-3 py-2.5 text-sm" /></span></label>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isShortVideo} onChange={e => setIsShortVideo(e.target.checked)} className="w-4 h-4"/><span className="text-sm font-bold">啟用短影音里程碑流程</span></label>
          {isShortVideo && <div className="rounded-2xl border border-[#DCE5DE] bg-[#F7FAF8] p-4">
            <div className="flex items-center gap-2 mb-4"><Target className="w-4 h-4 text-[#385244]"/><div><div className="text-sm font-bold">短影音目標流程</div><div className="text-[10px] text-[#7A837D]">點選目前所在階段，系統用軸線呈現完成／進行中／待進行。</div></div></div>
            <div className="overflow-x-auto pb-2"><div className="min-w-[560px] flex items-start">
              {SHORT_VIDEO_STAGES.map((item, index) => { const done = index < stageIndex; const current = index === stageIndex; return <React.Fragment key={item}><button type="button" onClick={() => setStage(item)} className="flex-1 group text-center"><div className={`mx-auto w-9 h-9 rounded-full flex items-center justify-center border-2 transition ${done ? 'bg-[#385244] border-[#385244] text-white' : current ? 'bg-white border-[#385244] text-[#385244] ring-4 ring-[#DCE5DE]' : 'bg-white border-[#C9CEC9] text-[#9AA09A]'}`}>{done ? <Check className="w-4 h-4"/> : index + 1}</div><div className={`mt-2 text-xs font-bold ${current ? 'text-[#385244]' : done ? 'text-[#53665A]' : 'text-[#8C938D]'}`}>{item}</div><div className="mt-1 text-[9px]">{done ? '已完成' : current ? '進行中' : '待進行'}</div></button>{index < SHORT_VIDEO_STAGES.length - 1 && <div className={`mt-[18px] h-0.5 flex-1 ${index < stageIndex ? 'bg-[#385244]' : 'bg-[#D8DDD8]'}`}><ChevronRight className="w-3 h-3 mx-auto -mt-1.5 text-transparent"/></div>}</React.Fragment>; })}
            </div></div>
          </div>}
        </div>

        <div className="grid grid-cols-1 gap-4">
          <label><span className="flex items-center gap-1.5 text-xs font-semibold mb-1.5"><Target className="w-3.5 h-3.5"/>目標／希望達成什麼</span><textarea rows={3} value={(draft as any).goal || ''} onChange={e => set('goal', e.target.value)} placeholder="例如：完成一支可發布的立博運動員短影音" className="w-full rounded-xl border border-[#DDD8CE] px-3 py-2.5 text-sm resize-y" /></label>
          <label><span className="block text-xs font-semibold mb-1.5">詳細說明</span><textarea rows={5} value={(draft as any).description || ''} onChange={e => set('description', e.target.value)} placeholder="完整描述這個任務要做什麼、背景、執行要求……" className="w-full rounded-xl border border-[#DDD8CE] px-3 py-2.5 text-sm resize-y" /></label>
          <label><span className="block text-xs font-semibold mb-1.5">備註／執行紀錄</span><textarea rows={4} value={draft.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="補充資訊、溝通紀錄、交付標準等" className="w-full rounded-xl border border-[#DDD8CE] px-3 py-2.5 text-sm resize-y" /></label>
        </div>
      </div>
      <footer className="sticky bottom-0 flex justify-end gap-2 px-5 py-4 bg-white/95 backdrop-blur border-t border-[#EBE8E1]"><button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#DDD8CE] text-xs font-semibold">取消</button><button type="button" onClick={save} disabled={!draft.title.trim()} className="px-5 py-2.5 rounded-xl bg-[#385244] text-white text-xs font-semibold disabled:opacity-40">儲存任務</button></footer>
    </section>
  </div>;
};
export default WorkTaskEditor;
