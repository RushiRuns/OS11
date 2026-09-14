import { MilestoneRepository } from '../../repositories/MilestoneRepository.js';
import type { Milestone, CreateMilestonePayload, UpdateMilestonePayload } from '@shared/types/index.js';

export class MilestoneService {
  private repository: MilestoneRepository;

  constructor(repository?: MilestoneRepository) {
    this.repository = repository ?? new MilestoneRepository();
  }

  public getByProjectId(projectId: string): Milestone[] {
    return this.repository.getByProjectId(projectId);
  }

  public getById(id: string): Milestone {
    const milestone = this.repository.getById(id);
    if (!milestone) {
      throw new Error(`Milestone with id "${id}" not found.`);
    }
    return milestone;
  }

  public create(payload: CreateMilestonePayload): Milestone {
    if (!payload.title || payload.title.trim().length === 0) {
      throw new Error('Milestone title is required.');
    }
    if (!payload.due_date) {
      throw new Error('Milestone due date is required.');
    }
    return this.repository.create({
      ...payload,
      title: payload.title.trim(),
    });
  }

  public update(id: string, fields: UpdateMilestonePayload): Milestone {
    if (fields.title !== undefined && fields.title.trim().length === 0) {
      throw new Error('Milestone title cannot be empty.');
    }
    return this.repository.update(id, {
      ...fields,
      title: fields.title !== undefined ? fields.title.trim() : undefined,
    });
  }

  public delete(id: string): void {
    this.repository.delete(id);
  }
}

export default MilestoneService;
