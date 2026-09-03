export interface FocusSession {
  id: string;
  taskId?: string;
  taskTitle: string;
  startedAt: string;
  endedAt?: string;
  plannedMinutes: number;
  interruptionCount: number;
  completed: boolean;
}

export interface FocusMetrics {
  totalMinutes: number;
  completedSessions: number;
  interruptedSessions: number;
  averagePlannedMinutes: number;
  averageActualMinutes: number;
  startDelayMinutes: number;
}

export function createFocusSession(input: {
  taskId?: string;
  taskTitle: string;
  plannedMinutes: number;
  now?: Date;
}): FocusSession {
  const now = input.now ?? new Date();
  return {
    id: `focus-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    startedAt: now.toISOString(),
    plannedMinutes: Math.max(1, Math.round(input.plannedMinutes)),
    interruptionCount: 0,
    completed: false,
  };
}

export function finishFocusSession(
  session: FocusSession,
  options?: { completed?: boolean; interrupted?: boolean; now?: Date }
): FocusSession {
  const updated = {
    ...session,
    endedAt: (options?.now ?? new Date()).toISOString(),
    completed: options?.completed ?? false,
  };

  if (options?.interrupted) {
    updated.interruptionCount += 1;
  }

  return updated;
}

export function getElapsedMinutes(session: FocusSession, now = new Date()): number {
  const end = session.endedAt ? new Date(session.endedAt) : now;
  const start = new Date(session.startedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

export function calculateFocusMetrics(sessions: FocusSession[]): FocusMetrics {
  if (sessions.length === 0) {
    return {
      totalMinutes: 0,
      completedSessions: 0,
      interruptedSessions: 0,
      averagePlannedMinutes: 0,
      averageActualMinutes: 0,
      startDelayMinutes: 0,
    };
  }

  const totalMinutes = sessions.reduce((sum, session) => sum + getElapsedMinutes(session), 0);
  const planned = sessions.reduce((sum, session) => sum + session.plannedMinutes, 0);
  const completedSessions = sessions.filter((session) => session.completed).length;
  const interruptedSessions = sessions.filter((session) => session.interruptionCount > 0).length;

  return {
    totalMinutes,
    completedSessions,
    interruptedSessions,
    averagePlannedMinutes: Math.round(planned / sessions.length),
    averageActualMinutes: Math.round(totalMinutes / sessions.length),
    startDelayMinutes: 0,
  };
}

export function shouldManagerInterrupt(input: {
  elapsedMinutes: number;
  plannedMinutes: number;
  hasUpcomingImportantBlock: boolean;
}): 'continue' | 'check-in' | 'suggest-switch' {
  if (input.hasUpcomingImportantBlock && input.elapsedMinutes >= input.plannedMinutes) {
    return 'suggest-switch';
  }
  if (input.elapsedMinutes >= input.plannedMinutes) return 'check-in';
  return 'continue';
}
