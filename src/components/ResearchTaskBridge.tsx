import React, { useEffect } from 'react';

type StudySubjectLike = {
  id: string; name: string; code: string; credits: number; progress: number;
  status: 'in_progress' | 'completed' | 'exam_prep'; focusTopics: string[];
  teacherOrNotes: string; source: 'user' | 'demo';
};
type StudyTaskLike = {
  id: string; subjectId: string; subjectName: string; title: string;
  type: 'study_task' | 'assignment' | 'exam'; chapter?: string; deadline: string;
  progress: number; estimatedHours: number; priority: 'high' | 'medium' | 'low';
  difficulty?: 'hard' | 'medium' | 'easy'; status: 'todo' | 'in_progress' | 'completed' | 'delayed';
  supervisionNote?: string; notes?: string; source: 'user' | 'demo'; createdBy?: 'user' | 'system';
};

const PROCESSED_KEY = 'ait_research_task_bridge_processed_v6';
const STUDY_SUBJECTS_KEY = 'ait_study_subjects_v2';
const STUDY_TASKS_KEY = 'ait_study_tasks_v2';
const MESSAGES_KEY = 'ait_messages_v2';
const REPAIR_KEY = 'ait_study_dedup_v1';

function readStore<T>(key: string): T[] | null {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : null; } catch { return null; }
}

function subjectQuality(s: StudySubjectLike) {
  return (s.code && s.code !== 'RESEARCH' ? 2 : 0) + (s.teacherOrNotes ? 1 : 0) + (s.focusTopics?.length || 0) + (s.progress || 0) / 100;
}

function taskQuality(t: StudyTaskLike) {
  return (t.notes ? t.notes.length : 0) + (t.deadline ? 20 : 0) + (t.estimatedHours ? 5 : 0);
}

/**
 * Study is a shared-data view: one subject ID and one task ID represent one record.
 * Older builds could create a new subject ID for every task that referenced the same
 * subject name. Repair those records once, and also normalize tasks to the canonical subject ID.
 */
function repairStudyStore(): boolean {
  const subjects = readStore<StudySubjectLike>(STUDY_SUBJECTS_KEY) || [];
  const tasks = readStore<StudyTaskLike>(STUDY_TASKS_KEY) || [];
  if (!subjects.length && !tasks.length) { localStorage.setItem(REPAIR_KEY, '1'); return false; }

  const byId = new Map<string, StudySubjectLike>();
  for (const raw of subjects) {
    if (!raw?.name) continue;
    const s = { ...raw, id: String(raw.id || `subj-user-${Date.now()}`), name: String(raw.name).trim(), source: 'user' as const };
    const old = byId.get(s.id);
    if (!old || subjectQuality(s) > subjectQuality(old)) byId.set(s.id, s);
  }

  // Same subject name must resolve to one canonical record, even when old builds generated different IDs.
  const byName = new Map<string, StudySubjectLike>();
  for (const s of byId.values()) {
    const key = s.name.toLowerCase();
    const old = byName.get(key);
    if (!old || subjectQuality(s) > subjectQuality(old)) byName.set(key, s);
  }
  const canonicalSubjects = Array.from(byName.values());
  const subjectIdByName = new Map(canonicalSubjects.map(s => [s.name.toLowerCase(), s.id]));
  const canonicalIds = new Set(canonicalSubjects.map(s => s.id));

  // Prefer the richest record for duplicate task IDs, then collapse legacy semantic duplicates.
  const byTaskId = new Map<string, StudyTaskLike>();
  for (const raw of tasks) {
    if (!raw?.title) continue;
    const t = { ...raw, id: String(raw.id || `s-task-user-${Date.now()}`), title: String(raw.title).trim(), source: 'user' as const };
    const subjectKey = String(t.subjectName || '').trim().toLowerCase();
    const canonicalSubjectId = subjectIdByName.get(subjectKey) || (canonicalIds.has(String(t.subjectId)) ? String(t.subjectId) : '');
    if (canonicalSubjectId) {
      t.subjectId = canonicalSubjectId;
      const s = canonicalSubjects.find(x => x.id === canonicalSubjectId);
      if (s) t.subjectName = s.name;
    }
    const old = byTaskId.get(t.id);
    if (!old || taskQuality(t) > taskQuality(old)) byTaskId.set(t.id, t);
  }
  const semantic = new Map<string, StudyTaskLike>();
  for (const t of byTaskId.values()) {
    const key = `${String(t.subjectId)}|${t.title.toLowerCase()}|${String(t.deadline || '').slice(0, 10)}`;
    const old = semantic.get(key);
    if (!old || taskQuality(t) > taskQuality(old)) semantic.set(key, t);
  }
  const canonicalTasks = Array.from(semantic.values());

  const before = JSON.stringify({ subjects, tasks });
  const after = JSON.stringify({ subjects: canonicalSubjects, tasks: canonicalTasks });
  if (before === after && localStorage.getItem(REPAIR_KEY) === '1') return false;
  localStorage.setItem(STUDY_SUBJECTS_KEY, JSON.stringify(canonicalSubjects));
  localStorage.setItem(STUDY_TASKS_KEY, JSON.stringify(canonicalTasks));
  localStorage.setItem(REPAIR_KEY, '1');
  return before !== after;
}

