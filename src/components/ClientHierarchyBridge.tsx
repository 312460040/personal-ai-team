import { useEffect } from 'react';
import { useAppData } from '../context/AppDataContext';
import type { WorkProject } from '../types';

const PARENT_ID = 'proj-client-li-medical';
const DONE_KEY = 'ait_li_medical_hierarchy_v2';
const SITES = [
  ['proj-site-libor', '立博'],
  ['proj-site-xinren', '新仁'],
  ['proj-site-shibo', '世博'],
  ['proj-site-taian', '泰安'],
  ['proj-site-banguo', '板國'],
  ['proj-site-botao', '博淘'],
] as const;

export function ClientHierarchyBridge() {
  const { workProjects, workTasks, addWorkProject, updateWorkTask } = useAppData();

  useEffect(() => {
    if (localStorage.getItem(DONE_KEY) === '1') return;
    const parent = workProjects.find((p) => p.id === PARENT_ID && p.source === 'user');
    if (!parent) return;

    const existing = new Set(workProjects.map((p) => p.id));
    SITES.forEach(([id, title]) => {
      if (existing.has(id)) return;
      const site: WorkProject = {
        id,
        workspaceId: 'work',
        title,
        category: '李總醫療體系｜據點',
        progress: 0,
        priority: 'medium',
        deadline: '',
        description: `李總醫療體系旗下據點／品牌：${title}。詳細工作項目由此查看。`,
        status: 'in_progress',
        owner: '本人',
        tags: ['client-site', 'li-medical', title],
        source: 'user',
        createdBy: 'user',
        parentProjectId: PARENT_ID,
        projectType: 'client_site',
      };
      addWorkProject(site);
    });

    const map: Array<[RegExp, string]> = [
      [/立博運動員影片|立博廣告影片素材|立博｜廣告/, 'proj-site-libor'],
      [/新仁影片/, 'proj-site-xinren'],
      [/世博｜廣告/, 'proj-site-shibo'],
      [/板國影片/, 'proj-site-banguo'],
    ];
    workTasks.filter((t) => t.projectId === PARENT_ID).forEach((task) => {
      const hit = map.find(([pattern]) => pattern.test(task.title));
      if (!hit) return;
      const site = SITES.find(([id]) => id === hit[1]);
      updateWorkTask({ ...task, projectId: hit[1], projectName: site?.[1] || task.projectName });
    });

    localStorage.setItem(DONE_KEY, '1');
  }, [workProjects, workTasks, addWorkProject, updateWorkTask]);

  return null;
}

export default ClientHierarchyBridge;
