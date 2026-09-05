import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChatWorkspace } from './components/ChatWorkspace';
import OwnerDashboard from './components/OwnerDashboard';
import CalendarView from './components/CalendarView';
import CurrentTimeSlot from './components/CurrentTimeSlot';
import ManagerNextAction from './components/ManagerNextAction';
import ManagerSupervision from './components/ManagerSupervision';
import NavigationShell from './components/NavigationShell';
import ManagerStatusDrawer from './components/ManagerStatusDrawer';
import { AgentActivityView } from './components/AgentActivityView';
import { WorkView } from './components/WorkView';
import { StudyView } from './components/StudyView';
import { TodayView } from './components/TodayView';
import { AgentRegistryModal } from './components/AgentRegistryModal';
import DatabaseView from './components/DatabaseView';
import DatabaseSync from './components/DatabaseSync';
import AgentHandoffSync from './components/AgentHandoffSync';
import OrganizationView from './components/OrganizationView';
import IdeaBoard from './components/IdeaBoard';
import { AGENT_REGISTRY } from './data/agentRegistry';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { analyzeManagerState } from './engines/managerEngine';
import { buildNotifications } from './engines/notificationEngine';
import type { AppNotification } from './engines/notificationEngine';
import type { WorkTask, StudyTask, StructuredTimeBlock } from './types';
import { apiUrl } from './services/apiBase';

type ChatSendContext = { workspaceId: string; projectId: string | null; chatRoomId: string; chatRoomName: string; chatCategoryId: string };
type CalendarTask = WorkTask | StudyTask;
const NOTIFICATION_KEY = 'ait_notifications_v1';
const TASK_BATCH_KEY = 'ait_manager_task_batches_v1';
const AI_TASK_CALENDAR_SYNC_KEY = 'ait_ai_task_calendar_sync_v1';
type ActiveTab = 'home' | 'chat' | 'activity' | 'work' | 'study' | 'today' | 'agents' | 'database' | 'ideas' | 'organization';

const taskVisualPriority = (priority: CalendarTask['priority']) =>
  priority === 'high' ? 'urgent' : priority === 'medium' ? 'important' : 'normal';

const nextTaipeiDate = (dateKey: string) => {
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

async function syncAiCreatedTaskDeadlineToCalendar(task: CalendarTask, type: 'work' | 'study') {
  const deadline = String(task.deadline || '');
  const dateKey = deadline.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!dateKey || !task.id || !task.title) return false;

  const endDate = nextTaipeiDate(dateKey);
  const priority = taskVisualPriority(task.priority);
  const response = await fetch(apiUrl('/api/calendar/events'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Owner-Confirmed': 'true',
      'X-Owner-Id': 'personal-owner',
    },
    body: JSON.stringify({
      externalTaskId: String(task.id),
      title: `${type === 'work' ? '💼' : '🎓'} ${task.title}｜截止`,
      description: `AIT_PRIORITY:${priority}\nAIT_TASK_DEADLINE:true\n由 Personal AI Team Manager 透過對話建立的任務截止日。`,
      allDay: true,
      startDate: dateKey,
      endDate,
    }),
  });

  return response.ok;
}

function AppMainContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [isAgentsModalOpen, setIsAgentsModalOpen] = useState(false);
  const [isManagerStatusOpen, setIsManagerStatusOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(NOTIFICATION_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const data = useAppData();
  const {
    workProjects,
    workTasks,
    studySubjects,
    studyTasks,
    todayBlocks,
    messages,
    activityLogs,
    isLoading,
    addWorkTask,
    updateWorkTask,
    deleteWorkTask,
    toggleWorkTask,
    addWorkProject,
    updateWorkProject,
    deleteWorkProject,
    addStudyTask,
    updateStudyTask,
    deleteStudyTask,
    toggleStudyTask,
    addStudySubject,
    updateStudySubject,
    deleteStudySubject,
    applyScheduleToToday,
    sendMessage,
    setCurrentContext,
    loadDemoData,
    clearDemoData,
    clearAllData,
  } = data;
  const processedTaskBatchIds = useRef<Set<string>>(new Set());
  const syncedAiCalendarTaskIds = useRef<Set<string>>(new Set());

  const handleAskAgentFromTab = (prompt: string) => {
    setActiveTab('chat');
    sendMessage(prompt);
  };

  const isScheduleCommand = (text: string) =>
    /(?:幫我|請幫我|請|麻煩)?(?:安排|排定|規劃|排程|分配).{0,60}(?:今天|明天|明日|時間|行程|工作|課業|事情|時段)/i.test(text) ||
    /(?:今天|明天|明日).{0,30}(?:怎麼排|幫我排|安排一下|排程|時間規劃)/i.test(text);

  const toCalendarDateTime = (targetDate: string, time: string) => `${targetDate}T${time}:00`;

  const syncManagedScheduleToCalendar = async (targetDate: string, blocks: StructuredTimeBlock[]) => {
    const managed = blocks.filter(
      (block: any) =>
        (block.type === 'work' || block.type === 'study') &&
        block.taskId &&
        /^\d{2}:\d{2} - \d{2}:\d{2}$/.test(String(block.time || ''))
    );
    if (!managed.length) return { synced: 0, failed: 0 };
    let synced = 0;
    let failed = 0;
    await Promise.all(
      managed.map(async (block: any) => {
        try {
          const [startTime, endTime] = String(block.time).split(' - ');
          const visual =
            block.visualPriority ||
            (block.priority === 'high' ? 'urgent' : block.priority === 'medium' ? 'important' : 'normal');
          const response = await fetch(apiUrl('/api/calendar/events'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Owner-Confirmed': 'true',
              'X-Owner-Id': 'personal-owner',
            },
            body: JSON.stringify({
              externalTaskId: String(block.taskId),
              title: `${block.type === 'work' ? '💼' : '🎓'} ${block.title}`,
              description: `AIT_PRIORITY:${visual}\n${block.recurring ? 'AIT_RECURRING:true\n' : ''}由 Personal AI Team Manager 排程。${block.tips || ''}`,
              startAt: toCalendarDateTime(targetDate, startTime),
              endAt: toCalendarDateTime(targetDate, endTime),
            }),
          });
          if (!response.ok) {
            failed += 1;
            return;
          }
          synced += 1;
        } catch {
          failed += 1;
        }
      })
    );
    return { synced, failed };
  };

  const executeSchedule = async (text: string) => {
    try {
      const response = await fetch(apiUrl('/api/agent/execute-schedule'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Owner-Confirmed': 'true',
          'X-Owner-Id': 'personal-owner',
        },
        body: JSON.stringify({
          message: text,
          context: { workProjects, workTasks, studySubjects, studyTasks, currentContext: data.currentContext },
        }),
      });
      if (!response.ok) throw new Error(`schedule execution returned ${response.status}`);
      const result = await response.json();
      if (result.executed && Array.isArray(result.blocks) && result.blocks.length) {
        applyScheduleToToday(result.blocks as StructuredTimeBlock[]);
        const calendarResult = await syncManagedScheduleToCalendar(result.targetDate, result.blocks as StructuredTimeBlock[]);
        if (calendarResult.failed) console.warn('Some managed schedule blocks could not be synced to Google Calendar:', calendarResult);
        setActiveTab('today');
      }
    } catch (error) {
      console.error('Manager schedule execution failed:', error);
    }
  };

  const handleChatSend = async (text: string, context?: ChatSendContext) => {
    if (context) setCurrentContext({ workspaceId: context.workspaceId, projectId: context.projectId });
    if (isScheduleCommand(text)) {
      await Promise.all([sendMessage(text), executeSchedule(text)]);
      return;
    }
    await sendMessage(text);
  };

  const currentActiveAgents = ['manager', 'work', 'study', 'research'];
  const workPendingCount = workTasks.filter((t) => t.status !== 'completed').length;
  const studyPendingCount = studyTasks.filter((t) => t.status !== 'completed').length;
  const managerAnalysis = useMemo(() => analyzeManagerState({ workTasks, studyTasks, todayBlocks }), [workTasks, studyTasks, todayBlocks]);

  useEffect(() => {
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const next = buildNotifications(managerAnalysis, workTasks, studyTasks, notifications);
    const changed =
      next.length !== notifications.length ||
      next.some((item, index) => item.id !== notifications[index]?.id || item.read !== notifications[index]?.read);
    if (changed) setNotifications(next);
  }, [managerAnalysis, workTasks, studyTasks]);

  useEffect(() => {
    const stored = localStorage.getItem(TASK_BATCH_KEY);
    if (stored) {
      try {
        const ids = JSON.parse(stored);
        if (Array.isArray(ids)) ids.forEach((id: string) => processedTaskBatchIds.current.add(id));
      } catch {}
    }
  }, []);

  useEffect(() => {
    messages.forEach((message) => {
      if (message.sender !== 'manager' || processedTaskBatchIds.current.has(message.id)) return;
      const marker = message.text.match(/<!--AIT_TASK_BATCH:([\s\S]*?)-->/);
      if (!marker) return;
      try {
        const batch = JSON.parse(marker[1]);
        const work: Array<WorkTask> = Array.isArray(batch.work) ? batch.work : [];
        const study: Array<StudyTask> = Array.isArray(batch.study) ? batch.study : [];
        work.forEach((task) => addWorkTask(task));
        study.forEach((task) => addStudyTask(task));
        processedTaskBatchIds.current.add(message.id);
        localStorage.setItem(TASK_BATCH_KEY, JSON.stringify(Array.from(processedTaskBatchIds.current).slice(-100)));
      } catch (error) {
        console.error('Failed to sync Manager-created task batch:', error);
      }
    });
  }, [messages, addWorkTask, addStudyTask]);

  // Conversation-created tasks are real tasks, but they previously stopped at the task list.
  // Give every AI-created task a real Google Calendar all-day deadline event. A later explicit
  // scheduling command can add a timed work/study block for the actual working session.
  useEffect(() => {
    const candidates: Array<{ task: CalendarTask; type: 'work' | 'study' }> = [
      ...workTasks.filter((task) => task.tags?.includes('AI-Manager-Created') || task.notes?.includes('AI 對話')).map((task) => ({ task, type: 'work' as const })),
      ...studyTasks.filter((task) => task.tags?.includes('AI-Manager-Created') || task.notes?.includes('AI 對話')).map((task) => ({ task, type: 'study' as const })),
    ];

    const pending = candidates.filter(({ task }) => !syncedAiCalendarTaskIds.current.has(task.id));
    if (!pending.length) return;

    void Promise.all(
      pending.map(async ({ task, type }) => {
        try {
          const synced = await syncAiCreatedTaskDeadlineToCalendar(task, type);
          if (synced) syncedAiCalendarTaskIds.current.add(task.id);
        } catch (error) {
          // Calendar may simply not be connected yet. Keep the task pending so the next scan can retry.
          console.debug('AI task calendar sync pending:', task.id, error);
        }
      })
    );
  }, [workTasks, studyTasks]);

  // Retry pending AI-created deadlines periodically so connecting Google Calendar after task creation also works.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const candidates: Array<{ task: CalendarTask; type: 'work' | 'study' }> = [
        ...workTasks.filter((task) => task.tags?.includes('AI-Manager-Created') || task.notes?.includes('AI 對話')).map((task) => ({ task, type: 'work' as const })),
        ...studyTasks.filter((task) => task.tags?.includes('AI-Manager-Created') || task.notes?.includes('AI 對話')).map((task) => ({ task, type: 'study' as const })),
      ];
      candidates
        .filter(({ task }) => !syncedAiCalendarTaskIds.current.has(task.id))
        .forEach(({ task, type }) => {
          void syncAiCreatedTaskDeadlineToCalendar(task, type).then((synced) => {
            if (synced) syncedAiCalendarTaskIds.current.add(task.id);
          }).catch(() => undefined);
        });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [workTasks, studyTasks]);

  const confirmAndApplySchedule = (blocks: StructuredTimeBlock[]) => {
    if (!blocks.length) return;
    applyScheduleToToday(blocks);
    setActiveTab('today');
  };

  const markNotificationRead = (id: string) => setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  const markAllNotificationsRead = () => setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#2D322E] flex flex-col font-sans selection:bg-[#5C7C66]/20 selection:text-[#2D4835]">
      <NavigationShell
        activeTab={activeTab}
        onTabChange={(tab) => (tab === 'agents' ? setIsAgentsModalOpen(true) : setActiveTab(tab))}
        onLoadDemoData={() => { if (window.confirm('確定要載入 Demo 範例資料嗎？（這將重設為示範任務資料庫）')) loadDemoData(); }}
        onClearDemoData={() => { if (window.confirm('確定要清除所有示範資料嗎？（這將完整保留你的真實資料）')) clearDemoData(); }}
        onClearAllData={() => { if (window.confirm('確定要清空共享資料庫以測試「查無資料」真實防捏造模式嗎？')) clearAllData(); }}
        activeAgentsCount={currentActiveAgents.length}
        totalAgentsCount={AGENT_REGISTRY.length}
        workTasksCount={workPendingCount}
        studyTasksCount={studyPendingCount}
        onOpenAgentsModal={() => setIsAgentsModalOpen(true)}
        onOpenManagerStatus={() => setIsManagerStatusOpen(true)}
        notifications={notifications}
        onReadNotifications={markNotificationRead}
        onReadAllNotifications={markAllNotificationsRead}
      />
      <main className="flex-1 w-full pb-10">
        {activeTab === 'home' && <div className="mx-auto max-w-7xl px-2 sm:px-4 pt-6 space-y-6"><OwnerDashboard /><CurrentTimeSlot blocks={todayBlocks} onToggleBlock={data.toggleTodayBlock} onAskManager={() => { setActiveTab('chat'); sendMessage('檢視我目前的時間與未完成任務，告訴我現在最應該做什麼，必要時重新排程。'); }} /><CalendarView /><ManagerSupervision /><ManagerNextAction /></div>}
        {activeTab === 'organization' && <OrganizationView />}
        {activeTab === 'chat' && <ChatWorkspace messages={messages} onSendMessage={handleChatSend} isLoading={isLoading} onApplyScheduleToToday={confirmAndApplySchedule} currentActiveAgents={currentActiveAgents} agentRegistry={AGENT_REGISTRY} workTasks={workTasks} studyTasks={studyTasks} workProjects={workProjects} studySubjects={studySubjects} onToggleWorkTask={toggleWorkTask} onToggleStudyTask={toggleStudyTask} onUpdateWorkTask={updateWorkTask} onUpdateStudyTask={updateStudyTask} onAddWorkTask={addWorkTask} onAddStudyTask={addStudyTask} />}
        {activeTab === 'activity' && <AgentActivityView activityLogs={activityLogs} onTriggerDemoFlow={() => { setActiveTab('chat'); sendMessage('幫我檢查目前有哪些工作需要優先處理？'); }} isLoading={isLoading} />}
        {activeTab === 'work' && <WorkView projects={workProjects} tasks={workTasks} onToggleTask={toggleWorkTask} onAddTask={addWorkTask} onUpdateTask={updateWorkTask} onDeleteTask={deleteWorkTask} onAddProject={addWorkProject} onUpdateProject={updateWorkProject} onDeleteProject={deleteWorkProject} onAskAgentAboutWork={handleAskAgentFromTab} onClearDemoData={clearDemoData} />}
        {activeTab === 'study' && <StudyView subjects={studySubjects} tasks={studyTasks} onToggleTask={toggleStudyTask} onAddTask={addStudyTask} onUpdateTask={updateStudyTask} onDeleteTask={deleteStudyTask} onAskAgentAboutStudy={handleAskAgentFromTab} onClearDemoData={clearDemoData} />}
        {activeTab === 'today' && <TodayView blocks={todayBlocks} onToggleBlock={data.toggleTodayBlock} onAddBlock={data.addTodayBlock} onAskManagerToReschedule={() => { setActiveTab('chat'); sendMessage('檢視我今天現有的工作與課業時間塊，幫我重新規劃最佳化時間分配。'); }} />}
        {activeTab === 'ideas' && <div className="mx-auto max-w-7xl px-2 sm:px-4 py-3 h-[calc(100vh-5rem)]"><IdeaBoard /></div>}
        {activeTab === 'database' && <DatabaseView />}
      </main>
      <AgentRegistryModal isOpen={isAgentsModalOpen} onClose={() => setIsAgentsModalOpen(false)} />
      <ManagerStatusDrawer isOpen={isManagerStatusOpen} onClose={() => setIsManagerStatusOpen(false)} activeAgentsCount={3} totalAgentsCount={AGENT_REGISTRY.length} workPendingCount={workPendingCount} studyPendingCount={studyPendingCount} />
    </div>
  );
}

export default function App() {
  return <AppDataProvider><DatabaseSync /><AgentHandoffSync /><AppMainContent /></AppDataProvider>;
}