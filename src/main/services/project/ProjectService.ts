import { ProjectRepository } from '../../repositories/ProjectRepository.js';
import type { Project, CreateProjectPayload, UpdateProjectPayload } from '@shared/types/index.js';

export class ProjectService {
  private repository: ProjectRepository;

  constructor(repository?: ProjectRepository) {
    this.repository = repository ?? new ProjectRepository();
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
      name: fields.name !== undefined ? fields.name.trim() : undefined,
    });
  }

  public archive(id: string): void {
    this.repository.archive(id);
  }

  public delete(id: string): void {
    this.repository.delete(id);
  }
}

export default ProjectService;
