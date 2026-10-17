import {
  addDays as dateFnsAddDays,
  addMonths as dateFnsAddMonths,
  differenceInCalendarDays,
  startOfWeek as dateFnsStartOfWeek,
  endOfWeek as dateFnsEndOfWeek,
} from 'date-fns';
import type {
  Objective,
  ObjectiveCadence,
  ObjectiveListState,
  CreateObjectivePayload,
} from '../types/Objective.js';
import type {
  KeyResult,
  KRCheckIn,
  KRHabitLog,
  CreateKeyResultPayload,
} from '../types/KeyResult.js';
import type { Task, Project } from '../types/index.js';

export const FY_START_MONTH = 1;
export const PACE_GRACE = 0.2;
export const PACE_TOLERANCE = 0.15;

// --- Date Utilities ---

/** Formats a Date object to YYYY-MM-DD in local time */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Adds calendar days to a YYYY-MM-DD string, returning YYYY-MM-DD */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const result = dateFnsAddDays(date, days);
  return localDateKey(result);
}

/** Adds months to a YYYY-MM-DD string, clamped to month-end, returning YYYY-MM-DD */
export function addMonthsClamped(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const result = dateFnsAddMonths(date, months);
  return localDateKey(result);
}

/** Inclusive day count between two YYYY-MM-DD strings */
export function daysInPeriod(startStr: string, endStr: string): number {
  const [y1, m1, d1] = startStr.split('-').map(Number);
  const [y2, m2, d2] = endStr.split('-').map(Number);
  const dStart = new Date(y1, m1 - 1, d1);
  const dEnd = new Date(y2, m2 - 1, d2);
  return differenceInCalendarDays(dEnd, dStart) + 1;
}

/** Total weeks in a period (Math.ceil(days / 7)) */
export function weeksInPeriod(startStr: string, endStr: string): number {
  const days = daysInPeriod(startStr, endStr);
  return Math.max(1, Math.ceil(days / 7));
}

// --- Quarter Computations ---

export interface QuarterInfo {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  label: string;
  start: string;
  end: string;
}

/** Returns the local start and end date for a given year and quarter */
export function quarterRange(
  year: number,
  quarter: 1 | 2 | 3 | 4,
  fyStartMonth = FY_START_MONTH
): { start: string; end: string } {
  const zeroIndexedStartMonth = (fyStartMonth - 1 + (quarter - 1) * 3) % 12;
  const yearOffset = Math.floor((fyStartMonth - 1 + (quarter - 1) * 3) / 12);
  const actualYear = year + yearOffset;

  const startDate = new Date(actualYear, zeroIndexedStartMonth, 1);
  // Last day of the 3-month quarter is day 0 of the following month
  const endDate = new Date(actualYear, zeroIndexedStartMonth + 3, 0);

  return {
    start: localDateKey(startDate),
    end: localDateKey(endDate),
  };
}

/** Returns quarter info for a given date string or Date object */
export function currentQuarter(
  dateInput: string | Date = new Date(),
  fyStartMonth = FY_START_MONTH
): QuarterInfo {
  let date: Date;
  if (typeof dateInput === 'string') {
    const [y, m, d] = dateInput.split('-').map(Number);
    date = new Date(y, m - 1, d || 1);
  } else {
    date = dateInput;
  }

  const calendarYear = date.getFullYear();
  const calendarMonth = date.getMonth() + 1; // 1-12

  const adjustedMonth = (calendarMonth - fyStartMonth + 12) % 12;
  const quarter = (Math.floor(adjustedMonth / 3) + 1) as 1 | 2 | 3 | 4;

  let fyYear = calendarYear;
  if (fyStartMonth > 1 && calendarMonth < fyStartMonth) {
    fyYear = calendarYear - 1;
  }

  const range = quarterRange(fyYear, quarter, fyStartMonth);

  return {
    year: fyYear,
    quarter,
    label: `Q${quarter} ${fyYear}`,
    start: range.start,
    end: range.end,
  };
}

// --- Work Index and Rollup ---

