import React, { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { analyzeManagerState } from '../engines/managerEngine';

const OwnerDashboard: React.FC = () => {
  const {
    workTasks,
    studyTasks,
    todayBlocks,
  } = useAppData();

  // ─────────────────────────────────────────────
  // 今日日期
  // ─────────────────────────────────────────────
  const today = new Date();

  const todayString = today.toISOString().split('T')[0];

  // ─────────────────────────────────────────────
  // 工作任務統計
  // ─────────────────────────────────────────────
  const workStats = useMemo(() => {
    const userTasks = workTasks.filter(
      (task) => task.source === 'user'
    );

    const completed = userTasks.filter(
      (task) => task.status === 'completed'
    ).length;

    const pending = userTasks.filter(
      (task) => task.status !== 'completed'
    ).length;

    const overdue = userTasks.filter((task) => {
      if (!task.deadline || task.status === 'completed') {
        return false;
      }

      return new Date(task.deadline) < today;
    }).length;

    return {
      total: userTasks.length,
      completed,
      pending,
      overdue,
    };
  }, [workTasks]);

  // ─────────────────────────────────────────────
  // 學習任務統計
  // ─────────────────────────────────────────────
  const studyStats = useMemo(() => {
    const userTasks = studyTasks.filter(
      (task) => task.source === 'user'
    );

    const completed = userTasks.filter(
      (task) => task.status === 'completed'
    ).length;

    const pending = userTasks.filter(
      (task) => task.status !== 'completed'
    ).length;

    return {
      total: userTasks.length,
      completed,
      pending,
    };
  }, [studyTasks]);

  // ─────────────────────────────────────────────
  // Manager Engine
  // ─────────────────────────────────────────────
  //
  // Owner Dashboard 不自己判斷任務風險。
  // 所有「逾期、到期、時間風險、工作量過載」
  // 都交給 Manager Engine 統一判斷。
  // ─────────────────────────────────────────────
  const managerAnalysis = useMemo(() => {
    return analyzeManagerState({
      workTasks,
      studyTasks,
      todayBlocks,
      now: today,
    });
  }, [workTasks, studyTasks, todayBlocks]);

  // ─────────────────────────────────────────────
  // 今日完成度
  // ─────────────────────────────────────────────
  const totalTasks =
    workStats.total + studyStats.total;

  const completedTasks =
    workStats.completed + studyStats.completed;

  const completionRate =
    totalTasks > 0
      ? Math.round(
          (completedTasks / totalTasks) * 100
        )
      : 0;

  // ─────────────────────────────────────────────
  // 目前 Focus
  // ─────────────────────────────────────────────
  //
  // 直接使用 Manager Engine 判斷的 currentBlock，
  // 避免 Dashboard 自己再寫一套時間區塊判斷邏輯。
  // ─────────────────────────────────────────────
  const currentBlock = managerAnalysis.currentBlock;

  // ─────────────────────────────────────────────
  // Manager Insight 樣式
  // ─────────────────────────────────────────────
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

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ─────────────────────────────────────── */}
        {/* Header */}
        {/* ─────────────────────────────────────── */}
        <section>
          <p className="text-sm font-medium text-slate-500">
            {todayString}
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            👑 Owner Dashboard
          </h1>

          <p className="mt-2 text-slate-500">
            你是整個 Personal AI Organization 的 Owner，
            Manager 正在替你整理今天的重要事項。
          </p>
        </section>

        {/* ─────────────────────────────────────── */}
        {/* Manager Briefing */}
        {/* ─────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xl">
              👑
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Manager 今日簡報
              </h2>

              <p className="text-sm text-slate-500">
                {managerAnalysis.dailySummary}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {managerAnalysis.insights.map((item) => {
              const style = insightStyles[item.level];

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 ${style.box}`}
                >
                  <div className="flex gap-3">
                    <span className="text-lg">
                      {style.icon}
                    </span>

                    <div>
                      <p className="font-semibold text-slate-900">
                        {item.title}
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─────────────────────────────────────── */}
        {/* Current Focus + Progress */}
        {/* ─────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Focus */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  現在
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  🍅 Current Focus
                </h2>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Focus Engine
              </span>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 p-5">

              {currentBlock ? (
                <>
                  <p className="text-sm text-slate-500">
                    目前時間區塊
                  </p>

                  <h3 className="mt-2 text-xl font-bold text-slate-900">
                    {currentBlock.title}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    {currentBlock.timeRange}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-slate-700">
                    目前沒有正在執行的時間區塊
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Manager 可以根據你的任務與時間安排下一個 Focus。
                  </p>
                </>
              )}

            </div>

            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              開始 Focus
            </button>

          </section>

          {/* Progress */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <p className="text-sm font-medium text-slate-500">
              今日進度
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              📊 今日完成度
            </h2>

            <div className="mt-6 flex items-end gap-3">

              <span className="text-5xl font-bold text-slate-900">
                {completionRate}%
              </span>

              <span className="mb-2 text-sm text-slate-500">
                {completedTasks} / {totalTasks} 項任務
              </span>

            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900 transition-all"
                style={{
                  width: `${completionRate}%`,
                }}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  工作
                </p>

                <p className="mt-1 text-lg font-bold text-slate-900">
                  {workStats.completed}/{workStats.total}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  學習
                </p>

                <p className="mt-1 text-lg font-bold text-slate-900">
                  {studyStats.completed}/{studyStats.total}
                </p>
              </div>

            </div>

          </section>
        </div>

        {/* ─────────────────────────────────────── */}
        {/* Manager 狀態摘要 */}
        {/* ─────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Manager Engine
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                🧠 今日管理狀態
              </h2>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {managerAnalysis.insights.length} 項分析
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                待處理任務
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {managerAnalysis.totalPendingTasks}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                工作＋學習
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                已完成任務
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {managerAnalysis.totalCompletedTasks}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                工作＋學習
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">
                預估剩餘工時
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {managerAnalysis.estimatedPendingHours}
                <span className="ml-1 text-sm font-medium">
                  小時
                </span>
              </p>

              <p className="mt-1 text-xs text-slate-500">
                目前待完成任務
              </p>
            </div>

          </div>
        </section>

        {/* ─────────────────────────────────────── */}
        {/* AI Team */}
        {/* ─────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <div>
            <p className="text-sm font-medium text-slate-500">
              Personal AI Organization
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              🤖 AI Team
            </h2>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👑</span>

                <div>
                  <p className="font-semibold text-slate-900">
                    Manager
                  </p>

                  <p className="text-xs text-emerald-600">
                    ● Online
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💼</span>

                <div>
                  <p className="font-semibold text-slate-900">
                    Work Agent
                  </p>

                  <p className="text-xs text-emerald-600">
                    ● Online
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📚</span>

                <div>
                  <p className="font-semibold text-slate-900">
                    Study Agent
                  </p>

                  <p className="text-xs text-emerald-600">
                    ● Online
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
};

export default OwnerDashboard;
