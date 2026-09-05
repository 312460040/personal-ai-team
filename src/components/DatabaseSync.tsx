import React, { useEffect, useRef } from 'react';
import { useAppData } from '../context/AppDataContext';
import type { WorkProject, WorkTask, StudySubject, StudyTask, TodayTimeBlock } from '../types';
import { apiUrl } from '../services/apiBase';
import { classifyWorkTaskCategory } from '../data/workTaxonomy';

const OWNER_ID = 'personal-owner';
const SYNC_DELAY = 900;

type Snapshot = {
  projects: any[];
  tasks: any[];
  studySubjects: any[];
  todayBlocks: any[];
};

function fromProject(row: any): WorkProject {
  return {
    id: String(row.id), workspaceId: row.workspace_id || 'work', title: row.title || '未命名專案', category: 'work',
    progress: 0, priority: row.priority === 'high' || row.priority === 'low' ? row.priority : 'medium',
    deadline: row.deadline || '', description: row.description || '', status: row.status || 'planning', owner: undefined,
    tags: [], source: 'user', createdBy: 'user',
  };
}

function fromWorkTask(row: any): WorkTask {
  return {
    id: String(row.id), workspaceId: row.workspace_id || 'work', projectId: row.project_id || '', projectName: row.project_name || '',
    title: row.title || '未命名任務', priority: row.priority === 'high' || row.priority === 'low' ? row.priority : 'medium',
    status: row.status || 'todo', startDate: row.start_at ? String(row.start_at).slice(0, 10) : undefined,
    deadline: row.deadline || '', estimatedHours: Number(row.estimated_hours || 0), assignee: undefined,
    notes: row.notes || undefined, tags: [], isUrgent: false, source: 'user', createdBy: 'user',
  };
}

function fromStudyTask(row: any, subjects: StudySubject[]): StudyTask {
  const subject = subjects.find(s => s.id === row.subject_id);
  return {
    id: String(row.id), subjectId: row.subject_id || '', subjectName: subject?.name || row.subject_name || '', title: row.title || '未命名課業',
    type: 'study_task', deadline: row.deadline || '', progress: Number(row.progress || 0), estimatedHours: Number(row.estimated_hours || 0),
    priority: row.priority === 'high' || row.priority === 'low' ? row.priority : 'medium', status: row.status || 'todo', notes: row.notes || undefined,
    source: 'user', createdBy: 'user',
  };
}

function fromSubject(row: any): StudySubject {
  return {
    id: String(row.id), name: row.name || '未命名科目', code: row.code || '', credits: Number(row.credits || 0), progress: Number(row.progress || 0),
    nextExamDate: row.next_exam_date || undefined, supervisorTone: row.supervisor_tone || undefined, teacherOrNotes: row.teacher_or_notes || undefined,
    status: row.status || 'in_progress', focusTopics: Array.isArray(row.focus_topics) ? row.focus_topics : [], source: 'user',
  };
}

function fromBlock(row: any): TodayTimeBlock {
  return {
    id: String(row.id), timeRange: row.time_range || '', type: row.type || 'buffer', title: row.title || '時間區塊',
    agentOwner: row.agent_owner || 'manager', targetDurationMin: Number(row.target_duration_min || 0), completed: Boolean(row.completed),
    notes: row.notes || undefined, source: 'user', createdBy: 'user',
  };
}

const userOnly = <T extends { source?: string }>(items: T[]) => items.filter(item => item.source === 'user');

function parseDurationHours(timeRange: string): number {
  const match = timeRange.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return 1;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  const minutes = end >= start ? end - start : end + 24 * 60 - start;
  return Math.max(0.5, Math.round((minutes / 60) * 10) / 10);
}

function todayDeadline(timeRange: string): string {
  const match = timeRange.match(/-\s*(\d{1,2}:\d{2})/);
  const date = new Date();
  const dateKey = date.toISOString().slice(0, 10);
  return `${dateKey} ${match?.[1] || '23:59'}`;
}