export interface WorkIndex {
  tasksByKrId: Map<string, Task[]>;
  tasksByProjectId: Map<string, Task[]>;
  projectsByKrId: Map<string, Project[]>;
}

export function buildWorkIndex(tasks: Task[], projects: Project[]): WorkIndex {
  const tasksByKrId = new Map<string, Task[]>();
  const tasksByProjectId = new Map<string, Task[]>();
  const projectsByKrId = new Map<string, Project[]>();

  // Index active, non-subtask tasks
  for (const t of tasks) {
    if (t.is_trashed === 1 || t.parent_task_id !== null) continue;

    if (t.key_result_id) {
      const arr = tasksByKrId.get(t.key_result_id) || [];
      arr.push(t);
      tasksByKrId.set(t.key_result_id, arr);
    }

    if (t.project_id) {
      const arr = tasksByProjectId.get(t.project_id) || [];
      arr.push(t);
      tasksByProjectId.set(t.project_id, arr);
    }
  }

  // Index active projects
  for (const p of projects) {
    if (p.status === 'archived') continue;
    if (p.key_result_id) {
      const arr = projectsByKrId.get(p.key_result_id) || [];
      arr.push(p);
      projectsByKrId.set(p.key_result_id, arr);
    }
  }

  return { tasksByKrId, tasksByProjectId, projectsByKrId };
}

export interface WorkRollupResult {
  done: number;
  total: number;
  progress: number;
  tasks: Task[];
  projects: Project[];
}

export function workRollup(keyResultId: string, index: WorkIndex): WorkRollupResult {
  const directTasks = index.tasksByKrId.get(keyResultId) || [];
  const linkedProjects = index.projectsByKrId.get(keyResultId) || [];

  const seenTaskIds = new Set<string>();
  const allTasks: Task[] = [];

  for (const t of directTasks) {
    if (!seenTaskIds.has(t.id)) {
      seenTaskIds.add(t.id);
      allTasks.push(t);
    }
  }

  const emptyProjects: Project[] = [];

  for (const p of linkedProjects) {
    const projTasks = index.tasksByProjectId.get(p.id) || [];
    if (projTasks.length === 0) {
      emptyProjects.push(p);
    } else {
      for (const t of projTasks) {
        if (!seenTaskIds.has(t.id)) {
          seenTaskIds.add(t.id);
          allTasks.push(t);
        }
      }
    }
  }

  let doneCount = 0;
  for (const t of allTasks) {
    if (t.is_completed === 1) {
      doneCount++;
    }
  }

  for (const p of emptyProjects) {
    if (p.status === 'completed') {
      doneCount++;
    }
  }

  const totalCount = allTasks.length + emptyProjects.length;
  const progress = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  return {
    done: doneCount,
    total: totalCount,
    progress,
    tasks: allTasks,
    projects: linkedProjects,
  };
}

// --- Habit Statistics ---

export interface HabitStatsResult {
  weekCount: number;
  weekStreak: number;
  periodCount: number;
  progress: number; // 0 to 1
  recentDays: boolean[]; // 7 days ending at today
}

