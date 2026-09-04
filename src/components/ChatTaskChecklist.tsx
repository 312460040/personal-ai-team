import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, Filter, Search, Tag } from 'lucide-react';
import type { WorkTask, StudyTask } from '../types';

type Task = (WorkTask | StudyTask) & { domain: 'work' | 'study' };

const COLORS: Record<string, string> = {
  work: 'border-l-[#557C61] bg-[#F3F8F4]',
  study: 'border-l-[#7A6AA6] bg-[#F6F3FA]',
  research: 'border-l-[#4F7C9A] bg-[#F2F7FA]',
  admin: 'border-l-[#B07A45] bg-[#FBF5EF]',
  personal: 'border-l-[#9B6B82] bg-[#FAF3F6]',
};

const DOTS: Record<string, string> = {
  work: 'bg-[#557C61]', study: 'bg-[#7A6AA6]', research: 'bg-[#4F7C9A]', admin: 'bg-[#B07A45]', personal: 'bg-[#9B6B82]',
};

function categoryOf(task: Task) {
  if (task.category) return task.category.toLowerCase();
  if (task.domain === 'study') return 'study';
  return 'work';
}

function categoryLabel(category: string) {
  return ({ work: '工作', study: '課業', research: '研究', admin: '行政', personal: '個人' } as Record<string, string>)[category] || category;
}

interface Props {
  workTasks: WorkTask[];
  studyTasks: StudyTask[];
  selectedTaskIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onToggleWorkTask: (id: string) => void;
  onToggleStudyTask: (id: string) => void;
}

export const ChatTaskChecklist: React.FC<Props> = ({ workTasks, studyTasks, selectedTaskIds, onSelectionChange, onToggleWorkTask, onToggleStudyTask }) => {
  const [filter, setFilter] = useState<'all' | 'work' | 'study' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const tasks = useMemo<Task[]>(() => [
    ...workTasks.filter(t => t.source === 'user').map(t => ({ ...t, domain: 'work' as const })),
    ...studyTasks.filter(t => t.source === 'user').map(t => ({ ...t, domain: 'study' as const })),
  ], [workTasks, studyTasks]);

  const filtered = useMemo(() => tasks.filter(task => {
    if (filter === 'work' && task.domain !== 'work') return false;
    if (filter === 'study' && task.domain !== 'study') return false;
    if (filter === 'completed' && task.status !== 'completed') return false;
    const q = search.trim().toLowerCase();
    return !q || task.title.toLowerCase().includes(q) || (task.tags || []).some(t => t.toLowerCase().includes(q));
  }), [tasks, filter, search]);

  const visible = showAll ? filtered : filtered.slice(0, 8);
  const pending = tasks.filter(t => t.status !== 'completed').length;

  const toggleSelected = (id: string) => onSelectionChange(selectedTaskIds.includes(id) ? selectedTaskIds.filter(x => x !== id) : [...selectedTaskIds, id]);
  const toggleDone = (task: Task) => task.domain === 'work' ? onToggleWorkTask(task.id) : onToggleStudyTask(task.id);

  return (
    <section className="mb-3 rounded-2xl border border-[#E5E2DC] bg-white overflow-hidden shadow-xs">
      <div className="px-3 py-2.5 border-b border-[#EBE8E1] flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#E8EFEB] text-[#385244] flex items-center justify-center"><CheckCircle2 className="w-3.5 h-3.5" /></div>
        <div className="flex-1 min-w-0"><div className="text-xs font-bold text-[#2D322E]">我的待辦清單</div><div className="text-[10px] text-[#8C938D]">勾選＝完成；選取後可以直接對 AI 說「把選中的都改成高優先」</div></div>
        <span className="text-[10px] font-semibold text-[#385244]">{pending} 待辦</span>
      </div>
      <div className="px-3 py-2 bg-[#F8F7F4] border-b border-[#EBE8E1] flex flex-wrap items-center gap-1.5">
        {(['all','work','study','completed'] as const).map(item => <button key={item} onClick={() => setFilter(item)} className={`px-2 py-1 rounded-lg text-[10px] border ${filter === item ? 'bg-[#385244] text-white border-[#385244]' : 'bg-white text-[#6B726C] border-[#DDD8CE]'}`}>{item === 'all' ? '全部' : item === 'work' ? '工作' : item === 'study' ? '課業' : '已完成'}</button>)}
        <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-[#DDD8CE]"><Search className="w-3 h-3 text-[#8C938D]" /><input value={search} onChange={e => setSearch(e.target.value)} className="w-24 bg-transparent text-[10px] outline-none" placeholder="搜尋任務／標籤" /></div>
      </div>
      {selectedTaskIds.length > 0 && <div className="px-3 py-2 bg-[#EEF5F0] text-[10px] text-[#385244] border-b border-[#D9E7DC] flex items-center gap-1.5"><Filter className="w-3 h-3" />已選 {selectedTaskIds.length} 項。現在直接輸入自然語言，AI 會只處理這些項目。</div>}
      <div className="p-2 space-y-1.5 max-h-64 overflow-y-auto">
        {visible.length === 0 ? <div className="py-5 text-center text-[11px] text-[#8C938D]">目前沒有符合條件的 User Task。</div> : visible.map(task => {
          const category = categoryOf(task);
          const done = task.status === 'completed';
          const selected = selectedTaskIds.includes(task.id);
          return <div key={task.id} className={`border border-[#E5E2DC] border-l-4 ${COLORS[category] || COLORS.work} rounded-xl p-2.5 ${done ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-2">
              <button onClick={() => toggleDone(task)} className={`mt-0.5 w-4 h-4 shrink-0 rounded-md border flex items-center justify-center ${done ? 'bg-[#385244] border-[#385244] text-white' : 'bg-white border-[#B8B4AC]'}`} title={done ? '標記為待辦' : '標記完成'}>{done && <Check className="w-3 h-3" />}</button>
              <button onClick={() => toggleSelected(task.id)} className={`mt-0.5 w-4 h-4 shrink-0 rounded-md border flex items-center justify-center ${selected ? 'bg-[#6B8B74] border-[#6B8B74] text-white' : 'bg-white border-[#C7C3BB]'}`} title="選取給 AI">{selected && <Check className="w-3 h-3" />}</button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap"><span className={`w-2 h-2 rounded-full ${DOTS[category] || DOTS.work}`} /><span className={`text-[11px] font-semibold ${done ? 'line-through' : ''}`}>{task.title}</span><span className="px-1.5 py-0.5 rounded-full bg-white/80 border border-black/5 text-[9px]">{categoryLabel(category)}</span></div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-[#7A837D]"><span>{task.priority}</span><span>·</span><span>{task.deadline || '無截止日'}</span>{task.tags?.map(tag => <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white border border-[#E0DCD4]"><Tag className="w-2.5 h-2.5" />{tag}</span>)}</div>
              </div>
            </div>
          </div>;
        })}
      </div>
      {filtered.length > 8 && <button onClick={() => setShowAll(v => !v)} className="w-full py-2 border-t border-[#EBE8E1] text-[10px] font-semibold text-[#385244]">{showAll ? '收起清單' : `顯示全部 ${filtered.length} 項`}</button>}
    </section>
  );
};
