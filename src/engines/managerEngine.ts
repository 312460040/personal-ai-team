import type {
  WorkTask,
  StudyTask,
  TodayTimeBlock,
} from '../types';

export type ManagerInsightLevel =
  | 'danger'
  | 'warning'
  | 'normal';

export interface ManagerInsight {
  id: string;
  level: ManagerInsightLevel;
  title: string;
  description: string;
  sourceType: 'work' | 'study' | 'schedule' | 'system';
  sourceId?: string;
  priority: number;
}

export interface RescheduleProposal {
  id: string;
  taskId: string;
  taskType: 'work' | 'study';
  taskTitle: string;
  reason: string;
  suggestedAction: string;
  priority: number;
}

export interface ManagerAnalysisResult {
  insights: ManagerInsight[];
  rescheduleProposals: RescheduleProposal[];
  dailySummary: string;
  currentBlock?: TodayTimeBlock;
  totalPendingTasks: number;
  totalCompletedTasks: number;
  estimatedPendingHours: number;
}

interface ManagerEngineInput {
  workTasks: WorkTask[];
  studyTasks: StudyTask[];
  todayBlocks: TodayTimeBlock[];
  now?: Date;
}

const DAYS_UNTIL_DEADLINE_WARNING = 3;
const MINUTES_PER_HOUR = 60;

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getDaysUntil(dateString: string, now: Date): number {
  const today = startOfDay(now);
  const deadline = startOfDay(new Date(dateString));

  const diffMs = deadline.getTime() - today.getTime();

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatDeadline(
  dateString: string,
  now: Date
): string {
  const deadline = new Date(dateString);

  if (Number.isNaN(deadline.getTime())) {
    return dateString;
  }

  const days = getDaysUntil(dateString, now);

  const hours = deadline.getHours().toString().padStart(2, '0');
  const minutes = deadline.getMinutes().toString().padStart(2, '0');
  const time = `${hours}:${minutes}`;

  if (days === 0) {
    return `今天 ${time}`;
  }

  if (days === 1) {
    return `明天 ${time}`;
  }

  if (days === -1) {
    return `昨天 ${time}`;
  }

  const month = deadline.getMonth() + 1;
  const day = deadline.getDate();

  return `${month}/${day} ${time}`;
}

function getRemainingMinutesUntilDeadline(
  dateString: string,
  now: Date
): number {
  const deadline = new Date(dateString);

  if (Number.isNaN(deadline.getTime())) {
    return 0;
  }

  const diffMs = deadline.getTime() - now.getTime();

  return Math.floor(diffMs / (1000 * 60));
}

function formatRemainingTime(minutes: number): string {
  if (minutes <= 0) {
    return '已超過截止時間';
  }

  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainingMinutes = minutes % MINUTES_PER_HOUR;

  if (hours === 0) {
    return `${remainingMinutes} 分鐘`;
  }

  if (remainingMinutes === 0) {
    return `${hours} 小時`;
  }

  return `${hours} 小時 ${remainingMinutes} 分鐘`;
}

function parseTimeRange(timeRange: string) {
  const [startTime, endTime] = timeRange
    .split('-')
    .map((time) => time.trim());

  if (!startTime || !endTime) {
    return null;
  }

  const [startHour, startMinute] =
    startTime.split(':').map(Number);

  const [endHour, endMinute] =
    endTime.split(':').map(Number);

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    return null;
  }

  return {
    start: startHour * MINUTES_PER_HOUR + startMinute,
    end: endHour * MINUTES_PER_HOUR + endMinute,
  };
}

/**
 * 計算「今天某類型任務」從現在到截止時間前的可用時間。
 *
 * v1 只使用 TodayTimeBlock：
 * - 只看 user 建立的時間區塊
 * - 只計算 work / study 對應區塊
 * - 不把 rest / buffer 算進去
 * - 目前只處理「今天到期」的任務
 *
 * 未來接 Calendar 與多日排程後，再擴充未來日期的可用時間。
 */