export function habitStats(
  keyResult: KeyResult,
  logs: KRHabitLog[],
  periodStart: string,
  periodEnd: string,
  todayStr: string,
  weekStartsOn: 0 | 1 = 1
): HabitStatsResult {
  const targetPerWeek = keyResult.target_value || 1;
  const weeks = weeksInPeriod(periodStart, periodEnd);
  const totalTarget = targetPerWeek * weeks;

  // Filter logs to this key result and period
  const logDatesSet = new Set<string>();
  for (const l of logs) {
    if (l.key_result_id === keyResult.id && l.log_date >= periodStart && l.log_date <= periodEnd) {
      logDatesSet.add(l.log_date);
    }
  }

  const periodCount = logDatesSet.size;
  const progress = totalTarget > 0 ? Math.min(1, periodCount / totalTarget) : 0;

  // Recent 7 days ending on today
  const recentDays: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const dateStr = addDays(todayStr, -i);
    recentDays.push(logDatesSet.has(dateStr));
  }

  // Current week ticks
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const curWeekStartDate = dateFnsStartOfWeek(todayDate, { weekStartsOn });
  const curWeekEndDate = dateFnsEndOfWeek(todayDate, { weekStartsOn });
  const curWeekStartStr = localDateKey(curWeekStartDate);
  const curWeekEndStr = localDateKey(curWeekEndDate);

  let thisWeekTicks = 0;
  for (const dateStr of logDatesSet) {
    if (dateStr >= curWeekStartStr && dateStr <= curWeekEndStr) {
      thisWeekTicks++;
    }
  }

  // Week streak calculation
  let weekStreak = 0;
  const currentWeekMet = thisWeekTicks >= targetPerWeek;
  if (currentWeekMet) {
    weekStreak = 1;
  }

  // Step backward week by week from previous week
  let checkWeekStart = dateFnsAddDays(curWeekStartDate, -7);
  const [psy, psm, psd] = periodStart.split('-').map(Number);
  const pStartDate = new Date(psy, psm - 1, psd);
  const earliestWeekStart = dateFnsStartOfWeek(pStartDate, { weekStartsOn });

  while (checkWeekStart >= earliestWeekStart) {
    const checkWeekEnd = dateFnsAddDays(checkWeekStart, 6);
    const startStr = localDateKey(checkWeekStart);
    const endStr = localDateKey(checkWeekEnd);

    let weekTicks = 0;
    for (const dateStr of logDatesSet) {
      if (dateStr >= startStr && dateStr <= endStr) {
        weekTicks++;
      }
    }

    if (weekTicks >= targetPerWeek) {
      weekStreak++;
      checkWeekStart = dateFnsAddDays(checkWeekStart, -7);
    } else {
      break;
    }
  }

  return {
    weekCount: thisWeekTicks,
    weekStreak,
    periodCount,
    progress,
    recentDays,
  };
}

// --- Key Result & Objective Progress ---

export function keyResultProgress(
  kr: KeyResult,
  workRollupResult?: { progress: number },
  habitStatsResult?: { progress: number }
): number {
  if (kr.kind === 'metric') {
    if (kr.target_value === kr.start_value) return 0;

    let raw: number;
    if (kr.target_value > kr.start_value) {
      // Ascending
      raw = (kr.current_value - kr.start_value) / (kr.target_value - kr.start_value);
    } else {
      // Descending
      raw = (kr.start_value - kr.current_value) / (kr.start_value - kr.target_value);
    }

    const clamped = Math.min(1, Math.max(0, raw));
    return Math.round(clamped * 100);
  }

  if (kr.kind === 'work') {
    return workRollupResult ? Math.min(100, Math.max(0, workRollupResult.progress)) : 0;
  }

  if (kr.kind === 'habit') {
    return habitStatsResult ? Math.round(Math.min(1, Math.max(0, habitStatsResult.progress)) * 100) : 0;
  }

  return 0;
}

export function objectiveProgress(
  keyResults: KeyResult[],
  krProgressMap: Map<string, number>
): number {
  if (keyResults.length === 0) return 0;

  let total = 0;
  for (const kr of keyResults) {
    const p = krProgressMap.get(kr.id) ?? 0;
    total += Math.min(100, Math.max(0, p));
  }

  return Math.round(total / keyResults.length);
}

// --- Health, Pace, Due & State ---

export function objectiveHealth(
  keyResults: KeyResult[]
): 'on_track' | 'at_risk' | 'off_track' | null {
  let hasStatus = false;
  let hasAtRisk = false;

  for (const kr of keyResults) {
    if (kr.status) {
      hasStatus = true;
      if (kr.status === 'off_track') return 'off_track';
      if (kr.status === 'at_risk') hasAtRisk = true;
    }
  }

  if (!hasStatus) return null;
  if (hasAtRisk) return 'at_risk';
  return 'on_track';
}

export interface PaceResult {
  isBehindPace: boolean;
  expectedProgress: number;
  elapsedRatio: number;
}

