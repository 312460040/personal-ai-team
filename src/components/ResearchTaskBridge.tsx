import React, { useEffect } from 'react';

type StudySubjectLike = {
  id: string;
  name: string;
  code: string;
  credits: number;
  progress: number;
  status: 'in_progress' | 'completed' | 'exam_prep';
  focusTopics: string[];
  teacherOrNotes: string;
  source: 'user' | 'demo';
};

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

const PROCESSED_KEY = 'ait_research_task_bridge_processed_v5';
const STUDY_SUBJECTS_KEY = 'ait_study_subjects_v2';
const STUDY_TASKS_KEY = 'ait_study_tasks_v2';
const MESSAGES_KEY = 'ait_messages_v2';

function normalizeSubject(raw: any): StudySubjectLike | null {
  if (!raw?.name) return null;
  return {
    id: String(raw.id || `subj-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    name: String(raw.name).trim(),
    code: String(raw.code || 'RESEARCH'),
    credits: Number(raw.credits || 0),
    progress: Number(raw.progress || 0),
    status: raw.status === 'completed' || raw.status === 'exam_prep' ? raw.status : 'in_progress',
    focusTopics: Array.isArray(raw.focusTopics) ? raw.focusTopics : [],
    teacherOrNotes: String(raw.teacherOrNotes || '由 Manager Agent 建立的研究科目。'),
    source: 'user',
  };
}

function normalizeStudyTask(raw: any, fallbackSubject?: StudySubjectLike | null): StudyTaskLike | null {
  if (!raw?.title) return null;
  return {
    id: String(raw.id || `s-task-research-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    subjectId: String(raw.subjectId || fallbackSubject?.id || 'subj-research-unassigned'),
    subjectName: String(raw.subjectName || fallbackSubject?.name || '研究／專題（待歸類）'),
    title: String(raw.title).trim(),
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

function parseSubject(text: string): StudySubjectLike | null {
  const direct = text.match(/(?:建立|新增|創建)(?:了)?\s*[「『"“]?([^「」『』"”\n]+?)[」』"”]?\s*科目/i);
  if (direct?.[1]) return normalizeSubject({ name: direct[1].trim().replace(/^\*+|\*+$/g, '') });
  const alternate = text.match(/(?:建立|新增|創建)[^\n]{0,40}[「『"“]([^「」『』"”]+)[」』"”]\s*科目/i);
  if (alternate?.[1]) return normalizeSubject({ name: alternate[1].trim() });
  return null;
}

function parseGroupedResearchTasks(text: string, subject: StudySubjectLike | null): StudyTaskLike[] {
  if (!isResearchTask(text)) return [];
  const section = text.match(/新增(?:了)?\s*(.{0,500}?)\s*(?:兩|二|三|四|五|[0-9]+)\s*項研究任務/i)?.[1] || '';
  const quoted = [...section.matchAll(/[「『"“]([^「」『』"”\n]+)[」』"”]/g)].map((m) => m[1].trim()).filter(Boolean);
  if (!quoted.length) return [];
  return quoted.map((title, index) => normalizeStudyTask({
    id: `s-task-manager-${Date.now()}-${index}`,
    title,
    subjectId: subject?.id,
    subjectName: subject?.name,
    notes: '由 Manager Agent 在研究科目中建立的研究任務。',
  }, subject)).filter(Boolean) as StudyTaskLike[];
}

function parseSingleCreatedTask(text: string, subject: StudySubjectLike | null): StudyTaskLike | null {
  if (!isResearchTask(text)) return null;
  const title = text.match(/任務名稱[^：:\n]*[：:]\s*\*?\*?([^\n*]+?)(?:\*+)?\s*$/im)?.[1]?.trim();
  if (!title) return null;
  const priorityRaw = text.match(/優先順序[^：:]*[：:]\s*`?\s*(high|medium|low)/i)?.[1]?.toLowerCase();
  const hoursRaw = text.match(/預估工時[^：:]*[：:]\s*\*?\*?(\d+(?:\.\d+)?)/i)?.[1];
  const deadline = text.match(/截止時間[^：:]*[：:]\s*`?([^`\n]+)`?/i)?.[1]?.trim() || '';
  const id = text.match(/任務 ID[^`]*`([^`]+)`/i)?.[1] || `s-task-research-${Date.now()}`;
  return normalizeStudyTask({ id, title, priority: priorityRaw || 'medium', estimatedHours: hoursRaw ? Number(hoursRaw) : 1, deadline, subjectId: subject?.id, subjectName: subject?.name, notes: '由 Manager Agent 建立的研究任務。' }, subject);
}

function readStore<T>(key: string): T[] | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function persistAndVerify(newSubjects: StudySubjectLike[], subjects: StudySubjectLike[], newTasks: StudyTaskLike[], tasks: StudyTaskLike[]) {
  const nextSubjects = [...newSubjects, ...subjects];
  const nextTasks = [...newTasks, ...tasks];
  localStorage.setItem(STUDY_SUBJECTS_KEY, JSON.stringify(nextSubjects));
  localStorage.setItem(STUDY_TASKS_KEY, JSON.stringify(nextTasks));

  const verifiedSubjects = readStore<StudySubjectLike>(STUDY_SUBJECTS_KEY) || [];
  const verifiedTasks = readStore<StudyTaskLike>(STUDY_TASKS_KEY) || [];
  const subjectIds = new Set(verifiedSubjects.map((item) => String(item.id)));
  const taskIds = new Set(verifiedTasks.map((item) => String(item.id)));
  const subjectsVerified = newSubjects.every((item) => subjectIds.has(String(item.id)));
  const tasksVerified = newTasks.every((item) => taskIds.has(String(item.id)));
  return subjectsVerified && tasksVerified;
}

function consumeManagerStudyData() {
  const messages = readStore<any>(MESSAGES_KEY);
  const subjects = readStore<StudySubjectLike>(STUDY_SUBJECTS_KEY);
  const tasks = readStore<StudyTaskLike>(STUDY_TASKS_KEY);
  if (!messages || !subjects || !tasks) return false;

  const processed = new Set<string>(readStore<string>(PROCESSED_KEY) || []);
  const subjectNames = new Set(subjects.map((s) => String(s?.name || '').trim()));
  const taskIds = new Set(tasks.map((t) => String(t?.id)));
  const newSubjects: StudySubjectLike[] = [];
  const newTasks: StudyTaskLike[] = [];

  for (const message of messages) {
    if (message?.sender !== 'manager' || typeof message?.text !== 'string') continue;
    const text = message.text;

    const batch = text.match(/<!--AIT_TASK_BATCH:([\s\S]*?)-->/);
    if (batch) {
      const key = `${message.id}:${batch[1]}`;
      if (processed.has(key)) continue;
      try {
        const parsed = JSON.parse(batch[1]);
        for (const raw of Array.isArray(parsed?.study) ? parsed.study : []) {
          let fallbackSubject: StudySubjectLike | null = null;
          const subjectName = String(raw?.subjectName || '').trim();
          if (subjectName) {
            fallbackSubject = normalizeSubject({ name: subjectName });
            if (fallbackSubject && !subjectNames.has(subjectName)) {
              newSubjects.push(fallbackSubject);
              subjectNames.add(subjectName);
            } else {
              fallbackSubject = subjects.find((s) => String(s.name).trim() === subjectName) || fallbackSubject;
            }
          }
          const task = normalizeStudyTask(raw, fallbackSubject);
          if (task && !taskIds.has(task.id)) { newTasks.push(task); taskIds.add(task.id); }
        }
      } catch {
        // Leave the original message untouched when its batch is malformed.
        continue;
      }
      if (persistAndVerify(newSubjects, subjects, newTasks, tasks)) {
        processed.add(key);
        localStorage.setItem(PROCESSED_KEY, JSON.stringify([...processed].slice(-300)));
        return true;
      }
      return false;
    }

    const key = `${message.id}:manager-study-v5`;
    if (processed.has(key)) continue;

    const subject = parseSubject(text);
    let effectiveSubject = subject;
    if (subject && !subjectNames.has(subject.name)) {
      newSubjects.push(subject);
      subjectNames.add(subject.name);
      effectiveSubject = subject;
    } else if (subject) {
      effectiveSubject = subjects.find((s) => String(s.name).trim() === subject.name) || subject;
    }

    for (const task of parseGroupedResearchTasks(text, effectiveSubject)) {
      if (!taskIds.has(task.id)) { newTasks.push(task); taskIds.add(task.id); }
    }

    const single = parseSingleCreatedTask(text, effectiveSubject);
    if (single && !taskIds.has(single.id)) { newTasks.push(single); taskIds.add(single.id); }

    if (!newSubjects.length && !newTasks.length) {
      processed.add(key);
      continue;
    }

    if (persistAndVerify(newSubjects, subjects, newTasks, tasks)) {
      processed.add(key);
      localStorage.setItem(PROCESSED_KEY, JSON.stringify([...processed].slice(-300)));
      return true;
    }
    return false;
  }

  localStorage.setItem(PROCESSED_KEY, JSON.stringify([...processed].slice(-300)));
  return false;
}

export const ResearchTaskBridge: React.FC = () => {
  useEffect(() => {
    let reloading = false;
    const run = () => {
      if (reloading) return;
      try {
        if (consumeManagerStudyData()) {
          reloading = true;
          window.location.reload();
        }
      } catch (error) {
        console.warn('[ResearchTaskBridge] failed to sync Manager study data:', error);
      }
    };
    run();
    const timer = window.setInterval(run, 800);
    return () => window.clearInterval(timer);
  }, []);
  return null;
};