function normalizeSubject(raw: any): StudySubjectLike | null {
  if (!raw?.name) return null;
  return { id: String(raw.id || `subj-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`), name: String(raw.name).trim(), code: String(raw.code || 'RESEARCH'), credits: Number(raw.credits || 0), progress: Number(raw.progress || 0), status: raw.status === 'completed' || raw.status === 'exam_prep' ? raw.status : 'in_progress', focusTopics: Array.isArray(raw.focusTopics) ? raw.focusTopics : [], teacherOrNotes: String(raw.teacherOrNotes || '由 Manager Agent 建立的研究科目。'), source: 'user' };
}

function normalizeStudyTask(raw: any, fallbackSubject?: StudySubjectLike | null): StudyTaskLike | null {
  if (!raw?.title) return null;
  return { id: String(raw.id || `s-task-research-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`), subjectId: String(raw.subjectId || fallbackSubject?.id || 'subj-research-unassigned'), subjectName: String(raw.subjectName || fallbackSubject?.name || '研究／專題（待歸類）'), title: String(raw.title).trim(), type: raw.type === 'assignment' || raw.type === 'exam' ? raw.type : 'study_task', chapter: raw.chapter || '研究／專題', deadline: String(raw.deadline || ''), progress: Number(raw.progress || 0), estimatedHours: Number(raw.estimatedHours || 1), priority: raw.priority === 'high' || raw.priority === 'low' ? raw.priority : 'medium', difficulty: raw.difficulty === 'hard' || raw.difficulty === 'easy' ? raw.difficulty : 'medium', status: raw.status === 'completed' || raw.status === 'in_progress' || raw.status === 'delayed' ? raw.status : 'todo', supervisionNote: raw.supervisionNote, notes: raw.notes || '由 Manager Agent 建立的研究／課業任務', source: 'user', createdBy: 'user' };
}