export function paceState(
  objective: Objective,
  progress: number,
  todayStr: string
): PaceResult {
  const totalDays = daysInPeriod(objective.period_start, objective.period_end);

  let elapsedDays = 0;
  if (todayStr <= objective.period_start) {
    elapsedDays = 0;
  } else if (todayStr >= objective.period_end) {
    elapsedDays = totalDays;
  } else {
    elapsedDays = daysInPeriod(objective.period_start, todayStr);
  }

  const elapsedRatio = totalDays > 0 ? elapsedDays / totalDays : 0;
  const expectedProgress = Math.round(elapsedRatio * 100);

  if (elapsedRatio <= PACE_GRACE) {
    return { isBehindPace: false, expectedProgress, elapsedRatio };
  }

  const threshold = expectedProgress - PACE_TOLERANCE * 100;
  const isBehindPace = progress < threshold;

  return { isBehindPace, expectedProgress, elapsedRatio };
}

export function nextCheckInDate(
  lastCheckInDate: string | null,
  periodStart: string,
  cadence: ObjectiveCadence
): string {
  const baseDate = lastCheckInDate ?? periodStart;
  switch (cadence) {
    case 'daily':
      return addDays(baseDate, 1);
    case 'weekly':
      return addDays(baseDate, 7);
    case 'biweekly':
      return addDays(baseDate, 14);
    case 'monthly':
      return addMonthsClamped(baseDate, 1);
    default:
      return addDays(baseDate, 7);
  }
}

export interface DueResult {
  isDue: boolean;
  isOverdue: boolean;
  dueDate: string;
  daysOverdue: number;
}

export function dueInfo(
  objective: Objective,
  keyResults: KeyResult[],
  checkIns: KRCheckIn[],
  todayStr: string
): DueResult {
  if (objective.status !== 'active' || keyResults.length === 0) {
    return { isDue: false, isOverdue: false, dueDate: '', daysOverdue: 0 };
  }

  const krIds = new Set(keyResults.map((k) => k.id));
  const relevantCheckIns = checkIns.filter((ci) => krIds.has(ci.key_result_id));

  let latestCheckIn: string | null = null;
  for (const ci of relevantCheckIns) {
    if (!latestCheckIn || ci.checked_in_on > latestCheckIn) {
      latestCheckIn = ci.checked_in_on;
    }
  }

  const nextDue = nextCheckInDate(latestCheckIn, objective.period_start, objective.cadence);
  const isDue = todayStr >= nextDue;
  const isOverdue = todayStr > nextDue;

  let daysOverdue = 0;
  if (isOverdue) {
    const [y1, m1, d1] = nextDue.split('-').map(Number);
    const [y2, m2, d2] = todayStr.split('-').map(Number);
    daysOverdue = differenceInCalendarDays(new Date(y2, m2 - 1, d2), new Date(y1, m1 - 1, d1));
  }

  return {
    isDue,
    isOverdue,
    dueDate: nextDue,
    daysOverdue,
  };
}

export function objectiveListState(
  objective: Objective,
  health: 'on_track' | 'at_risk' | 'off_track' | null,
  isBehindPace: boolean,
  due: DueResult,
  todayStr: string
): ObjectiveListState {
  if (objective.status === 'paused') return 'paused';
  if (todayStr > objective.period_end) return 'ended';
  if (due.isOverdue) return 'overdue';
  if (due.isDue) return 'due';
  if (health === 'off_track') return 'off_track';
  if (health === 'at_risk') return 'at_risk';
  if (isBehindPace) return 'behind_pace';
  return null;
}

// --- Complete Metrics Bundle ---

export interface OkrMetricsBundle {
  workIndex: WorkIndex;
  workRollups: Map<string, WorkRollupResult>;
  habitStatsMap: Map<string, HabitStatsResult>;
  krProgressMap: Map<string, number>;
  objectiveProgressMap: Map<string, number>;
  objectiveHealthMap: Map<string, 'on_track' | 'at_risk' | 'off_track' | null>;
  objectivePaceMap: Map<string, PaceResult>;
  objectiveDueMap: Map<string, DueResult>;
  objectiveStateMap: Map<string, ObjectiveListState>;
}

