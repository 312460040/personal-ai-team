import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, Clock3, Play, RefreshCw } from 'lucide-react';
import { superviseNow } from '../engines/supervisionEngine';
import { useAppData } from '../context/AppDataContext';

export default function ManagerSupervision() {
  const { todayBlocks, workTasks, studyTasks } = useAppData();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(id); }, []);
  const result = useMemo(() => superviseNow({ todayBlocks, workTasks, studyTasks, now }), [todayBlocks, workTasks, studyTasks, now]);
  const tone = result.state === 'overdue' ? 'border-red-200 bg-red-50' : result.state === 'late-start' ? 'border-amber-200 bg-amber-50' : result.state === 'current' ? 'border-[#D9E6DD] bg-[#F5F9F6]' : 'border-[#E5E2DC] bg-white';
  return <section className={`rounded-2xl border p-5 shadow-sm ${tone}`}>
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[#385244]"><BellRing className="w-4 h-4" /></div>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-widest text-[#8A908B]">Manager Supervision</span><span className="h-1.5 w-1.5 rounded-full bg-[#6E9A79]" /></div><h3 className="mt-1 text-sm font-bold text-[#303631]">{result.title}</h3><p className="mt-1 text-xs leading-5 text-[#69716B]">{result.message}</p></div>
      <Clock3 className="hidden sm:block w-4 h-4 text-[#9A9F9B]" />
    </div>
    <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3"><span className="text-[10px] text-[#8A908B]">每 30 秒重新判斷一次</span>{result.action === 'start' && <span className="flex items-center gap-1 text-[10px] font-semibold text-[#385244]"><Play className="w-3 h-3" />建議現在開始</span>}{result.action === 'reschedule' && <span className="flex items-center gap-1 text-[10px] font-semibold text-[#9A572F]"><RefreshCw className="w-3 h-3" />建議重新排程</span>}</div>
  </section>;
}
