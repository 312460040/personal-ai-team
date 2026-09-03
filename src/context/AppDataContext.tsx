import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  WorkProject,
  WorkTask,
  StudySubject,
  StudyTask,
  TodayTimeBlock,
  DiscussionRecord,
  Person,
  ChatMessage,
  AgentActivityLog,
  StructuredTimeBlock,
} from '../types';
import {
  DEMO_WORK_PROJECTS,
  DEMO_WORK_TASKS,
  DEMO_STUDY_SUBJECTS,
  DEMO_STUDY_TASKS,
  DEMO_TODAY_BLOCKS,
  INITIAL_USER_WORK_PROJECTS,
  INITIAL_USER_WORK_TASKS,
  INITIAL_USER_STUDY_SUBJECTS,
  INITIAL_USER_STUDY_TASKS,
  INITIAL_USER_TODAY_BLOCKS,
} from '../data/mockData';

export const INITIAL_PEOPLE: Person[] = [
  { id: 'p-1', name: '本人', role: '核心負責人 / 使用者', source: 'user', createdBy: 'user' },
  { id: 'p-2', name: 'Alex Chen', role: 'Tech Lead (技術主管)', source: 'demo', createdBy: 'system' },
  { id: 'p-3', name: 'Sarah Lin', role: 'PM (產品經理)', source: 'demo', createdBy: 'system' },
  { id: 'p-4', name: 'David Wang', role: 'DevOps 工程師', source: 'demo', createdBy: 'system' },
];

export const INITIAL_DISCUSSIONS: DiscussionRecord[] = [
  {
    id: 'disc-user-1',
    timestamp: '2026-09-01 16:30',
    title: 'AI Agent 個人管理架構對齊',
    topic: '多 Agent 職責切分、Shared Data Store 與嚴格防捏造機制',
    summary: 'Manager Agent 負責調度，Work/Study Agents 僅分析 User Data，Demo Data 強制隔離。',
    participants: ['本人'],
    actionItems: ['建立統一 Shared Data Store', '驗證 Work Agent 查詢「設計 AI Agent 團隊架構」'],
    source: 'user',
    createdBy: 'user',
  },
];

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'msg-welcome-1',
  sender: 'manager',
  text: `### 👋 你好！我是你的 AI 總管 (Manager Agent)

我與 **Work Agent** 及 **Study Agent** 已經連線至**統一共享資料庫 (Shared Data Store)**。

#### 🛡️ 資料來源隔離與防捏造原則：
1. **Manager Agent (總管)**：接收需求後，分派查詢給專屬 Agent，並嚴格根據 Agent 回傳之**使用者真實資料 (User Data)** 做決策。
2. **Work Agent (工作管理員)**：預設**只能分析 \`source = "user"\`** 的工作專案與任務，Demo 示範資料絕不納入分析。
3. **Study Agent (課業管理員)**：預設**只能分析 \`source = "user"\`** 的學科與課業，絕不自行捏造不存在的科目或題型。

---

💡 **試試看詢問**：
> 「幫我檢查目前有哪些工作需要優先處理？」

Work Agent 會讀取你在資料庫中建立的真實任務（**設計 AI Agent 團隊架構**）並回傳分析！`,
  timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }),
  delegatedAgents: ['work', 'study'],
};

interface AppDataContextType {
  // Current Context

  currentContext: CurrentContext;
  setCurrentContext: (context: CurrentContext) => void;
  // Shared Data Store
  workProjects: WorkProject[];
  workTasks: WorkTask[];
  studySubjects: StudySubject[];
  studyTasks: StudyTask[];
  discussionRecords: DiscussionRecord[];
  people: Person[];
  todayBlocks: TodayTimeBlock[];
  messages: ChatMessage[];
  activityLogs: AgentActivityLog[];
  isLoading: boolean;

