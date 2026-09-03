import React, { useMemo, useState } from 'react';
import { Bell, Check, CheckCheck, AlertTriangle, Clock3, Bot, CircleCheck, ShieldAlert } from 'lucide-react';
import type { AppNotification, NotificationType } from '../engines/notificationEngine';

interface Props {
  notifications: AppNotification[];
  onRead: (id: string) => void;
  onReadAll: () => void;
  onNavigate: (tab: NonNullable<AppNotification['actionTab']>) => void;
}

const iconFor = (type: NotificationType) => {
  if (type === 'owner-confirmation') return ShieldAlert;
  if (type === 'deadline') return Clock3;
  if (type === 'task-complete') return CircleCheck;
  if (type === 'agent-report') return Bot;
  return AlertTriangle;
};

const labelFor = (type: NotificationType) => ({
  'manager-alert': 'Manager 預警',
  deadline: '截止提醒',
  'agent-report': 'Agent 回報',
  'task-complete': '任務完成',
  'owner-confirmation': '需要 Owner 確認',
  'schedule-conflict': '排程衝突',
}[type]);

export const NotificationCenter: React.FC<Props> = ({ notifications, onRead, onReadAll, onNavigate }) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'manager' | 'agent'>('all');
  const unreadCount = notifications.filter(x => !x.read).length;
  const visible = useMemo(() => notifications.filter(item => {
    if (filter === 'unread') return !item.read;
    if (filter === 'manager') return item.type === 'manager-alert' || item.type === 'deadline' || item.type === 'owner-confirmation' || item.type === 'schedule-conflict';
    if (filter === 'agent') return item.type === 'agent-report' || item.type === 'task-complete';
    return true;
  }), [notifications, filter]);

  return <div className="w-[360px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#E5E2DC] bg-white shadow-2xl overflow-hidden">
    <div className="px-4 pt-4 pb-3 border-b border-[#EEEAE4]">
      <div className="flex items-center justify-between"><div><h3 className="text-sm font-bold">通知中心</h3><p className="mt-0.5 text-[10px] text-[#858B86]">Manager 與 AI Team 的重要動態</p></div><button onClick={onReadAll} disabled={unreadCount === 0} className="flex items-center gap-1 text-[10px] font-semibold text-[#385244] disabled:opacity-40"><CheckCheck className="w-3.5 h-3.5" />全部已讀</button></div>
      <div className="mt-3 flex gap-1 rounded-lg bg-[#F5F3EF] p-1">
        {([['all','全部'],['unread','未讀'],['manager','Manager'],['agent','Agent']] as const).map(([id,label]) => <button key={id} onClick={() => setFilter(id)} className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold ${filter === id ? 'bg-white shadow-sm text-[#385244]' : 'text-[#7B817C]'}`}>{label}</button>)}
      </div>
    </div>
    <div className="max-h-[430px] overflow-y-auto">
      {visible.length === 0 ? <div className="px-6 py-12 text-center"><Bell className="mx-auto w-7 h-7 text-[#C6CBC7]" /><p className="mt-3 text-xs font-semibold text-[#68716A]">目前沒有符合條件的通知</p><p className="mt-1 text-[10px] text-[#9A9F9B]">有重要事項時，Manager 會在這裡提醒你。</p></div> : visible.map(item => { const Icon = iconFor(item.type); return <button key={item.id} onClick={() => { onRead(item.id); if (item.actionTab) onNavigate(item.actionTab); }} className={`w-full text-left px-4 py-3 border-b border-[#F0EEE9] hover:bg-[#FAF8F5] ${item.read ? '' : 'bg-[#F7FAF8]'}`}><div className="flex gap-3"><div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.priority === 'critical' ? 'bg-red-50 text-red-600' : item.priority === 'high' ? 'bg-amber-50 text-amber-700' : 'bg-[#EEF4F0] text-[#385244]'}`}><Icon className="w-4 h-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[9px] font-bold uppercase tracking-wide text-[#7E857F]">{labelFor(item.type)}</span>{!item.read && <span className="h-1.5 w-1.5 rounded-full bg-[#B36534]" />}</div><p className="mt-1 text-xs font-semibold text-[#303631]">{item.title}</p><p className="mt-1 text-[10px] leading-4 text-[#747B75] line-clamp-2">{item.message}</p></div></div></button>; })}
    </div>
    <div className="px-4 py-2 border-t border-[#EEEAE4] text-[9px] text-[#9A9F9B] flex items-center gap-1"><Check className="w-3 h-3" />點擊通知可直接前往相關工作區</div>
  </div>;
};
