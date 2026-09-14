export interface TaskDependency {
  task_id: string;
  depends_on_id: string;
}

export interface CreateTaskDependencyPayload {
  task_id: string;
  depends_on_id: string;
}
