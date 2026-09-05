import React, { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Circle, Flame, Lightbulb, ListChecks, MessageCircle, NotebookPen, Plus, Sparkles, Target, Trophy, Utensils, Droplets, Dumbbell, BookOpen, Moon, MoreVertical, Pin, CalendarDays } from 'lucide-react';

interface Habit {
  id: string;
  name: string;
  description: string;
  time: string;
  icon: React.ReactNode;
  tone: string;
  completed: boolean;
}

interface Memo {
  id: string;
  title: string;
  date: string;
  tone: string;
}

const initialHabits: Habit[] = [
  { id: 'water', name: '喝水', description: '每天 8 杯水', time: '08:30', icon: <Droplets className="w-6 h-6" />, tone: 'bg-sky-50 text-sky-600 border-sky-100', completed: true },
  { id: 'exercise', name: '運動 30 分鐘', description: '每週 3 次', time: '19:00', icon: <Dumbbell className="w-6 h-6" />, tone: 'bg-rose-50 text-rose-500 border-rose-100', completed: true },
  { id: 'reading', name: '閱讀', description: '每天 30 分鐘', time: '22:00', icon: <BookOpen className="w-6 h-6" />, tone: 'bg-amber-50 text-amber-600 border-amber-100', completed: false },
  { id: 'sleep', name: '早睡', description: '晚上 11 點前', time: '23:00', icon: <Moon className="w-6 h-6" />, tone: 'bg-indigo-50 text-indigo-500 border-indigo-100', completed: true },
  { id: 'breakfast', name: '吃早餐', description: '每天', time: '08:00', icon: <Utensils className="w-6 h-6" />, tone: 'bg-emerald-50 text-emerald-600 border-emerald-100', completed: false },
];

const initialMemos: Memo[] = [
  { id: '1', title: '下次去醫院要帶健保卡', date: '9/4', tone: 'bg-violet-400' },
  { id: '2', title: '記得買媽媽的生日禮物', date: '9/3', tone: 'bg-orange-400' },
  { id: '3', title: '週末整理房間', date: '9/2', tone: 'bg-amber-400' },
];

const formatDate = () => new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date());

