import type { WorkProject, WorkTask } from '../types';
import { LI_ROOT_TITLE, LI_SITES, inferLiSiteFromTask } from './workHierarchy';

const VERSION = 'ait_data_schema_v11';
const PROJECTS_KEY = 'ait_work_projects_v2';
const TASKS_KEY = 'ait_work_tasks_v2';
const PARENT_ID = 'proj-client-li-medical';
const SITE_IDS: Record<string, string> = {
  '立博': 'proj-site-libor', '新仁': 'proj-site-xinren', '世博': 'proj-site-shibo',
  '泰安': 'proj-site-taian', '板國': 'proj-site-banguo', '博淘': 'proj-site-botao',
};
const demoProjectTitles = new Set(['數位行銷專案', 'AI 個人管理系統', '範例專案']);
const demoTaskTitles = new Set(['設計 AI Agent 團隊架構', '完成首頁設計', '研究資料整理']);

function read<T>(key: string): T[] { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
function write(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); }

function addMissing<T extends { id: string }>(items: T[], incoming: T[]): boolean {
  const ids = new Set(items.map(item => item.id)); let changed = false;
  for (const item of incoming) if (!ids.has(item.id)) { items.push(item); ids.add(item.id); changed = true; }
  return changed;
}

function seedBaseline(projects: WorkProject[], tasks: WorkTask[]): boolean {
  const root: WorkProject = {
    id: PARENT_ID, workspaceId: 'work', title: LI_ROOT_TITLE, category: '醫療體系', progress: 0,
    priority: 'medium', deadline: '', description: '李總醫療體系客戶總管理節點', status: 'in_progress', owner: '本人',
    tags: ['li-medical'], source: 'user', createdBy: 'user', projectType: 'client_root',
  } as WorkProject;
  const general: WorkProject = {
    id: 'proj-client-general-hospital', workspaceId: 'work', title: '綜合醫院', category: '客戶｜醫療', progress: 0,
    priority: 'medium', deadline: '', description: '綜合醫院目前的行銷與社群工作。', status: 'in_progress', owner: '本人',
    tags: ['client', 'medical'], source: 'user', createdBy: 'user', projectType: 'client_root',
  } as WorkProject;
  const travel: WorkProject = {
    id: 'proj-client-travel', workspaceId: 'work', title: '旅遊業的客戶', category: '客戶｜旅遊', progress: 0,
    priority: 'medium', deadline: '', description: '旅遊業案件採事件驅動：新案件到達後建立案件名稱／類別並更新紀錄。', status: 'in_progress', owner: '本人',
    tags: ['client', 'travel', 'case-driven'], source: 'user', createdBy: 'user', projectType: 'client_root',
  } as WorkProject;
  let changed = addMissing(projects, [root, general, travel]);
  for (const site of LI_SITES) {
    changed = addMissing(projects, [{
      id: SITE_IDS[site], workspaceId: 'work', title: site, category: '李總醫療體系｜據點', progress: 0,
      priority: 'medium', deadline: '', description: `${LI_ROOT_TITLE}旗下據點／品牌：${site}`, status: 'in_progress', owner: '本人',
      tags: ['client-site', 'li-medical', site], source: 'user', createdBy: 'user', parentProjectId: PARENT_ID, projectType: 'client_site',
    } as WorkProject]);
  }
  const task = (id: string, projectId: string, title: string, priority: 'high'|'medium'|'low', status: 'todo'|'in_progress', notes: string, estimatedHours = 1): WorkTask => ({
    id, workspaceId: 'work', projectId, projectName: projects.find(p => p.id === projectId)?.title || '', title, priority, status,
    estimatedHours, deadline: '', startDate: '', notes, tags: ['user-baseline'], isUrgent: priority === 'high', source: 'user', createdBy: 'user',
  } as WorkTask);
  const baselineTasks: WorkTask[] = [
    task('w-task-client-li-monthly-digital-audit', PARENT_ID, '每月20日｜數位／線上資訊檢查', 'medium', 'todo', '[工作分類] 網站管理｜網站維護\n[週期] 每月20日\n檢查所有數位／線上資訊是否需要更新，並確認資訊正確性。'),
    task('w-task-client-li-ban-guo-video', SITE_IDS['板國'], '板國影片｜短影音製作', 'medium', 'in_progress', '[工作分類] 多媒體短影音｜腳本構想／現場拍攝／後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認\n[目前階段] 未指定，Manager 不猜測。'),
    task('w-task-client-li-xin-ren-video', SITE_IDS['新仁'], '新仁影片｜短影音製作', 'medium', 'in_progress', '[工作分類] 多媒體短影音｜腳本構想／現場拍攝／後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認\n[目前階段] 未指定，Manager 不猜測。'),
    task('w-task-client-li-libor-athlete-video', SITE_IDS['立博'], '立博運動員影片｜短影音製作', 'high', 'in_progress', '[工作分類] 多媒體短影音｜後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認\n[目前階段] 剪輯'),
    task('w-task-client-li-libor-ad-material', SITE_IDS['立博'], '立博廣告影片素材｜短影音製作', 'medium', 'in_progress', '[工作分類] 多媒體短影音｜腳本構想／現場拍攝／後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認'),
    task('w-task-client-li-ad-libor', SITE_IDS['立博'], '立博｜廣告投放', 'high', 'in_progress', '[工作分類] 行銷企劃｜廣告投放\n[目前狀態] 投放中'),
    task('w-task-client-li-ad-banguo', SITE_IDS['板國'], '板國｜廣告投放', 'high', 'in_progress', '[工作分類] 行銷企劃｜廣告投放\n[目前狀態] 投放中'),
    task('w-task-client-li-ad-shibo', SITE_IDS['世博'], '世博｜廣告投放與成效追蹤', 'medium', 'in_progress', '[工作分類] 行銷企劃｜廣告投放／成效追蹤\n[目前狀態] 追蹤中'),
    task('w-task-client-hospital-marketing-diagnosis', general.id, '行銷診斷', 'medium', 'todo', '[工作分類] 行銷企劃｜行銷診斷'),
    task('w-task-client-hospital-google-business', general.id, '優化 Google 商家', 'medium', 'todo', '[工作分類] 網站管理｜Google 商務維護'),
    task('w-task-client-hospital-groups', general.id, '分享社團', 'low', 'todo', '[工作分類] 社群管理｜分享社團', 0.5),
    task('w-task-client-hospital-post-comments', general.id, '留言／貼文', 'medium', 'todo', '[工作分類] 社群管理｜客服回覆／定期發文'),
    task('w-task-client-hospital-ad-proposal', general.id, '建議投放廣告的企畫書', 'high', 'todo', '[工作分類] 行銷企劃｜構想行銷企劃／廣告投放', 2),
    task('w-task-client-travel-document-processing', travel.id, '文書處理｜新案件建立與紀錄', 'medium', 'todo', '[工作分類] 行銷企劃｜專案管理、進度追蹤\n[工作模式] 事件驅動：新案件到達 → Owner 提供案件名稱／類別 → 建立案件 → 更新與記錄。'),
  ];
  return addMissing(tasks, baselineTasks) || changed;
}

