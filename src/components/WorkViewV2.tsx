import React, { useMemo, useState } from 'react';
import { ChevronRight, FolderKanban, Plus, Sparkles } from 'lucide-react';
import type { WorkProject, WorkTask } from '../types';
import WorkProjectDetail from './WorkProjectDetail';

type Props = {
  projects: WorkProject[];
  tasks: WorkTask[];
  onToggleTask: (id: string) => void;
  onAddTask: (task: any) => void;
  onUpdateTask: (task: WorkTask) => void;
  onDeleteTask: (id: string) => void;
  onAddProject: (project: any) => void;
  onUpdateProject: (project: WorkProject) => void;
  onDeleteProject: (id: string) => void;
  onAskAgentAboutWork: (prompt: string) => void;
  onClearDemoData: () => void;
};

const priorityLabel: Record<string, string> = { high: '迫切', medium: '重要', low: '一般' };
const statusLabel: Record<string, string> = { planning: '規劃中', in_progress: '進行中', completed: '已完成', on_hold: '暫停' };

export const WorkViewV2: React.FC<Props> = (props) => {
  const { projects, tasks } = props;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const roots = useMemo(() => projects.filter((p) => !p.parentProjectId), [projects]);
  const childrenOf = (id: string) => projects.filter((p) => p.parentProjectId === id);
  const selected = selectedId ? projects.find((p) => p.id === selectedId) : undefined;

  const addProject = () => {
    const title = window.prompt('專案名稱');
    if (!title?.trim()) return;
    props.onAddProject({ workspaceId: 'work', title: title.trim(), category: '一般專案', progress: 0, priority: 'medium', deadline: '', description: '', status: 'planning', owner: '本人', tags: [], source: 'user', createdBy: 'user' });
  };

  const addTask = () => {
    if (!selected) return;
    const title = window.prompt(`新增「${selected.title}」的工作項目`);
    if (!title?.trim()) return;
    props.onAddTask({ workspaceId: 'work', projectId: selected.id, projectName: selected.title, title: title.trim(), priority: 'medium', status: 'todo', deadline: '', estimatedHours: 1, notes: '', tags: [], isUrgent: false, source: 'user', createdBy: 'user' });
  };

  if (selected) {
    return <WorkProjectDetail project={selected} tasks={tasks} onBack={() => setSelectedId(null)} onToggleTask={props.onToggleTask} onEditProject={props.onUpdateProject} onEditTask={props.onUpdateTask} onAddTask={addTask} />;
  }

  const renderProject = (project: WorkProject, depth = 0) => {
    const childProjects = childrenOf(project.id);
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    const done = projectTasks.filter((t) => t.status === 'completed').length;
    const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : project.progress;
    return <React.Fragment key={project.id}>
      <button type="button" onClick={() => setSelectedId(project.id)} className="w-full text-left rounded-2xl border border-[#E5E2DC] bg-white hover:border-[#B9C8BC] hover:shadow-sm transition p-4" style={{ marginLeft: depth * 18 }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EBF1EC] text-[#385244] flex items-center justify-center shrink-0"><FolderKanban className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-[#2D322E]">{project.title}</span><span className="text-[10px] px-2 py-1 rounded-full bg-[#F4EDE2] text-[#8C6B3E]">{priorityLabel[project.priority]}</span><span className="text-[10px] text-[#7A837D]">{statusLabel[project.status]}</span></div>
            <div className="text-[11px] text-[#7A837D] mt-1">{project.category} · {projectTasks.length} 項工作 · 完成 {progress}%</div>
            <div className="mt-3 h-1.5 rounded-full bg-[#EEECE7] overflow-hidden"><div className="h-full bg-[#6B8A73]" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
          </div><ChevronRight className="w-4 h-4 text-[#A0A69F] mt-2" />
        </div>
      </button>
      {childProjects.map((child) => renderProject(child, depth + 1))}
    </React.Fragment>;
  };

  return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div><div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#6B8A73]" /><h1 className="text-xl font-bold text-[#2D322E]">工作管理</h1></div><p className="text-xs text-[#7A837D] mt-1">客戶 → 據點／專案 → 工作分類 → 具體任務 → 進度</p></div>
      <div className="flex gap-2"><button onClick={addProject} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DDD8CE] bg-white text-[#385244] text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> 新增專案</button><button onClick={() => props.onAskAgentAboutWork('檢查目前工作專案與任務，告訴我最應優先處理的項目。')} className="px-3 py-2 rounded-xl bg-[#385244] text-white text-xs font-semibold">問 Manager</button></div>
    </div>
    <section className="rounded-2xl bg-[#FDFCFB] border border-[#E5E2DC] p-4 sm:p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-bold text-sm text-[#2D322E]">工作專案清單</h2><p className="text-[10px] text-[#8C938D] mt-1">點擊任一專案即可進入詳細工作項目。</p></div><span className="text-[10px] text-[#8C938D]">{projects.length} 個專案</span></div><div className="space-y-2">{roots.map((p) => renderProject(p))}</div></section>
    <section className="rounded-2xl bg-white border border-[#E5E2DC] p-4"><div className="text-xs font-semibold text-[#385244]">快速新增工作</div><div className="text-[11px] text-[#7A837D] mt-1">先點進專案，再可直接新增該專案的工作項目。六個李總醫療體系據點會各自保留自己的工作清單。</div><button onClick={() => selected ? addTask() : setSelectedId(roots[0]?.id || null)} className="mt-3 px-3 py-2 rounded-lg bg-[#F0F4F0] text-[#385244] text-xs font-semibold">{selected ? `新增「${selected.title}」工作` : '選擇專案後新增工作'}</button></section>
  </div>;
};
export default WorkViewV2;