export function computeOkrMetrics(params: {
  objectives: Objective[];
  keyResults: KeyResult[];
  checkIns: KRCheckIn[];
  habitLogs: KRHabitLog[];
  tasks: Task[];
  projects: Project[];
  todayStr: string;
}): OkrMetricsBundle {
  const { objectives, keyResults, checkIns, habitLogs, tasks, projects, todayStr } = params;

  const workIndex = buildWorkIndex(tasks, projects);
  const workRollups = new Map<string, WorkRollupResult>();
  const habitStatsMap = new Map<string, HabitStatsResult>();
  const krProgressMap = new Map<string, number>();

  const krsByObjectiveId = new Map<string, KeyResult[]>();

  for (const kr of keyResults) {
    const list = krsByObjectiveId.get(kr.objective_id) || [];
    list.push(kr);
    krsByObjectiveId.set(kr.objective_id, list);

    if (kr.kind === 'work') {
      const rollup = workRollup(kr.id, workIndex);
      workRollups.set(kr.id, rollup);
      krProgressMap.set(kr.id, keyResultProgress(kr, rollup));
    } else if (kr.kind === 'habit') {
      const parentObj = objectives.find((o) => o.id === kr.objective_id);
      const start = parentObj?.period_start ?? todayStr;
      const end = parentObj?.period_end ?? todayStr;
      const hStats = habitStats(kr, habitLogs, start, end, todayStr);
      habitStatsMap.set(kr.id, hStats);
      krProgressMap.set(kr.id, keyResultProgress(kr, undefined, hStats));
    } else {
      krProgressMap.set(kr.id, keyResultProgress(kr));
    }
  }

  const objectiveProgressMap = new Map<string, number>();
  const objectiveHealthMap = new Map<string, 'on_track' | 'at_risk' | 'off_track' | null>();
  const objectivePaceMap = new Map<string, PaceResult>();
  const objectiveDueMap = new Map<string, DueResult>();
  const objectiveStateMap = new Map<string, ObjectiveListState>();

  for (const obj of objectives) {
    const krs = krsByObjectiveId.get(obj.id) || [];

    const progress = objectiveProgress(krs, krProgressMap);
    objectiveProgressMap.set(obj.id, progress);

    const health = objectiveHealth(krs);
    objectiveHealthMap.set(obj.id, health);

    const pace = paceState(obj, progress, todayStr);
    objectivePaceMap.set(obj.id, pace);

    const due = dueInfo(obj, krs, checkIns, todayStr);
    objectiveDueMap.set(obj.id, due);

    const state = objectiveListState(obj, health, pace.isBehindPace, due, todayStr);
    objectiveStateMap.set(obj.id, state);
  }

  return {
    workIndex,
    workRollups,
    habitStatsMap,
    krProgressMap,
    objectiveProgressMap,
    objectiveHealthMap,
    objectivePaceMap,
    objectiveDueMap,
    objectiveStateMap,
  };
}

// --- Validation Helpers ---

export function validateObjectivePayload(payload: Partial<CreateObjectivePayload>): void {
  if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
    throw new Error('Goal title cannot be empty.');
  }
  if (!payload.period_start || !payload.period_end) {
    throw new Error('Start and end dates are required.');
  }
  if (payload.period_end < payload.period_start) {
    throw new Error('End date must be greater than or equal to start date.');
  }
}

export function validateKeyResultPayload(payload: Partial<CreateKeyResultPayload>): void {
  if (!payload.title || typeof payload.title !== 'string' || payload.title.trim().length === 0) {
    throw new Error('Key result title cannot be empty.');
  }
  if (payload.kind === 'metric') {
    if (payload.start_value === payload.target_value) {
      throw new Error('Target value must be different from start value.');
    }
  } else if (payload.kind === 'habit') {
    const t = payload.target_value ?? 1;
    if (t < 1 || t > 7) {
      throw new Error('Habit frequency must be between 1 and 7 days per week.');
    }
  }
}
