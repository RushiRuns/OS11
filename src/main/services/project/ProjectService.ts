import { ProjectRepository } from '../../repositories/ProjectRepository.js';
import { TaskRepository } from '../../repositories/TaskRepository.js';
import { isStalled } from '../../domain/project-health.js';
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
    if (payload.views !== undefined && payload.views.length === 0) {
      throw new Error('A project must have at least one view enabled.');
    }
    let defaultView = payload.default_view;
    if (payload.views && payload.views.length > 0) {
      if (!defaultView || !payload.views.includes(defaultView)) {
        defaultView = payload.views[0];
      }
    }
    return this.repository.create({
      ...payload,
      name: payload.name.trim(),
      ...(defaultView !== undefined ? { default_view: defaultView } : {}),
    });
  }

  public update(id: string, fields: UpdateProjectPayload): Project {
    if (fields.name !== undefined && fields.name.trim().length === 0) {
      throw new Error('Project name cannot be empty.');
    }
    if (fields.views !== undefined && fields.views.length === 0) {
      throw new Error('A project must have at least one view enabled.');
    }
    let defaultView = fields.default_view;
    if (fields.views !== undefined && fields.views.length > 0) {
      const current = this.repository.getById(id);
      const targetDefault = defaultView ?? current?.default_view;
      if (targetDefault && !fields.views.includes(targetDefault)) {
        defaultView = fields.views[0];
      }
    }
    const updated = this.repository.update(id, {
      ...fields,
      ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
      ...(defaultView !== undefined ? { default_view: defaultView } : {}),
    });

    if (fields.area_id) {
      this.taskRepo.updateAreaByProjectId(id, fields.area_id);
    }

    return updated;
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

  public setSomeday(id: string, isSomeday: boolean): Project {
    return this.repository.setSomeday(id, isSomeday);
  }

  public getSomedayProjects(): Project[] {
    return this.repository.getSomedayProjects();
  }

  public getSomedayImpact(id: string): { openTasks: number; datedTasks: number } {
    const tasks = this.taskRepo.getByProjectId(id).filter((t) => t.is_trashed === 0 && t.is_completed === 0);
    const datedTasks = tasks.filter((t) => t.due_date !== null).length;
    return { openTasks: tasks.length, datedTasks };
  }

  public markReviewed(id: string, reviewedAt?: string): Project {
    return this.repository.markReviewed(id, reviewedAt ?? new Date().toISOString());
  }

  public getStalledProjectIds(): string[] {
    const projects = this.repository.getAll().filter((p) => p.status === 'active' && p.is_someday !== 1);
    const allTasks = this.taskRepo.getAll();
    const stalled: string[] = [];
    for (const p of projects) {
      if (isStalled(p, allTasks)) {
        stalled.push(p.id);
      }
    }
    return stalled;
  }
}

export default ProjectService;
