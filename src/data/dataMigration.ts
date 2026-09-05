import type { WorkProject, WorkTask } from '../types';
import { LI_ROOT_TITLE, LI_SITES, inferLiSiteFromTask } from './workHierarchy';

const VERSION = 'ait_data_schema_v13';
const PROJECTS_KEY = 'ait_work_projects_v2';
const TASKS_KEY = 'ait_work_tasks_v2';
const PARENT_ID = 'proj-client-li-medical';
const SITE_IDS: Record<string,string> = {'立博':'proj-site-libor','新仁':'proj-site-xinren','世博':'proj-site-shibo','泰安':'proj-site-taian','板國':'proj-site-banguo','博淘':'proj-site-botao'};
const demoProjectTitles = new Set(['數位行銷專案','AI 個人管理系統','範例專案']);
const demoTaskTitles = new Set(['設計 AI Agent 團隊架構','完成首頁設計','研究資料整理']);
function read<T>(key:string):T[]{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[];}catch{return[];}}
function write(key:string,value:unknown){localStorage.setItem(key,JSON.stringify(value));}
function addMissing<T extends{id:string}>(items:T[],incoming:T[]){const ids=new Set(items.map(x=>x.id));let changed=false;for(const x of incoming)if(!ids.has(x.id)){items.push(x);ids.add(x.id);changed=true;}return changed;}
function baselineProject(id:string,title:string,category:string,type:string,parentProjectId?:string):WorkProject{return{id,workspaceId:'work',title,category,progress:0,priority:'medium',deadline:'',description:parentProjectId?`${LI_ROOT_TITLE}旗下據點／品牌：${title}`:`${title}客戶工作管理節點`,status:'in_progress',owner:'本人',tags:parentProjectId?['client-site','li-medical',title]:['client'],source:'user',createdBy:'user',parentProjectId,projectType:type} as WorkProject;}
function baselineTask(id:string,projectId:string,title:string,priority:'high'|'medium'|'low',status:'todo'|'in_progress',notes:string,projects:WorkProject[]):WorkTask{return{id,workspaceId:'work',projectId,projectName:projects.find(p=>p.id===projectId)?.title||'',title,priority,status,estimatedHours:1,deadline:'',startDate:'',notes,tags:['user-baseline'],isUrgent:priority==='high',source:'user',createdBy:'user'} as WorkTask;}

