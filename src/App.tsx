import React, { useEffect, useMemo, useState } from 'react';
import { ChatWorkspace } from './components/ChatWorkspace';
import { ManagerChecklist } from './components/ManagerChecklist';
import OwnerDashboard from './components/OwnerDashboard';
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

type ChatSendContext = { workspaceId: string; projectId: string | null; chatRoomId: string; chatRoomName: string; chatCategoryId: string };
const NOTIFICATION_KEY = 'ait_notifications_v1';
type ActiveTab = 'home' | 'chat' | 'activity' | 'work' | 'study' | 'today' | 'agents' | 'database';

function AppMainContent() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [isAgentsModalOpen, setIsAgentsModalOpen] = useState(false);
  const [isManagerStatusOpen, setIsManagerStatusOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => { try { return JSON.parse(localStorage.getItem(NOTIFICATION_KEY) || '[]'); } catch { return []; } });
  const data = useAppData();
  const { workProjects, workTasks, studySubjects, studyTasks, todayBlocks, messages, activityLogs, isLoading, addWorkTask, updateWorkTask, deleteWorkTask, toggleWorkTask, addWorkProject, updateWorkProject, deleteWorkProject, addStudyTask, updateStudyTask, deleteStudyTask, toggleStudyTask, addStudySubject, updateStudySubject, deleteStudySubject, addTodayBlock, toggleTodayBlock, applyScheduleToToday, sendMessage, setCurrentContext, loadDemoData, clearDemoData, clearAllData } = data;
  const handleAskAgentFromTab = (prompt: string) => { setActiveTab('chat'); sendMessage(prompt); };
  const handleChatSend = (text: string, context?: ChatSendContext) => {
    if (context) setCurrentContext({ workspaceId: context.workspaceId, projectId: context.projectId });
    sendMessage(text);
  };
  const currentActiveAgents = ['manager', 'work', 'study'];
  const workPendingCount = workTasks.filter(t => t.status !== 'completed').length;
  const studyPendingCount = studyTasks.filter(t => t.status !== 'completed').length;
  const managerAnalysis = useMemo(() => analyzeManagerState({ workTasks, studyTasks, todayBlocks }), [workTasks, studyTasks, todayBlocks]);
  const checklistMode = useMemo<'daily-review' | 'tomorrow-plan' | null>(() => {
    const latestUser = [...messages].reverse().find(m => m.sender === 'user');
    if (!latestUser) return null;
    if (/每日覆盤|今日覆盤|今天覆盤|回顧今天|今日回顧|每天覆盤|日終覆盤/i.test(latestUser.text)) return 'daily-review';
    if (/隔日規劃|明日規劃|明天規劃|安排明天|規劃明天|明日安排|明天安排/i.test(latestUser.text)) return 'tomorrow-plan';
    return null;
  }, [messages]);
  useEffect(() => { localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { const next = buildNotifications(managerAnalysis, workTasks, studyTasks, notifications); const changed = next.length !== notifications.length || next.some((item, index) => item.id !== notifications[index]?.id || item.read !== notifications[index]?.read); if (changed) setNotifications(next); }, [managerAnalysis, workTasks, studyTasks]);
  const markNotificationRead = (id: string) => setNotifications(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
  const markAllNotificationsRead = () => setNotifications(prev => prev.map(item => ({ ...item, read: true })));

  return <div className="min-h-screen bg-[#F8F7F4] text-[#2D322E] flex flex-col font-sans selection:bg-[#5C7C66]/20 selection:text-[#2D4835]">
    <NavigationShell activeTab={activeTab} onTabChange={tab => tab === 'agents' ? setIsAgentsModalOpen(true) : setActiveTab(tab)} onLoadDemoData={() => { if (window.confirm('確定要載入 Demo 範例資料嗎？（這將重設為示範任務資料庫）')) loadDemoData(); }} onClearDemoData={() => { if (window.confirm('確定要清除所有示範資料嗎？（這將完整保留你的真實資料）')) clearDemoData(); }} onClearAllData={() => { if (window.confirm('確定要清空共享資料庫以測試「查無資料」真實防捏造模式嗎？')) clearAllData(); }} activeAgentsCount={3} totalAgentsCount={AGENT_REGISTRY.length} workTasksCount={workPendingCount} studyTasksCount={studyPendingCount} onOpenAgentsModal={() => setIsAgentsModalOpen(true)} onOpenManagerStatus={() => setIsManagerStatusOpen(true)} notifications={notifications} onReadNotification={markNotificationRead} onReadAllNotifications={markAllNotificationsRead} />
    <main className="flex-1 w-full pb-10">
      {activeTab === 'home' && <div className="mx-auto max-w-7xl px-2 sm:px-4 pt-6 space-y-6"><OwnerDashboard /><ManagerSupervision /><ManagerNextAction /></div>}
      {activeTab === 'chat' && <div className="mx-auto max-w-7xl px-2 sm:px-4 pt-3 space-y-3">
        {checklistMode && (
          <ManagerChecklist
            mode={checklistMode}
            workTasks={workTasks}
            studyTasks={studyTasks}
            onConfirm={(message) => sendMessage(message)}
          />
        )}
        <ChatWorkspace messages={messages} onSendMessage={handleChatSend} isLoading={isLoading} onApplyScheduleToToday={applyScheduleToToday} currentActiveAgents={currentActiveAgents} agentRegistry={AGENT_REGISTRY} />
      </div>}
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
