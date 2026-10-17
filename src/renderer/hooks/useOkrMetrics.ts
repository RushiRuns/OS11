import { useMemo } from 'react';
import { useOkrStore } from '../stores/okrStore.js';
import { useTaskStore } from '../stores/taskStore.js';
import { useProjectStore } from '../stores/projectStore.js';
import { useToday } from './useToday.js';
import { computeOkrMetrics, type OkrMetricsBundle } from '@shared/utils/okr.js';

export function useOkrMetrics(customToday?: string): OkrMetricsBundle {
  const currentToday = useToday();
  const effectiveToday = customToday ?? currentToday;

  const objectivesById = useOkrStore((s) => s.objectivesById);
  const keyResultsById = useOkrStore((s) => s.keyResultsById);
  const checkInsByKeyResultId = useOkrStore((s) => s.checkInsByKeyResultId);
  const habitLogsByKeyResultId = useOkrStore((s) => s.habitLogsByKeyResultId);

  const tasksById = useTaskStore((s) => s.tasksById);
  const projectsById = useProjectStore((s) => s.projectsById);

  return useMemo(() => {
    const objectives = Object.values(objectivesById);
    const keyResults = Object.values(keyResultsById);

    const checkIns: Array<import('@shared/types/KeyResult.js').KRCheckIn> = [];
    for (const arr of Object.values(checkInsByKeyResultId)) {
      for (const item of arr) {
        checkIns.push(item);
      }
    }

    const habitLogs: Array<import('@shared/types/KeyResult.js').KRHabitLog> = [];
    for (const arr of Object.values(habitLogsByKeyResultId)) {
      for (const item of arr) {
        habitLogs.push(item);
      }
    }

    const tasks = Object.values(tasksById);
    const projects = Object.values(projectsById);

    return computeOkrMetrics({
      objectives,
      keyResults,
      checkIns,
      habitLogs,
      tasks,
      projects,
      todayStr: effectiveToday,
    });
  }, [
    objectivesById,
    keyResultsById,
    checkInsByKeyResultId,
    habitLogsByKeyResultId,
    tasksById,
    projectsById,
    effectiveToday,
  ]);
}
