import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChatWorkspace } from './components/ChatWorkspace';
import OwnerDashboard from './components/OwnerDashboard';
import CalendarView from './components/CalendarView';
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
import { AGENT_REGISTRY } from './data/agentRegistry';
import { AppDataProvider, useAppData } from './context/AppDataContext';
import { analyzeManagerState } from './engines/managerEngine';
import { buildNotifications } from './engines/notificationEngine';
import type { AppNotification } from './engines/notificationEngine';
import type { WorkTask, StudyTask, StructuredTimeBlock } from './types';

type ChatSendContext = { workspaceId: string; projectId: string | null; chatRoomId: string; chatRoomName: string; chatCategoryId: string };
const NOTIFICATION_KEY = 'ait_notifications_v1';
const TASK_BATCH_KEY = 'ait_manager_task_batches_v1';
type ActiveTab = 'home' | 'chat' | 'activity' | 'work' | 'study' | 'today' | 'agents' | 'database';

function AppMainContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [isAgentsModalOpen, setIsAgentsModalOpen] = useState(false);
  const [isManagerStatusOpen, setIsManagerStatusOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => { try { return JSON.parse(localStorage.getItem(NOTIFICATION_KEY) || '[]'); } catch { return []; } });
  const data = useAppData();
  const { workProjects, workTasks, studySubjects, studyTasks, todayBlocks, messages, activityLogs, isLoading, addWorkTask, updateWorkTask, deleteWorkTask, toggleWorkTask, addWorkProject, updateWorkProject, deleteWorkProject, addStudyTask, updateStudyTask, deleteStudyTask, toggleStudyTask, addStudySubject, updateStudySubject, deleteStudySubject, addTodayBlock, toggleTodayBlock, applyScheduleToToday, sendMessage, setCurrentContext, loadDemoData, clearDemoData, clearAllData } = data;
  const processedTaskBatchIds = useRef<Set<string>>(new Set());
  const handleAskAgentFromTab = (prompt: string) => { setActiveTab('chat'); sendMessage(prompt); };
  const isScheduleCommand = (text: string) => /(?:幫我|請幫我|請|麻煩)?(?:安排|排定|規劃|排程|分配).{0,60}(?:今天|明天|明日|時間|行程|工作|課業|事情|時段)/i.test(text) || /(?:今天|明天|明日).{0,30}(?:怎麼排|幫我排|安排一下|排程|時間規劃)/i.test(text);
  const executeSchedule = async (text: string) => {
    try {
      const response = await fetch('/api/agent/execute-schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Owner-Confirmed': 'true' },
        body: JSON.stringify({ message: text, context: { workProjects, workTasks, studySubjects, studyTasks, currentContext: data.currentContext } }),
      });
      if (!response.ok) throw new Error(`schedule execution returned ${response.status}`);
      const result = await response.json();
      if (result.executed && Array.isArray(result.blocks) && result.blocks.length) {
        applyScheduleToToday(result.blocks as StructuredTimeBlock[]);
        setActiveTab('today');
      }
    } catch (error) {
      console.error('Manager schedule execution failed:', error);
    }
  };
  const handleChatSend = async (text: string, context?: ChatSendContext) => {
    if (context) setCurrentContext({ workspaceId: context.workspaceId, projectId: context.projectId });
    if (isScheduleCommand(text)) {
      // The natural-language command is still sent to Manager for conversation/audit;
      // the executable schedule path runs in parallel and writes the resulting blocks automatically.
      await Promise.all([sendMessage(text), executeSchedule(text)]);
      return;
    }
    await sendMessage(text);
  };
  const currentActiveAgents = ['manager', 'work', 'study'];
  const workPendingCount = workTasks.filter(t => t.status !== 'completed').length;
  const studyPendingCount = studyTasks.filter(t => t.status !== 'completed').length;
  const managerAnalysis = useMemo(() => analyzeManagerState({ workTasks, studyTasks, todayBlocks }), [workTasks, studyTasks, todayBlocks]);

  useEffect(() => { localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { const next = buildNotifications(managerAnalysis, workTasks, studyTasks, notifications); const changed = next.length !== notifications.length || next.some((item, index) => item.id !== notifications[index]?.id || item.read !== notifications[index]?.read); if (changed) setNotifications(next); }, [managerAnalysis, workTasks, studyTasks]);
  useEffect(() => { const stored = localStorage.getItem(TASK_BATCH_KEY); if (stored) { try { const ids = JSON.parse(stored); if (Array.isArray(ids)) ids.forEach((id: string) => processedTaskBatchIds.current.add(id)); } catch {} } }, []);
  useEffect(() => { messages.forEach(message => { if (message.sender !== 'manager' || processedTaskBatchIds.current.has(message.id)) return; const marker = message.text.match(/<!--AIT_TASK_BATCH:([\s\S]*?)-->/); if (!marker) return; try { const batch = JSON.parse(marker[1]); const work: Array<WorkTask> = Array.isArray(batch.work) ? batch.work : []; const study: Array<StudyTask> = Array.isArray(batch.study) ? batch.study : []; work.forEach(task => addWorkTask(task)); study.forEach(task => addStudyTask(task)); processedTaskBatchIds.current.add(message.id); localStorage.setItem(TASK_BATCH_KEY, JSON.stringify(Array.from(processedTaskBatchIds.current).slice(-100))); } catch (error) { console.error('Failed to sync Manager-created task batch:', error); } }); }, [messages, addWorkTask, addStudyTask]);
  useEffect(() => { const handler = (event: Event) => { const detail = (event as CustomEvent<{ work?: WorkTask[]; study?: StudyTask[] }>).detail || {}; const work = Array.isArray(detail.work) ? detail.work : []; const study = Array.isArray(detail.study) ? detail.study : []; work.forEach(task => { if (!workTasks.some(existing => existing.id === task.id || existing.title.trim().toLowerCase() === task.title.trim().toLowerCase())) addWorkTask(task); }); study.forEach(task => { if (!studyTasks.some(existing => existing.id === task.id || existing.title.trim().toLowerCase() === task.title.trim().toLowerCase())) addStudyTask(task); }); }; window.addEventListener('ait:manager-task-arranged', handler); return () => window.removeEventListener('ait:manager-task-arranged', handler); }, [workTasks, studyTasks, addWorkTask, addStudyTask]);
  const confirmAndApplySchedule = (blocks: StructuredTimeBlock[]) => { if (!blocks.length) return; applyScheduleToToday(blocks); setActiveTab('today'); };
  const markNotificationRead = (id: string) => setNotifications(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
  const markAllNotificationsRead = () => setNotifications(prev => prev.map(item => ({ ...item, read: true })));

  return <div className="min-h-screen bg-[#F8F7F4] text-[#2D322E] flex flex-col font-sans selection:bg-[#5C7C66]/20 selection:text-[#2D4835]">
    <NavigationShell activeTab={activeTab} onTabChange={tab => tab === 'agents' ? setIsAgentsModalOpen(true) : setActiveTab(tab)} onLoadDemoData={() => { if (window.confirm('確定要載入 Demo 範例資料嗎？（這將重設為示範任務資料庫）')) loadDemoData(); }} onClearDemoData={() => { if (window.confirm('確定要清除所有示範資料嗎？（這將完整保留你的真實資料）')) clearDemoData(); }} onClearAllData={() => { if (window.confirm('確定要清空共享資料庫以測試「查無資料」真實防捏造模式嗎？')) clearAllData(); }} activeAgentsCount={3} totalAgentsCount={AGENT_REGISTRY.length} workTasksCount={workPendingCount} studyTasksCount={studyPendingCount} onOpenAgentsModal={() => setIsAgentsModalOpen(true)} onOpenManagerStatus={() => setIsManagerStatusOpen(true)} notifications={notifications} onReadNotifications={markNotificationRead} onReadAllNotifications={markAllNotificationsRead} />
    <main className="flex-1 w-full pb-10">
      {activeTab === 'home' && <div className="mx-auto max-w-7xl px-2 sm:px-4 pt-6 space-y-6"><OwnerDashboard /><CalendarView /><ManagerSupervision /><ManagerNextAction /></div>}
      {activeTab === 'chat' && <ChatWorkspace messages={messages} onSendMessage={handleChatSend} isLoading={isLoading} onApplyScheduleToToday={confirmAndApplySchedule} currentActiveAgents={currentActiveAgents} agentRegistry={AGENT_REGISTRY} workTasks={workTasks} studyTasks={studyTasks} />}
      {activeTab === 'activity' && <AgentActivityView activityLogs={activityLogs} onTriggerDemoFlow={() => { setActiveTab('chat'); sendMessage('幫我檢查目前有哪些工作需要優先處理？'); }} isLoading={isLoading} />}
      {activeTab === 'work' && <WorkView projects={workProjects} tasks={workTasks} onToggleTask={toggleWorkTask} onAddTask={addWorkTask} onUpdateTask={updateWorkTask} onDeleteTask={deleteWorkTask} onAddProject={addWorkProject} onUpdateProject={updateWorkProject} onDeleteProject={deleteWorkProject} onAskAgentAboutWork={handleAskAgentFromTab} onClearDemoData={clearDemoData} />}
      {activeTab === 'study' && <StudyView subjects={studySubjects} tasks={studyTasks} onToggleTask={toggleStudyTask} onAddTask={addStudyTask} onUpdateTask={updateStudyTask} onDeleteTask={deleteStudyTask} onAddSubject={addStudySubject} onUpdateSubject={updateStudySubject} onDeleteSubject={deleteStudySubject} onAskAgentAboutStudy={handleAskAgentFromTab} onClearDemoData={clearDemoData} />}
      {activeTab === 'today' && <TodayView blocks={todayBlocks} onToggleBlock={toggleTodayBlock} onAddBlock={addTodayBlock} onAskManagerToReschedule={() => { setActiveTab('chat'); sendMessage('檢視我今天現有的工作與課業時間塊，幫我重新規劃最佳化時間分配。'); }} />}
      {activeTab === 'database' && <DatabaseView />}
    </main>
    <AgentRegistryModal isOpen={isAgentsModalOpen} onClose={() => setIsAgentsModalOpen(false)} />
    <ManagerStatusDrawer isOpen={isManagerStatusOpen} onClose={() => setIsManagerStatusOpen(false)} activeAgentsCount={3} totalAgentsCount={AGENT_REGISTRY.length} workPendingCount={workPendingCount} studyPendingCount={studyPendingCount} />
  </div>;
}

export default function App() { return <AppDataProvider><AppMainContent /></AppDataProvider>; }
