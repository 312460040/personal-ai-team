import express from 'express';

const OWNER_ID = 'personal-owner';
const installedKey = '__personal_ai_work_hierarchy_installed__';

function config() {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
  return { base, key };
}

async function supabase(path: string, options: RequestInit = {}) {
  const { base, key } = config();
  if (!base || !key) throw new Error('Supabase is not configured');
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

const sites = [
  { id: 'proj-site-libor', clientId: 'proj-client-li-medical', title: '立博', description: '李總醫療體系旗下據點／品牌：立博。', tags: ['client-site', 'li-medical', 'libor'] },
  { id: 'proj-site-xinren', clientId: 'proj-client-li-medical', title: '新仁', description: '李總醫療體系旗下據點／品牌：新仁。', tags: ['client-site', 'li-medical', 'xinren'] },
  { id: 'proj-site-shibo', clientId: 'proj-client-li-medical', title: '世博', description: '李總醫療體系旗下據點／品牌：世博。', tags: ['client-site', 'li-medical', 'shibo'] },
  { id: 'proj-site-taian', clientId: 'proj-client-li-medical', title: '泰安', description: '李總醫療體系旗下據點／品牌：泰安。', tags: ['client-site', 'li-medical', 'taian'] },
  { id: 'proj-site-banguo', clientId: 'proj-client-li-medical', title: '板國', description: '李總醫療體系旗下據點／品牌：板國。', tags: ['client-site', 'li-medical', 'banguo'] },
  { id: 'proj-site-botao', clientId: 'proj-client-li-medical', title: '博淘', description: '李總醫療體系旗下據點／品牌：博淘。', tags: ['client-site', 'li-medical', 'botao'] },
];

const taskSiteMap: Array<[RegExp, string]> = [
  [/立博運動員影片|立博廣告影片素材|立博｜廣告/, 'proj-site-libor'],
  [/新仁影片/, 'proj-site-xinren'],
  [/世博｜廣告/, 'proj-site-shibo'],
  [/板國影片/, 'proj-site-banguo'],
];

function normalizeTask(task: any) {
  const hit = taskSiteMap.find(([pattern]) => pattern.test(String(task.title || '')));
  return hit ? { id: task.id, project_id: hit[1] } : null;
}

export async function normalizeWorkHierarchy(ownerId = OWNER_ID) {
  const users = await supabase(`users?external_id=eq.${encodeURIComponent(ownerId)}&select=id&limit=1`);
  if (!Array.isArray(users) || !users[0]?.id) throw new Error('Owner not found');
  const userId = String(users[0].id);

  for (const site of sites) {
    await supabase('projects', {
      method: 'POST',
      body: JSON.stringify({ id: site.id, user_id: userId, workspace_id: 'work', title: site.title, description: site.description, status: 'in_progress', priority: 'medium', deadline: null, source: 'user', parent_project_id: site.clientId, project_type: 'client_site' }),
    });
  }

  const rows = await supabase(`tasks?user_id=eq.${encodeURIComponent(userId)}&domain=eq.work&select=id,title`);
  const updates = (Array.isArray(rows) ? rows : []).map(normalizeTask).filter(Boolean) as Array<{ id: string; project_id: string }>;
  for (const update of updates) {
    await supabase(`tasks?id=eq.${encodeURIComponent(update.id)}`, { method: 'PATCH', body: JSON.stringify({ project_id: update.project_id }) });
  }

  return { sites, remappedTasks: updates };
}

export function installWorkHierarchyBridge() {
  const app = express.application as any;
  if (app[installedKey]) return;
  app[installedKey] = true;
  const originalPost = app.post;
  app.post = function workHierarchyPost(path: any, ...handlers: any[]) {
    if (path !== '/api/agent/chat' || !handlers.length) return originalPost.call(this, path, ...handlers);
    const wrapped = handlers.map((handler: any) => {
      if (typeof handler !== 'function') return handler;
      return async function hierarchyHandler(this: any, req: any, res: any, next: any) {
        const originalJson = res.json.bind(res);
        res.json = (payload: any) => {
          if (payload?.onboardingSnapshot) {
            Promise.resolve(normalizeWorkHierarchy(String(req.header?.('x-owner-id') || req.headers?.['x-owner-id'] || OWNER_ID)))
              .then((result) => {
                payload.onboardingSnapshot.hierarchy = result;
                if (Array.isArray(payload.createdWorkTasks)) {
                  payload.createdWorkTasks = payload.createdWorkTasks.map((task: any) => {
                    const mapped = result.remappedTasks.find((item) => item.id === task.id);
                    return mapped ? { ...task, projectId: mapped.project_id, projectName: sites.find((site) => site.id === mapped.project_id)?.title || task.projectName } : task;
                  });
                }
              })
              .catch((error) => console.warn('[Work Hierarchy] normalization failed:', error instanceof Error ? error.message : String(error)));
          }
          return originalJson(payload);
        };
        return handler.call(this, req, res, next);
      };
    });
    return originalPost.call(this, path, ...wrapped);
  };
}

installWorkHierarchyBridge();
