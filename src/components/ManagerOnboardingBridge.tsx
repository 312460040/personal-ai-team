import { useEffect } from 'react';

const MESSAGE_KEY = 'ait_messages_v2';
const WORK_PROJECTS_KEY = 'ait_work_projects_v2';
const WORK_TASKS_KEY = 'ait_work_tasks_v2';
const PROCESSED_KEY = 'ait_manager_onboarding_processed_v1';

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]) {
  const map = new Map(existing.map(item => [item.id, item]));
  incoming.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
}

export function ManagerOnboardingBridge() {
  useEffect(() => {
    let processed = false;
    try {
      processed = localStorage.getItem(PROCESSED_KEY) === '1';
    } catch {}
    if (processed) return;

    const messages = readArray<any>(MESSAGE_KEY);
    const latest = [...messages].reverse().find(message => typeof message?.text === 'string' && message.text.includes('<!--AIT_MANAGER_ONBOARDING:'));
    if (!latest) return;

    const match = latest.text.match(/<!--AIT_MANAGER_ONBOARDING:([\s\S]*?)-->/);
    if (!match?.[1]) return;

    try {
      const snapshot = JSON.parse(match[1]);
      const projects = Array.isArray(snapshot?.projects) ? snapshot.projects.map((project: any) => ({
        ...project,
        source: 'user',
        createdBy: 'user',
        workspaceId: project.workspaceId || 'work',
      })) : [];
      const tasks = Array.isArray(snapshot?.tasks) ? snapshot.tasks.map((task: any) => ({
        ...task,
        workspaceId: 'work',
        projectName: projects.find((project: any) => project.id === task.projectId)?.title || '',
        deadline: task.deadline || '',
        source: 'user',
        createdBy: 'user',
      })) : [];

      const existingProjects = readArray<any>(WORK_PROJECTS_KEY);
      const existingTasks = readArray<any>(WORK_TASKS_KEY);
      localStorage.setItem(WORK_PROJECTS_KEY, JSON.stringify(mergeById(existingProjects, projects)));
      localStorage.setItem(WORK_TASKS_KEY, JSON.stringify(mergeById(existingTasks, tasks)));
      localStorage.setItem(PROCESSED_KEY, '1');
      window.setTimeout(() => window.location.reload(), 100);
    } catch (error) {
      console.error('[ManagerOnboardingBridge] failed to apply onboarding snapshot:', error);
    }
  }, []);

  return null;
}
