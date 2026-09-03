import React, { useMemo, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { analyzeManagerState, RescheduleProposal } from '../engines/managerEngine';

const insightStyles = {
  danger: {
    box: 'border-red-200 bg-red-50',
    icon: '🔴',
  },
  warning: {
    box: 'border-amber-200 bg-amber-50',
    icon: '🟡',
  },
  normal: {
    box: 'border-emerald-200 bg-emerald-50',
    icon: '🟢',
  },
};

const OwnerDashboard: React.FC = () => {
  const {
    workTasks,
    studyTasks,
    todayBlocks,
    updateWorkTask,
    updateStudyTask,
  } = useAppData();

  const [dismissedProposals, setDismissedProposals] = useState<string[]>([]);
  const [processingProposalId, setProcessingProposalId] = useState<string | null>(null);

  const now = new Date();
  const todayString = now.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const managerAnalysis = useMemo(
    () => analyzeManagerState({ workTasks, studyTasks, todayBlocks, now }),
    [workTasks, studyTasks, todayBlocks]
  );

  const workStats = useMemo(() => {
    const userTasks = workTasks.filter((task) => task.source === 'user');
    return {
      total: userTasks.length,
      completed: userTasks.filter((task) => task.status === 'completed').length,
    };
  }, [workTasks]);

  const studyStats = useMemo(() => {
    const userTasks = studyTasks.filter((task) => task.source === 'user');
    return {
      total: userTasks.length,
      completed: userTasks.filter((task) => task.status === 'completed').length,
    };
  }, [studyTasks]);

  const totalTasks = workStats.total + studyStats.total;
  const completedTasks = workStats.completed + studyStats.completed;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const currentBlock = managerAnalysis.currentBlock;

  const activeProposals = managerAnalysis.rescheduleProposals.filter(
    (proposal) => !dismissedProposals.includes(proposal.id)
  );

  const findTask = (proposal: RescheduleProposal) => {
    return proposal.taskType === 'work'
      ? workTasks.find((task) => task.id === proposal.taskId)
      : studyTasks.find((task) => task.id === proposal.taskId);
  };

  const handleAcceptProposal = (proposal: RescheduleProposal) => {
    const task = findTask(proposal);
    if (!task) {
      window.alert('找不到原任務，這個建議已無法套用。');
      setDismissedProposals((prev) => [...prev, proposal.id]);
      return;
    }

    const suggestedDate = window.prompt(
      `請輸入「${proposal.taskTitle}」新的截止時間。\n格式：YYYY-MM-DD HH:mm\n\nManager 不會替你猜日期，新的時間由 Owner 決定。`,
      task.deadline.replace('T', ' ').slice(0, 16)
    );

    if (!suggestedDate) return;

    const normalizedDeadline = suggestedDate.trim().replace(' ', 'T');
    const parsedDeadline = new Date(normalizedDeadline);

    if (Number.isNaN(parsedDeadline.getTime())) {
      window.alert('日期格式無法辨識，請使用 YYYY-MM-DD HH:mm。');
      return;
    }

    setProcessingProposalId(proposal.id);

    if (proposal.taskType === 'work') {
      updateWorkTask({
        ...task,
        deadline: normalizedDeadline,
      });
    } else {
      updateStudyTask({
        ...task,
        deadline: normalizedDeadline,
      });
    }

    setDismissedProposals((prev) => [...prev, proposal.id]);
    setProcessingProposalId(null);
  };

  const handleRejectProposal = (proposal: RescheduleProposal) => {
    setDismissedProposals((prev) => [...prev, proposal.id]);
  };

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section>
          <p className="text-sm font-medium text-slate-500">{todayString}</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">👑 Owner Dashboard</h1>
          <p className="mt-2 text-slate-500">
            你是 Personal AI Organization 的 Owner。Manager 負責發現問題、提出方案；重大決策仍由你確認。
          </p>
        </section>

        {activeProposals.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700">需要 Owner 決策</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">🧭 Manager 重新排程建議</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Manager 偵測到時間風險，但不會自行修改你的任務。
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                {activeProposals.length} 項待確認
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {activeProposals.map((proposal) => (
                <div key={proposal.id} className="rounded-xl border border-amber-200 bg-white p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
                          優先處理
                        </span>
                        <span className="text-xs text-slate-500">
                          {proposal.taskType === 'work' ? '工作' : '學習'}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-slate-900">{proposal.taskTitle}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{proposal.reason}</p>
                      <p className="mt-2 text-sm font-medium text-slate-700">💡 {proposal.suggestedAction}</p>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={processingProposalId === proposal.id}
                        onClick={() => handleAcceptProposal(proposal)}
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        接受並重新安排
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectProposal(proposal)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        忽略
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xl">👑</div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Manager 今日簡報</h2>
              <p className="text-sm text-slate-500">{managerAnalysis.dailySummary}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {managerAnalysis.insights.map((item) => {
              const style = insightStyles[item.level];
              return (
                <div key={item.id} className={`rounded-xl border p-4 ${style.box}`}>
                  <div className="flex gap-3">
                    <span className="text-lg">{style.icon}</span>
                    <div>
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">現在</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">🍅 Current Focus</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Focus Engine</span>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-5">
              {currentBlock ? (
                <>
                  <p className="text-sm text-slate-500">目前時間區塊</p>
                  <h3 className="mt-2 text-xl font-bold text-slate-900">{currentBlock.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{currentBlock.timeRange}</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-slate-700">目前沒有正在執行的時間區塊</p>
                  <p className="mt-2 text-sm text-slate-500">Manager 可以根據你的任務與時間安排下一個 Focus。</p>
                </>
              )}
            </div>

            <button type="button" className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              開始 Focus
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">今日進度</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">📊 今日完成度</h2>
            <div className="mt-6 flex items-end gap-3">
              <span className="text-5xl font-bold text-slate-900">{completionRate}%</span>
              <span className="mb-2 text-sm text-slate-500">{completedTasks} / {totalTasks} 項任務</span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${completionRate}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">工作</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{workStats.completed}/{workStats.total}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">學習</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{studyStats.completed}/{studyStats.total}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Manager Engine</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">🧠 今日管理狀態</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{managerAnalysis.insights.length} 項分析</span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">待處理任務</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{managerAnalysis.totalPendingTasks}</p>
              <p className="mt-1 text-xs text-slate-500">工作＋學習</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">已完成任務</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{managerAnalysis.totalCompletedTasks}</p>
              <p className="mt-1 text-xs text-slate-500">工作＋學習</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">預估剩餘工時</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {managerAnalysis.estimatedPendingHours}<span className="ml-1 text-sm font-medium">小時</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">目前待完成任務</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Personal AI Organization</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">🤖 AI Team</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              ['👑', 'Manager'],
              ['💼', 'Work Agent'],
              ['📚', 'Study Agent'],
            ].map(([icon, name]) => (
              <div key={name} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <p className="font-semibold text-slate-900">{name}</p>
                    <p className="text-xs text-emerald-600">● Online</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default OwnerDashboard;