export const PersonalPlanningView: React.FC<{ onOpenAgentChat?: () => void }> = ({ onOpenAgentChat }) => {
  const [habits, setHabits] = useState(initialHabits);
  const [memos, setMemos] = useState(initialMemos);
  const [monthOffset, setMonthOffset] = useState(0);

  const completedCount = habits.filter(h => h.completed).length;
  const completionRate = Math.round((completedCount / habits.length) * 100);
  const monthLabel = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long' }).format(date);
  }, [monthOffset]);

  const toggleHabit = (id: string) => setHabits(prev => prev.map(h => h.id === id ? { ...h, completed: !h.completed } : h));

  const addHabit = () => {
    const name = window.prompt('想新增什麼習慣？例如：每天伸展 10 分鐘');
    if (!name?.trim()) return;
    setHabits(prev => [...prev, { id: `habit-${Date.now()}`, name: name.trim(), description: '自訂習慣', time: '自訂', icon: <Target className="w-6 h-6" />, tone: 'bg-emerald-50 text-emerald-600 border-emerald-100', completed: false }]);
  };

  const addMemo = () => {
    const title = window.prompt('想記下什麼？');
    if (!title?.trim()) return;
    setMemos(prev => [{ id: `memo-${Date.now()}`, title: title.trim(), date: '今天', tone: 'bg-emerald-400' }, ...prev]);
  };

  const calendarDays = useMemo(() => {
    const now = new Date();
    now.setMonth(now.getMonth() + monthOffset);
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    return [...Array(firstDay).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  }, [monthOffset]);

  const completedCalendarDays = new Set([1, 2, 3, 4, 8, 9, 10, 11, 12, 15, 16, 17, 18, 22, 23, 24, 25]);

  return (
    <div className="h-full overflow-y-auto bg-[#FBFAF7] custom-scrollbar">
      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-7">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
          <main className="min-w-0 space-y-5">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold mb-1"><Sparkles className="w-4 h-4" />今天也照顧好自己</div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#243229]">早安，今天也一起加油！ ☀️</h2>
                <p className="mt-1 text-sm text-[#7A837D]">{formatDate()} · 把小小的習慣，慢慢變成更好的生活。</p>
              </div>
              <button onClick={onOpenAgentChat} className="self-start sm:self-auto inline-flex items-center gap-2 rounded-xl border border-[#E2DDD3] bg-white px-4 py-2.5 text-sm font-semibold text-[#4C5C52] shadow-sm hover:bg-[#F6F3ED] transition"><MessageCircle className="w-4 h-4" />和 Personal Agent 聊聊</button>
            </header>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={<Target />} label="今日完成" value={`${completedCount} / ${habits.length}`} sub={`${completionRate}% 完成`} tone="green" progress={completionRate} />
              <StatCard icon={<Flame />} label="連續天數" value="12 天" sub="持續前進中！" tone="orange" />
              <StatCard icon={<ListChecks />} label="本月完成" value="18 次" sub="比上個月多 3 次 ↗" tone="blue" />
              <StatCard icon={<Trophy />} label="最佳紀錄" value="28 天" sub="再挑戰新高！" tone="purple" />
            </section>

            <section className="rounded-2xl border border-[#E7E2D9] bg-white p-4 sm:p-5 shadow-[0_8px_30px_rgba(70,65,55,0.05)]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-[#EAF3ED] text-[#4D8B67] flex items-center justify-center"><Check className="w-5 h-5" /></div><div><h3 className="font-bold text-[#29362E]">今日習慣</h3><p className="text-xs text-[#929992]">完成一點點，就離理想的自己更近一點。</p></div></div>
                <span className="hidden sm:block text-xs text-[#8A938D]">已完成 {completedCount} 項</span>
              </div>
              <div className="space-y-2.5">
                {habits.map(habit => (
                  <div key={habit.id} className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${habit.completed ? 'border-[#E5EEE8] bg-[#F7FBF8]' : 'border-[#ECE7DE] bg-[#FFFEFC] hover:bg-[#FBF9F4]'}`}>
                    <div className={`w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center ${habit.tone}`}>{habit.icon}</div>
                    <div className="min-w-0 flex-1"><div className="font-semibold text-sm text-[#344039] truncate">{habit.name}</div><div className="text-xs text-[#8D958F] mt-0.5">{habit.description}</div></div>
                    <div className="hidden sm:block text-xs text-[#7E8780]">{habit.time}</div>
                    <button onClick={() => toggleHabit(habit.id)} className={`min-w-[82px] rounded-full px-3 py-2 text-xs font-bold transition ${habit.completed ? 'bg-[#4CAF7A] text-white shadow-sm hover:bg-[#439C6E]' : 'border border-[#E8BFB7] bg-white text-[#D86759] hover:bg-[#FFF6F3]'}`}>{habit.completed ? <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />已完成</span> : <span className="inline-flex items-center gap-1"><Circle className="w-3.5 h-3.5" />打卡</span>}</button>
                    <button className="p-1.5 text-[#A1A7A2] hover:text-[#59645D]" title="更多"><MoreVertical className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={addHabit} className="mt-3 w-full rounded-xl border border-dashed border-[#AFCDBA] bg-[#F4FAF6] px-4 py-3 text-left hover:bg-[#EEF7F1] transition"><span className="flex items-center gap-3"><span className="w-9 h-9 rounded-full bg-[#4CAF7A] text-white flex items-center justify-center"><Plus className="w-5 h-5" /></span><span><span className="block text-sm font-bold text-[#43805C]">新增習慣</span><span className="block text-xs text-[#8C968F] mt-0.5">建立一個新的好習慣，讓生活更有規律！</span></span></span></button>
            </section>

            <section className="rounded-2xl overflow-hidden border border-[#DCE9E1] bg-gradient-to-r from-[#EAF5ED] via-[#F5FAF6] to-[#FFF8EC] px-6 py-5 flex items-center justify-between gap-4">
              <div><p className="text-base sm:text-lg font-bold text-[#4D614F]">每天進步一點點，</p><p className="text-base sm:text-lg font-bold text-[#657462] mt-1">就是最好的自己。 ♡</p></div><div className="text-4xl">🌱</div>
            </section>
          </main>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-[#E7E2D9] bg-white p-4 shadow-[0_8px_30px_rgba(70,65,55,0.05)]">
              <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[#5A7562]" /><h3 className="font-bold text-[#29362E]">本月打卡紀錄</h3></div><div className="flex gap-1"><button onClick={() => setMonthOffset(v => v - 1)} className="p-1 rounded-lg hover:bg-[#F4F2ED]"><ChevronLeft className="w-4 h-4" /></button><button onClick={() => setMonthOffset(v => v + 1)} className="p-1 rounded-lg hover:bg-[#F4F2ED]"><ChevronRight className="w-4 h-4" /></button></div></div>
              <div className="text-center text-sm font-semibold text-[#66736A] mb-3">{monthLabel}</div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#9AA19C] mb-1">{['日','一','二','三','四','五','六'].map(d => <span key={d}>{d}</span>)}</div>
              <div className="grid grid-cols-7 gap-1">{calendarDays.map((day, i) => <div key={`${day}-${i}`} className="aspect-square flex items-center justify-center">{day ? <span className={`w-7 h-7 flex items-center justify-center rounded-full text-[11px] ${completedCalendarDays.has(day) && monthOffset === 0 ? 'bg-[#4CAF7A] text-white font-bold' : 'text-[#59635C] hover:bg-[#F2F4F1]'}`}>{day}</span> : null}</div>)}</div>
              <div className="mt-3 rounded-xl bg-[#FFF7EA] px-3 py-2.5 text-center"><div className="text-xs text-[#927A59]">本月已完成 <strong className="text-[#765B35]">18 次</strong></div><div className="text-[11px] text-[#A58E70] mt-0.5">繼續保持！ 💪</div></div>
            </section>

            <section className="rounded-2xl border border-[#E7E2D9] bg-white p-4 shadow-[0_8px_30px_rgba(70,65,55,0.05)]">
              <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><NotebookPen className="w-5 h-5 text-[#5A7562]" /><h3 className="font-bold text-[#29362E]">最近備忘錄</h3></div><button onClick={addMemo} className="text-xs font-semibold text-[#4B8B64] hover:underline">新增</button></div>
              <div className="space-y-1">{memos.slice(0, 4).map(memo => <div key={memo.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[#F8F6F1]"><span className={`w-2.5 h-2.5 rounded-full ${memo.tone}`} /><span className="flex-1 text-xs text-[#56615A] truncate">{memo.title}</span><span className="text-[10px] text-[#9CA29D]">{memo.date}</span>{memo.id === '1' && <Pin className="w-3 h-3 text-[#B1B6B1]" />}</div>)}</div>
            </section>

            <button onClick={addMemo} className="w-full rounded-2xl bg-[#4CAF7A] text-white p-4 text-left shadow-sm hover:bg-[#439C6E] transition"><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Plus className="w-5 h-5" /></span><span><span className="block text-sm font-bold">快速新增備忘錄</span><span className="block text-xs text-white/75 mt-0.5">隨手記下重要的事情！</span></span></div></button>

            <button onClick={onOpenAgentChat} className="w-full rounded-2xl border border-[#EEE3D1] bg-[#FFF9EF] p-4 text-left hover:bg-[#FFF5E5] transition"><div className="flex items-center gap-3"><span className="text-2xl">💡</span><span className="flex-1"><span className="block text-sm font-bold text-[#65533C]">告訴 Personal Agent</span><span className="block text-xs text-[#8F7D66] mt-0.5">你的目標或想法吧！</span></span><ChevronRight className="w-4 h-4 text-[#9D8A70]" /></div></button>
          </aside>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub: string; tone: 'green'|'orange'|'blue'|'purple'; progress?: number }> = ({ icon, label, value, sub, tone, progress }) => {
  const tones = { green: 'bg-[#EEF7F1] text-[#4D8B67]', orange: 'bg-[#FFF4E5] text-[#B06F2A]', blue: 'bg-[#EEF5FC] text-[#4E78A8]', purple: 'bg-[#F5F0FC] text-[#8256A8]' };
  return <div className={`rounded-2xl border border-white/80 p-4 ${tones[tone]} shadow-[0_6px_20px_rgba(70,65,55,0.04)]`}><div className="flex items-center gap-2 text-xs font-semibold opacity-90"><span className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center">{icon}</span>{label}</div><div className="mt-2 text-2xl font-bold text-[#27342D]">{value}</div><div className="mt-1 text-[11px] opacity-80">{sub}</div>{progress !== undefined && <div className="mt-2 h-1.5 rounded-full bg-black/5 overflow-hidden"><div className="h-full rounded-full bg-[#4CAF7A]" style={{ width: `${progress}%` }} /></div>}</div>;
};
