import React, { createContext, useContext, useState, useEffect } from 'react';
import { WorkProject, WorkTask, StudySubject, StudyTask, TodayTimeBlock, DiscussionRecord, Person, ChatMessage, AgentActivityLog, StructuredTimeBlock } from '../types';
import { DEMO_WORK_PROJECTS, DEMO_WORK_TASKS, DEMO_STUDY_SUBJECTS, DEMO_STUDY_TASKS, DEMO_TODAY_BLOCKS, INITIAL_USER_WORK_PROJECTS, INITIAL_USER_WORK_TASKS, INITIAL_USER_STUDY_SUBJECTS, INITIAL_USER_STUDY_TASKS, INITIAL_USER_TODAY_BLOCKS } from '../data/mockData';

export const INITIAL_PEOPLE: Person[] = [
  { id: 'p-1', name: '本人', role: '核心負責人 / 使用者', source: 'user', createdBy: 'user' },
  { id: 'p-2', name: 'Alex Chen', role: 'Tech Lead (技術主管)', source: 'demo', createdBy: 'system' },
  { id: 'p-3', name: 'Sarah Lin', role: 'PM (產品經理)', source: 'demo', createdBy: 'system' },
  { id: 'p-4', name: 'David Wang', role: 'DevOps 工程師', source: 'demo', createdBy: 'system' },
];

export const INITIAL_DISCUSSIONS: DiscussionRecord[] = [{ id: 'disc-user-1', timestamp: '2026-09-01 16:30', title: 'AI Agent 個人管理架構對齊', topic: '多 Agent 職責切分、Shared Data Store 與嚴格防捏造機制', summary: 'Manager Agent 負責調度，Work/Study Agents 僅分析 User Data，Demo Data 強制隔離。', participants: ['本人'], actionItems: ['建立統一 Shared Data Store', '驗證 Work Agent 查詢「設計 AI Agent 團隊架構」'], source: 'user', createdBy: 'user' }];
const INITIAL_WELCOME_MESSAGE: ChatMessage = { id: 'msg-welcome-1', sender: 'manager', text: `### 👋 你好！我是你的 AI 總管 (Manager Agent)\n\n我與 **Work Agent** 及 **Study Agent** 已經連線至**統一共享資料庫 (Shared Data Store)**。\n\n💡 **試試看詢問**：\n> 「幫我檢查目前有哪些工作需要優先處理？」`, timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }), delegatedAgents: ['work', 'study'] };