  // Work operations (Always source: 'user', createdBy: 'user')
  addWorkTask: (task: Omit<WorkTask, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => void;
  updateWorkTask: (task: WorkTask) => void;
  deleteWorkTask: (taskId: string) => void;
  toggleWorkTask: (taskId: string) => void;
  addWorkProject: (project: Omit<WorkProject, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => void;
  updateWorkProject: (project: WorkProject) => void;
  deleteWorkProject: (projectId: string) => void;

  // Study operations (Always source: 'user', createdBy: 'user')
  addStudyTask: (task: Omit<StudyTask, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => void;
  updateStudyTask: (task: StudyTask) => void;
  deleteStudyTask: (taskId: string) => void;
  toggleStudyTask: (taskId: string) => void;
  addStudySubject: (subject: Omit<StudySubject, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => void;
  updateStudySubject: (subject: StudySubject) => void;
  deleteStudySubject: (subjectId: string) => void;

  // Today operations
  addTodayBlock: (block: Omit<TodayTimeBlock, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => void;
  toggleTodayBlock: (blockId: string) => void;
  applyScheduleToToday: (blocks: StructuredTimeBlock[]) => void;

  // Discussion & People operations
  addDiscussionRecord: (rec: Omit<DiscussionRecord, 'id' | 'source' | 'createdBy'>) => void;
  deleteDiscussionRecord: (id: string) => void;
  addPerson: (person: Omit<Person, 'id' | 'source' | 'createdBy'>) => void;

  // Agent Communication
  sendMessage: (text: string) => Promise<void>;

  // Data management
  clearDemoData: () => void;
  loadDemoData: () => void;
  clearAllData: () => void;
}
export interface CurrentContext {
  workspaceId: string;
  projectId: string | null;
}
const AppDataContext = createContext<AppDataContextType | null>(null);

// Migration helper to ensure all items have explicit source and createdBy tags and maintain strict data fidelity
function migrateItems<T extends { id: string; source?: 'user' | 'demo'; createdBy?: 'user' | 'system'; title?: string; projectName?: string; priority?: string; deadline?: string }>(
  items: T[],
  defaultUserItems: T[]
): T[] {
  const result: T[] = items.map((item) => {
    let updatedItem = { ...item };
    if (!updatedItem.source || !updatedItem.createdBy) {
      const isDemo = updatedItem.id.includes('demo') || (updatedItem.title && updatedItem.title.includes('【Demo】')) || (updatedItem.projectName && updatedItem.projectName.includes('【Demo】'));
      updatedItem.source = isDemo ? ('demo' as const) : ('user' as const);
      updatedItem.createdBy = isDemo ? ('system' as const) : ('user' as const);
    }
    // Fix historical truncated deadlines or mis-inferred priorities in localStorage
    if (updatedItem.title && updatedItem.title.includes('整理 AI Team 下一階段開發計畫')) {
      updatedItem.priority = 'medium';
      if (!updatedItem.deadline || updatedItem.deadline === '2026-09-05') {
        updatedItem.deadline = '2026-09-05T18:00:00';
      }
    } else if (updatedItem.title && updatedItem.title.includes('測試任務參數保存')) {
      updatedItem.priority = 'medium';
      if (!updatedItem.deadline || updatedItem.deadline === '2026-09-10') {
        updatedItem.deadline = '2026-09-10T18:30:00';
      }
    } else if (updatedItem.title && updatedItem.title.includes('設計 AI Agent 團隊架構')) {
      updatedItem.priority = 'high';
      if (!updatedItem.deadline || updatedItem.deadline === '2026-09-03 18:00' || updatedItem.deadline === '2026-09-03') {
        updatedItem.deadline = '2026-09-03T18:00:00';
      }
    }
    return updatedItem;
  });


  return result;
}

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 0. Current Context
  const [currentContext, setCurrentContext] = useState<CurrentContext>({
    workspaceId: 'work',
    projectId: 'proj-user-ai-team',
  });

  // 1. Unified Shared Data States with Strict Source Tagging
  const [workProjects, setWorkProjects] = useState<WorkProject[]>(() => {
    try {
      const saved = localStorage.getItem('ait_work_projects_v2');
      if (saved) {
        return migrateItems<WorkProject>(JSON.parse(saved), INITIAL_USER_WORK_PROJECTS);
      }
    } catch (e) {
      console.error('Error reading ait_work_projects_v2', e);
    }
    return [...INITIAL_USER_WORK_PROJECTS, ...DEMO_WORK_PROJECTS];
  });

  const [workTasks, setWorkTasks] = useState<WorkTask[]>(() => {
    try {
      const saved = localStorage.getItem('ait_work_tasks_v2');
      if (saved) {
        return migrateItems<WorkTask>(JSON.parse(saved), INITIAL_USER_WORK_TASKS);
      }
    } catch (e) {
      console.error('Error reading ait_work_tasks_v2', e);
    }
    return [...INITIAL_USER_WORK_TASKS, ...DEMO_WORK_TASKS];
  });

  const [studySubjects, setStudySubjects] = useState<StudySubject[]>(() => {
    try {
      const saved = localStorage.getItem('ait_study_subjects_v2');
      if (saved) {
        return migrateItems<StudySubject>(JSON.parse(saved), INITIAL_USER_STUDY_SUBJECTS);
      }
    } catch (e) {
      console.error('Error reading ait_study_subjects_v2', e);
    }
    return [...DEMO_STUDY_SUBJECTS];
  });

  const [studyTasks, setStudyTasks] = useState<StudyTask[]>(() => {
    try {
      const saved = localStorage.getItem('ait_study_tasks_v2');
      if (saved) {
        return migrateItems<StudyTask>(JSON.parse(saved), INITIAL_USER_STUDY_TASKS);
      }
    } catch (e) {
      console.error('Error reading ait_study_tasks_v2', e);
    }
    return [...DEMO_STUDY_TASKS];
  });

  const [discussionRecords, setDiscussionRecords] = useState<DiscussionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ait_discussion_records_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading ait_discussion_records_v2', e);
    }
    return INITIAL_DISCUSSIONS;
  });

  const [people, setPeople] = useState<Person[]>(() => {
    try {
      const saved = localStorage.getItem('ait_people_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading ait_people_v2', e);
    }
    return INITIAL_PEOPLE;
  });

  const [todayBlocks, setTodayBlocks] = useState<TodayTimeBlock[]>(() => {
    try {
      const saved = localStorage.getItem('ait_today_blocks_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading ait_today_blocks_v2', e);
    }
    return DEMO_TODAY_BLOCKS;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('ait_messages_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading ait_messages_v2', e);
    }
    return [INITIAL_WELCOME_MESSAGE];
  });

