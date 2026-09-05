import { useEffect } from 'react';
import { LI_ROOT_TITLE, LI_SITES, inferLiSiteFromTask } from '../data/workHierarchy';

const PARENT_ID = 'proj-client-li-medical';
const DONE_KEY = 'ait_li_medical_hierarchy_v4';
const PROJECTS_KEY = 'ait_work_projects_v2';
const TASKS_KEY = 'ait_work_tasks_v2';
const SITE_IDS: Record<string, string> = {
  '立博': 'proj-site-libor', '新仁': 'proj-site-xinren', '世博': 'proj-site-shibo',
  '泰安': 'proj-site-taian', '板國': 'proj-site-banguo', '博淘': 'proj-site-botao',
};

const canonicalClient: Record<string, string> = {
  '李總醫療體系': PARENT_ID,
  '綜合醫院': 'proj-client-general-hospital',
  '旅遊業的客戶': 'proj-client-travel',
};

function read(key: string): any[] { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function text(value: any) { return String(value || '').trim(); }

function normalizeProjects(input: any[]) {
  const byCanonical = new Map<string, any>();
  const aliases = new Map<string, string>();
  const isSite = (p: any) => Object.values(SITE_IDS).includes(String(p.id)) || p.projectType === 'client_site';

  for (const original of input) {
    const p = { ...original };
    const title = text(p.title);
    let canonicalId = String(p.id || '');
    if (canonicalClient[title]) canonicalId = canonicalClient[title];
    for (const [site, id] of Object.entries(SITE_IDS)) if (title === site) canonicalId = id;
    if (isSite(p)) {
      const site = Object.entries(SITE_IDS).find(([, id]) => id === canonicalId || title === id)?.[0];
      if (site) canonicalId = SITE_IDS[site];
    }
    if (!canonicalId) continue;
    const existing = byCanonical.get(canonicalId);
    if (!existing) {
      p.id = canonicalId;
      byCanonical.set(canonicalId, p);
    } else {
      // Keep the richest record while preserving the canonical identity.
      byCanonical.set(canonicalId, {
        ...existing,
        ...Object.fromEntries(Object.entries(p).filter(([, value]) => value !== undefined && value !== '' && value !== null)),
        id: canonicalId,
      });
    }
    if (String(original.id) !== canonicalId) aliases.set(String(original.id), canonicalId);
  }

  const result = Array.from(byCanonical.values());
  const root = result.find(p => p.id === PARENT_ID);
  if (root) {
    root.title = LI_ROOT_TITLE; root.projectType = 'client_root'; root.source = 'user'; root.createdBy = 'user';
    delete root.parentProjectId;
  }
  for (const site of LI_SITES) {
    const id = SITE_IDS[site];
    const p = result.find(x => x.id === id);
    if (p) {
      p.title = site; p.parentProjectId = PARENT_ID; p.projectType = 'client_site'; p.source = 'user'; p.createdBy = 'user';
      p.category = '李總醫療體系｜據點';
    }
  }
  for (const title of ['綜合醫院', '旅遊業的客戶']) {
    const p = result.find(x => x.id === canonicalClient[title]);
    if (p) { p.title = title; p.projectType = 'client_root'; p.source = 'user'; p.createdBy = 'user'; delete p.parentProjectId; }
  }
  return { projects: result, aliases };
}

function normalizeTasks(input: any[], aliases: Map<string, string>, projects: any[]) {
  const validIds = new Set(projects.map(p => String(p.id)));
  const result = new Map<string, any>();
  for (const original of input) {
    const task = { ...original };
    const oldProject = String(task.projectId || '');
    if (aliases.has(oldProject)) task.projectId = aliases.get(oldProject);
    const inferredSite = inferLiSiteFromTask(text(task.title), text(task.notes));
    if (inferredSite && SITE_IDS[inferredSite]) task.projectId = SITE_IDS[inferredSite];
    if (!validIds.has(String(task.projectId || ''))) {
      const name = text(task.projectName);
      if (name === '李總醫療體系') task.projectId = PARENT_ID;
      else if (SITE_IDS[name]) task.projectId = SITE_IDS[name];
      else if (canonicalClient[name]) task.projectId = canonicalClient[name];
    }
    if (!validIds.has(String(task.projectId || ''))) continue;
    task.projectName = projects.find(p => p.id === task.projectId)?.title || task.projectName || '';
    const dedupeKey = String(task.id || '') || `${task.projectId}|${text(task.title).toLowerCase()}`;
    const existing = result.get(dedupeKey);
    if (!existing) result.set(dedupeKey, task);
    else if (existing.projectId !== task.projectId) result.set(dedupeKey, task);
  }
  return Array.from(result.values());
}

export function ClientHierarchyBridge() {
  useEffect(() => {
    try {
      const rawProjects = read(PROJECTS_KEY);
      const rawTasks = read(TASKS_KEY);
      const { projects, aliases } = normalizeProjects(rawProjects);
      const required: any[] = [];
      if (!projects.some(p => p.id === PARENT_ID)) required.push({ id: PARENT_ID, workspaceId: 'work', title: LI_ROOT_TITLE, category: '醫療體系', progress: 0, priority: 'medium', deadline: '', description: '李總醫療體系客戶總管理節點', status: 'in_progress', owner: '本人', tags: ['li-medical'], source: 'user', createdBy: 'user', projectType: 'client_root' });
      for (const site of LI_SITES) if (!projects.some(p => p.id === SITE_IDS[site])) required.push({ id: SITE_IDS[site], workspaceId: 'work', title: site, category: '李總醫療體系｜據點', progress: 0, priority: 'medium', deadline: '', description: `${LI_ROOT_TITLE}旗下據點／品牌：${site}`, status: 'in_progress', owner: '本人', tags: ['client-site', 'li-medical', site], source: 'user', createdBy: 'user', parentProjectId: PARENT_ID, projectType: 'client_site' });
      const nextProjects = [...projects, ...required];
      const nextTasks = normalizeTasks(rawTasks, aliases, nextProjects);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(nextProjects));
      localStorage.setItem(TASKS_KEY, JSON.stringify(nextTasks));
      localStorage.setItem(DONE_KEY, '1');
      window.dispatchEvent(new Event('ait:work-data-normalized'));
    } catch (error) { console.warn('[ClientHierarchyBridge] normalization failed', error); }
  }, []);
  return null;
}

export default ClientHierarchyBridge;
