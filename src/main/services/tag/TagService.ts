import { TagRepository } from '../../repositories/TagRepository.js';
import type { Tag, CreateTagPayload, UpdateTagPayload } from '@shared/types/index.js';
import type { Task } from '@shared/types/task.js';

export class TagService {
  private repository: TagRepository;

  constructor(repository?: TagRepository) {
    this.repository = repository ?? new TagRepository();
  }

  public getAll(): Tag[] {
    return this.repository.getAll();
  }

  public getById(id: string): Tag {
    const tag = this.repository.getById(id);
    if (!tag) {
      throw new Error(`Tag with id "${id}" not found.`);
    }
    return tag;
  }

  public create(payload: CreateTagPayload): Tag {
    if (!payload.name || payload.name.trim().length === 0) {
      throw new Error('Tag name is required.');
    }
    return this.repository.create({
      ...payload,
      name: payload.name.trim(),
    });
  }

  public update(id: string, fields: UpdateTagPayload): Tag {
    if (fields.name !== undefined && fields.name.trim().length === 0) {
      throw new Error('Tag name cannot be empty.');
    }
    return this.repository.update(id, {
      ...fields,
      name: fields.name !== undefined ? fields.name.trim() : undefined,
    });
  }

  public delete(id: string): void {
    this.repository.delete(id);
  }

  public getTagsForTask(taskId: string): Tag[] {
    return this.repository.getTagsForTask(taskId);
  }

  public addTagToTask(taskId: string, tagId: string): void {
    this.repository.addTagToTask(taskId, tagId);
  }

  public removeTagFromTask(taskId: string, tagId: string): void {
    this.repository.removeTagFromTask(taskId, tagId);
  }

  public getTasksForTag(tagId: string): Task[] {
    return this.repository.getTasksForTag(tagId);
  }
}

export default TagService;
