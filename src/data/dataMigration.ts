import type { WorkProject, WorkTask } from '../types';
import { LI_ROOT_TITLE, LI_SITES, inferLiSiteFromTask } from './workHierarchy';

const VERSION = 'ait_data_schema_v8';
const PROJECTS_KEY = 'ait_work_projects_v2';
const TASKS_KEY = 'ait_work_tasks_v2';

const demoProjectTitles = new Set(['數位行銷專案','AI 個人管理系統','範例專案']);
const demoTaskTitles = new Set(['設計 AI Agent 團隊架構','完成首頁設計','研究資料整理']);

function read<T>(key: string): T[] {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}
function write(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); }
function id(prefix: string, value: string) { return `${prefix}_${value.replace(/[^\w\u4e00-\u9fff]+/g, '_')}`; }

export function migrateWorkData(): { changed: boolean; message?: string } {
  if (localStorage.getItem(VERSION) === '1') return { changed: false };

  const projects = read<WorkProject>(PROJECTS_KEY).filter(p => !demoProjectTitles.has(p.title));
  const tasks = read<WorkTask>(TASKS_KEY).filter(t => !demoTaskTitles.has(t.title));
  let changed = false;

  let root = projects.find(p => p.title === LI_ROOT_TITLE && !p.parentProjectId);
  if (!root) {
    root = {
      id: id('client', LI_ROOT_TITLE), workspaceId: 'work', title: LI_ROOT_TITLE,
      category: '醫療體系', progress: 0, priority: 'medium', deadline: '',
      description: '醫療體系客戶總管理節點', status: 'planning', owner: '本人', tags: [],
      source: 'system', createdBy: 'system', projectType: 'client_root',
    } as WorkProject;
    projects.push(root); changed = true;
  }

  for (const site of LI_SITES) {
    const existing = projects.find(p => p.parentProjectId === root!.id && p.title === site);
    if (!existing) {
      projects.push({
        id: id('site', site), workspaceId: 'work', title: site, category: '醫療體系據點',
        progress: 0, priority: 'medium', deadline: '', description: `${LI_ROOT_TITLE}－${site}`,
        status: 'planning', owner: '本人', tags: [], source: 'system', createdBy: 'system',
        parentProjectId: root.id, projectType: 'client_site',
      } as WorkProject);
      changed = true;
    }
  }

  const siteByTitle = new Map(projects.filter(p => p.parentProjectId === root!.id).map(p => [p.title, p]));
  for (const task of tasks) {
    const currentProject = projects.find(p => p.id === task.projectId);
    const siteName = inferLiSiteFromTask(task.title, task.notes);
    if (currentProject?.title === LI_ROOT_TITLE && siteName && siteByTitle.get(siteName)) {
      task.projectId = siteByTitle.get(siteName)!.id;
      task.projectName = siteName;
      changed = true;
    }
  }

  if (changed || !localStorage.getItem(PROJECTS_KEY) || !localStorage.getItem(TASKS_KEY)) {
    write(PROJECTS_KEY, projects);
    write(TASKS_KEY, tasks);
  }
  localStorage.setItem(VERSION, '1');
  return { changed, message: changed ? '工作資料已自動升級至新版階層' : undefined };
}
