import React, { useEffect } from 'react';

type StudyTaskLike = {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  type: 'study_task' | 'assignment' | 'exam';
  chapter?: string;
  deadline: string;
  progress: number;
  estimatedHours: number;
  priority: 'high' | 'medium' | 'low';
  difficulty?: 'hard' | 'medium' | 'easy';
  status: 'todo' | 'in_progress' | 'completed' | 'delayed';
  supervisionNote?: string;
  notes?: string;
  source: 'user' | 'demo';
  createdBy?: 'user' | 'system';
};

const PROCESSED_KEY = 'ait_research_task_bridge_processed_v2';
const STUDY_TASKS_KEY = 'ait_study_tasks_v2';
const MESSAGES_KEY = 'ait_messages_v2';

function normalizeStudyTask(raw: any): StudyTaskLike | null {
  if (!raw?.id || !raw?.title) return null;
  return {
    id: String(raw.id),
    subjectId: String(raw.subjectId || 'subj-research-unassigned'),
    subjectName: String(raw.subjectName || '研究／專題（待歸類）'),
    title: String(raw.title),
    type: raw.type === 'assignment' || raw.type === 'exam' ? raw.type : 'study_task',
    chapter: raw.chapter || '研究／專題',
    deadline: String(raw.deadline || ''),
    progress: Number(raw.progress || 0),
    estimatedHours: Number(raw.estimatedHours || 1),
    priority: raw.priority === 'high' || raw.priority === 'low' ? raw.priority : 'medium',
    difficulty: raw.difficulty === 'hard' || raw.difficulty === 'easy' ? raw.difficulty : 'medium',
    status: raw.status === 'completed' || raw.status === 'in_progress' || raw.status === 'delayed' ? raw.status : 'todo',
    supervisionNote: raw.supervisionNote,
    notes: raw.notes || '由 Manager Agent 建立的研究／課業任務',
    source: 'user',
    createdBy: 'user',
  };
}

function isResearchTask(text: string) {
  return /研究|研究任務|論文|文獻|研究計畫|研究專題/i.test(text);
}

function parseSingleCreatedTask(text: string): StudyTaskLike | null {
  if (!isResearchTask(text)) return null;
  const title = text.match(/(?:任務名稱|任務名稱：)\s*\*?\*?([^\n*]+)/i)?.[1]?.trim();
  if (!title) return null;
  const priorityRaw = text.match(/優先順序[^：:]*[：:]\s*`?\s*(high|medium|low)/i)?.[1]?.toLowerCase();
  const hoursRaw = text.match(/預估工時[^：:]*[：:]\s*\*?\*?(\d+(?:\.\d+)?)/i)?.[1];
  const deadline = text.match(/截止時間[^：:]*[：:]\s*`?([^`\n]+)`?/i)?.[1]?.trim() || '';
  const id = text.match(/任務 ID[^`]*`([^`]+)`/i)?.[1] || `s-task-research-${Date.now()}`;
  return normalizeStudyTask({
    id,
    title: title.replace(/\*+$/g, '').trim(),
    priority: priorityRaw || 'medium',
    estimatedHours: hoursRaw ? Number(hoursRaw) : 1,
    deadline,
    subjectId: 'subj-research-unassigned',
    subjectName: '研究／專題（待歸類）',
    notes: '由 Manager Agent 建立的研究任務；待指定科目後可重新歸類。',
  });
}

function consumeManagerTasks() {
  let messages: any[] = [];
  let tasks: StudyTaskLike[] = [];
  try {
    messages = JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]');
    tasks = JSON.parse(localStorage.getItem(STUDY_TASKS_KEY) || '[]');
  } catch {
    return false;
  }

  if (!Array.isArray(messages) || !Array.isArray(tasks)) return false;
  const processed = new Set<string>(JSON.parse(localStorage.getItem(PROCESSED_KEY) || '[]'));
  const existingIds = new Set(tasks.map((task: any) => task?.id));
  const additions: StudyTaskLike[] = [];

  for (const message of messages) {
    if (message?.sender !== 'manager' || typeof message?.text !== 'string') continue;
    const marker = message.text.match(/<!--AIT_TASK_BATCH:([\s\S]*?)-->/);
    if (marker) {
      const key = `${message.id}:${marker[1]}`;
      if (!processed.has(key)) {
        try {
          const batch = JSON.parse(marker[1]);
          for (const raw of Array.isArray(batch?.study) ? batch.study : []) {
            const task = normalizeStudyTask(raw);
            if (task && !existingIds.has(task.id)) {
              additions.push(task);
              existingIds.add(task.id);
            }
          }
        } catch {
          // Ignore malformed marker; normal chat state remains untouched.
        }
        processed.add(key);
      }
      continue;
    }

    // Compatibility path for the older singular creation response.
    const key = `${message.id}:single-research`;
    if (!processed.has(key)) {
      const task = parseSingleCreatedTask(message.text);
      if (task && !existingIds.has(task.id)) {
        additions.push(task);
        existingIds.add(task.id);
      }
      processed.add(key);
    }
  }

  if (!additions.length) {
    localStorage.setItem(PROCESSED_KEY, JSON.stringify([...processed].slice(-300)));
    return false;
  }

  localStorage.setItem(STUDY_TASKS_KEY, JSON.stringify([...additions, ...tasks]));
  localStorage.setItem(PROCESSED_KEY, JSON.stringify([...processed].slice(-300)));
  return true;
}

/**
 * This bridge is mounted outside AppDataProvider because Manager responses can
 * arrive in a different response shape than AppDataContext historically handled.
 * It writes the canonical localStorage Study Task store and reloads once so the
 * provider hydrates the new task immediately. No duplicate is created because
 * task IDs and processed message markers are checked first.
 */
export const ResearchTaskBridge: React.FC = () => {
  useEffect(() => {
    let reloading = false;
    const run = () => {
      if (reloading) return;
      try {
        if (consumeManagerTasks()) {
          reloading = true;
          window.location.reload();
        }
      } catch (error) {
        console.warn('[ResearchTaskBridge] failed to sync Manager task:', error);
      }
    };

    run();
    const timer = window.setInterval(run, 800);
    return () => window.clearInterval(timer);
  }, []);

  return null;
};
