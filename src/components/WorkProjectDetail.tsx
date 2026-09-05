import React from 'react';
import { ArrowLeft, Calendar, CheckCircle2, Clock3, Edit2, FolderKanban, Plus, User, XCircle } from 'lucide-react';
import type { WorkProject, WorkTask } from '../types';

interface Props {
  project: WorkProject;
  tasks: WorkTask[];
  onBack: () => void;
  onToggleTask: (taskId: string) => void;
  onEditProject: (project: WorkProject) => void;
  onEditTask: (task: WorkTask) => void;
  onAddTask: () => void;
}

const statusLabel: Record<string, string> = {
  todo: '待辦',
  in_progress: '進行中',
  completed: '已完成',
  delayed: '已延遲',
};

const priorityLabel: Record<string, string> = { high: '迫切', medium: '重要', low: '一般' };

export const WorkProjectDetail: React.FC<Props> = ({ project, tasks, onBack, onToggleTask, onEditProject, onEditTask, onAddTask }) => {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const completed = projectTasks.filter((task) => task.status === 'completed').length;
  const calculatedProgress = projectTasks.length ? Math.round((completed / projectTasks.length) * 100) : project.progress;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#385244] hover:text-[#2D322E]">
        <ArrowLeft className="w-4 h-4" /> 返回工作專案
      </button>

      <section className="rounded-2xl bg-white border border-[#E5E2DC] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#EBE8E1]">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#EBF1EC] text-[#385244] text-[10px] font-semibold">
                  <FolderKanban className="w-3.5 h-3.5" /> {project.category}
                </span>
                <span className="px-2 py-1 rounded-full bg-[#F4EDE2] text-[#8C6B3E] text-[10px] font-semibold">{priorityLabel[project.priority] || project.priority}</span>
                <span className="px-2 py-1 rounded-full bg-[#F8F7F4] border border-[#E5E2DC] text-[#6B726C] text-[10px]">{statusLabel[project.status] || project.status}</span>
              </div>
              <h2 className="text-xl font-bold text-[#2D322E]">{project.title}</h2>
              <p className="mt-2 text-sm text-[#6B726C] leading-relaxed">{project.description || '尚未填寫專案描述。'}</p>
            </div>
            <button type="button" onClick={() => onEditProject(project)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#DDD8CE] bg-[#FAF8F5] text-[#385244] text-xs font-semibold">
              <Edit2 className="w-3.5 h-3.5" /> 編輯專案
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#EBE8E1]">
          <div className="p-4"><div className="text-[10px] text-[#8C938D]">工作項目</div><div className="mt-1 text-lg font-bold text-[#2D322E]">{projectTasks.length} 項</div></div>
          <div className="p-4"><div className="text-[10px] text-[#8C938D]">完成</div><div className="mt-1 text-lg font-bold text-[#385244]">{completed} 項</div></div>
          <div className="p-4"><div className="text-[10px] text-[#8C938D]">目前進度</div><div className="mt-1 text-lg font-bold text-[#4E6B56]">{calculatedProgress}%</div></div>
          <div className="p-4"><div className="text-[10px] text-[#8C938D]">截止日</div><div className="mt-1 text-sm font-semibold text-[#2D322E] flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {project.deadline || '未設定'}</div></div>
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-[#E5E2DC] shadow-xs p-5">
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#EBE8E1]">
          <div><h3 className="text-sm font-bold text-[#2D322E]">詳細工作項目</h3><p className="text-[10px] text-[#8C938D] mt-0.5">這些任務都直接隸屬於「{project.title}」</p></div>
          <button type="button" onClick={onAddTask} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#385244] text-white text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> 新增工作</button>
        </div>

        {projectTasks.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-[#DDD8CE] bg-[#FAF8F5]">
            <CheckCircle2 className="w-8 h-8 mx-auto text-[#A39E93] mb-2" />
            <div className="text-sm font-semibold text-[#2D322E]">這個專案目前沒有工作項目</div>
            <button type="button" onClick={onAddTask} className="mt-3 px-3 py-2 rounded-lg bg-[#385244] text-white text-xs font-semibold">+ 新增第一個工作</button>
          </div>
        ) : (
          <div className="space-y-2">
            {projectTasks.map((task) => {
              const done = task.status === 'completed';
              return (
                <div key={task.id} className={`rounded-xl border p-3.5 ${done ? 'bg-[#FAF8F5] border-[#E5E2DC]' : 'bg-white border-[#DDD8CE]'}`}>
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => onToggleTask(task.id)} className="mt-0.5 shrink-0" title={done ? '標記為未完成' : '標記完成'}>
                      {done ? <CheckCircle2 className="w-5 h-5 text-[#4E6B56]" /> : <XCircle className="w-5 h-5 text-[#B0B5B0]" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-semibold ${done ? 'line-through text-[#8C938D]' : 'text-[#2D322E]'}`}>{task.title}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-[#6B726C]">
                        <span className="px-1.5 py-0.5 rounded bg-[#EBF1EC] text-[#385244]">{priorityLabel[task.priority] || task.priority}</span>
                        <span>{statusLabel[task.status] || task.status}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /> {task.estimatedHours || 0}h</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {task.deadline || '未設定'}</span>
                        <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {task.assignee || '本人'}</span>
                      </div>
                      {task.notes && <p className="mt-2 text-[11px] text-[#7A837D] leading-relaxed">{task.notes}</p>}
                    </div>
                    <button type="button" onClick={() => onEditTask(task)} className="shrink-0 p-1.5 rounded-lg text-[#8C938D] hover:bg-[#EFECE5] hover:text-[#385244]" title="編輯工作">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default WorkProjectDetail;
