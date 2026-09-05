import { useEffect } from 'react';

const PARENT_ID = 'proj-client-li-medical';
const DONE_KEY = 'ait_li_medical_hierarchy_v3';
const PROJECTS_KEY = 'ait_work_projects_v2';
const TASKS_KEY = 'ait_work_tasks_v2';
const SITES = [
  ['proj-site-libor', '立博'],
  ['proj-site-xinren', '新仁'],
  ['proj-site-shibo', '世博'],
  ['proj-site-taian', '泰安'],
  ['proj-site-banguo', '板國'],
  ['proj-site-botao', '博淘'],
] as const;

export function ClientHierarchyBridge() {
  useEffect(() => {
    if (localStorage.getItem(DONE_KEY) === '1') return;
    try {
      const projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      const tasks = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
      const parent = projects.find((p: any) => p.id === PARENT_ID && p.source !== 'demo');
      if (!parent) return;

      const projectMap = new Map(projects.map((p: any) => [String(p.id), p]));
      const nextProjects = [...projects];
      SITES.forEach(([id, title]) => {
        if (projectMap.has(id)) return;
        nextProjects.push({
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
        });
      });

      const taskMap: Array<[RegExp, string, string]> = [
        [/立博運動員影片/, 'proj-site-libor', '立博'],
        [/立博廣告影片素材|立博｜廣告/, 'proj-site-libor', '立博'],
        [/新仁影片/, 'proj-site-xinren', '新仁'],
        [/世博｜廣告/, 'proj-site-shibo', '世博'],
        [/板國影片/, 'proj-site-banguo', '板國'],
      ];
      const nextTasks = tasks.map((task: any) => {
        if (task.projectId !== PARENT_ID) return task;
        const hit = taskMap.find(([pattern]) => pattern.test(String(task.title || '')));
        return hit ? { ...task, projectId: hit[1], projectName: hit[2] } : task;
      });

      localStorage.setItem(PROJECTS_KEY, JSON.stringify(nextProjects));
      localStorage.setItem(TASKS_KEY, JSON.stringify(nextTasks));
      localStorage.setItem(DONE_KEY, '1');
      window.location.reload();
    } catch (error) {
      console.warn('[ClientHierarchyBridge] migration failed', error);
    }
  }, []);
  return null;
}

export default ClientHierarchyBridge;
