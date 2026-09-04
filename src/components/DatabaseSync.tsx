import React, { useEffect, useRef } from 'react';
import { useAppData } from '../context/AppDataContext';
import type { WorkProject, WorkTask, StudySubject, StudyTask, TodayTimeBlock } from '../types';
import { apiUrl } from '../services/apiBase';

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

export const DatabaseSync: React.FC = () => {
  const data = useAppData();
  const hydrated = useRef(false);
  const configured = useRef(false);
  const syncing = useRef(false);
  const migrationDone = useRef(false);

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

        // First connection: preserve existing browser data by migrating it into the shared DB.
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
