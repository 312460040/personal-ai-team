import type { WorkProject, WorkTask } from '../types';
import { LI_ROOT_TITLE, LI_SITES, inferLiSiteFromTask } from './workHierarchy';

const VERSION = 'ait_data_schema_v9';
const PROJECTS_KEY = 'ait_work_projects_v2';
const TASKS_KEY = 'ait_work_tasks_v2';
const PARENT_ID = 'proj-client-li-medical';
const SITE_IDS: Record<string,string> = { '立博':'proj-site-libor', '新仁':'proj-site-xinren', '世博':'proj-site-shibo', '泰安':'proj-site-taian', '板國':'proj-site-banguo', '博淘':'proj-site-botao' };
const demoProjectTitles = new Set(['數位行銷專案','AI 個人管理系統','範例專案']);
const demoTaskTitles = new Set(['設計 AI Agent 團隊架構','完成首頁設計','研究資料整理']);
function read<T>(key:string):T[]{try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch{return[]}}
function write(key:string,value:unknown){localStorage.setItem(key,JSON.stringify(value))}
export function migrateWorkData():{changed:boolean;message?:string}{
 if(localStorage.getItem(VERSION)==='1')return{changed:false};
 const projects=read<WorkProject>(PROJECTS_KEY).filter(p=>!demoProjectTitles.has(p.title));
 const tasks=read<WorkTask>(TASKS_KEY).filter(t=>!demoTaskTitles.has(t.title)); let changed=false;
 let root=projects.find(p=>p.id===PARENT_ID&&!p.parentProjectId)||projects.find(p=>p.title===LI_ROOT_TITLE&&!p.parentProjectId);
 if(!root){root={id:PARENT_ID,workspaceId:'work',title:LI_ROOT_TITLE,category:'醫療體系',progress:0,priority:'medium',deadline:'',description:'李總醫療體系客戶總管理節點',status:'in_progress',owner:'本人',tags:['li-medical'],source:'user',createdBy:'user',projectType:'client'} as WorkProject;projects.push(root);changed=true}
 else if(root.id!==PARENT_ID){const oldId=root.id;root={...root,id:PARENT_ID,projectType:'client'};const i=projects.findIndex(p=>p.id===oldId);if(i>=0)projects[i]=root;for(const task of tasks)if(task.projectId===oldId){task.projectId=PARENT_ID;task.projectName=LI_ROOT_TITLE}changed=true}
 for(const site of LI_SITES){const siteId=SITE_IDS[site];let existing=projects.find(p=>p.id===siteId)||projects.find(p=>p.parentProjectId===root!.id&&p.title===site);if(!existing){projects.push({id:siteId,workspaceId:'work',title:site,category:'李總醫療體系｜據點',progress:0,priority:'medium',deadline:'',description:`${LI_ROOT_TITLE}旗下據點／品牌：${site}`,status:'in_progress',owner:'本人',tags:['client-site','li-medical',site],source:'user',createdBy:'user',parentProjectId:root.id,projectType:'client_site'} as WorkProject);changed=true}else if(existing.parentProjectId!==root!.id||existing.id!==siteId){const oldId=existing.id;const i=projects.findIndex(p=>p.id===oldId);projects[i]={...existing,id:siteId,parentProjectId:root!.id,projectType:'client_site'};for(const task of tasks)if(task.projectId===oldId){task.projectId=siteId;task.projectName=site}changed=true}}
 const projectMap=new Map(projects.map(p=>[p.id,p]));
 for(const task of tasks){const current=projectMap.get(task.projectId);const site=inferLiSiteFromTask(task.title,task.notes);if((current?.id===root.id||current?.title===LI_ROOT_TITLE)&&site){const target=projectMap.get(SITE_IDS[site]);if(target&&task.projectId!==target.id){task.projectId=target.id;task.projectName=target.title;changed=true}}}
 if(changed||!localStorage.getItem(PROJECTS_KEY)||!localStorage.getItem(TASKS_KEY)){write(PROJECTS_KEY,projects);write(TASKS_KEY,tasks)}
 localStorage.setItem(VERSION,'1');return{changed,message:changed?'工作資料已自動升級至新版階層':''};
}