export function migrateWorkData():{changed:boolean;message?:string}{
  const previous=localStorage.getItem(VERSION);
  if(previous==='1')return{changed:false};
  const originalProjects=read<WorkProject>(PROJECTS_KEY);
  let projects=originalProjects.filter(p=>!demoProjectTitles.has(p.title));
  let tasks=read<WorkTask>(TASKS_KEY).filter(t=>!demoTaskTitles.has(t.title));
  const aliases=new Map<string,string>();
  const byTitle=(title:string)=>projects.filter(p=>p.title===title);

  // Canonical top-level clients: exactly one record per client.
  for(const [title,id,type] of [['李總醫療體系',PARENT_ID,'client_root'],['綜合醫院','proj-client-general-hospital','client_root'],['旅遊業的客戶','proj-client-travel','client_root']] as const){
    const matches=byTitle(title);const canonical=matches.find(p=>p.id===id)||matches[0];
    if(canonical){
      for(const duplicate of matches)if(duplicate.id!==canonical.id){aliases.set(duplicate.id,id);projects=projects.filter(p=>p.id!==duplicate.id);}
      canonical.id=id;canonical.title=title;canonical.projectType=type;canonical.source='user';canonical.createdBy='user';delete canonical.parentProjectId;
      if(!projects.some(p=>p.id===id))projects.push(canonical);
    }
  }
  const root=projects.find(p=>p.id===PARENT_ID)||baselineProject(PARENT_ID,LI_ROOT_TITLE,'醫療體系','client_root');
  if(!projects.some(p=>p.id===PARENT_ID))projects.push(root);

  // Canonical six medical sites: exactly one record per site and always under Li Medical.
  for(const site of LI_SITES){
    const id=SITE_IDS[site];const matches=projects.filter(p=>p.title===site||p.id===id);const canonical=matches.find(p=>p.id===id)||matches[0]||baselineProject(id,site,'李總醫療體系｜據點','client_site',PARENT_ID);
    for(const duplicate of matches)if(duplicate.id!==canonical.id){aliases.set(duplicate.id,id);projects=projects.filter(p=>p.id!==duplicate.id);}
    canonical.id=id;canonical.title=site;canonical.parentProjectId=PARENT_ID;canonical.projectType='client_site';canonical.source='user';canonical.createdBy='user';canonical.category='李總醫療體系｜據點';
    if(!projects.some(p=>p.id===id))projects.push(canonical);
  }

  // Defensive pass: remove any remaining duplicate top-level client records by title.
  const seenClient=new Set<string>();
  projects=projects.filter(p=>{if(!['李總醫療體系','綜合醫院','旅遊業的客戶'].includes(String(p.title)))return true;const key=String(p.title);if(seenClient.has(key))return false;seenClient.add(key);return true;});

  const projectIds=new Set(projects.map(p=>p.id));const deduped=new Map<string,WorkTask>();
  for(const task of tasks){
    const t={...task};const old=String(t.projectId||'');if(aliases.has(old))t.projectId=aliases.get(old)!;
    const site=inferLiSiteFromTask(String(t.title||''),String(t.notes||''));if(site)t.projectId=SITE_IDS[site];
    if(!projectIds.has(String(t.projectId||''))){const name=String(t.projectName||'').trim();if(name===LI_ROOT_TITLE)t.projectId=PARENT_ID;else if(SITE_IDS[name])t.projectId=SITE_IDS[name];else if(name==='綜合醫院')t.projectId='proj-client-general-hospital';else if(name==='旅遊業的客戶')t.projectId='proj-client-travel';}
    if(!projectIds.has(String(t.projectId||'')))continue;
    t.projectName=projects.find(p=>p.id===t.projectId)?.title||t.projectName||'';
    const key=`${t.projectId}|${String(t.title||'').trim().toLowerCase()}`;const existing=deduped.get(key);if(!existing||String(t.notes||'').length>String(existing.notes||'').length)deduped.set(key,t);
  }
  tasks=Array.from(deduped.values());
  const make=(id:string,p:string,title:string,priority:'high'|'medium'|'low',status:'todo'|'in_progress',notes:string)=>baselineTask(id,p,title,priority,status,notes,projects);
  const required:WorkTask[]=[
    make('w-task-client-li-monthly-digital-audit',PARENT_ID,'每月20日｜數位／線上資訊檢查','medium','todo','[工作分類] 網站管理｜網站維護\n[週期] 每月20日\n檢查所有數位／線上資訊是否需要更新，並確認資訊正確性。'),
    make('w-task-client-li-ban-guo-video',SITE_IDS['板國'],'板國影片｜短影音製作','medium','in_progress','[工作分類] 多媒體短影音｜腳本構想／現場拍攝／後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認'),
    make('w-task-client-li-xin-ren-video',SITE_IDS['新仁'],'新仁影片｜短影音製作','medium','in_progress','[工作分類] 多媒體短影音｜腳本構想／現場拍攝／後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認'),
    make('w-task-client-li-libor-athlete-video',SITE_IDS['立博'],'立博運動員影片｜短影音製作','high','in_progress','[工作分類] 多媒體短影音｜後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認\n[目前階段] 剪輯'),
    make('w-task-client-li-libor-ad-material',SITE_IDS['立博'],'立博廣告影片素材｜短影音製作','medium','in_progress','[工作分類] 多媒體短影音｜腳本構想／現場拍攝／後製剪輯\n[流程] 溝通 → 腳本 → 拍攝 → 剪輯 → 確認'),
    make('w-task-client-li-ad-libor',SITE_IDS['立博'],'立博｜廣告投放','high','in_progress','[工作分類] 行銷企劃｜廣告投放\n[目前狀態] 投放中'),
    make('w-task-client-li-ad-banguo',SITE_IDS['板國'],'板國｜廣告投放','high','in_progress','[工作分類] 行銷企劃｜廣告投放\n[目前狀態] 投放中'),
    make('w-task-client-li-ad-shibo',SITE_IDS['世博'],'世博｜廣告投放與成效追蹤','medium','in_progress','[工作分類] 行銷企劃｜廣告投放／成效追蹤\n[目前狀態] 追蹤中'),
    make('w-task-client-hospital-marketing-diagnosis','proj-client-general-hospital','行銷診斷','medium','todo','[工作分類] 行銷企劃｜行銷診斷'),
    make('w-task-client-hospital-google-business','proj-client-general-hospital','優化 Google 商家','medium','todo','[工作分類] 網站管理｜Google 商務維護'),
    make('w-task-client-hospital-groups','proj-client-general-hospital','分享社團','low','todo','[工作分類] 社群管理｜分享社團'),
    make('w-task-client-hospital-post-comments','proj-client-general-hospital','留言／貼文','medium','todo','[工作分類] 社群管理｜客服回覆／定期發文'),
    make('w-task-client-hospital-ad-proposal','proj-client-general-hospital','建議投放廣告的企畫書','high','todo','[工作分類] 行銷企劃｜構想行銷企劃／廣告投放'),
    make('w-task-client-travel-document-processing','proj-client-travel','文書處理｜新案件建立與紀錄','medium','todo','[工作分類] 行銷企劃｜專案管理、進度追蹤\n[工作模式] 新案件到達 → Owner 提供案件名稱／類別 → 建立案件 → 更新與記錄。'),
  ];
  const beforeTasks=tasks.length;addMissing(tasks,required);
  write(PROJECTS_KEY,projects);write(TASKS_KEY,tasks);localStorage.setItem(VERSION,'1');
  return{changed:projects.length!==originalProjects.length||tasks.length!==beforeTasks||aliases.size>0||previous!=='1',message:'工作管理資料已完成去重、階層化與任務分類'};
}
