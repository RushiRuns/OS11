export interface ProjectHealthTarget {
  id: string;
  status: string;
  is_someday?: number;
}

export interface ProjectTaskHealthItem {
  project_id?: string | null;
  is_completed: number;
  is_trashed: number;
  bucket?: string | null;
  waiting_since?: string | null;
  due_date?: string | null;
}

/**
 * Determines if a project is stalled.
 * A project is stalled if:
 * 1. It is active (status === 'active' and is_someday !== 1).
 * 2. It has zero incomplete actionable tasks (every incomplete task is in Someday, Waiting For, or there are no tasks at all).
 */
export function isStalled(
  project: ProjectHealthTarget,
  tasks: ProjectTaskHealthItem[]
): boolean {
  if (project.status !== 'active' || project.is_someday === 1) {
    return false;
  }

  // Find incomplete, non-trashed tasks belonging to this project
  const projectTasks = tasks.filter(
    (t) => t.project_id === project.id && t.is_completed === 0 && t.is_trashed === 0
  );

  // If there are no incomplete tasks, it has no active next action -> stalled
  if (projectTasks.length === 0) {
    return true;
  }

  // An actionable next action must NOT be in Someday and must NOT be waiting
  const hasActionableTask = projectTasks.some((t) => {
    const isSomeday = t.bucket === 'someday';
    const isWaiting = Boolean(t.waiting_since);
    return !isSomeday && !isWaiting;
  });

  return !hasActionableTask;
}