  const [activityLogs, setActivityLogs] = useState<AgentActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem('ait_activity_logs_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading ait_activity_logs_v2', e);
    }
    return [
      {
        id: 'init-act-1',
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        stepIndex: 1,
        fromAgent: 'manager',
        action: '系統啟動與資料來源隔離',
        summary: 'Manager Agent：已連結至統一共享資料來源 (Shared Data Store)',
        detail: '嚴格落實 User Data 與 Demo Data 隔離。Work/Study Agents 預設僅分析 source === "user" 之真實資料。',
        status: 'completed',
        durationMs: 35,
      },
    ];
  });

  const [isLoading, setIsLoading] = useState(false);

  // 2. Sync to LocalStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('ait_work_projects_v2', JSON.stringify(workProjects));
  }, [workProjects]);

  useEffect(() => {
    localStorage.setItem('ait_work_tasks_v2', JSON.stringify(workTasks));
  }, [workTasks]);

  useEffect(() => {
    localStorage.setItem('ait_study_subjects_v2', JSON.stringify(studySubjects));
  }, [studySubjects]);

  useEffect(() => {
    localStorage.setItem('ait_study_tasks_v2', JSON.stringify(studyTasks));
  }, [studyTasks]);

  useEffect(() => {
    localStorage.setItem('ait_discussion_records_v2', JSON.stringify(discussionRecords));
  }, [discussionRecords]);

  useEffect(() => {
    localStorage.setItem('ait_people_v2', JSON.stringify(people));
  }, [people]);

  useEffect(() => {
    localStorage.setItem('ait_today_blocks_v2', JSON.stringify(todayBlocks));
  }, [todayBlocks]);

  useEffect(() => {
    localStorage.setItem('ait_messages_v2', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('ait_activity_logs_v2', JSON.stringify(activityLogs));
  }, [activityLogs]);

  // 3. Work Operations (ALWAYS source: 'user', createdBy: 'user')
  const addWorkTask = (task: Omit<WorkTask, 'id' | 'source' | 'createdBy'> & { id?: string; source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => {
    const newTask: WorkTask = {
      ...task,
      id: task.id || `w-task-user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      source: task.source || 'user',
      createdBy: task.createdBy || 'user',
    };
    setWorkTasks((prev) => [newTask, ...prev]);
  };

  const updateWorkTask = (task: WorkTask) => {
    setWorkTasks((prev) => prev.map((t) => (t.id === task.id ? { ...task, source: task.source || 'user', createdBy: task.createdBy || 'user' } : t)));
  };

  const deleteWorkTask = (taskId: string) => {
    setWorkTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const toggleWorkTask = (taskId: string) => {
    setWorkTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === 'completed' ? 'todo' : 'completed' }
          : t
      )
    );
  };

  const addWorkProject = (project: Omit<WorkProject, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => {
    const newProj: WorkProject = {
      ...project,
      id: `proj-user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      source: project.source || 'user',
      createdBy: project.createdBy || 'user',
    };
    setWorkProjects((prev) => [...prev, newProj]);
  };

  const updateWorkProject = (project: WorkProject) => {
    setWorkProjects((prev) => prev.map((p) => (p.id === project.id ? { ...project, source: project.source || 'user', createdBy: project.createdBy || 'user' } : p)));
    setWorkTasks((prev) =>
      prev.map((t) => (t.projectId === project.id ? { ...t, projectName: project.title } : t))
    );
  };

  const deleteWorkProject = (projectId: string) => {
    setWorkProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  // 4. Study Operations (ALWAYS source: 'user', createdBy: 'user')
  const addStudyTask = (task: Omit<StudyTask, 'id' | 'source' | 'createdBy'> & { id?: string; source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => {
    const newTask: StudyTask = {
      ...task,
      id: task.id || `s-task-user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      source: task.source || 'user',
      createdBy: task.createdBy || 'user',
    };
    setStudyTasks((prev) => [newTask, ...prev]);
  };

  const updateStudyTask = (task: StudyTask) => {
    setStudyTasks((prev) => prev.map((t) => (t.id === task.id ? { ...task, source: task.source || 'user', createdBy: task.createdBy || 'user' } : t)));
  };

  const deleteStudyTask = (taskId: string) => {
    setStudyTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const toggleStudyTask = (taskId: string) => {
    setStudyTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === 'completed' ? 'todo' : 'completed' }
          : t
      )
    );
  };

  const addStudySubject = (subject: Omit<StudySubject, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => {
    const newSubj: StudySubject = {
      ...subject,
      id: `subj-user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      source: subject.source || 'user',
      createdBy: subject.createdBy || 'user',
    };
    setStudySubjects((prev) => [...prev, newSubj]);
  };

  const updateStudySubject = (subject: StudySubject) => {
    setStudySubjects((prev) => prev.map((s) => (s.id === subject.id ? { ...subject, source: subject.source || 'user', createdBy: subject.createdBy || 'user' } : s)));
    setStudyTasks((prev) =>
      prev.map((t) => (t.subjectId === subject.id ? { ...t, subjectName: subject.name } : t))
    );
  };

  const deleteStudySubject = (subjectId: string) => {
    setStudySubjects((prev) => prev.filter((s) => s.id !== subjectId));
  };

  // 5. Today Operations
  const addTodayBlock = (block: Omit<TodayTimeBlock, 'id' | 'source' | 'createdBy'> & { source?: 'user' | 'demo'; createdBy?: 'user' | 'system' }) => {
    const newBlock: TodayTimeBlock = {
      ...block,
      id: `block-user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      source: block.source || 'user',
      createdBy: block.createdBy || 'user',
    };
    setTodayBlocks((prev) => [...prev, newBlock]);
  };

  const toggleTodayBlock = (blockId: string) => {
    setTodayBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, completed: !b.completed } : b))
    );
  };

  const applyScheduleToToday = (blocks: StructuredTimeBlock[]) => {
    const newTodayBlocks: TodayTimeBlock[] = blocks.map((b, idx) => ({
      id: `applied-block-user-${Date.now()}-${idx}`,
      timeRange: b.time,
      type: b.type,
      title: b.title,
      agentOwner: b.agentOwner,
      targetDurationMin: parseInt(b.duration) || 60,
      completed: false,
      notes: b.tips,
      source: 'user',
      createdBy: 'user',
    }));
    setTodayBlocks(newTodayBlocks);
  };

  // 6. Discussion & People Operations
  const addDiscussionRecord = (rec: Omit<DiscussionRecord, 'id' | 'source' | 'createdBy'>) => {
    const newRec: DiscussionRecord = {
      ...rec,
      id: `disc-user-${Date.now()}`,
      source: 'user',
      createdBy: 'user',
    };
    setDiscussionRecords((prev) => [newRec, ...prev]);
  };

  const deleteDiscussionRecord = (id: string) => {
    setDiscussionRecords((prev) => prev.filter((d) => d.id !== id));
  };

  const addPerson = (person: Omit<Person, 'id' | 'source' | 'createdBy'>) => {
    const newPerson: Person = {
      ...person,
      id: `person-user-${Date.now()}`,
      source: 'user',
      createdBy: 'user',
    };
    setPeople((prev) => [...prev, newPerson]);
  };

  // 7. Clear Demo Data ONLY (Preserves all source: "user" data)
  const clearDemoData = () => {
    setWorkProjects((prev) => prev.filter((p) => p.source === 'user'));
    setWorkTasks((prev) => prev.filter((t) => t.source === 'user'));
    setStudySubjects((prev) => prev.filter((s) => s.source === 'user'));
    setStudyTasks((prev) => prev.filter((t) => t.source === 'user'));
    setTodayBlocks((prev) => prev.filter((b) => b.source === 'user'));
    setDiscussionRecords((prev) => prev.filter((d) => d.source === 'user'));
    setPeople((prev) => prev.filter((p) => p.source === 'user'));

    setActivityLogs((prev) => [
      {
        id: `clear-demo-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        stepIndex: 1,
        fromAgent: 'manager',
        action: '清除所有示範資料',
        summary: 'Manager Agent：已清除所有 Demo 示範資料，完整保留使用者真實資料 (User Data)',
        detail: '移除 demo projects/tasks/subjects。使用者建立之「我的資料」不受任何影響。',
        status: 'completed',
        durationMs: 25,
      },
      ...prev,
    ]);
  };

  // Load Demo Data
  const loadDemoData = () => {
    setWorkProjects((prev) => {
      const userOnly = prev.filter((p) => p.source === 'user');
      return [...userOnly, ...DEMO_WORK_PROJECTS];
    });
    setWorkTasks((prev) => {
      const userOnly = prev.filter((t) => t.source === 'user');
      return [...userOnly, ...DEMO_WORK_TASKS];
    });
    setStudySubjects((prev) => {
      const userOnly = prev.filter((s) => s.source === 'user');
      return [...userOnly, ...DEMO_STUDY_SUBJECTS];
    });
    setStudyTasks((prev) => {
      const userOnly = prev.filter((t) => t.source === 'user');
      return [...userOnly, ...DEMO_STUDY_TASKS];
    });
    setTodayBlocks((prev) => {
      const userOnly = prev.filter((b) => b.source === 'user');
      return [...userOnly, ...DEMO_TODAY_BLOCKS];
    });

    setActivityLogs((prev) => [
      {
        id: `load-demo-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        stepIndex: 1,
        fromAgent: 'manager',
        action: '載入 Demo 示範資料',
        summary: 'Manager Agent：已將示範資料標記為 source = "demo" 載入資料庫',
        detail: '載入示範專案與任務。Agent 依規範將自動過濾，不影響使用者資料決策。',
        status: 'completed',
        durationMs: 30,
      },
      ...prev,
    ]);
  };

  // Clear All Data
  const clearAllData = () => {
    setWorkProjects([]);
    setWorkTasks([]);
    setStudySubjects([]);
    setStudyTasks([]);
    setTodayBlocks([]);
    setDiscussionRecords([]);
    setPeople([{ id: 'p-1', name: '本人', role: '本人 / 負責人', source: 'user', createdBy: 'user' }]);
    setActivityLogs([
      {
        id: `clear-all-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        stepIndex: 1,
        fromAgent: 'manager',
        action: '清空共享資料庫',
        summary: 'Manager Agent：已清空全部資料庫 (包含 User Data 與 Demo Data)',
        detail: '資料庫為全空狀態，可用於測試極限防捏造邊界。',
        status: 'completed',
        durationMs: 25,
      },
    ]);
  };

  // 8. Agent Communication
  const sendMessage = async (text: string) => {
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: {
            currentContext,

            workProjects,
            workTasks,
            studySubjects,
            studyTasks,
            discussionRecords,
            people,
            todayBlocks,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      // If server returned created task commands (data creation instruction)
      if (data.createdStudyTask) {
        addStudyTask(data.createdStudyTask);
      } else if (data.createdWorkTask) {
        addWorkTask(data.createdWorkTask);
      } else if (data.createdTaskPayload) {
        addWorkTask(data.createdTaskPayload);
      }

      // If server returned updated task commands (data modification instruction)
      if (data.updatedWorkTask) {
        updateWorkTask(data.updatedWorkTask);
      } else if (data.updatedTaskPayload) {
        updateWorkTask(data.updatedTaskPayload);
      }

      if (data.updatedStudyTask) {
        updateStudyTask(data.updatedStudyTask);
      }

      const managerMsgId = `manager-${Date.now()}`;
      const managerMsg: ChatMessage = {
        id: managerMsgId,
        sender: 'manager',
        text: data.finalSynthesisMarkdown || '已收到需求並完成多 Agent 協調處理。',
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }),
        intentType: data.intentType,
        delegatedAgents: data.delegatedAgents,
        activityLogs: data.activityLogs || [],
        workOutput: data.workOutput,
        studyOutput: data.studyOutput,
        proposedTimeBlocks: data.proposedTimeBlocks || [],
      };

      setMessages((prev) => [...prev, managerMsg]);

      if (data.activityLogs && Array.isArray(data.activityLogs)) {
        setActivityLogs((prev) => [...data.activityLogs, ...prev].slice(0, 60));
      }
    } catch (error) {
      console.error('Failed to call multi-agent chat:', error);
      const fallbackMsg: ChatMessage = {
        id: `manager-err-${Date.now()}`,
        sender: 'manager',
        text: `### ⚠️ AI 團隊通訊服務提醒
目前伺服器連線繁忙或發生短暫中斷。請確認資料庫狀態後再次嘗試。`,
        timestamp: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }),
        delegatedAgents: ['work', 'study'],
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppDataContext.Provider
      value={{
        currentContext,
        setCurrentContext,
        workProjects,
        workTasks,
        studySubjects,
        studyTasks,
        discussionRecords,
        people,
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
        addDiscussionRecord,
        deleteDiscussionRecord,
        addPerson,
        sendMessage,
        clearDemoData,
        loadDemoData,
        clearAllData,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