export const DatabaseSync: React.FC = () => {
  const data = useAppData();
  const hydrated = useRef(false);
  const configured = useRef(false);
  const syncing = useRef(false);
  const migrationDone = useRef(false);
  const processedScheduleKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ait_schedule_task_sync_v1');
      if (saved) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) ids.forEach((id: string) => processedScheduleKeys.current.add(id));
      }
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const health = await fetch(apiUrl('/api/persistence/health'), { headers: { 'X-Owner-Id': OWNER_ID } }).then(r => r.json());
        if (cancelled || !health?.configured) { hydrated.current = true; return; }
        configured.current = true;
        const response = await fetch(apiUrl('/api/persistence/snapshot'), { headers: { 'X-Owner-Id': OWNER_ID } });
        if (!response.ok) throw new Error(`database snapshot ${response.status}`);
        const payload = await response.json();
        const snapshot: Snapshot = payload?.data || { projects: [], tasks: [], studySubjects: [], todayBlocks: [] };
        if (cancelled) return;

        const localProjects = userOnly(data.workProjects);
        const localWorkTasks = userOnly(data.workTasks);
        const localStudyTasks = userOnly(data.studyTasks);
        const localSubjects = userOnly(data.studySubjects);
        const localBlocks = userOnly(data.todayBlocks);
        const hasLocal = localProjects.length + localWorkTasks.length + localStudyTasks.length + localSubjects.length + localBlocks.length > 0;
        const hasDb = snapshot.projects.length + snapshot.tasks.length + snapshot.studySubjects.length + snapshot.todayBlocks.length > 0;

        if (!hasDb && hasLocal && !migrationDone.current) {
          await fetch(apiUrl('/api/persistence/sync'), {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Owner-Id': OWNER_ID },
            body: JSON.stringify({ projects: localProjects, workTasks: localWorkTasks, studyTasks: localStudyTasks, studySubjects: localSubjects, todayBlocks: localBlocks }),
          });
          migrationDone.current = true;
        } else if (hasDb) {
          const dbProjects = snapshot.projects.map(fromProject);
          const dbSubjects = snapshot.studySubjects.map(fromSubject);
          const dbWorkTasks = snapshot.tasks.filter(t => t.domain === 'work').map(fromWorkTask);
          const dbStudyTasks = snapshot.tasks.filter(t => t.domain === 'study').map(t => fromStudyTask(t, dbSubjects));
          const dbBlocks = snapshot.todayBlocks.map(fromBlock);
          const projectIds = new Set(dbProjects.map(p => p.id));
          const workTaskIds = new Set(dbWorkTasks.map(t => t.id));
          const studyTaskIds = new Set(dbStudyTasks.map(t => t.id));
          const subjectIds = new Set(dbSubjects.map(s => s.id));

          localProjects.filter(p => !projectIds.has(p.id)).forEach(p => data.deleteWorkProject(p.id));
          localWorkTasks.filter(t => !workTaskIds.has(t.id)).forEach(t => data.deleteWorkTask(t.id));
          localStudyTasks.filter(t => !studyTaskIds.has(t.id)).forEach(t => data.deleteStudyTask(t.id));
          localSubjects.filter(s => !subjectIds.has(s.id)).forEach(s => data.deleteStudySubject(s.id));

          dbProjects.forEach(p => data.workProjects.some(x => x.id === p.id) ? data.updateWorkProject(p) : data.addWorkProject(p));
          dbWorkTasks.forEach(t => data.workTasks.some(x => x.id === t.id) ? data.updateWorkTask(t) : data.addWorkTask(t));
          dbSubjects.forEach(s => data.studySubjects.some(x => x.id === s.id) ? data.updateStudySubject(s) : data.addStudySubject(s));
          dbStudyTasks.forEach(t => data.studyTasks.some(x => x.id === t.id) ? data.updateStudyTask(t) : data.addStudyTask(t));
          dbBlocks.forEach(b => data.todayBlocks.some(x => x.id === b.id) ? data.updateTodayBlock(b) : data.addTodayBlock(b));
        }
        hydrated.current = true;
      } catch (error) {
        console.warn('[DatabaseSync] database unavailable; local fallback remains active.', error);
        hydrated.current = true;
      }
    };
    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  // A schedule is not just a calendar event: it represents executable work/study.
  // Keep the Work/Study pages as the task source of truth by materializing every
  // work/study time block as a task when it does not already exist.
  useEffect(() => {
    if (!hydrated.current) return;
    const candidates = data.todayBlocks.filter(block => block.type === 'work' || block.type === 'study');
    if (!candidates.length) return;

    const run = () => {
      let changed = false;
      const now = Date.now();
      const existingWorkIds = new Set(data.workTasks.map(task => task.id));
      const existingStudyIds = new Set(data.studyTasks.map(task => task.id));
      const existingWorkTitles = new Set(data.workTasks.map(task => `${task.title}|${task.deadline.slice(0, 10)}`));
      const existingStudyTitles = new Set(data.studyTasks.map(task => `${task.title}|${task.deadline.slice(0, 10)}`));
      const fallbackProject = data.workProjects.find(project => project.source === 'user') || data.workProjects[0];
      const fallbackSubject = data.studySubjects.find(subject => subject.source === 'user') || data.studySubjects[0];

      candidates.forEach((block, index) => {
        const key = `${block.id}|${block.title}|${block.timeRange}`;
        if (processedScheduleKeys.current.has(key)) return;
        const deadline = todayDeadline(block.timeRange);
        const hours = parseDurationHours(block.timeRange);
        const priority = block.priority || (block.visualPriority === 'urgent' ? 'high' : block.visualPriority === 'important' ? 'medium' : 'low');

        if (block.type === 'work') {
          if (existingWorkIds.has(block.id) || existingWorkTitles.has(`${block.title}|${deadline.slice(0, 10)}`)) {
            processedScheduleKeys.current.add(key);
            return;
          }
          const category = classifyWorkTaskCategory(block.title, block.notes || '');
          const categoryNote = category ? `[工作分類] ${category.category}｜${category.item}\n${category.description}` : '[工作分類] 待 Manager Agent 分類';
          data.addWorkTask({
            id: `w-task-scheduled-${now}-${index}`,
            workspaceId: 'work',
            projectId: data.currentContext.projectId || fallbackProject?.id || 'proj-ai-scheduled',
            projectName: fallbackProject?.title || 'AI 排程工作（待歸類）',
            title: block.title,
            priority,
            status: 'todo',
            estimatedHours: hours,
            startDate: new Date().toISOString().slice(0, 10),
            deadline,
            assignee: '本人',
            notes: `${categoryNote}\n[AIT_SCHEDULED] ${block.timeRange}`,
            tags: ['AI-SCHEDULED', ...(category ? [category.category, category.item] : [])],
            isUrgent: priority === 'high',
            source: 'user',
            createdBy: 'user',
          });
          changed = true;
        } else {
          if (existingStudyIds.has(block.id) || existingStudyTitles.has(`${block.title}|${deadline.slice(0, 10)}`)) {
            processedScheduleKeys.current.add(key);
            return;
          }
          data.addStudyTask({
            id: `s-task-scheduled-${now}-${index}`,
            subjectId: fallbackSubject?.id || 'subj-ai-scheduled',
            subjectName: fallbackSubject?.name || 'AI 排程課業（待歸類）',
            title: block.title,
            type: 'study_task',
            chapter: 'AI 排程',
            deadline,
            progress: 0,
            estimatedHours: hours,
            priority,
            difficulty: 'medium',
            status: 'todo',
            supervisionNote: '由 Manager Agent 排程建立，請依時段執行。',
            notes: `[AIT_SCHEDULED] ${block.timeRange}`,
            source: 'user',
            createdBy: 'user',
          });
          changed = true;
        }

        processedScheduleKeys.current.add(key);
      });

      if (changed) {
        localStorage.setItem('ait_schedule_task_sync_v1', JSON.stringify(Array.from(processedScheduleKeys.current).slice(-300)));
      }
    };

    const timer = window.setTimeout(run, 250);
    return () => window.clearTimeout(timer);
  }, [data.todayBlocks, data.workTasks, data.studyTasks, data.workProjects, data.studySubjects, data.currentContext]);

  // Research is treated as a study-domain task in the user-facing Study page.
  // The Manager create flow historically classified the phrase「研究任務」as work,
  // so mirror only AI-created research tasks into Study Tasks instead of silently
  // moving/deleting the original Work Task. This keeps the original audit trail
  // while making research work visible in the 課業任務 tab as requested.
  useEffect(() => {
    if (!hydrated.current) return;
    const researchTasks = data.workTasks.filter((task) => {
      const text = `${task.title} ${task.notes || ''}`;
      return task.source === 'user' && /研究/.test(text) && /AI 對話|User-Created|由使用者透過 AI/.test(text);
    });
    if (!researchTasks.length) return;

    const run = () => {
      researchTasks.forEach((task) => {
        const linkedId = `s-task-research-${task.id}`;
        const alreadyLinked = data.studyTasks.some((studyTask) =>
          studyTask.id === linkedId || studyTask.notes?.includes(`[RESEARCH_LINK:${task.id}]`)
        );
        if (alreadyLinked) return;

        const fallbackSubject = data.studySubjects.find(subject => subject.source === 'user') || data.studySubjects[0];
        data.addStudyTask({
          id: linkedId,
          subjectId: fallbackSubject?.id || 'subj-research',
          subjectName: fallbackSubject?.name || '研究／專題（待歸類）',
          title: task.title,
          type: 'study_task',
          chapter: '研究任務',
          deadline: task.deadline || '',
          progress: 0,
          estimatedHours: Number(task.estimatedHours) || 1,
          priority: task.priority,
          difficulty: 'medium',
          status: task.status === 'completed' ? 'completed' : 'todo',
          supervisionNote: '由 Manager Agent 建立的研究任務，已同步至課業任務。',
          notes: `由 Manager Agent 建立之研究任務。\n[RESEARCH_LINK:${task.id}]`,
          source: 'user',
          createdBy: 'user',
        });
      });
    };

    const timer = window.setTimeout(run, 100);
    return () => window.clearTimeout(timer);
  }, [data.workTasks, data.studyTasks, data.studySubjects]);

  useEffect(() => {
    if (!configured.current || !hydrated.current || syncing.current) return;
    const timer = window.setTimeout(async () => {
      syncing.current = true;
      try {
        await fetch(apiUrl('/api/persistence/sync'), {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Owner-Id': OWNER_ID },
          body: JSON.stringify({
            projects: userOnly(data.workProjects), workTasks: userOnly(data.workTasks), studyTasks: userOnly(data.studyTasks),
            studySubjects: userOnly(data.studySubjects), todayBlocks: userOnly(data.todayBlocks),
          }),
        });
      } catch (error) {
        console.warn('[DatabaseSync] sync failed; local state retained.', error);
      } finally { syncing.current = false; }
    }, SYNC_DELAY);
    return () => window.clearTimeout(timer);
  }, [data.workProjects, data.workTasks, data.studySubjects, data.studyTasks, data.todayBlocks]);

  return null;
};

export default DatabaseSync;
