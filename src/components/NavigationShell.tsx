import React, { useState } from 'react';
import { Bot, Briefcase, GraduationCap, CalendarDays, Activity, Users, RotateCcw, Trash2, Database, Bell, Menu, X, House } from 'lucide-react';

interface Props {
  activeTab: 'home' | 'chat' | 'activity' | 'work' | 'study' | 'today' | 'agents';
  onTabChange: (tab: 'home' | 'chat' | 'activity' | 'work' | 'study' | 'today' | 'agents') => void;
  onClearDemoData: () => void;
  onLoadDemoData: () => void;
  onClearAllData: () => void;
  activeAgentsCount: number;
  totalAgentsCount: number;
  workTasksCount: number;
  studyTasksCount: number;
  onOpenAgentsModal: () => void;
  onOpenManagerStatus: () => void;
}

const items = [
  { id: 'home' as const, label: '首頁總覽', icon: House },
  { id: 'chat' as const, label: 'Manager 對話', icon: Bot },
  { id: 'activity' as const, label: '協作動態', icon: Activity },
  { id: 'work' as const, label: 'Work', icon: Briefcase },
  { id: 'study' as const, label: 'Study', icon: GraduationCap },
  { id: 'today' as const, label: 'Today', icon: CalendarDays },
];

export default function NavigationShell({ activeTab, onTabChange, onClearDemoData, onLoadDemoData, onClearAllData, activeAgentsCount, totalAgentsCount, workTasksCount, studyTasksCount, onOpenAgentsModal, onOpenManagerStatus }: Props) {
  const [open, setOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const pending = workTasksCount + studyTasksCount;
  const navigate = (tab: Props['activeTab']) => { onTabChange(tab); setOpen(false); setNoticeOpen(false); };

  return <>
    <header className="sticky top-0 z-40 w-full border-b border-[#E5E2DC] bg-[#FDFCFB]/95 backdrop-blur-md">
      <div className="h-16 px-3 sm:px-5 flex items-center gap-3">
        <button onClick={() => setOpen(true)} className="p-2.5 rounded-xl hover:bg-[#F0EEE9] text-[#4E5850]" aria-label="開啟側欄"><Menu className="w-5 h-5" /></button>
        <button onClick={() => navigate('home')} className="flex items-center gap-2.5 text-left">
          <div className="relative w-9 h-9 rounded-xl bg-[#385244] flex items-center justify-center text-white"><Bot className="w-5 h-5" /><span className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-[#6E9A79] ring-2 ring-[#FDFCFB]" /></div>
          <div className="hidden sm:block"><div className="text-sm font-bold text-[#2D322E]">Personal AI Team</div><div className="text-[10px] text-[#737A75]">Personal AI Workspace</div></div>
        </button>
        <nav className="hidden md:flex items-center gap-1 ml-2" aria-label="主要頁面">
          <button onClick={() => navigate('home')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${activeTab === 'home' ? 'bg-[#E8EFEB] text-[#385244]' : 'text-[#666D68] hover:bg-[#F0EEE9]'}`}><House className="w-3.5 h-3.5" />首頁</button>
          <button onClick={() => navigate('chat')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${activeTab === 'chat' ? 'bg-[#E8EFEB] text-[#385244]' : 'text-[#666D68] hover:bg-[#F0EEE9]'}`}><Bot className="w-3.5 h-3.5" />Manager 對話</button>
        </nav>
        <button onClick={onOpenManagerStatus} className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#DDE5DF] bg-[#F7FAF8] text-xs text-[#385244] hover:bg-[#EEF4F0]" title="查看 Manager 狀態">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6E9A79]" /> Manager Online
        </button>
        <div className="flex-1" />
        <div className="relative">
          <button onClick={() => setNoticeOpen(v => !v)} className="relative p-2.5 rounded-xl hover:bg-[#F0EEE9] text-[#4E5850]" aria-label="通知"><Bell className="w-[18px] h-[18px]" />{pending > 0 && <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[#B36534] text-white text-[9px] leading-[15px] text-center font-bold">{pending > 9 ? '9+' : pending}</span>}</button>
          {noticeOpen && <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[#E5E2DC] bg-white shadow-xl p-3 z-50">
            <div className="flex items-center justify-between px-1 pb-3 border-b border-[#EEEAE4]"><b className="text-sm">通知</b><span className="text-[10px] text-[#7A817B]">Manager</span></div>
            <div className="py-2">
              {pending > 0 ? <>
                {workTasksCount > 0 && <button onClick={() => navigate('work')} className="w-full text-left flex gap-3 p-3 rounded-xl hover:bg-[#FAF8F5]"><span>💼</span><span><b className="text-xs">Work 有 {workTasksCount} 件待處理</b><span className="block text-[10px] text-[#7A817B] mt-0.5">Manager 可以協助你安排優先順序。</span></span></button>}
                {studyTasksCount > 0 && <button onClick={() => navigate('study')} className="w-full text-left flex gap-3 p-3 rounded-xl hover:bg-[#FAF8F5]"><span>📚</span><span><b className="text-xs">Study 有 {studyTasksCount} 件待處理</b><span className="block text-[10px] text-[#7A817B] mt-0.5">可以請 Study Agent 幫你整理。</span></span></button>}
                <button onClick={() => navigate('chat')} className="w-full mt-1 py-2 rounded-lg text-xs font-semibold text-[#385244] hover:bg-[#EEF4F0]">讓 Manager 幫我安排 →</button>
              </> : <div className="py-8 text-center text-xs text-[#8A908B]">目前沒有新的通知<br/><span className="text-[10px]">有重要事項時，Manager 會在這裡提醒你。</span></div>}
            </div>
          </div>}
        </div>
        <button onClick={onOpenManagerStatus} className="flex md:hidden items-center gap-1.5 p-2 rounded-lg hover:bg-[#F0EEE9] text-[#4E5850]" aria-label="Manager 狀態"><Bot className="w-4 h-4" /></button>
        <button onClick={onOpenAgentsModal} className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#DDD8CE] text-xs text-[#4A504B]"><Users className="w-3.5 h-3.5 text-[#4E6B56]" />AI Team <span className="px-1.5 rounded bg-[#EBF1EC] text-[#2D4835] font-mono text-[10px]">{activeAgentsCount}/{totalAgentsCount}</span></button>
        <div className="relative hidden sm:block">
          <button onClick={() => setDataOpen(v => !v)} className="p-2 rounded-lg hover:bg-[#F0EEE9] text-[#68716A]" title="資料管理"><Database className="w-4 h-4" /></button>
          {dataOpen && <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white border border-[#E5E2DC] shadow-lg p-1 z-50 text-xs"><button onClick={onClearDemoData} className="w-full text-left p-2 hover:bg-[#FAF8F5] flex gap-2"><Trash2 className="w-3.5 h-3.5 text-[#B36534]" />清除示範資料</button><button onClick={onLoadDemoData} className="w-full text-left p-2 hover:bg-[#FAF8F5] flex gap-2"><RotateCcw className="w-3.5 h-3.5 text-[#385244]" />載入 Demo 資料</button><button onClick={onClearAllData} className="w-full text-left p-2 hover:bg-[#FAF0E6] text-[#B36534] flex gap-2"><Trash2 className="w-3.5 h-3.5" />清空所有資料</button></div>}
        </div>
      </div>
    </header>

    {open && <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setOpen(false)}>
      <aside className="h-full w-[285px] max-w-[85vw] bg-[#FDFCFB] shadow-2xl border-r border-[#E5E2DC]" onClick={e => e.stopPropagation()}>
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#E5E2DC]"><div className="flex items-center gap-2"><Bot className="w-5 h-5 text-[#385244]" /><b className="text-sm">Personal AI Team</b></div><button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-[#F0EEE9]"><X className="w-4 h-4" /></button></div>
        <div className="p-3">
          <div className="px-3 pt-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-[#9A9F9B]">Workspace</div>
          {items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => navigate(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${activeTab === id ? 'bg-[#E8EFEB] text-[#385244] font-semibold' : 'text-[#555D57] hover:bg-[#F3F1ED]'}`}><Icon className="w-4 h-4" /><span>{label}</span>{id === 'work' && workTasksCount > 0 && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-[#EFECE5]">{workTasksCount}</span>}{id === 'study' && studyTasksCount > 0 && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-[#EFECE5]">{studyTasksCount}</span>}</button>)}
          <div className="my-3 border-t border-[#EBE8E1]" />
          <button onClick={() => { setOpen(false); onOpenManagerStatus(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#555D57] hover:bg-[#F3F1ED]"><Bot className="w-4 h-4 text-[#385244]" /><span>Manager 狀態</span><span className="ml-auto text-[10px] text-[#4E6B56]">Online</span></button>
          <button onClick={() => { setOpen(false); onOpenAgentsModal(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#555D57] hover:bg-[#F3F1ED]"><Users className="w-4 h-4" /><span>AI 團隊成員</span><span className="ml-auto text-[10px]">{activeAgentsCount}/{totalAgentsCount}</span></button>
          <button onClick={() => { setOpen(false); setNoticeOpen(true); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#555D57] hover:bg-[#F3F1ED]"><Bell className="w-4 h-4" /><span>通知</span>{pending > 0 && <span className="ml-auto min-w-5 text-center text-[10px] font-bold text-[#B36534]">{pending}</span>}</button>
        </div>
        <div className="absolute bottom-0 w-[285px] max-w-[85vw] px-4 py-3 border-t border-[#E5E2DC] text-[10px] text-[#8A908B]">👑 Owner · Manager 負責調度 AI Team</div>
      </aside>
    </div>}
  </>;
}
