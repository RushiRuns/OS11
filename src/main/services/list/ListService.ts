import { ListRepository } from '../../repositories/ListRepository.js';
import type { List, CreateListPayload, UpdateListPayload } from '@shared/types/index.js';

export class ListService {
  private repository: ListRepository;

  constructor(repository?: ListRepository) {
    this.repository = repository ?? new ListRepository();
  }

  public getAll(): List[] {
    return this.repository.getAll();
  }

  public getById(id: string): List {
    const list = this.repository.getById(id);
    if (!list) {
      throw new Error(`List with id "${id}" not found.`);
    }
    return list;
  }

  public create(payload: CreateListPayload): List {
    if (!payload.name || payload.name.trim().length === 0) {
      throw new Error('List name is required.');
    }
    return this.repository.create({
      ...payload,
      name: payload.name.trim(),
    });
  }

  public update(id: string, fields: UpdateListPayload): List {
    if (fields.name !== undefined && fields.name.trim().length === 0) {
      throw new Error('List name cannot be empty.');
    }
    return this.repository.update(id, {
      ...fields,
      ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
    });
  }

  public delete(id: string): boolean {
    const list = this.getById(id);
    if (list.is_smart === 1) {
      throw new Error('Cannot delete built-in smart lists.');
    }
    this.repository.delete(id);
    return true;
  }

  public reorder(updates: Array<{ id: string; sortOrder: number }>): void {
    this.repository.reorder(updates);
  }
}

export default ListService;