function isResearchTask(text: string) { return /研究|研究任務|論文|文獻|研究計畫|研究專題/i.test(text); }
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
  const quoted = [...section.matchAll(/[「『"“]([^「」『』"”\n]+)[」』"”]/g)].map(m => m[1].trim()).filter(Boolean);
  return quoted.map((title, index) => normalizeStudyTask({ id: `s-task-manager-${Date.now()}-${index}`, title, subjectId: subject?.id, subjectName: subject?.name, notes: '由 Manager Agent 在研究科目中建立的研究任務。' }, subject)).filter(Boolean) as StudyTaskLike[];
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

function persistAndVerify(newSubjects: StudySubjectLike[], subjects: StudySubjectLike[], newTasks: StudyTaskLike[], tasks: StudyTaskLike[]) {
  const mergedSubjects = [...subjects, ...newSubjects];
  const subjectByName = new Map<string, StudySubjectLike>();
  for (const s of mergedSubjects) { const key = s.name.trim().toLowerCase(); const old = subjectByName.get(key); if (!old || subjectQuality(s) > subjectQuality(old)) subjectByName.set(key, s); }
  const canonicalSubjects = Array.from(subjectByName.values());
  const idByName = new Map(canonicalSubjects.map(s => [s.name.trim().toLowerCase(), s.id]));
  const mergedTasks = [...tasks, ...newTasks].map(t => ({ ...t, subjectId: idByName.get(String(t.subjectName || '').trim().toLowerCase()) || t.subjectId }));
  const taskByKey = new Map<string, StudyTaskLike>();
  for (const t of mergedTasks) { const key = `${t.id}|${t.subjectId}|${t.title.toLowerCase()}|${String(t.deadline || '').slice(0,10)}`; const old = taskByKey.get(key); if (!old || taskQuality(t) > taskQuality(old)) taskByKey.set(key, t); }
  localStorage.setItem(STUDY_SUBJECTS_KEY, JSON.stringify(canonicalSubjects));
  localStorage.setItem(STUDY_TASKS_KEY, JSON.stringify(Array.from(taskByKey.values())));
  return true;
}

function consumeManagerStudyData() {
  const messages = readStore<any>(MESSAGES_KEY); const subjects = readStore<StudySubjectLike>(STUDY_SUBJECTS_KEY); const tasks = readStore<StudyTaskLike>(STUDY_TASKS_KEY);
  if (!messages || !subjects || !tasks) return false;
  const processed = new Set<string>(readStore<string>(PROCESSED_KEY) || []);
  const subjectNames = new Set(subjects.map(s => String(s?.name || '').trim().toLowerCase()));
  const taskIds = new Set(tasks.map(t => String(t?.id))); const newSubjects: StudySubjectLike[] = []; const newTasks: StudyTaskLike[] = [];
  for (const message of messages) {
    if (message?.sender !== 'manager' || typeof message?.text !== 'string') continue;
    const text = message.text; const batch = text.match(/<!--AIT_TASK_BATCH:([\s\S]*?)-->/);
    if (batch) {
      const key = `${message.id}:${batch[1]}`; if (processed.has(key)) continue;
      try {
        const parsed = JSON.parse(batch[1]);
        for (const raw of Array.isArray(parsed?.study) ? parsed.study : []) {
          const subjectName = String(raw?.subjectName || '').trim(); let fallbackSubject: StudySubjectLike | null = null;
          if (subjectName) {
            const keyName = subjectName.toLowerCase();
            fallbackSubject = newSubjects.find(s => s.name.toLowerCase() === keyName) || subjects.find(s => s.name.trim().toLowerCase() === keyName) || normalizeSubject({ name: subjectName });
            if (fallbackSubject && !subjectNames.has(keyName) && !newSubjects.some(s => s.id === fallbackSubject!.id)) { newSubjects.push(fallbackSubject); subjectNames.add(keyName); }
          }
          const task = normalizeStudyTask(raw, fallbackSubject);
          if (task && !taskIds.has(task.id) && !newTasks.some(t => t.id === task.id)) { newTasks.push(task); taskIds.add(task.id); }
        }
      } catch { continue; }
      persistAndVerify(newSubjects, subjects, newTasks, tasks); processed.add(key); localStorage.setItem(PROCESSED_KEY, JSON.stringify([...processed].slice(-300))); return Boolean(newSubjects.length || newTasks.length);
    }
    const key = `${message.id}:manager-study-v6`; if (processed.has(key)) continue;
    const subject = parseSubject(text); let effectiveSubject = subject;
    if (subject) { const existing = subjects.find(s => s.name.trim().toLowerCase() === subject.name.trim().toLowerCase()) || newSubjects.find(s => s.name.trim().toLowerCase() === subject.name.trim().toLowerCase()); if (existing) effectiveSubject = existing; else newSubjects.push(subject); }
    for (const task of parseGroupedResearchTasks(text, effectiveSubject)) if (!tasks.some(t => t.id === task.id) && !newTasks.some(t => t.id === task.id)) newTasks.push(task);
    const single = parseSingleCreatedTask(text, effectiveSubject); if (single && !tasks.some(t => t.id === single.id) && !newTasks.some(t => t.id === single.id)) newTasks.push(single);
    if (!newSubjects.length && !newTasks.length) { processed.add(key); continue; }
    persistAndVerify(newSubjects, subjects, newTasks, tasks); processed.add(key); localStorage.setItem(PROCESSED_KEY, JSON.stringify([...processed].slice(-300))); return true;
  }
  return false;
}

export const ResearchTaskBridge: React.FC = () => {
  useEffect(() => {
    let reloading = false;
    const run = () => {
      if (reloading) return;
      try {
        const repaired = repairStudyStore();
        if (repaired) { reloading = true; window.location.reload(); return; }
        if (consumeManagerStudyData()) { reloading = true; window.location.reload(); }
      } catch (error) { console.warn('[ResearchTaskBridge] failed to repair/sync study data:', error); }
    };
    run(); const timer = window.setInterval(run, 800); return () => window.clearInterval(timer);
  }, []);
  return null;
};
