import { AreaRepository } from '../../repositories/AreaRepository.js';
import { ProjectRepository } from '../../repositories/ProjectRepository.js';
import { TaskRepository } from '../../repositories/TaskRepository.js';
import type { Area, CreateAreaPayload, UpdateAreaPayload } from '@shared/types/index.js';

export class AreaService {
  private areaRepo: AreaRepository;
  private projectRepo: ProjectRepository;
  private taskRepo: TaskRepository;

  constructor(
    areaRepo?: AreaRepository,
    projectRepo?: ProjectRepository,
    taskRepo?: TaskRepository
  ) {
    this.areaRepo = areaRepo ?? new AreaRepository();
    this.projectRepo = projectRepo ?? new ProjectRepository();
    this.taskRepo = taskRepo ?? new TaskRepository();
  }

  public getAll(): Area[] {
    return this.areaRepo.getAll();
  }

  public getById(id: string): Area {
    const area = this.areaRepo.getById(id);
    if (!area) {
      throw new Error(`Area with id "${id}" not found.`);
    }
    return area;
  }

  public create(payload: CreateAreaPayload): Area {
    if (!payload.name || payload.name.trim().length === 0) {
      throw new Error('Area name is required.');
    }
    return this.areaRepo.create({
      ...payload,
      name: payload.name.trim(),
    });
  }

  public update(id: string, fields: UpdateAreaPayload): Area {
    if (fields.name !== undefined && fields.name.trim().length === 0) {
      throw new Error('Area name cannot be empty.');
    }
    return this.areaRepo.update(id, {
      ...fields,
      ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
    });
  }

  public delete(id: string): void {
    const totalAreas = this.areaRepo.count();
    if (totalAreas <= 1) {
      throw new Error('At least one Area must always exist.');
    }

    const projectCount = this.projectRepo.countByAreaId(id);
    const looseTaskCount = this.taskRepo.countLooseByAreaId(id, { includeTrashed: true });
    const allTaskCount = this.taskRepo.countAllByAreaId(id);
    if (projectCount > 0 || looseTaskCount > 0 || allTaskCount > 0) {
      throw new Error("Move or delete this Area's projects first.");
    }

    this.areaRepo.delete(id);
  }

  public reorder(updates: Array<{ id: string; sortOrder: number }>): void {
    this.areaRepo.reorder(updates);
  }
}

export default AreaService;
