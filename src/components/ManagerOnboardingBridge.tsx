import { useEffect } from 'react';
import { apiUrl } from '../services/apiRouting';

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

function applySnapshot(snapshot: any) {
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
}

function requestRealOnboarding(onDone: (snapshot: any) => void) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', apiUrl('/api/agent/chat'), true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('X-Owner-Id', 'personal-owner');
  xhr.onreadystatechange = () => {
    if (xhr.readyState !== XMLHttpRequest.DONE) return;
    if (xhr.status < 200 || xhr.status >= 300) {
      console.warn('[ManagerOnboardingBridge] onboarding request failed:', xhr.status, xhr.responseText);
      return;
    }
    try {
      const payload = JSON.parse(xhr.responseText);
      if (payload?.onboardingSnapshot) onDone(payload.onboardingSnapshot);
    } catch (error) {
      console.error('[ManagerOnboardingBridge] invalid onboarding response:', error);
    }
  };
  xhr.onerror = () => console.warn('[ManagerOnboardingBridge] onboarding network error');
  xhr.send(JSON.stringify({
    message: '請把我的長期工作記憶真正建立並記住，不只是回覆文字。客戶與工作狀況包含：李總醫療體系、綜合醫院、旅遊業的客戶。請建立客戶與工作分類、目前任務、工作流程、固定週期與複習筆記。',
    agentId: 'manager',
    context: { currentContext: { workspaceId: 'work', projectId: null }, workProjects: [], workTasks: [], studySubjects: [], studyTasks: [] },
  }));
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
    if (latest) {
      const match = latest.text.match(/<!--AIT_MANAGER_ONBOARDING:([\s\S]*?)-->/);
      if (match?.[1]) {
        try {
          applySnapshot(JSON.parse(match[1]));
          window.setTimeout(() => window.location.reload(), 100);
          return;
        } catch (error) {
          console.error('[ManagerOnboardingBridge] failed to apply existing onboarding snapshot:', error);
        }
      }
    }

    // The normal chat fetch is intentionally rule-routed in the browser. Use XHR here
    // so onboarding reaches the real Render API and can perform the actual Shared Data
    // Store write even when the browser-side task-arrangement fallback is active.
    requestRealOnboarding((snapshot) => {
      try {
        applySnapshot(snapshot);
        window.setTimeout(() => window.location.reload(), 100);
      } catch (error) {
        console.error('[ManagerOnboardingBridge] failed to apply live onboarding snapshot:', error);
      }
    });
  }, []);

  return null;
}