function getAvailableMinutesUntilDeadline(
  deadlineString: string,
  todayBlocks: TodayTimeBlock[],
  now: Date,
  taskType: 'work' | 'study'
): number {
  const deadline = new Date(deadlineString);

  if (Number.isNaN(deadline.getTime())) {
    return 0;
  }

  const deadlineIsToday =
    startOfDay(deadline).getTime() ===
    startOfDay(now).getTime();

  if (!deadlineIsToday) {
    return 0;
  }

  const currentMinutes =
    now.getHours() * MINUTES_PER_HOUR +
    now.getMinutes();

  const deadlineMinutes =
    deadline.getHours() * MINUTES_PER_HOUR +
    deadline.getMinutes();

  if (deadlineMinutes <= currentMinutes) {
    return 0;
  }

  return todayBlocks
    .filter((block) => block.source === 'user')
    .filter((block) => !block.completed)
    .filter((block) => block.type === taskType)
    .reduce((total, block) => {
      const range = parseTimeRange(block.timeRange);

      if (!range) {
        return total;
      }

      const start = Math.max(
        range.start,
        currentMinutes
      );

      const end = Math.min(
        range.end,
        deadlineMinutes
      );

      if (end <= start) {
        return total;
      }

      return total + (end - start);
    }, 0);
}

/**
 * 計算今天從現在開始，某一類型還剩多少可用時間。
 *
 * 用途：
 * 判斷「今天待辦工作量」是否已經超過目前安排的可用時間。
 */
function getRemainingAvailableMinutesToday(
  todayBlocks: TodayTimeBlock[],
  now: Date,
  taskType: 'work' | 'study'
): number {
  const currentMinutes =
    now.getHours() * MINUTES_PER_HOUR +
    now.getMinutes();

  return todayBlocks
    .filter((block) => block.source === 'user')
    .filter((block) => !block.completed)
    .filter((block) => block.type === taskType)
    .reduce((total, block) => {
      const range = parseTimeRange(block.timeRange);

      if (!range) {
        return total;
      }

      const start = Math.max(
        range.start,
        currentMinutes
      );

      const end = range.end;

      if (end <= start) {
        return total;
      }

      return total + (end - start);
    }, 0);
}

function findCurrentBlock(
  todayBlocks: TodayTimeBlock[],
  now: Date
): TodayTimeBlock | undefined {
  const currentMinutes =
    now.getHours() * MINUTES_PER_HOUR +
    now.getMinutes();

  return todayBlocks
    .filter((block) => block.source === 'user')
    .find((block) => {
      const range = parseTimeRange(block.timeRange);

      if (!range) {
        return false;
      }

      return (
        currentMinutes >= range.start &&
        currentMinutes < range.end
      );
    });
}

