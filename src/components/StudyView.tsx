import React, { useState } from 'react';
import {
  GraduationCap,
  Plus,
  BookOpen,
  Calendar,
  Sparkles,
  Check,
  Flame,
  FileText,
  Trash2,
  Edit2,
  AlertOctagon,
  BookPlus,
  Target,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { StudySubject, StudyTask } from '../types';

interface StudyViewProps {
  subjects: StudySubject[];
  tasks: StudyTask[];
  onToggleTask: (taskId: string) => void;
  onAddTask: (task: Omit<StudyTask, 'id'>) => void;
  onUpdateTask: (task: StudyTask) => void;
  onDeleteTask: (taskId: string) => void;
  onAddSubject: (subject: Omit<StudySubject, 'id'>) => void;
  onUpdateSubject: (subject: StudySubject) => void;
  onDeleteSubject: (subjectId: string) => void;
  onAskAgentAboutStudy: (prompt: string) => void;
  onClearDemoData?: () => void;
}

export const StudyView: React.FC<StudyViewProps> = ({
  subjects,
  tasks,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubject,
  onAskAgentAboutStudy,
  onClearDemoData,
}) => {
  // Filters
  const [filterSource, setFilterSource] = useState<'ALL' | 'user' | 'demo'>('ALL');
  const [filterDifficulty, setFilterDifficulty] = useState<'ALL' | 'hard' | 'medium' | 'easy'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'todo' | 'in_progress' | 'completed' | 'delayed'>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'exam' | 'assignment' | 'study_task'>('ALL');
  const [filterSubject, setFilterSubject] = useState<string>('ALL');

  // Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubjectId, setTaskSubjectId] = useState('');
  const [taskChapter, setTaskChapter] = useState('');
  const [taskType, setTaskType] = useState<'study_task' | 'assignment' | 'exam'>('exam');
  const [taskDifficulty, setTaskDifficulty] = useState<'hard' | 'medium' | 'easy'>('hard');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [taskStatus, setTaskStatus] = useState<'todo' | 'in_progress' | 'completed' | 'delayed'>('todo');
  const [taskProgress, setTaskProgress] = useState(0);
  const [taskHours, setTaskHours] = useState(2);
  const [taskDeadline, setTaskDeadline] = useState('明天 22:00');
  const [taskSupervision, setTaskSupervision] = useState('按表操課！請務必手寫推導與實作題目，嚴禁拖延。');
  const [taskNotes, setTaskNotes] = useState('');

  // Subject Modal State
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<StudySubject | null>(null);

  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('CS201');
  const [subjectCredits, setSubjectCredits] = useState(3);
  const [subjectProgress, setSubjectProgress] = useState(40);
  const [subjectExamDate, setSubjectExamDate] = useState('2026-09-18 (期中考)');
  const [subjectSupervisorTone, setSupervisorTone] = useState('嚴格督促：按表操課，絕不拖延！');
  const [subjectTeacherNotes, setSubjectTeacherNotes] = useState('');
  const [subjectStatus, setSubjectStatus] = useState<'in_progress' | 'completed' | 'exam_prep'>('exam_prep');
  const [subjectFocusTopics, setSubjectFocusTopics] = useState('圖論, 樹狀結構, 演算法複雜度');

  // Open Task Modal (Add/Edit)
  const openCreateTaskModal = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskSubjectId(subjects[0]?.id || '');
    setTaskChapter('重點單元');
    setTaskType('exam');
    setTaskDifficulty('hard');
    setTaskPriority('high');
    setTaskStatus('todo');
    setTaskProgress(0);
    setTaskHours(2);
    setTaskDeadline('明天 22:00');
    setTaskSupervision('按表操課！請關閉通訊軟體，專注完成練習。');
    setTaskNotes('');
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task: StudyTask) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskSubjectId(task.subjectId);
    setTaskChapter(task.chapter || '');
    setTaskType(task.type || 'study_task');
    setTaskDifficulty(task.difficulty || 'medium');
    setTaskPriority(task.priority || 'high');
    setTaskStatus(task.status || 'todo');
    setTaskProgress(task.progress || 0);
    setTaskHours(task.estimatedHours);
    setTaskDeadline(task.deadline);
    setTaskSupervision(task.supervisionNote || '');
    setTaskNotes(task.notes || '');
    setShowTaskModal(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const matchedSubject = subjects.find((s) => s.id === taskSubjectId);
    const subjectName = matchedSubject ? matchedSubject.name : '學業科目';

    if (editingTask) {
      onUpdateTask({
        ...editingTask,
        title: taskTitle.trim(),
        subjectId: taskSubjectId,
        subjectName,
        chapter: taskChapter.trim(),
        type: taskType,
        difficulty: taskDifficulty,
        priority: taskPriority,
        status: taskStatus,
        progress: Number(taskProgress) || 0,
        estimatedHours: Number(taskHours) || 1,
        deadline: taskDeadline.trim(),
        supervisionNote: taskSupervision.trim(),
        notes: taskNotes.trim(),
      });
    } else {
      onAddTask({
        title: taskTitle.trim(),
        subjectId: taskSubjectId || 'subj-custom',
        subjectName,
        chapter: taskChapter.trim(),
        type: taskType,
        difficulty: taskDifficulty,
        priority: taskPriority,
        status: taskStatus,
        progress: Number(taskProgress) || 0,
        estimatedHours: Number(taskHours) || 1,
        deadline: taskDeadline.trim(),
        supervisionNote: taskSupervision.trim(),
        notes: taskNotes.trim(),
        source: 'user',
        createdBy: 'user',
      });
    }

    setShowTaskModal(false);
  };

  // Open Subject Modal (Add/Edit)
  const openCreateSubjectModal = () => {
    setEditingSubject(null);
    setSubjectName('');
    setSubjectCode('CS101');
    setSubjectCredits(3);
    setSubjectProgress(30);
    setSubjectExamDate('2026-09-20');
    setSupervisorTone('嚴格督促：重點複習，按表操課！');
    setSubjectTeacherNotes('');
    setSubjectStatus('exam_prep');
    setSubjectFocusTopics('核心基礎, 實作測驗');
    setShowSubjectModal(true);
  };

  const openEditSubjectModal = (subj: StudySubject) => {
    setEditingSubject(subj);
    setSubjectName(subj.name);
    setSubjectCode(subj.code);
    setSubjectCredits(subj.credits);
    setSubjectProgress(subj.progress);
    setSubjectExamDate(subj.nextExamDate || '');
    setSupervisorTone(subj.supervisorTone || '按表操課');
    setSubjectTeacherNotes(subj.teacherOrNotes || '');
    setSubjectStatus(subj.status);
    setSubjectFocusTopics((subj.focusTopics || []).join(', '));
    setShowSubjectModal(true);
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;

    const focusTopicsArr = subjectFocusTopics
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingSubject) {
      onUpdateSubject({
        ...editingSubject,
        name: subjectName.trim(),
        code: subjectCode.trim(),
        credits: Number(subjectCredits) || 3,
        progress: Number(subjectProgress) || 0,
        nextExamDate: subjectExamDate.trim(),
        supervisorTone: subjectSupervisorTone.trim(),
        teacherOrNotes: subjectTeacherNotes.trim(),
        status: subjectStatus,
        focusTopics: focusTopicsArr,
      });
    } else {
      onAddSubject({
        name: subjectName.trim(),
        code: subjectCode.trim(),
        credits: Number(subjectCredits) || 3,
        progress: Number(subjectProgress) || 0,
        nextExamDate: subjectExamDate.trim(),
        supervisorTone: subjectSupervisorTone.trim(),
        teacherOrNotes: subjectTeacherNotes.trim(),
        status: subjectStatus,
        focusTopics: focusTopicsArr,
        source: 'user',
        createdBy: 'user',
      });
    }

    setShowSubjectModal(false);
  };

  // Filter Tasks
  const filteredTasks = tasks.filter((t) => {
    if (filterSource !== 'ALL' && t.source !== filterSource) return false;
    if (filterDifficulty !== 'ALL' && t.difficulty !== filterDifficulty) return false;
    if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
    if (filterType !== 'ALL' && t.type !== filterType) return false;
    if (filterSubject !== 'ALL' && t.subjectId !== filterSubject) return false;
    return true;
  });

  const filteredSubjects = subjects.filter((s) => {
    if (filterSource !== 'ALL' && s.source !== filterSource) return false;
    return true;
  });

  const userStudyTasksCount = tasks.filter((t) => t.source === 'user').length;
  const demoStudyTasksCount = tasks.filter((t) => t.source === 'demo').length;

  const totalStudyHours = tasks
    .filter((t) => (filterSource === 'ALL' ? t.source === 'user' || t.source === 'demo' : t.source === filterSource))
    .filter((t) => t.status !== 'completed')
    .reduce((acc, t) => acc + (Number(t.estimatedHours) || 0), 0);

  const totalCredits = filteredSubjects.reduce((acc, s) => acc + (Number(s.credits) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#FAF0E6] text-[#B36534]">
              <GraduationCap className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-[#2D322E]">Study 課業科目與按表操課督促</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-[#FAF0E6] text-[#7D3E1B] border border-[#ECD1BA]">
              Study Agent 專屬資料庫
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#6B726C]">
            Study Agent 專門追蹤真實學科進度（我的資料：{userStudyTasksCount} 筆 | 示範資料：{demoStudyTasksCount} 筆），貫徹「按表操課」嚴格督促。嚴禁捏造不存在的科目或考題。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onClearDemoData && (demoStudyTasksCount > 0 || subjects.some((s) => s.source === 'demo')) && (
            <button
              id="btn-clear-demo-study"
              onClick={() => {
                if (window.confirm('確定要清除所有示範資料嗎？（這將保留你建立的所有真實課業資料）')) {
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
            id="btn-ask-study-agent"
            onClick={() =>
              onAskAgentAboutStudy(
                '請 Study Agent 檢視我目前登記的所有科目與考試任務，依據掌握度與倒數天數，制定一份高強度的按表操課複習計畫！'
              )
            }
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#EFECE5] hover:bg-[#E4DFD6] text-[#385244] border border-[#DDD8CE] text-xs font-semibold transition-colors"
          >
            <Sparkles className="w-4 h-4 text-[#4E6B56]" />
            <span>呼叫 Study Agent 制定複習計畫</span>
          </button>

          <button
            id="btn-add-study-subject"
            onClick={openCreateSubjectModal}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#FAF8F5] hover:bg-[#EFECE5] text-[#385244] border border-[#DDD8CE] text-xs font-semibold transition-colors"
          >
            <BookPlus className="w-4 h-4" />
            <span>新增學科科目</span>
          </button>

          <button
            id="btn-add-study-task"
            onClick={openCreateTaskModal}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#385244] hover:bg-[#2B4035] text-white text-xs font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>新增學習任務</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#6B726C] font-medium">修習學科科目</span>
            <div className="text-xl font-bold text-[#2D322E] mt-1 font-mono">
              {subjects.length} 門學科 ({totalCredits} 學分)
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#EBF1EC] text-[#385244]">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#6B726C] font-medium">待完成學習任務</span>
            <div className="text-xl font-bold text-[#4E6B56] mt-1 font-mono">
              {tasks.filter((t) => t.status !== 'completed').length} / {tasks.length} 項
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#FAF0E6] text-[#B36534]">
            <Target className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#6B726C] font-medium">預估總學習時數</span>
            <div className="text-xl font-bold text-[#B36534] mt-1 font-mono">
              ~{totalStudyHours.toFixed(1)} 小時
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#FAF0E6] text-[#B36534]">
            <Flame className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Subjects Section */}
      <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#EBE8E1]">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-[#385244]" />
            <h3 className="text-sm font-bold text-[#2D322E]">學科科目清單 (Subjects)</h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-[#6B726C] font-mono">{filteredSubjects.length} Enrolled</span>
            <button
              onClick={openCreateSubjectModal}
              className="p-1 rounded-lg hover:bg-[#EFECE5] text-[#385244] text-xs font-semibold flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>建立科目</span>
            </button>
          </div>
        </div>

        {filteredSubjects.length === 0 ? (
          <div className="text-center py-8 px-4 border border-dashed border-[#DDD8CE] rounded-xl bg-[#FAF8F5]">
            <BookOpen className="w-8 h-8 mx-auto text-[#A39E93] mb-2" />
            <p className="text-sm font-semibold text-[#2D322E]">目前尚未建立任何課業科目</p>
            <p className="text-xs text-[#6B726C] mt-1 max-w-md mx-auto">
              Study Agent 嚴禁捏造課程或考試。請點擊下方按鈕建立真實修習的學科與期考日程。
            </p>
            <button
              onClick={openCreateSubjectModal}
              className="mt-3 px-3.5 py-1.5 rounded-xl bg-[#385244] text-white text-xs font-semibold hover:bg-[#2B4035] transition-colors"
            >
              + 建立學科科目
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredSubjects.map((subject) => (
              <div
                key={subject.id}
                className="p-4 rounded-xl bg-[#FFFFFF] border border-[#E5E2DC] hover:border-[#B36534]/50 transition-all flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EFECE5] text-[#4A504B]">
                        {subject.code} · {subject.credits} 學分
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          subject.source === 'user'
                            ? 'bg-[#EBF1EC] text-[#2D4835] border border-[#C6DAC9]'
                            : 'bg-[#F4EDE2] text-[#8C6B3E] border border-[#E0D3BE]'
                        }`}
                      >
                        {subject.source === 'user' ? '我的資料' : '示範資料'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          subject.status === 'exam_prep'
                            ? 'bg-[#FAF0E6] text-[#7D3E1B] border border-[#ECD1BA]'
                            : 'bg-[#EBF1EC] text-[#2D4835]'
                        }`}
                      >
                        {subject.status === 'exam_prep' ? '期考衝刺' : '授課進行中'}
                      </span>
                      <button
                        onClick={() => openEditSubjectModal(subject)}
                        className="p-1 text-[#8C938D] hover:text-[#2D322E] hover:bg-[#EFECE5] rounded"
                        title="編輯科目"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`確定要刪除科目「${subject.name}」嗎？`)) {
                            onDeleteSubject(subject.id);
                          }
                        }}
                        className="p-1 text-[#8C938D] hover:text-red-600 hover:bg-[#FAF0E6] rounded"
                        title="刪除科目"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-[#2D322E] mb-1">{subject.name}</h4>
                  {subject.supervisorTone && (
                    <p className="text-xs text-[#7D3E1B] bg-[#FAF0E6] p-1.5 rounded-lg mb-2.5 font-medium leading-relaxed">
                      🚨 {subject.supervisorTone}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1 font-mono">
                    <span className="text-[#6B726C]">掌握度</span>
                    <span className="text-[#B36534] font-bold">{subject.progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#EFECE5] overflow-hidden mb-2.5">
                    <div
                      className="h-full bg-[#B36534] rounded-full transition-all duration-500"
                      style={{ width: `${subject.progress}%` }}
                    />
                  </div>

                  <div className="text-[11px] text-[#8C938D] font-mono flex items-center justify-between">
                    <span>📅 考試：{subject.nextExamDate || '未設定'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Study Tasks Section */}
      <div className="p-5 rounded-2xl bg-[#FFFFFF] border border-[#E5E2DC] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#EBE8E1]">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-[#385244]" />
            <h3 className="text-sm font-bold text-[#2D322E]">課業任務與衝刺清單 (Study Tasks)</h3>
            <span className="text-xs text-[#6B726C] font-mono">({filteredTasks.length})</span>
          </div>

          {/* Filters */}
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

            {/* Subject Filter */}
            {subjects.length > 0 && (
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="bg-[#F8F7F4] border border-[#DDD8CE] text-xs rounded-lg px-2 py-1 text-[#4A504B]"
              >
                <option value="ALL">全部科目</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}

            {/* Type Filter */}
            <div className="flex items-center space-x-1 bg-[#F8F7F4] p-1 rounded-lg border border-[#DDD8CE] text-xs">
              <span className="text-[#8C938D] px-1 text-[11px]">類型:</span>
              {(['ALL', 'exam', 'assignment', 'study_task'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    filterType === t
                      ? 'bg-[#385244] text-white shadow-xs'
                      : 'text-[#6B726C] hover:text-[#2D322E]'
                  }`}
                >
                  {t === 'ALL'
                    ? '全部'
                    : t === 'exam'
                    ? '考試'
                    : t === 'assignment'
                    ? '作業'
                    : '學習'}
                </button>
              ))}
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center space-x-1 bg-[#F8F7F4] p-1 rounded-lg border border-[#DDD8CE] text-xs">
              <span className="text-[#8C938D] px-1 text-[11px]">難度:</span>
              {(['ALL', 'hard', 'medium', 'easy'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setFilterDifficulty(d)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    filterDifficulty === d
                      ? 'bg-[#B36534] text-white shadow-xs'
                      : 'text-[#6B726C] hover:text-[#2D322E]'
                  }`}
                >
                  {d === 'ALL' ? '全部' : d.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Task List or Empty State */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-10 px-4 border border-dashed border-[#DDD8CE] rounded-xl bg-[#FAF8F5]">
            <BookOpen className="w-8 h-8 mx-auto text-[#A39E93] mb-2" />
            <p className="text-sm font-semibold text-[#2D322E]">查無符合條件的課業任務</p>
            <p className="text-xs text-[#6B726C] mt-1 max-w-md mx-auto">
              Study Agent 僅依據真實登記的任務進行按表操課督促。點擊下方按鈕手動新增學習與複習任務。
            </p>
            <button
              onClick={openCreateTaskModal}
              className="mt-3 px-4 py-2 rounded-xl bg-[#385244] text-white text-xs font-semibold hover:bg-[#2B4035] transition-colors"
            >
              + 建立學習任務
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const isDone = task.status === 'completed';

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs ${
                    isDone
                      ? 'bg-[#FAF8F5] border-[#E5E2DC] opacity-65'
                      : 'bg-[#FFFFFF] border-[#E5E2DC] hover:border-[#B36534]/50'
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

                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#FAF0E6] text-[#7D3E1B] font-semibold border border-[#ECD1BA]">
                          📚 {task.subjectName}
                        </span>

                        {task.chapter && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#EFECE5] text-[#4A504B]">
                            {task.chapter}
                          </span>
                        )}

                        <span
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            task.difficulty === 'hard'
                              ? 'bg-[#FAF0E6] text-[#B36534] border border-[#ECD1BA]'
                              : task.difficulty === 'medium'
                              ? 'bg-[#EBF1EC] text-[#2D4835]'
                              : 'bg-[#EFECE5] text-[#6B726C]'
                          }`}
                        >
                          {(task.difficulty || 'medium').toUpperCase()}
                        </span>

                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                            task.status === 'completed'
                              ? 'bg-[#EBF1EC] text-[#2D4835]'
                              : task.status === 'in_progress'
                              ? 'bg-[#FAF0E6] text-[#7D3E1B]'
                              : 'bg-[#F4F0E8] text-[#5C645D]'
                          }`}
                        >
                          {task.status === 'completed'
                            ? '已完成'
                            : task.status === 'in_progress'
                            ? '進行中'
                            : '待辦'}
                        </span>
                      </div>

                      {/* Title */}
                      <h4
                        className={`text-sm font-semibold text-[#2D322E] ${
                          isDone ? 'line-through text-[#8C938D]' : ''
                        }`}
                      >
                        {task.title}
                      </h4>

                      {/* Supervision Note */}
                      {task.supervisionNote && (
                        <div className="flex items-start space-x-1.5 text-xs text-[#7D3E1B] bg-[#FAF0E6] p-2 rounded-lg border border-[#ECD1BA]">
                          <ShieldAlert className="w-3.5 h-3.5 text-[#B36534] shrink-0 mt-0.5" />
                          <span>
                            <strong>按表操課督促：</strong>
                            {task.supervisionNote}
                          </span>
                        </div>
                      )}

                      {/* Timeline & Duration */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B726C] font-mono pt-0.5">
                        <span className="flex items-center space-x-1 text-[#385244] font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>預估時間：{task.estimatedHours} 小時</span>
                        </span>
                        <span className="flex items-center space-x-1 text-[#B36534] font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>截止：{task.deadline}</span>
                        </span>
                        <span>掌握度：{task.progress}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 pt-2 md:pt-0 border-t md:border-t-0 border-[#EBE8E1] justify-end">
                    <button
                      onClick={() =>
                        onAskAgentAboutStudy(
                          `請 Study Agent 針對科目「${task.subjectName}」的任務「${task.title}」（單元：${task.chapter}，預估時數：${task.estimatedHours}h），幫我擬定一份高效率按表操課的衝刺複習計畫與自我檢核要點。`
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg text-[#7D3E1B] bg-[#FAF0E6] hover:bg-[#F3E3D3] text-xs flex items-center space-x-1 transition-colors font-medium border border-[#ECD1BA]"
                      title="請 Study Agent 擬定複習計畫"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#B36534]" />
                      <span>複習計畫</span>
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
                        if (window.confirm(`確定要刪除學習任務「${task.title}」嗎？`)) {
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
                <GraduationCap className="w-5 h-5 text-[#B36534]" />
                <h3 className="text-base font-bold text-[#2D322E]">
                  {editingTask ? '編輯學習任務' : '手動建立學習任務'}
                </h3>
              </div>
              <span className="text-xs text-[#6B726C]">Study Agent 資料庫</span>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#4A504B] font-semibold mb-1">
                  任務名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：演算法期中重點複習（圖論與 Dijkstra）"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">所屬科目</label>
                  <select
                    value={taskSubjectId}
                    onChange={(e) => setTaskSubjectId(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                    {subjects.length === 0 && <option value="">(無科目，將列為未歸類)</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">章節 / 單元</label>
                  <input
                    type="text"
                    value={taskChapter}
                    onChange={(e) => setTaskChapter(e.target.value)}
                    placeholder="例如：Ch 6-8 圖論與短路徑"
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">任務類型</label>
                  <select
                    value={taskType}
                    onChange={(e: any) => setTaskType(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  >
                    <option value="exam">考試衝刺 (Exam)</option>
                    <option value="assignment">作業習題 (Assignment)</option>
                    <option value="study_task">日常預習/複習 (Study)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">難易度</label>
                  <select
                    value={taskDifficulty}
                    onChange={(e: any) => setTaskDifficulty(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  >
                    <option value="hard">Hard (高難度)</option>
                    <option value="medium">Medium (中等)</option>
                    <option value="easy">Easy (基礎)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">預估時數 (小時)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="12"
                    value={taskHours}
                    onChange={(e) => setTaskHours(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">
                    截止日期 / 考試時間 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    placeholder="例如：今晚 22:00 / 2026-09-04"
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">目前進度掌握度 (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={taskProgress}
                    onChange={(e) => setTaskProgress(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#4A504B] font-semibold mb-1">
                  Study Agent 按表操課督促叮嚀
                </label>
                <textarea
                  rows={2}
                  value={taskSupervision}
                  onChange={(e) => setTaskSupervision(e.target.value)}
                  placeholder="輸入要由 Study Agent 提醒你的督促要點（如：親手推導演算法、嚴禁滑手機）"
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

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

      {/* Subject Modal (Create & Edit) */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#E5E2DC] rounded-2xl max-w-lg w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#EBE8E1]">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-[#B36534]" />
                <h3 className="text-base font-bold text-[#2D322E]">
                  {editingSubject ? '編輯學科科目' : '新增學科科目'}
                </h3>
              </div>
              <span className="text-xs text-[#6B726C]">Study Agent 科目庫</span>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#4A504B] font-semibold mb-1">
                  科目名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：資料結構與演算法"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">課程代碼</label>
                  <input
                    type="text"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    placeholder="CS201"
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">學分數</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={subjectCredits}
                    onChange={(e) => setSubjectCredits(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">期中/期末考日期</label>
                  <input
                    type="text"
                    value={subjectExamDate}
                    onChange={(e) => setSubjectExamDate(e.target.value)}
                    placeholder="例如：2026-09-18 (期中考)"
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>

                <div>
                  <label className="block text-[#4A504B] font-semibold mb-1">整體掌握度 (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={subjectProgress}
                    onChange={(e) => setSubjectProgress(Number(e.target.value))}
                    className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#4A504B] font-semibold mb-1">督導風格 / 叮嚀</label>
                <input
                  type="text"
                  value={subjectSupervisorTone}
                  onChange={(e) => setSupervisorTone(e.target.value)}
                  placeholder="嚴格督促：按表操課，絕不拖延！"
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

              <div>
                <label className="block text-[#4A504B] font-semibold mb-1">
                  重點章節 (逗號分隔)
                </label>
                <input
                  type="text"
                  value={subjectFocusTopics}
                  onChange={(e) => setSubjectFocusTopics(e.target.value)}
                  placeholder="圖論, 樹狀結構, 動態規劃"
                  className="w-full bg-[#FAF8F5] border border-[#DDD8CE] rounded-xl px-3 py-2 text-sm text-[#2D322E] focus:outline-none focus:border-[#385244]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-[#EBE8E1]">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#EFECE5] text-[#4A504B] hover:bg-[#E4DFD6] font-medium text-xs transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#385244] hover:bg-[#2B4035] text-white font-medium text-xs shadow-xs transition-colors"
                >
                  {editingSubject ? '更新科目' : '建立科目'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
