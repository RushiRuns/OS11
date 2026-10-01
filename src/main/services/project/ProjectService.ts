import { ProjectRepository } from '../../repositories/ProjectRepository.js';
import { TaskRepository } from '../../repositories/TaskRepository.js';
import type { Project, CreateProjectPayload, UpdateProjectPayload, NotificationHistoryItem } from '@shared/types/index.js';

export class ProjectService {
  private repository: ProjectRepository;
  private taskRepo: TaskRepository;

  constructor(repository?: ProjectRepository, taskRepo?: TaskRepository) {
    this.repository = repository ?? new ProjectRepository();
    this.taskRepo = taskRepo ?? new TaskRepository();
  }

  public getAll(): Project[] {
    return this.repository.getAll();
  }

  public getById(id: string): Project {
    const project = this.repository.getById(id);
    if (!project) {
      throw new Error(`Project with id "${id}" not found.`);
    }
    return project;
  }

  public getByAreaId(areaId: string): Project[] {
    return this.repository.getByAreaId(areaId);
  }

  public create(payload: CreateProjectPayload): Project {
    if (!payload.name || payload.name.trim().length === 0) {
      throw new Error('Project name is required.');
    }
    return this.repository.create({
      ...payload,
      name: payload.name.trim(),
    });
  }

  public update(id: string, fields: UpdateProjectPayload): Project {
    if (fields.name !== undefined && fields.name.trim().length === 0) {
      throw new Error('Project name cannot be empty.');
    }
    return this.repository.update(id, {
      ...fields,
      ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
    });
  }

  public archive(id: string): void {
    this.repository.archive(id);
  }

  public getActivity(id: string): NotificationHistoryItem[] {
    return this.repository.getActivity(id);
  }

  public delete(id: string): { trashedTaskIds: string[]; trashedCount: number } {
    const tasks = this.taskRepo.getByProjectId(id);
    const now = new Date().toISOString();
    for (const t of tasks) {
      this.taskRepo.trash(t.id, now);
    }
    this.repository.delete(id);
    return { trashedTaskIds: tasks.map(t => t.id), trashedCount: tasks.length };
  }
}

export default ProjectService;