export function migrateWorkData(): { changed: boolean; message?: string } {
  if (localStorage.getItem(VERSION) === '1') return { changed: false };
  const projects = read<WorkProject>(PROJECTS_KEY).filter(p => !demoProjectTitles.has(p.title));
  const tasks = read<WorkTask>(TASKS_KEY).filter(t => !demoTaskTitles.has(t.title));
  let changed = seedBaseline(projects, tasks);
  let root = projects.find(p => p.id === PARENT_ID && !p.parentProjectId) || projects.find(p => p.title === LI_ROOT_TITLE && !p.parentProjectId);
  if (!root) throw new Error('工作資料初始化失敗：找不到李總醫療體系');
  if (root.id !== PARENT_ID || root.projectType !== 'client_root') { const oldId = root.id; const normalizedRoot = { ...root, id: PARENT_ID, projectType: 'client_root' } as WorkProject; const i = projects.findIndex(p => p.id === oldId); if (i >= 0) projects[i] = normalizedRoot; else projects.push(normalizedRoot); root = normalizedRoot; for (const t of tasks) if (t.projectId === oldId) { t.projectId = PARENT_ID; t.projectName = LI_ROOT_TITLE; } changed = true; }
  const projectMap = new Map(projects.map(p => [p.id, p]));
  for (const site of LI_SITES) { const target = projectMap.get(SITE_IDS[site]); if (!target) continue; if (target.parentProjectId !== root.id || target.projectType !== 'client_site') { target.parentProjectId = root.id; target.projectType = 'client_site'; changed = true; } }
  for (const t of tasks) { const current = projectMap.get(t.projectId); const site = inferLiSiteFromTask(t.title, t.notes); if ((current?.id === root.id || current?.title === LI_ROOT_TITLE) && site) { const target = projectMap.get(SITE_IDS[site]); if (target && t.projectId !== target.id) { t.projectId = target.id; t.projectName = target.title; changed = true; } } }
  if (changed || !localStorage.getItem(PROJECTS_KEY) || !localStorage.getItem(TASKS_KEY)) { write(PROJECTS_KEY, projects); write(TASKS_KEY, tasks); }
  localStorage.setItem(VERSION, '1');
  return { changed, message: changed ? '工作管理資料已自動建立並升級' : '工作資料已是最新版' };
}
