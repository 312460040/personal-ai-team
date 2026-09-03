import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  CheckCircle2,
  Clock,
  FolderKanban,
  Sparkles,
  Check,
  Flame,
  User,
  Calendar,
  FileText,
  Trash2,
  Edit2,
  AlertTriangle,
  FolderPlus,
  Filter,
} from 'lucide-react';
import { WorkProject, WorkTask } from '../types';

interface WorkViewProps {
  projects: WorkProject[];
  tasks: WorkTask[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (task: Omit<WorkTask, 'id'>) => void;
  onUpdateTask: (task: WorkTask) => void;
  onDeleteTask: (taskId: string) => void;
  onAddProject: (project: Omit<WorkProject, 'id'>) => void;
  onUpdateProject: (project: WorkProject) => void;
  onDeleteProject: (projectId: string) => void;
  onAskAgentAboutWork: (prompt: string) => void;
  onClearDemoData?: () => void;
}

export const WorkView: React.FC<WorkViewProps> = ({
  projects,
  tasks,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onAskAgentAboutWork,
  onClearDemoData,
}) => {
  // Filters
  const [filterSource, setFilterSource] = useState<'ALL' | 'user' | 'demo'>('ALL');
  const [filterPriority, setFilterPriority] = useState<'ALL' | 'high' | 'medium' | 'low'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'todo' | 'in_progress' | 'completed' | 'delayed'>('ALL');
  const [filterProject, setFilterProject] = useState<string>('ALL');

  // Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<WorkTask | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskCustomProjectName, setTaskCustomProjectName] = useState('');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [taskStatus, setTaskStatus] = useState<'todo' | 'in_progress' | 'completed' | 'delayed'>('todo');
  const [taskHours, setTaskHours] = useState(2);
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('2026-09-03 18:00');
  const [taskAssignee, setTaskAssignee] = useState('本人');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskIsUrgent, setTaskIsUrgent] = useState(false);

  // Project Modal State
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<WorkProject | null>(null);

  const [projectTitle, setProjectTitle] = useState('');
  const [projectCategory, setProjectCategory] = useState('軟體工程');
  const [projectPriority, setProjectPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [projectStatus, setProjectStatus] = useState<'planning' | 'in_progress' | 'completed' | 'on_hold'>('in_progress');
  const [projectProgress, setProjectProgress] = useState(30);
  const [projectDeadline, setProjectDeadline] = useState('2026-09-15');
  const [projectOwner, setProjectOwner] = useState('本人');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectTags, setProjectTags] = useState('Backend, API');