export function analyzeManagerState({
  workTasks,
  studyTasks,
  todayBlocks,
  now = new Date(),
}: ManagerEngineInput): ManagerAnalysisResult {
  const userWorkTasks = workTasks.filter(
    (task) => task.source === 'user'
  );

  const userStudyTasks = studyTasks.filter(
    (task) => task.source === 'user'
  );

  const userTodayBlocks = todayBlocks.filter(
    (block) => block.source === 'user'
  );

  const pendingWorkTasks = userWorkTasks.filter(
    (task) => task.status !== 'completed'
  );

  const pendingStudyTasks = userStudyTasks.filter(
    (task) => task.status !== 'completed'
  );

  const insights: ManagerInsight[] = [];
  const rescheduleProposals: RescheduleProposal[] = [];

  // ─────────────────────────────────────────────
  // 1. 工作任務：逾期
  // ─────────────────────────────────────────────

  pendingWorkTasks
    .filter((task) => getDaysUntil(task.deadline, now) < 0)
    .forEach((task) => {
      insights.push({
        id: `work-overdue-${task.id}`,
        level: 'danger',
        title: `工作「${task.title}」已逾期`,
        description:
          `截止時間為 ${formatDeadline(task.deadline, now)}，目前仍未完成，建議優先處理或重新安排。`,
        sourceType: 'work',
        sourceId: task.id,
        priority: 100,
      });
    });

  // ─────────────────────────────────────────────
  // 2. 工作任務：今天／近期到期
  // ─────────────────────────────────────────────

  pendingWorkTasks
    .filter((task) => {
      const days = getDaysUntil(task.deadline, now);

      return (
        days >= 0 &&
        days <= DAYS_UNTIL_DEADLINE_WARNING
      );
    })
    .forEach((task) => {
      const days = getDaysUntil(task.deadline, now);

      if (days === 0) {
        const remainingMinutes =
          getRemainingMinutesUntilDeadline(
            task.deadline,
            now
          );

        const availableMinutes =
          getAvailableMinutesUntilDeadline(
            task.deadline,
            userTodayBlocks,
            now,
            'work'
          );

        const estimatedMinutes =
          task.estimatedHours * MINUTES_PER_HOUR;

        const remainingTimeText =
          formatRemainingTime(remainingMinutes);

        const availableTimeText =
          formatRemainingTime(availableMinutes);

        const hasTimeRisk =
          availableMinutes < estimatedMinutes;

        const hasNoAvailableTime =
          availableMinutes <= 0;

        let description: string;

        if (hasNoAvailableTime) {
          description =
            `截止時間為 ${formatDeadline(task.deadline, now)}，目前剩餘約 ${remainingTimeText}，但今天沒有可用的工作時間區塊，預估需要 ${task.estimatedHours} 小時，建議立即重新安排。`;
        } else if (hasTimeRisk) {
          description =
            `截止時間為 ${formatDeadline(task.deadline, now)}，距離截止約 ${remainingTimeText}，但依照今天的工作安排，實際可用時間約 ${availableTimeText}，預估需要 ${task.estimatedHours} 小時，可能無法完成，建議重新安排。`;
        } else {
          description =
            `截止時間為 ${formatDeadline(task.deadline, now)}，距離截止約 ${remainingTimeText}，依照今天的工作安排，實際可用時間約 ${availableTimeText}，預估需要 ${task.estimatedHours} 小時，目前仍有機會完成。`;
        }

        insights.push({
          id: `work-deadline-today-${task.id}`,
          level: 'danger',
          title: hasNoAvailableTime
            ? `工作「${task.title}」今天到期，但目前沒有可用時間`
            : hasTimeRisk
              ? `工作「${task.title}」今天到期，可能有時間風險`
              : `工作「${task.title}」今天到期`,
          description,
          sourceType: 'work',
          sourceId: task.id,
          priority:
            hasNoAvailableTime || hasTimeRisk
              ? 110
              : 90,
        });

        return;
      }

      if (days === 1) {
        const remainingMinutes =
          getRemainingMinutesUntilDeadline(
            task.deadline,
            now
          );

        const estimatedMinutes =
          task.estimatedHours * MINUTES_PER_HOUR;

        const remainingTimeText =
          formatRemainingTime(remainingMinutes);

        const hasTimeRisk =
          remainingMinutes > 0 &&
          estimatedMinutes > remainingMinutes;

        insights.push({
          id: `work-deadline-tomorrow-${task.id}`,
          level: 'warning',
          title: hasTimeRisk
            ? `工作「${task.title}」明天到期，可能有時間風險`
            : `工作「${task.title}」明天到期`,
          description: hasTimeRisk
            ? `截止時間為 ${formatDeadline(task.deadline, now)}，剩餘約 ${remainingTimeText}，但預估需要 ${task.estimatedHours} 小時，Manager 建議提前處理或重新安排。`
            : `截止時間為 ${formatDeadline(task.deadline, now)}，剩餘約 ${remainingTimeText}，Manager 建議近期優先安排。`,
          sourceType: 'work',
          sourceId: task.id,
          priority: hasTimeRisk ? 95 : 80,
        });

        return;
      }

      const remainingMinutes =
        getRemainingMinutesUntilDeadline(
          task.deadline,
          now
        );

      const estimatedMinutes =
        task.estimatedHours * MINUTES_PER_HOUR;

      const remainingTimeText =
        formatRemainingTime(remainingMinutes);

      const hasTimeRisk =
        remainingMinutes > 0 &&
        estimatedMinutes > remainingMinutes;

      insights.push({
        id: `work-deadline-${task.id}`,
        level: 'warning',
        title: hasTimeRisk
          ? `工作「${task.title}」可能有時間風險`
          : `工作「${task.title}」即將到期`,
        description: hasTimeRisk
          ? `截止時間為 ${formatDeadline(task.deadline, now)}，剩餘約 ${remainingTimeText}，但預估需要 ${task.estimatedHours} 小時，Manager 建議提前安排。`
          : `截止時間為 ${formatDeadline(task.deadline, now)}，剩餘約 ${remainingTimeText}，Manager 建議近期安排。`,
        sourceType: 'work',
        sourceId: task.id,
        priority: hasTimeRisk ? 85 : 70,
      });
    });

  // ─────────────────────────────────────────────
  // 3. 工作任務：高優先級
  // ─────────────────────────────────────────────

  pendingWorkTasks
    .filter((task) => task.priority === 'high')
    .forEach((task) => {
      const alreadyReported = insights.some(
        (insight) =>
          insight.sourceId === task.id &&
          insight.sourceType === 'work'
      );

      if (alreadyReported) {
        return;
      }

      insights.push({
        id: `work-high-${task.id}`,
        level: 'warning',
        title: `高優先工作「${task.title}」尚未完成`,
        description:
          '這項工作具有較高優先級，Manager 建議安排近期處理。',
        sourceType: 'work',
        sourceId: task.id,
        priority: 60,
      });
    });

  // ─────────────────────────────────────────────
  // 4. 學習任務：逾期
  // ─────────────────────────────────────────────

  pendingStudyTasks
    .filter((task) => getDaysUntil(task.deadline, now) < 0)
    .forEach((task) => {
      insights.push({
        id: `study-overdue-${task.id}`,
        level: 'danger',
        title: `學習任務「${task.title}」已逾期`,
        description:
          `截止時間為 ${formatDeadline(task.deadline, now)}，目前仍未完成。`,
        sourceType: 'study',
        sourceId: task.id,
        priority: 95,
      });
    });

  // ─────────────────────────────────────────────
  // 5. 學習任務：今天／近期到期
  // ─────────────────────────────────────────────

  pendingStudyTasks
    .filter((task) => {
      const days = getDaysUntil(task.deadline, now);

      return (
        days >= 0 &&
        days <= DAYS_UNTIL_DEADLINE_WARNING
      );
    })
    .forEach((task) => {
      const days = getDaysUntil(task.deadline, now);

      if (days === 0) {
        const remainingMinutes =
          getRemainingMinutesUntilDeadline(
            task.deadline,
            now
          );

        const availableMinutes =
          getAvailableMinutesUntilDeadline(
            task.deadline,
            userTodayBlocks,
            now,
            'study'
          );

        const estimatedMinutes =
          task.estimatedHours * MINUTES_PER_HOUR;

        const remainingTimeText =
          formatRemainingTime(remainingMinutes);

        const availableTimeText =
          formatRemainingTime(availableMinutes);

        const hasTimeRisk =
          availableMinutes < estimatedMinutes;

        const hasNoAvailableTime =
          availableMinutes <= 0;

        let description: string;

        if (hasNoAvailableTime) {
          description =
            `截止時間為 ${formatDeadline(task.deadline, now)}，目前剩餘約 ${remainingTimeText}，但今天沒有可用的學習時間區塊，預估需要 ${task.estimatedHours} 小時，建議立即重新安排。`;
        } else if (hasTimeRisk) {
          description =
            `截止時間為 ${formatDeadline(task.deadline, now)}，距離截止約 ${remainingTimeText}，但依照今天的學習安排，實際可用時間約 ${availableTimeText}，預估需要 ${task.estimatedHours} 小時，可能無法完成，建議重新安排。`;
        } else {
          description =
            `截止時間為 ${formatDeadline(task.deadline, now)}，距離截止約 ${remainingTimeText}，依照今天的學習安排，實際可用時間約 ${availableTimeText}，預估需要 ${task.estimatedHours} 小時，目前仍有機會完成。`;
        }

        insights.push({
          id: `study-deadline-today-${task.id}`,
          level: 'danger',
          title: hasNoAvailableTime
            ? `學習任務「${task.title}」今天到期，但目前沒有可用時間`
            : hasTimeRisk
              ? `學習任務「${task.title}」今天到期，可能有時間風險`
              : `學習任務「${task.title}」今天到期`,
          description,
          sourceType: 'study',
          sourceId: task.id,
          priority:
            hasNoAvailableTime || hasTimeRisk
              ? 105
              : 85,
        });

        return;
      }

      if (days === 1) {
        const remainingMinutes =
          getRemainingMinutesUntilDeadline(
            task.deadline,
            now
          );

        const estimatedMinutes =
          task.estimatedHours * MINUTES_PER_HOUR;

        const remainingTimeText =
          formatRemainingTime(remainingMinutes);

        const hasTimeRisk =
          remainingMinutes > 0 &&
          estimatedMinutes > remainingMinutes;

        insights.push({
          id: `study-deadline-tomorrow-${task.id}`,
          level: 'warning',
          title: hasTimeRisk
            ? `學習任務「${task.title}」明天到期，可能有時間風險`
            : `學習任務「${task.title}」明天到期`,
          description: hasTimeRisk
            ? `截止時間為 ${formatDeadline(task.deadline, now)}，剩餘約 ${remainingTimeText}，但預估需要 ${task.estimatedHours} 小時，Manager 建議提前安排或重新調整。`
            : `截止時間為 ${formatDeadline(task.deadline, now)}，剩餘約 ${remainingTimeText}，Manager 建議近期安排學習時間。`,
          sourceType: 'study',
          sourceId: task.id,
          priority: hasTimeRisk ? 90 : 75,
        });

        return;
      }

      const remainingMinutes =
        getRemainingMinutesUntilDeadline(
          task.deadline,
          now
        );

      const estimatedMinutes =
        task.estimatedHours * MINUTES_PER_HOUR;

      const remainingTimeText =
        formatRemainingTime(remainingMinutes);

      const hasTimeRisk =
        remainingMinutes > 0 &&
        estimatedMinutes > remainingMinutes;

      insights.push({
        id: `study-deadline-${task.id}`,
        level: 'warning',
        title: hasTimeRisk
          ? `學習任務「${task.title}」可能有時間風險`
          : `學習任務「${task.title}」即將到期`,
        description: hasTimeRisk
          ? `截止時間為 ${formatDeadline(task.deadline, now)}，剩餘約 ${remainingTimeText}，但預估需要 ${task.estimatedHours} 小時，Manager 建議提前安排。`
          : `截止時間為 ${formatDeadline(task.deadline, now)}，剩餘約 ${remainingTimeText}，Manager 建議近期安排學習時間。`,
        sourceType: 'study',
        sourceId: task.id,
        priority: hasTimeRisk ? 80 : 65,
      });
    });

  // ─────────────────────────────────────────────
  // 6. 今日工作量：是否超過目前可用時間
  // ─────────────────────────────────────────────
  //
  // 這是 Manager 的第一版「過載判斷」：
  // - 工作只比較 pending WorkTask 的預估工時
  //   與今天剩餘 work 時間區塊。
  // - 學習只比較 pending StudyTask 的預估工時
  //   與今天剩餘 study 時間區塊。
  //
  // 注意：
  // 目前 WorkTask / StudyTask 沒有「剩餘工時」欄位，
  // 因此 v1 只能使用 estimatedHours 作為需求量。
  // 未來加入實際執行時間後，再改成更精準的剩餘工時。
  // ─────────────────────────────────────────────

  const pendingWorkHours =
    pendingWorkTasks.reduce(
      (total, task) => total + task.estimatedHours,
      0
    );

  const pendingStudyHours =
    pendingStudyTasks.reduce(
      (total, task) => total + task.estimatedHours,
      0
    );

  const availableWorkMinutes =
    getRemainingAvailableMinutesToday(
      userTodayBlocks,
      now,
      'work'
    );

  const availableStudyMinutes =
    getRemainingAvailableMinutesToday(
      userTodayBlocks,
      now,
      'study'
    );

  const availableWorkHours =
    availableWorkMinutes / MINUTES_PER_HOUR;

  const availableStudyHours =
    availableStudyMinutes / MINUTES_PER_HOUR;

  if (pendingWorkHours > 0) {
    if (availableWorkMinutes <= 0) {
      insights.push({
        id: 'workload-overload-work',
        level: 'warning',
        title: '今天工作量可能超出可用時間',
        description:
          `目前還有約 ${pendingWorkHours} 小時的未完成工作，但從現在開始沒有可用的工作時間區塊，Manager 建議重新安排今天的工作。`,
        sourceType: 'system',
        sourceId: 'workload-work',
        priority: 88,
      });
    } else if (pendingWorkHours > availableWorkHours) {
      const overloadHours =
        pendingWorkHours - availableWorkHours;

      insights.push({
        id: 'workload-overload-work',
        level: 'warning',
        title: '今天工作量可能超出可用時間',
        description:
          `目前還有約 ${pendingWorkHours} 小時的未完成工作，但今天剩餘可用工作時間約 ${availableWorkHours.toFixed(1)} 小時，約超出 ${overloadHours.toFixed(1)} 小時，Manager 建議重新安排或調整優先級。`,
        sourceType: 'system',
        sourceId: 'workload-work',
        priority: 88,
      });
    }
  }

  if (pendingStudyHours > 0) {
    if (availableStudyMinutes <= 0) {
      insights.push({
        id: 'workload-overload-study',
        level: 'warning',
        title: '今天學習量可能超出可用時間',
        description:
          `目前還有約 ${pendingStudyHours} 小時的未完成學習任務，但從現在開始沒有可用的學習時間區塊，Manager 建議重新安排今天的學習。`,
        sourceType: 'system',
        sourceId: 'workload-study',
        priority: 83,
      });
    } else if (pendingStudyHours > availableStudyHours) {
      const overloadHours =
        pendingStudyHours - availableStudyHours;

      insights.push({
        id: 'workload-overload-study',
        level: 'warning',
        title: '今天學習量可能超出可用時間',
        description:
          `目前還有約 ${pendingStudyHours} 小時的未完成學習任務，但今天剩餘可用學習時間約 ${availableStudyHours.toFixed(1)} 小時，約超出 ${overloadHours.toFixed(1)} 小時，Manager 建議重新安排或調整優先級。`,
        sourceType: 'system',
        sourceId: 'workload-study',
        priority: 83,
      });
    }
  }

  // ─────────────────────────────────────────────
  // 7. 重新排程建議（Proposal）
  // ─────────────────────────────────────────────
  //
  // Manager 在這裡只「提出方案」，不直接修改 Owner 的資料。
  // 目前 v1 不猜測未來的具體日期或時間，只根據：
  // - 截止日期
  // - 優先級
  // - 今日可用時間
  // - 預估工時
  //
  // 真正修改排程必須等 Owner 確認後，
  // 再由 AppDataContext 執行。
  // ─────────────────────────────────────────────

  const sortedPendingWorkTasks = [...pendingWorkTasks].sort((a, b) => {
    const deadlineDiff =
      new Date(a.deadline).getTime() -
      new Date(b.deadline).getTime();

    if (!Number.isNaN(deadlineDiff) && deadlineDiff !== 0) {
      return deadlineDiff;
    }

    const priorityRank = {
      high: 0,
      medium: 1,
      low: 2,
    };

    return priorityRank[a.priority] - priorityRank[b.priority];
  });

  const sortedPendingStudyTasks = [...pendingStudyTasks].sort((a, b) => {
    const deadlineDiff =
      new Date(a.deadline).getTime() -
      new Date(b.deadline).getTime();

    if (!Number.isNaN(deadlineDiff) && deadlineDiff !== 0) {
      return deadlineDiff;
    }

    const priorityRank = {
      high: 0,
      medium: 1,
      low: 2,
    };

    return priorityRank[a.priority] - priorityRank[b.priority];
  });

  // 工作過載時：
  // 第一順位任務優先保留，其餘任務可列為延後候選。
  if (pendingWorkHours > availableWorkHours) {
    sortedPendingWorkTasks.slice(1).forEach((task) => {
      rescheduleProposals.push({
        id: `reschedule-work-${task.id}`,
        taskId: task.id,
        taskType: 'work',
        taskTitle: task.title,
        reason:
          `今天目前約有 ${pendingWorkHours} 小時未完成工作，但剩餘可用工作時間約 ${availableWorkHours.toFixed(1)} 小時。`,
        suggestedAction:
          task.priority === 'high'
            ? '保留高優先級任務，並與 Owner 確認是否需要延後其他工作。'
            : '建議將此工作移出今天的優先處理範圍，待 Owner 確認新的時間。',
        priority:
          task.priority === 'high'
            ? 75
            : 55,
      });
    });
  }

  // 學習過載時同理。
  if (pendingStudyHours > availableStudyHours) {
    sortedPendingStudyTasks.slice(1).forEach((task) => {
      rescheduleProposals.push({
        id: `reschedule-study-${task.id}`,
        taskId: task.id,
        taskType: 'study',
        taskTitle: task.title,
        reason:
          `今天目前約有 ${pendingStudyHours} 小時未完成學習任務，但剩餘可用學習時間約 ${availableStudyHours.toFixed(1)} 小時。`,
        suggestedAction:
          task.priority === 'high'
            ? '保留高優先級學習任務，並與 Owner 確認是否需要延後其他學習任務。'
            : '建議將此學習任務移出今天的優先處理範圍，待 Owner 確認新的時間。',
        priority:
          task.priority === 'high'
            ? 72
            : 52,
      });
    });
  }

  // 如果有今天到期但時間不足的任務，建立更高優先級的確認方案。
  [...pendingWorkTasks, ...pendingStudyTasks]
    .filter((task) => getDaysUntil(task.deadline, now) === 0)
    .forEach((task) => {
      const taskType =
        'projectId' in task
          ? 'work'
          : 'study';

      const availableMinutes =
        getAvailableMinutesUntilDeadline(
          task.deadline,
          userTodayBlocks,
          now,
          taskType
        );

      const estimatedMinutes =
        task.estimatedHours * MINUTES_PER_HOUR;

      if (availableMinutes < estimatedMinutes) {
        rescheduleProposals.push({
          id: `reschedule-urgent-${taskType}-${task.id}`,
          taskId: task.id,
          taskType,
          taskTitle: task.title,
          reason:
            `此任務今天到期，但目前可用時間約 ${formatRemainingTime(availableMinutes)}，預估需要 ${task.estimatedHours} 小時。`,
          suggestedAction:
            '這是截止日期風險，Manager 建議 Owner 優先確認是否延長截止時間、調整其他工作，或重新安排此任務。',
          priority: 120,
        });
      }
    });

  const sortedRescheduleProposals =
    Array.from(
      new Map(
        rescheduleProposals.map((proposal) => [
          proposal.taskId,
          proposal,
        ])
      ).values()
    ).sort(
      (a, b) => b.priority - a.priority
    );

  // ─────────────────────────────────────────────
  // 8. 目前時間區塊
  // ─────────────────────────────────────────────

  const currentBlock = findCurrentBlock(
    userTodayBlocks,
    now
  );

  if (currentBlock && !currentBlock.completed) {
    insights.push({
      id: `current-block-${currentBlock.id}`,
      level: 'normal',
      title: `現在是「${currentBlock.title}」時間`,
      description:
        `目前時間區塊為 ${currentBlock.timeRange}，可以開始執行這項安排。`,
      sourceType: 'schedule',
      sourceId: currentBlock.id,
      priority: 40,
    });
  }

  // ─────────────────────────────────────────────
  // 9. 統計目前任務
  // ─────────────────────────────────────────────

  const allTasks = [
    ...userWorkTasks,
    ...userStudyTasks,
  ];

  const pendingTasks = allTasks.filter(
    (task) => task.status !== 'completed'
  );

  const completedTasks = allTasks.filter(
    (task) => task.status === 'completed'
  );

  const estimatedPendingHours = pendingTasks.reduce(
    (total, task) => total + task.estimatedHours,
    0
  );

  // ─────────────────────────────────────────────
  // 10. 沒有特殊狀況
  // ─────────────────────────────────────────────

  if (insights.length === 0) {
    insights.push({
      id: 'system-normal',
      level: 'normal',
      title: '目前沒有需要特別注意的事項',
      description:
        '目前沒有偵測到逾期、即將到期、高優先級未完成任務或明顯的時間配置風險。',
      sourceType: 'system',
      priority: 10,
    });
  }

  // ─────────────────────────────────────────────
  // 11. 整理重複提醒
  // ─────────────────────────────────────────────
  //
  // 同一個任務可能同時符合：
  // - 即將到期
  // - 高優先級
  // - 時間風險
  //
  // Manager 不應該重複打擾 Owner。
  // 保留同一來源中優先級最高的提醒。
  // ─────────────────────────────────────────────

  const consolidatedInsights =
    new Map<string, ManagerInsight>();

  insights.forEach((insight) => {
    const key = insight.sourceId
      ? `${insight.sourceType}-${insight.sourceId}`
      : insight.id;

    const existing = consolidatedInsights.get(key);

    if (
      !existing ||
      insight.priority > existing.priority
    ) {
      consolidatedInsights.set(key, insight);
    }
  });

  // ─────────────────────────────────────────────
  // 12. 依重要程度排序
  // ─────────────────────────────────────────────

  const sortedInsights = Array.from(
    consolidatedInsights.values()
  ).sort(
    (a, b) => b.priority - a.priority
  );

  // ─────────────────────────────────────────────
  // 13. 產生 Manager 今日摘要
  // ─────────────────────────────────────────────

  const topInsight = sortedInsights[0];

  let dailySummary: string;

  if (!topInsight) {
    dailySummary =
      '今天目前沒有需要特別注意的事項。';
  } else if (topInsight.level === 'danger') {
    dailySummary =
      `今天最需要注意的是「${topInsight.title}」。${topInsight.description}`;
  } else if (topInsight.level === 'warning') {
    dailySummary =
      `今天有 ${sortedInsights.length} 件事項需要注意，其中最重要的是「${topInsight.title}」。`;
  } else {
    dailySummary =
      `目前有 ${pendingTasks.length} 項待處理任務。${topInsight.description}`;
  }

  return {
    insights: sortedInsights,
    rescheduleProposals: sortedRescheduleProposals,
    dailySummary,
    currentBlock,
    totalPendingTasks: pendingTasks.length,
    totalCompletedTasks: completedTasks.length,
    estimatedPendingHours,
  };
}