interface AppDataContextType {
  currentContext: CurrentContext; setCurrentContext: (context: CurrentContext) => void;
  workProjects: WorkProject[]; workTasks: WorkTask[]; studySubjects: StudySubject[]; studyTasks: StudyTask[]; discussionRecords: DiscussionRecord[]; people: Person[]; todayBlocks: TodayTimeBlock[]; messages: ChatMessage[]; activityLogs: AgentActivityLog[]; isLoading: boolean;
  addWorkTask: (task: Omit<WorkTask, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => void; updateWorkTask: (task: WorkTask) => void; deleteWorkTask: (taskId: string) => void; toggleWorkTask: (taskId: string) => void;
  addWorkProject: (project: Omit<WorkProject, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => void; updateWorkProject: (project: WorkProject) => void; deleteWorkProject: (projectId: string) => void;
  addStudyTask: (task: Omit<StudyTask, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => void; updateStudyTask: (task: StudyTask) => void; deleteStudyTask: (taskId: string) => void; toggleStudyTask: (taskId: string) => void;
  addStudySubject: (subject: Omit<StudySubject, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => void; updateStudySubject: (subject: StudySubject) => void; deleteStudySubject: (subjectId: string) => void;
  addTodayBlock: (block: Omit<TodayTimeBlock, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => void; updateTodayBlock: (block: TodayTimeBlock) => void; toggleTodayBlock: (blockId: string) => void; applyScheduleToToday: (blocks: StructuredTimeBlock[]) => void;
  addDiscussionRecord: (rec: Omit<DiscussionRecord, 'id' | 'source' | 'createdBy'>) => void; deleteDiscussionRecord: (id: string) => void; addPerson: (person: Omit<Person, 'id' | 'source' | 'createdBy'>) => void;
  sendMessage: (text: string) => Promise<void>; clearDemoData: () => void; loadDemoData: () => void; clearAllData: () => void;
}
export interface CurrentContext { workspaceId: string; projectId: string | null; }
const AppDataContext = createContext<AppDataContextType | null>(null);
function migrateItems<T extends { id: string; source?: 'user' | 'demo'; createdBy?: 'user' | 'system'; title?: string; projectName?: string; priority?: string; deadline?: string }>(items: T[]): T[] { return items.map(item => { const updated = { ...item }; if (!updated.source || !updated.createdBy) { const isDemo = updated.id.includes('demo') || !!updated.title?.includes('【Demo】') || !!updated.projectName?.includes('【Demo】'); updated.source = isDemo ? 'demo' : 'user'; updated.createdBy = isDemo ? 'system' : 'user'; } return updated; }); }

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentContext, setCurrentContext] = useState<CurrentContext>({ workspaceId: 'work', projectId: 'proj-user-ai-team' });
  const loadArray = <T,>(key: string, fallback: T[]): T[] => { try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : fallback; } catch { return fallback; } };
  const [workProjects, setWorkProjects] = useState<WorkProject[]>(() => migrateItems(loadArray('ait_work_projects_v2', [...INITIAL_USER_WORK_PROJECTS, ...DEMO_WORK_PROJECTS])));
  const [workTasks, setWorkTasks] = useState<WorkTask[]>(() => migrateItems(loadArray('ait_work_tasks_v2', [...INITIAL_USER_WORK_TASKS, ...DEMO_WORK_TASKS])));
  const [studySubjects, setStudySubjects] = useState<StudySubject[]>(() => migrateItems(loadArray('ait_study_subjects_v2', [...DEMO_STUDY_SUBJECTS])));
  const [studyTasks, setStudyTasks] = useState<StudyTask[]>(() => migrateItems(loadArray('ait_study_tasks_v2', [...INITIAL_USER_STUDY_TASKS, ...DEMO_STUDY_TASKS])));
  const [discussionRecords, setDiscussionRecords] = useState<DiscussionRecord[]>(() => loadArray('ait_discussion_records_v2', INITIAL_DISCUSSIONS));
  const [people, setPeople] = useState<Person[]>(() => loadArray('ait_people_v2', INITIAL_PEOPLE));
  const [todayBlocks, setTodayBlocks] = useState<TodayTimeBlock[]>(() => loadArray('ait_today_blocks_v2', DEMO_TODAY_BLOCKS));
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadArray('ait_messages_v2', [INITIAL_WELCOME_MESSAGE]));
  const [activityLogs, setActivityLogs] = useState<AgentActivityLog[]>(() => loadArray('ait_activity_logs_v2', []));
  const [isLoading, setIsLoading] = useState(false);
  const persist = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.error(`Failed to persist ${key}`, e); } };
  useEffect(() => persist('ait_work_projects_v2', workProjects), [workProjects]); useEffect(() => persist('ait_work_tasks_v2', workTasks), [workTasks]); useEffect(() => persist('ait_study_subjects_v2', studySubjects), [studySubjects]); useEffect(() => persist('ait_study_tasks_v2', studyTasks), [studyTasks]); useEffect(() => persist('ait_discussion_records_v2', discussionRecords), [discussionRecords]); useEffect(() => persist('ait_people_v2', people), [people]); useEffect(() => persist('ait_today_blocks_v2', todayBlocks), [todayBlocks]); useEffect(() => persist('ait_messages_v2', messages), [messages]); useEffect(() => persist('ait_activity_logs_v2', activityLogs), [activityLogs]);
  const addWorkTask = (task: any) => setWorkTasks(prev => [{ ...task, id: task.id || `w-task-user-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, source: task.source || 'user', createdBy: task.createdBy || 'user' }, ...prev]);
  const updateWorkTask = (task: WorkTask) => setWorkTasks(prev => prev.map(t => t.id === task.id ? { ...task, source: task.source || 'user', createdBy: task.createdBy || 'user' } : t));
  const deleteWorkTask = (id: string) => setWorkTasks(prev => prev.filter(t => t.id !== id));
  const toggleWorkTask = (id: string) => setWorkTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'completed' ? 'todo' : 'completed' } : t));
  const addWorkProject = (project: any) => setWorkProjects(prev => [...prev, { ...project, id: `proj-user-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, source: project.source || 'user', createdBy: project.createdBy || 'user' }]);
  const updateWorkProject = (project: WorkProject) => { setWorkProjects(prev => prev.map(p => p.id === project.id ? { ...project, source: project.source || 'user', createdBy: project.createdBy || 'user' } : p)); setWorkTasks(prev => prev.map(t => t.projectId === project.id ? { ...t, projectName: project.title } : t)); };
  const deleteWorkProject = (id: string) => setWorkProjects(prev => prev.filter(p => p.id !== id));
  const addStudyTask = (task: any) => setStudyTasks(prev => [{ ...task, id: task.id || `s-task-user-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, source: task.source || 'user', createdBy: task.createdBy || 'user' }, ...prev]);
  const updateStudyTask = (task: StudyTask) => setStudyTasks(prev => prev.map(t => t.id === task.id ? { ...task, source: task.source || 'user', createdBy: task.createdBy || 'user' } : t));
  const deleteStudyTask = (id: string) => setStudyTasks(prev => prev.filter(t => t.id !== id));
  const toggleStudyTask = (id: string) => setStudyTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'completed' ? 'todo' : 'completed' } : t));
  const addStudySubject = (subject: any) => setStudySubjects(prev => [...prev, { ...subject, id: `subj-user-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, source: subject.source || 'user', createdBy: subject.createdBy || 'user' }]);
  const updateStudySubject = (subject: StudySubject) => { setStudySubjects(prev => prev.map(s => s.id === subject.id ? { ...subject, source: subject.source || 'user', createdBy: subject.createdBy || 'user' } : s)); setStudyTasks(prev => prev.map(t => t.subjectId === subject.id ? { ...t, subjectName: subject.name } : t)); };
  const deleteStudySubject = (id: string) => setStudySubjects(prev => prev.filter(s => s.id !== id));
  const addTodayBlock = (block: any) => setTodayBlocks(prev => [...prev, { ...block, id: `block-user-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, source: block.source || 'user', createdBy: block.createdBy || 'user' }]);
  const updateTodayBlock = (block: TodayTimeBlock) => setTodayBlocks(prev => prev.map(b => b.id === block.id ? { ...block, source: block.source || 'user', createdBy: block.createdBy || 'user' } : b));
  const toggleTodayBlock = (id: string) => setTodayBlocks(prev => prev.map(b => b.id === id ? { ...b, completed: !b.completed } : b));
  const applyScheduleToToday = (blocks: StructuredTimeBlock[]) => setTodayBlocks(blocks.map((b, idx) => ({ id: `applied-block-user-${Date.now()}-${idx}`, timeRange: b.time, type: b.type, title: b.title, agentOwner: b.agentOwner, targetDurationMin: parseInt(b.duration) || 60, completed: false, notes: b.tips, source: 'user', createdBy: 'user' })));
  const addDiscussionRecord = (rec: any) => setDiscussionRecords(prev => [{ ...rec, id: `disc-user-${Date.now()}`, source: 'user', createdBy: 'user' }, ...prev]);
  const deleteDiscussionRecord = (id: string) => setDiscussionRecords(prev => prev.filter(d => d.id !== id));
  const addPerson = (person: any) => setPeople(prev => [...prev, { ...person, id: `person-user-${Date.now()}`, source: 'user', createdBy: 'user' }]);
  const clearDemoData = () => { setWorkProjects(p => p.filter(x => x.source === 'user')); setWorkTasks(p => p.filter(x => x.source === 'user')); setStudySubjects(p => p.filter(x => x.source === 'user')); setStudyTasks(p => p.filter(x => x.source === 'user')); setTodayBlocks(p => p.filter(x => x.source === 'user')); setDiscussionRecords(p => p.filter(x => x.source === 'user')); setPeople(p => p.filter(x => x.source === 'user')); };
  const loadDemoData = () => { setWorkProjects(p => [...p.filter(x => x.source === 'user'), ...DEMO_WORK_PROJECTS]); setWorkTasks(p => [...p.filter(x => x.source === 'user'), ...DEMO_WORK_TASKS]); setStudySubjects(p => [...p.filter(x => x.source === 'user'), ...DEMO_STUDY_SUBJECTS]); setStudyTasks(p => [...p.filter(x => x.source === 'user'), ...DEMO_STUDY_TASKS]); setTodayBlocks(p => [...p.filter(x => x.source === 'user'), ...DEMO_TODAY_BLOCKS]); };
  const clearAllData = () => { setWorkProjects([]); setWorkTasks([]); setStudySubjects([]); setStudyTasks([]); setTodayBlocks([]); setDiscussionRecords([]); setPeople([{ id: 'p-1', name: '本人', role: '本人 / 負責人', source: 'user', createdBy: 'user' }]); setActivityLogs([]); };
  const sendMessage = async (text: string) => {
    const userMsg: ChatMessage = { id: `user-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, sender: 'user', text, timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    try {
      const response = await fetch('/api/agent/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, context: { currentContext, workProjects, workTasks, studySubjects, studyTasks, discussionRecords, people, todayBlocks } }) });
      if (!response.ok) throw new Error(`Server returned status ${response.status}`);
      const data = await response.json();
      if (data.createdStudyTask) addStudyTask(data.createdStudyTask); else if (data.createdWorkTask) addWorkTask(data.createdWorkTask); else if (data.createdTaskPayload) addWorkTask(data.createdTaskPayload);
      if (data.updatedWorkTask) updateWorkTask(data.updatedWorkTask); else if (data.updatedTaskPayload) updateWorkTask(data.updatedTaskPayload); if (data.updatedStudyTask) updateStudyTask(data.updatedStudyTask);
      const managerMsg: ChatMessage = { id: `manager-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, sender: 'manager', text: data.finalSynthesisMarkdown || '已收到需求並完成多 Agent 協調處理。', timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }), intentType: data.intentType, delegatedAgents: data.delegatedAgents, activityLogs: data.activityLogs || [], workOutput: data.workOutput, studyOutput: data.studyOutput, proposedTimeBlocks: data.proposedTimeBlocks || [] };
      setMessages(prev => [...prev, managerMsg]);
      if (Array.isArray(data.activityLogs)) setActivityLogs(prev => [...data.activityLogs, ...prev].slice(0, 60));
    } catch (error) {
      console.error('Failed to call multi-agent chat:', error);
      setMessages(prev => [...prev, { id: `manager-err-${Date.now()}`, sender: 'manager', text: '### ⚠️ AI 團隊通訊服務提醒\n目前伺服器連線繁忙或發生短暫中斷。請確認資料庫狀態後再次嘗試。', timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }), delegatedAgents: ['work', 'study'] }]);
    } finally { setIsLoading(false); }
  };
  return <AppDataContext.Provider value={{ currentContext, setCurrentContext, workProjects, workTasks, studySubjects, studyTasks, discussionRecords, people, todayBlocks, messages, activityLogs, isLoading, addWorkTask, updateWorkTask, deleteWorkTask, toggleWorkTask, addWorkProject, updateWorkProject, deleteWorkProject, addStudyTask, updateStudyTask, deleteStudyTask, toggleStudyTask, addStudySubject, updateStudySubject, deleteStudySubject, addTodayBlock, updateTodayBlock, toggleTodayBlock, applyScheduleToToday, addDiscussionRecord, deleteDiscussionRecord, addPerson, sendMessage, clearDemoData, loadDemoData, clearAllData }}>{children}</AppDataContext.Provider>;
};
export const useAppData = () => { const context = useContext(AppDataContext); if (!context) throw new Error('useAppData must be used within AppDataProvider'); return context; };