  // Open Task Modal (Add / Edit)
  const openCreateTaskModal = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskProjectId(projects[0]?.id || 'custom');
    setTaskCustomProjectName(projects.length === 0 ? 'AI 個人管理系統' : '');
    setTaskPriority('high');
    setTaskStatus('todo');
    setTaskHours(2);
    setTaskStartDate(new Date().toISOString().split('T')[0]);
    setTaskDeadline('2026-09-03 18:00');
    setTaskAssignee('本人');
    setTaskNotes('');
    setTaskIsUrgent(false);
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task: WorkTask) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskProjectId(task.projectId || 'custom');
    setTaskCustomProjectName(task.projectName || '');
    setTaskPriority(task.priority);
    setTaskStatus(task.status);
    setTaskHours(task.estimatedHours);
    setTaskStartDate(task.startDate || '');
    setTaskDeadline(task.deadline);
    setTaskAssignee(task.assignee || '本人');
    setTaskNotes(task.notes || '');
    setTaskIsUrgent(Boolean(task.isUrgent));
    setShowTaskModal(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    let finalProjectId = taskProjectId;
    let finalProjectName = '未歸類專案';

    if (taskProjectId === 'custom') {
      finalProjectName = taskCustomProjectName.trim() || 'AI 個人管理系統';
      finalProjectId = `proj-custom-${Date.now()}`;
    } else {
      const matchedProject = projects.find((p) => p.id === taskProjectId);
      if (matchedProject) {
        finalProjectName = matchedProject.title;
        finalProjectId = matchedProject.id;
      } else if (taskCustomProjectName.trim()) {
        finalProjectName = taskCustomProjectName.trim();
      }
    }

    if (editingTask) {
      onUpdateTask({
        ...editingTask,
        title: taskTitle.trim(),
        workspaceId: 'work',
        projectId: finalProjectId,
        projectName: finalProjectName,
        priority: taskPriority,
        status: taskStatus,
        estimatedHours: Number(taskHours) || 1,
        startDate: taskStartDate.trim(),
        deadline: taskDeadline.trim(),
        assignee: taskAssignee.trim() || '本人',
        notes: taskNotes.trim(),
        isUrgent: taskIsUrgent,
      });
    } else {
      onAddTask({
        title: taskTitle.trim(),
        workspaceId: 'work',
        projectId: finalProjectId || 'proj-work',
        projectName: finalProjectName,
        priority: taskPriority,
        status: taskStatus,
        estimatedHours: Number(taskHours) || 1,
        startDate: taskStartDate.trim(),
        deadline: taskDeadline.trim(),
        assignee: taskAssignee.trim() || '本人',
        notes: taskNotes.trim(),
        isUrgent: taskIsUrgent,
        tags: [taskPriority.toUpperCase()],
        source: 'user',
        createdBy: 'user',
      });
    }

    setShowTaskModal(false);
  };

  // Open Project Modal (Add / Edit)
  const openCreateProjectModal = () => {
    setEditingProject(null);
    setProjectTitle('');
    setProjectCategory('專案研發');
    setProjectPriority('high');
    setProjectStatus('in_progress');
    setProjectProgress(0);
    setProjectDeadline('2026-09-30');
    setProjectOwner('本人');
    setProjectDescription('');
    setProjectTags('Dev, Q3');
    setShowProjectModal(true);
  };

  const openEditProjectModal = (proj: WorkProject) => {
    setEditingProject(proj);
    setProjectTitle(proj.title);
    setProjectCategory(proj.category);
    setProjectPriority(proj.priority);
    setProjectStatus(proj.status);
    setProjectProgress(proj.progress);
    setProjectDeadline(proj.deadline);
    setProjectOwner(proj.owner || '本人');
    setProjectDescription(proj.description);
    setProjectTags((proj.tags || []).join(', '));
    setShowProjectModal(true);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle.trim()) return;

    const tagsArray = projectTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingProject) {
      onUpdateProject({
        ...editingProject,
        title: projectTitle.trim(),
        category: projectCategory.trim(),
        priority: projectPriority,
        status: projectStatus,
        progress: Number(projectProgress) || 0,
        deadline: projectDeadline.trim(),
        owner: projectOwner.trim(),
        description: projectDescription.trim(),
        tags: tagsArray,
      });
    } else {
      onAddProject({
        title: projectTitle.trim(),
        workspaceId: 'work',
        category: projectCategory.trim(),
        priority: projectPriority,
        status: projectStatus,
        progress: Number(projectProgress) || 0,
        deadline: projectDeadline.trim(),
        owner: projectOwner.trim(),
        description: projectDescription.trim(),
        tags: tagsArray,
        source: 'user',
        createdBy: 'user',
      });
    }

    setShowProjectModal(false);
  };

  // Filter Tasks
  const filteredTasks = tasks.filter((t) => {
    if (filterSource !== 'ALL' && t.source !== filterSource) return false;
    if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (filterProject !== 'ALL' && t.projectId !== filterProject) return false;
    return true;
  });

  const filteredProjects = projects.filter((p) => {
    if (filterSource !== 'ALL' && p.source !== filterSource) return false;
    return true;
  });

  const userTasksCount = tasks.filter((t) => t.source === 'user').length;
  const demoTasksCount = tasks.filter((t) => t.source === 'demo').length;

  const totalEstimatedHours = tasks
    .filter((t) => (filterSource === 'ALL' ? t.source === 'user' || t.source === 'demo' : t.source === filterSource))
    .filter((t) => t.status !== 'completed')
    .reduce((acc, t) => acc + (Number(t.estimatedHours) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#EBF1EC] text-[#385244]">
              <Briefcase className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-[#2D322E]">Work 專案與工作任務管理</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9]">
              Work Agent 專屬資料庫
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#6B726C]">
            Work Agent 專門讀取此處真實資料（我的資料：{userTasksCount} 筆 | 示範資料：{demoTasksCount} 筆）。絕不憑空捏造工作。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onClearDemoData && (demoTasksCount > 0 || projects.some((p) => p.source === 'demo')) && (
            <button
              id="btn-clear-demo-work"
              onClick={() => {
                if (window.confirm('確定要清除所有示範資料嗎？（這將保留你建立的所有真實資料）')) {
                  onClearDemoData();
                }
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#FAF0E6] hover:bg-[#F5E2D0] text-[#B36534] border border-[#ECD1BA] text-xs font-semibold transition-colors"
              title="清除所有示範資料，保留我的資料"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清除所有示範資料</span>
            </button>
          )}

          <button
            id="btn-ask-work-agent"
            onClick={() =>
              onAskAgentAboutWork(
                '請 Work Agent 幫我分析目前所有工作任務的優先級與截止日，並針對預估工時給出拆解與執行建議。'
              )
            }
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#EFECE5] hover:bg-[#E4DFD6] text-[#385244] border border-[#DDD8CE] text-xs font-semibold transition-colors"
          >
            <Sparkles className="w-4 h-4 text-[#4E6B56]" />
            <span>呼叫 Work Agent 分析</span>
          </button>

          <button
            id="btn-add-work-project"
            onClick={openCreateProjectModal}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#EFECE5] text-[#385244] border border-[#DDD8CE] text-xs font-semibold transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            <span>新增專案</span>
          </button>

          <button
            id="btn-add-work-task"
            onClick={openCreateTaskModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#385244] hover:bg-[#2B4035] text-white text-xs font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>新增工作任務</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#6B726C] font-medium">真實登記專案</span>
            <div className="text-xl font-bold text-[#2D322E] mt-1 font-mono">
              {projects.length} 個專案
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#E8EFEB] text-[#385244]">
            <FolderKanban className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#6B726C] font-medium">待辦與進行中任務</span>
            <div className="text-xl font-bold text-[#4E6B56] mt-1 font-mono">
              {tasks.filter((t) => t.status !== 'completed').length} / {tasks.length} 項
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#EBF1EC] text-[#4E6B56]">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#6B726C] font-medium">預估待投入總工時</span>
            <div className="text-xl font-bold text-[#B36534] mt-1 font-mono">
              ~{totalEstimatedHours.toFixed(1)} 小時
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#FAF0E6] text-[#B36534]">
            <Flame className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#EBE8E1]">
          <div className="flex items-center space-x-2">
            <FolderKanban className="w-4 h-4 text-[#385244]" />
            <h3 className="text-sm font-bold text-[#2D322E]">工作專案清單 (Projects)</h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-[#6B726C] font-mono">
              {filteredProjects.length} Active Projects
            </span>
            <button
              onClick={openCreateProjectModal}
              className="p-1 rounded-lg hover:bg-[#EFECE5] text-[#385244] text-xs font-semibold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>建立專案</span>
            </button>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="text-center py-8 px-4 border border-dashed border-[#DDD8CE] rounded-xl bg-[#FAF8F5]">
            <FolderKanban className="w-8 h-8 mx-auto text-[#A39E93] mb-2" />
            <p className="text-sm font-semibold text-[#2D322E]">目前尚未建立任何工作專案</p>
            <p className="text-xs text-[#6B726C] mt-1 max-w-md mx-auto">
              Work Agent 嚴禁捏造專案。請點擊下方按鈕手動建立您的第一個專案，以便進行任務排程與進度追蹤。
            </p>
            <button
              onClick={openCreateProjectModal}
              className="mt-3 px-3.5 py-1.5 rounded-xl bg-[#385244] text-white text-xs font-semibold hover:bg-[#2B4035] transition-colors"
            >
              + 立即建立工作專案
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E2DC] hover:border-[#4E6B56]/60 transition-all flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9]">
                        {project.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          project.source === 'user'
                            ? 'bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9]'
                            : 'bg-[#F4EDE2] text-[#8C6B3E] border border-[#E0D3BE]'
                        }`}
                      >
                        {project.source === 'user' ? '我的資料' : '示範資料'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          project.priority === 'high'
                            ? 'bg-[#FAF0E6] text-[#B36534] border border-[#ECD1BA]'
                            : 'bg-[#EFECE5] text-[#4A504B]'
                        }`}
                      >
                        {project.priority.toUpperCase()}
                      </span>
                      <button
                        onClick={() => openEditProjectModal(project)}
                        className="p-1 text-[#8C938D] hover:text-[#2D322E] hover:bg-[#EFECE5] rounded"
                        title="編輯專案"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`確定要刪除專案「${project.title}」嗎？`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                        className="p-1 text-[#8C938D] hover:text-red-600 hover:bg-[#FAF0E6] rounded"
                        title="刪除專案"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-[#2D322E] mb-1">{project.title}</h4>
                  <p className="text-xs text-[#6B726C] leading-relaxed mb-3 line-clamp-2">
                    {project.description || '無描述'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1 font-mono">
                    <span className="text-[#6B726C]">完成進度</span>
                    <span className="text-[#4E6B56] font-bold">{project.progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#EFECE5] overflow-hidden mb-2.5">
                    <div
                      className="h-full bg-[#4E6B56] rounded-full transition-all duration-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#8C938D] font-mono">
                    <span>📅 截止：{project.deadline}</span>
                    <span className="text-[#6B726C]">👤 {project.owner || '本人'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tasks Section */}
      <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#EBE8E1]">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#385244]" />
            <h3 className="text-sm font-bold text-[#2D322E]">工作任務清單 (Work Tasks)</h3>
            <span className="text-xs text-[#6B726C] font-mono">({filteredTasks.length})</span>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Source Filter */}
            <div className="flex items-center space-x-1 bg-[#F8F7F4] p-1 rounded-lg border border-[#DDD8CE] text-xs">
              <span className="text-[#8C938D] px-1 text-[11px]">資料來源:</span>
              {(['ALL', 'user', 'demo'] as const).map((src) => (
                <button
                  key={src}
                  onClick={() => setFilterSource(src)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    filterSource === src
                      ? src === 'user'
                        ? 'bg-[#385244] text-white shadow-xs'
                        : src === 'demo'
                        ? 'bg-[#8C6B3E] text-white shadow-xs'
                        : 'bg-[#4A504B] text-white shadow-xs'
                      : 'text-[#6B726C] hover:text-[#2D322E]'
                  }`}
                >
                  {src === 'ALL' ? '全部' : src === 'user' ? '我的資料' : '示範資料'}
                </button>
              ))}
            </div>

            {/* Project Filter */}
            {projects.length > 0 && (
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="bg-[#F8F7F4] border border-[#DDD8CE] text-xs rounded-lg px-2 py-1 text-[#4A504B]"
              >
                <option value="ALL">全部專案</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            )}

            {/* Priority Filter */}
            <div className="flex items-center space-x-1 bg-[#F8F7F4] p-1 rounded-lg border border-[#DDD8CE] text-xs">
              <span className="text-[#8C938D] px-1 text-[11px]">優先級:</span>
              {(['ALL', 'high', 'medium', 'low'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(p)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    filterPriority === p
                      ? 'bg-[#385244] text-white shadow-xs'
                      : 'text-[#6B726C] hover:text-[#2D322E]'
                  }`}
                >
                  {p === 'ALL' ? '全部' : p.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1 bg-[#F8F7F4] p-1 rounded-lg border border-[#DDD8CE] text-xs">
              <span className="text-[#8C938D] px-1 text-[11px]">狀態:</span>
              {(['ALL', 'todo', 'in_progress', 'completed', 'delayed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    filterStatus === s
                      ? 'bg-[#385244] text-white shadow-xs'
                      : 'text-[#6B726C] hover:text-[#2D322E]'
                  }`}
                >
                  {s === 'ALL'
                    ? '全部'
                    : s === 'todo'
                    ? '待辦'
                    : s === 'in_progress'
                    ? '進行中'
                    : s === 'completed'
                    ? '已完成'
                    : '已延遲'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Task List or Empty State */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-[#DDD8CE] rounded-xl bg-[#FAF8F5]">
            <CheckCircle2 className="w-8 h-8 mx-auto text-[#A39E93] mb-2" />
            <p className="text-sm font-semibold text-[#2D322E]">查無符合條件的工作任務</p>
            <p className="text-xs text-[#6B726C] mt-1 max-w-md mx-auto">
              Work Agent 僅能分析真實登記的任務。點擊下方按鈕手動新增任務，並填寫預估工時與截止日期。
            </p>
            <button
              onClick={openCreateTaskModal}
              className="mt-3 px-4 py-2 rounded-xl bg-[#385244] text-white text-xs font-semibold hover:bg-[#2B4035] transition-colors"
            >
              + 建立工作任務
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const isDone = task.status === 'completed';
              const isDelayed = task.status === 'delayed';

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs ${
                    isDone
                      ? 'bg-[#FAF8F5] border-[#E5E2DC] opacity-65'
                      : isDelayed
                      ? 'bg-[#FFFBF5] border-[#ECD1BA]'
                      : 'bg-[#FFFFFF] border-[#E5E2DC] hover:border-[#4E6B56]/60'
                  }`}
                >
                  <div className="flex items-start space-x-3.5 flex-1">
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className={`mt-1 flex items-center justify-center w-5 h-5 rounded-md border transition-colors shrink-0 ${
                        isDone
                          ? 'bg-[#385244] border-[#385244] text-white'
                          : 'border-[#DDD8CE] hover:border-[#385244] text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    <div className="space-y-1.5 flex-1">
                      {/* Meta Tags */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            task.source === 'user'
                              ? 'bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9]'
                              : 'bg-[#F4EDE2] text-[#8C6B3E] border border-[#E0D3BE]'
                          }`}
                        >
                          {task.source === 'user' ? '我的資料' : '示範資料'}
                        </span>

                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#EFECE5] text-[#4A504B] font-medium">
                          📁 {task.projectName}
                        </span>

                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            task.priority === 'high'
                              ? 'bg-[#FAF0E6] text-[#7D3E1B] border border-[#ECD1BA]'
                              : task.priority === 'medium'
                              ? 'bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9]'
                              : 'bg-[#EFECE5] text-[#6B726C]'
                          }`}
                        >
                          {task.priority.toUpperCase()}
                        </span>

                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                            task.status === 'completed'
                              ? 'bg-[#EBF1EC] text-[#2D4835]'
                              : task.status === 'in_progress'
                              ? 'bg-[#E8EFEB] text-[#385244]'
                              : task.status === 'delayed'
                              ? 'bg-[#FAF0E6] text-[#B36534]'
                              : 'bg-[#F4F0E8] text-[#5C645D]'
                          }`}
                        >
                          {task.status === 'completed'
                            ? '已完成'
                            : task.status === 'in_progress'
                            ? '進行中'
                            : task.status === 'delayed'
                            ? '已延遲'
                            : '待辦'}
                        </span>

                        {task.isUrgent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#B36534] text-white">
                            🔥 緊急
                          </span>
                        )}

                        {task.assignee && (
                          <span className="text-[11px] text-[#6B726C] flex items-center space-x-0.5">
                            <User className="w-3 h-3 text-[#8C938D]" />
                            <span>{task.assignee}</span>
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4
                        className={`text-sm font-semibold text-[#2D322E] ${
                          isDone ? 'line-through text-[#8C938D]' : ''
                        }`}
                      >
                        {task.title}
                      </h4>

                      {/* Notes if available */}
                      {task.notes && (
                        <p className="text-xs text-[#6B726C] bg-[#FAF8F5] p-2 rounded-lg border border-[#EBE8E1]">
                          📝 備註：{task.notes}
                        </p>
                      )}

                      {/* Timeline & Duration */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B726C] font-mono pt-0.5">
                        <span className="flex items-center space-x-1 text-[#385244] font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>預估工時：{task.estimatedHours} 小時</span>
                        </span>
                        {task.startDate && (
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-[#8C938D]" />
                            <span>開始：{task.startDate}</span>
                          </span>
                        )}
                        <span className="flex items-center space-x-1 text-[#B36534] font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>截止：{task.deadline}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 pt-2 md:pt-0 border-t md:border-t-0 border-[#EBE8E1] justify-end">
                    <button
                      onClick={() =>
                        onAskAgentAboutWork(
                          `請 Work Agent 幫我分析並拆解「${task.title}」（所屬專案：${task.projectName}，預估工時：${task.estimatedHours}h，截止日：${task.deadline}）的具體執行步驟與時間規劃。`
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg text-[#385244] bg-[#EBF1EC] hover:bg-[#DDE8DF] text-xs flex items-center space-x-1 transition-colors font-medium"
                      title="請 Work Agent 拆解此任務"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#4E6B56]" />
                      <span>拆解分析</span>
                    </button>

                    <button
                      onClick={() => openEditTaskModal(task)}
                      className="p-1.5 rounded-lg text-[#6B726C] hover:text-[#2D322E] hover:bg-[#EFECE5] transition-colors"
                      title="編輯任務"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        if (window.confirm(`確定要刪除任務「${task.title}」嗎？`)) {
                          onDeleteTask(task.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-[#8C938D] hover:text-red-600 hover:bg-[#FAF0E6] transition-colors"
                      title="刪除任務"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Task Modal (Create & Edit) */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#E5E2DC] rounded-2xl max-w-lg w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#EBE8E1]">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-[#385244]" />
                <h3 className="text-base font-bold text-[#2D322E]">
                  {editingTask ? '編輯工作任務' : '手動建立工作任務'}
                </h3>
              </div>
              <span className="text-xs text-[#6B726C]">Work Agent 資料庫</span>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
              {/* Task Title */}
              <div>
                <label className="block text-[#4A504B] font-semibold mb-1">
                  任務名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：重構會員結帳 API 與撰寫單元測試"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

              {/* Project Select */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">所屬專案</label>
                  <select
                    value={taskProjectId}
                    onChange={(e) => setTaskProjectId(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.category})
                      </option>
                    ))}
                    <option value="custom">+ 自訂/手動輸入專案名稱</option>
                  </select>
                </div>

                {taskProjectId === 'custom' && (
                  <div className="col-span-full">
                    <label className="block text-[#4A504B] font-semibold mb-1">
                      專案名稱 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={taskCustomProjectName}
                      onChange={(e) => setTaskCustomProjectName(e.target.value)}
                      placeholder="例如：AI 個人管理系統"
                      className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">負責人 / 擔當</label>
                  <input
                    type="text"
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    placeholder="本人 / 團隊成員"
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">優先順序</label>
                  <select
                    value={taskPriority}
                    onChange={(e: any) => setTaskPriority(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  >
                    <option value="high">High (高優先)</option>
                    <option value="medium">Medium (中等)</option>
                    <option value="low">Low (低)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">任務狀態</label>
                  <select
                    value={taskStatus}
                    onChange={(e: any) => setTaskStatus(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  >
                    <option value="todo">待辦 (Todo)</option>
                    <option value="in_progress">進行中 (In Progress)</option>
                    <option value="delayed">已延遲 (Delayed)</option>
                    <option value="completed">已完成 (Completed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">預估工時 (小時)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={taskHours}
                    onChange={(e) => setTaskHours(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">開始日期</label>
                  <input
                    type="text"
                    value={taskStartDate}
                    onChange={(e) => setTaskStartDate(e.target.value)}
                    placeholder="2026-09-02 / 今天"
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">
                    截止日期 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    placeholder="例如：明天 17:00 / 2026-09-03"
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[#4A504B] font-semibold mb-1">備註說明 (選填)</label>
                <textarea
                  rows={2}
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="提供具體上下文，供 Work Agent 進行深度拆解與防禦性提醒..."
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

              {/* Urgent Toggle */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="task-is-urgent"
                  checked={taskIsUrgent}
                  onChange={(e) => setTaskIsUrgent(e.target.checked)}
                  className="rounded border-[#DDD8CE] text-[#385244] focus:ring-[#385244]"
                />
                <label htmlFor="task-is-urgent" className="text-xs font-semibold text-[#2D322E]">
                  標記為緊急任務 (🔥 Urgent)
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-[#EBE8E1]">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#EFECE5] text-[#4A504B] hover:bg-[#E4DFD6] font-medium text-xs transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#385244] hover:bg-[#2B4035] text-white font-medium text-xs shadow-xs transition-colors"
                >
                  {editingTask ? '更新任務' : '儲存建立'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Modal (Create & Edit) */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#E5E2DC] rounded-2xl max-w-lg w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#EBE8E1]">
              <div className="flex items-center space-x-2">
                <FolderKanban className="w-5 h-5 text-[#385244]" />
                <h3 className="text-base font-bold text-[#2D322E]">
                  {editingProject ? '編輯工作專案' : '新增工作專案'}
                </h3>
              </div>
              <span className="text-xs text-[#6B726C]">Work Agent 專案庫</span>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#4A504B] font-semibold mb-1">
                  專案名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：電商核心結帳系統重構"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">專案類別</label>
                  <input
                    type="text"
                    value={projectCategory}
                    onChange={(e) => setProjectCategory(e.target.value)}
                    placeholder="軟體工程 / 商業提案 / 行銷企劃"
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">負責人</label>
                  <input
                    type="text"
                    value={projectOwner}
                    onChange={(e) => setProjectOwner(e.target.value)}
                    placeholder="本人 / 專案經理"
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">優先順序</label>
                  <select
                    value={projectPriority}
                    onChange={(e: any) => setProjectPriority(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  >
                    <option value="high">High (高)</option>
                    <option value="medium">Medium (中)</option>
                    <option value="low">Low (低)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">專案狀態</label>
                  <select
                    value={projectStatus}
                    onChange={(e: any) => setProjectStatus(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  >
                    <option value="planning">規劃中 (Planning)</option>
                    <option value="in_progress">進行中 (In Progress)</option>
                    <option value="completed">已結案 (Completed)</option>
                    <option value="on_hold">暫緩 (On Hold)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">完成進度 (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={projectProgress}
                    onChange={(e) => setProjectProgress(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">專案截止日</label>
                  <input
                    type="text"
                    value={projectDeadline}
                    onChange={(e) => setProjectDeadline(e.target.value)}
                    placeholder="2026-09-30 / 下週五"
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">標籤 (逗號分隔)</label>
                  <input
                    type="text"
                    value={projectTags}
                    onChange={(e) => setProjectTags(e.target.value)}
                    placeholder="Backend, API, Q3"
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#4A504B] font-semibold mb-1">專案描述</label>
                <textarea
                  rows={2}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="簡要描述專案目標與核心交付內容..."
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-[#EBE8E1]">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#EFECE5] text-[#4A504B] hover:bg-[#E4DFD6] font-medium text-xs transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#385244] hover:bg-[#2B4035] text-white font-medium text-xs shadow-xs transition-colors"
                >
                  {editingProject ? '更新專案' : '建立專案'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
