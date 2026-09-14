import { DependencyRepository } from '../../repositories/DependencyRepository.js';
import { wouldCreateCycle } from '../../domain/dependency-check.js';
import type { TaskDependency } from '@shared/types/index.js';

export class DependencyService {
  private repository: DependencyRepository;

  constructor(repository?: DependencyRepository) {
    this.repository = repository ?? new DependencyRepository();
  }

  public getAll(): TaskDependency[] {
    return this.repository.getAll();
  }

  public getByTaskId(taskId: string): string[] {
    return this.repository.getByTaskId(taskId);
  }

  public getByProjectId(projectId: string): TaskDependency[] {
    return this.repository.getByProjectId(projectId);
  }

  public add(taskId: string, dependsOnId: string): void {
    if (!taskId || !dependsOnId) {
      throw new Error('Both taskId and dependsOnId are required.');
    }

    if (taskId === dependsOnId) {
      throw new Error('A task cannot depend on itself.');
    }

    // Circular dependency check
    const isCycle = wouldCreateCycle(taskId, dependsOnId, () => {
      const all = this.repository.getAll();
      return all.map((d) => ({
        task_id: d.task_id,
        depends_on_task_id: d.depends_on_id,
      }));
    });

    if (isCycle) {
      throw new Error(`Circular dependency detected: task "${taskId}" cannot depend on "${dependsOnId}".`);
    }

    this.repository.add(taskId, dependsOnId);
  }

  public remove(taskId: string, dependsOnId: string): void {
    this.repository.remove(taskId, dependsOnId);
  }
}

export default DependencyService;
