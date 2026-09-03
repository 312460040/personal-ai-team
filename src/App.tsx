import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { AiTeamChat } from './components/AiTeamChat';
import OwnerDashboard from './components/OwnerDashboard';
import { AgentActivityView } from './components/AgentActivityView';
import { WorkView } from './components/WorkView';
import { StudyView } from './components/StudyView';
import { TodayView } from './components/TodayView';
import { AgentRegistryModal } from './components/AgentRegistryModal';
import { AGENT_REGISTRY } from './data/agentRegistry';
import { AppDataProvider, useAppData } from './context/AppDataContext';

function AppMainContent() {
  const [activeTab, setActiveTab] = useState<'chat' | 'activity' | 'work' | 'study' | 'today' | 'agents'>('chat');
  const [isAgentsModalOpen, setIsAgentsModalOpen] = useState(false);

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
    addTodayBlock,
    toggleTodayBlock,
    applyScheduleToToday,
    sendMessage,
    loadDemoData,
    clearDemoData,
    clearAllData,
  } = useAppData();

  const handleAskAgentFromTab = (prompt: string) => {
    setActiveTab('chat');
    sendMessage(prompt);
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#2D322E] flex flex-col font-sans selection:bg-[#5C7C66]/20 selection:text-[#2D4835]">
      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'agents') {
            setIsAgentsModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        onLoadDemoData={() => {
          if (window.confirm('確定要載入 Demo 範例資料嗎？（這將重設為示範任務資料庫）')) {
            loadDemoData();
          }
        }}
        onClearDemoData={() => {
          if (window.confirm('確定要清除所有示範資料嗎？（將完整保留你的真實資料）')) {
            clearDemoData();
          }
        }}
        onClearAllData={() => {
          if (window.confirm('確定要清空共享資料庫以測試「查無資料」真實防捏造模式嗎？')) {
            clearAllData();
          }
        }}
        activeAgentsCount={3}
        totalAgentsCount={AGENT_REGISTRY.length}
        workTasksCount={workTasks.filter((t) => t.status !== 'completed').length}
        studyTasksCount={studyTasks.filter((t) => t.status !== 'completed').length}
        onOpenAgentsModal={() => setIsAgentsModalOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1 w-full pb-10">
        {activeTab === 'chat' && (
          <OwnerDashboard />
        )}

        {activeTab === 'activity' && (
          <AgentActivityView
            activityLogs={activityLogs}
            onTriggerDemoFlow={() => {
              setActiveTab('chat');
              sendMessage('幫我檢查目前有哪些工作需要優先處理？');
            }}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'work' && (
          <WorkView
            projects={workProjects}
            tasks={workTasks}
            onToggleTask={toggleWorkTask}
            onAddTask={addWorkTask}
            onUpdateTask={updateWorkTask}
            onDeleteTask={deleteWorkTask}
            onAddProject={addWorkProject}
            onUpdateProject={updateWorkProject}
            onDeleteProject={deleteWorkProject}
            onAskAgentAboutWork={handleAskAgentFromTab}
            onClearDemoData={clearDemoData}
          />
        )}

        {activeTab === 'study' && (
          <StudyView
            subjects={studySubjects}
            tasks={studyTasks}
            onToggleTask={toggleStudyTask}
            onAddTask={addStudyTask}
            onUpdateTask={updateStudyTask}
            onDeleteTask={deleteStudyTask}
            onAddSubject={addStudySubject}
            onUpdateSubject={updateStudySubject}
            onDeleteSubject={deleteStudySubject}
            onAskAgentAboutStudy={handleAskAgentFromTab}
            onClearDemoData={clearDemoData}
          />
        )}

        {activeTab === 'today' && (
          <TodayView
            blocks={todayBlocks}
            onToggleBlock={toggleTodayBlock}
            onAddBlock={addTodayBlock}
            onAskManagerToReschedule={() => {
              setActiveTab('chat');
              sendMessage('檢視我今天現有的工作與課業時間塊，幫我重新規劃最佳化時間分配。');
            }}
          />
        )}
      </main>

      {/* Extensible Agent Registry Modal */}
      <AgentRegistryModal
        isOpen={isAgentsModalOpen}
        onClose={() => setIsAgentsModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <AppMainContent />
    </AppDataProvider>
  );
}
