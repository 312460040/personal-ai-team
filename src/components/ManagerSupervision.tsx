import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Clock3, Play, RefreshCw, Bell } from 'lucide-react';
import { superviseNow } from '../engines/supervisionEngine';
import { useAppData } from '../context/AppDataContext';

const NOTIFY_PERMISSION_KEY = 'ait_manager_schedule_notifications_v1';

export default function ManagerSupervision() {
  const { todayBlocks, workTasks, studyTasks } = useAppData();
  const [now, setNow] = useState(() => new Date());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');
  const lastNotifiedKey = useRef<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const result = useMemo(() => superviseNow({ todayBlocks, workTasks, studyTasks, now }), [todayBlocks, workTasks, studyTasks, now]);

  // 每個行程狀態只提醒一次，避免 Manager 每 30 秒狂洗通知。
  useEffect(() => {
    if (notificationPermission !== 'granted' || !result.blockId) return;
    if (result.state !== 'next' && result.state !== 'current' && result.state !== 'late-start' && result.state !== 'missed-schedule') return;
    const dateKey = now.toISOString().slice(0, 10);
    const key = `${dateKey}:${result.blockId}:${result.state}`;
    if (lastNotifiedKey.current === key) return;
    lastNotifiedKey.current = key;
    try {
      const seen = JSON.parse(localStorage.getItem(NOTIFY_PERMISSION_KEY) || '[]') as string[];
      if (seen.includes(key)) return;
      const nextSeen = [...seen.slice(-49), key];
      localStorage.setItem(NOTIFY_PERMISSION_KEY, JSON.stringify(nextSeen));
      const notification = new Notification(`Manager｜${result.title}`, {
        body: result.message,
        tag: `ait-manager-${result.blockId}-${result.state}`,
      });
      notification.onclick = () => window.focus();
    } catch {
      // 瀏覽器不支援或通知權限狀態改變時，仍保留頁面內督促。
    }
  }, [notificationPermission, result, now]);

  const enableNotifications = async () => {
    if (!(typeof window !== 'undefined' && 'Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch {
      setNotificationPermission(Notification.permission);
    }
  };

  const tone = result.state === 'overdue' || result.state === 'missed-schedule' ? 'border-red-200 bg-red-50' : result.state === 'late-start' ? 'border-amber-200 bg-amber-50' : result.state === 'current' ? 'border-[#D9E6DD] bg-[#F5F9F6]' : 'border-[#E5E2DC] bg-white';
  const shouldEnable = notificationPermission !== 'granted' && notificationPermission !== 'unsupported';

  return <section className={`rounded-2xl border p-5 shadow-sm ${tone}`}>
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[#385244]"><BellRing className="w-4 h-4" /></div>
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-widest text-[#8A908B]">Manager Supervision</span><span className="h-1.5 w-1.5 rounded-full bg-[#6E9A79]" /></div><h3 className="mt-1 text-sm font-bold text-[#303631]">{result.title}</h3><p className="mt-1 text-xs leading-5 text-[#69716B]">{result.message}</p></div>
      <Clock3 className="hidden sm:block w-4 h-4 text-[#9A9F9B]" />
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-3">
      <span className="text-[10px] text-[#8A908B]">每 30 秒檢查 Today 行程，遇到開始、晚開始或錯過行程會督促</span>
      <div className="flex items-center gap-3">
        {shouldEnable && <button type="button" onClick={enableNotifications} className="flex items-center gap-1 rounded-lg border border-[#DDE5DF] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#385244] hover:bg-[#F5F9F6]"><Bell className="w-3 h-3" />開啟桌面督促</button>}
        {result.action === 'start' && <span className="flex items-center gap-1 text-[10px] font-semibold text-[#385244]"><Play className="w-3 h-3" />現在開始</span>}
        {result.action === 'reschedule' && <span className="flex items-center gap-1 text-[10px] font-semibold text-[#9A572F]"><RefreshCw className="w-3 h-3" />立即重新排程</span>}
      </div>
    </div>
  </section>;
}
