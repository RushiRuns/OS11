import { v4 as uuidv4 } from 'uuid';
import type { CustomGroupRepository } from '../repositories/CustomGroupRepository.js';
import type {
  CustomGroup,
  CustomGroupSection,
  ProjectGroupOverride,
  CreateCustomGroupPayload,
  UpdateCustomGroupPayload,
  CreateCustomGroupSectionPayload,
  UpdateCustomGroupSectionPayload,
  SetProjectGroupOverridePayload,
  MoveTasksPayload,
  MoveTasksResult,
  DeleteImpactResult,
} from '../../shared/types/CustomGroup.js';

export const MAX_SECTIONS_PER_GROUP = 12;
export const MAX_NAME_LENGTH = 40;

export class CustomGroupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomGroupValidationError';
  }
}

/**
 * Validate group or section name length and characters.
 */
export function validateName(name: unknown, fieldLabel = 'Name'): string {
  if (typeof name !== 'string') {
    throw new CustomGroupValidationError(`${fieldLabel} must be a string.`);
  }
  const trimmed = name.trim();
  if (trimmed.length < 1) {
    throw new CustomGroupValidationError(`${fieldLabel} cannot be empty.`);
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new CustomGroupValidationError(`${fieldLabel} cannot exceed ${MAX_NAME_LENGTH} characters.`);
  }
  return trimmed;
}

/**
 * Create a custom group with optional initial sections.
 */
export function createCustomGroup(
  repo: CustomGroupRepository,
  payload: CreateCustomGroupPayload
): CustomGroup {
  const name = validateName(payload.name, 'Group name');

  // Check unique name among active groups
  const existing = repo.getGroupByName(name);
  if (existing) {
    throw new CustomGroupValidationError(`A custom group named "${name}" already exists.`);
  }

  const sectionsToCreate = payload.initialSections || [];
  if (sectionsToCreate.length > MAX_SECTIONS_PER_GROUP) {
    throw new CustomGroupValidationError(`A custom group cannot exceed ${MAX_SECTIONS_PER_GROUP} sections.`);
  }

  // Validate initial section names uniqueness
  const seenNames = new Set<string>();
  for (const sName of sectionsToCreate) {
    const valid = validateName(sName, 'Section name');
    const lower = valid.toLowerCase();
    if (seenNames.has(lower)) {
      throw new CustomGroupValidationError(`Duplicate section name "${valid}" in group.`);
    }
    seenNames.add(lower);
  }

  const now = new Date().toISOString();
  const groupId = uuidv4();
  const sortOrder = payload.sort_order ?? 0;

  const group = repo.createGroup({
    id: groupId,
    name,
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
  });

  const createdSections: CustomGroupSection[] = [];
  let secSort = 0;
  for (const sName of sectionsToCreate) {
    const sec = repo.createSection({
      id: uuidv4(),
      group_id: groupId,
      name: sName.trim(),
      sort_order: secSort++,
      created_at: now,
      updated_at: now,
    });
    createdSections.push(sec);
  }

  group.sections = createdSections;
  return group;
}

/**
 * Update custom group name or sort order.
 */
export function updateCustomGroup(
  repo: CustomGroupRepository,
  payload: UpdateCustomGroupPayload
): CustomGroup {
  if (!payload.id) {
    throw new CustomGroupValidationError('Group ID is required.');
  }

  const existing = repo.getGroupById(payload.id);
  if (!existing) {
    throw new CustomGroupValidationError('Custom group not found.');
  }

  let name: string | undefined = undefined;
  if (payload.name !== undefined) {
    name = validateName(payload.name, 'Group name');
    const duplicate = repo.getGroupByName(name, payload.id);
    if (duplicate) {
      throw new CustomGroupValidationError(`A custom group named "${name}" already exists.`);
    }
  }

  const now = new Date().toISOString();
  const updated = repo.updateGroup(payload.id, {
    name,
    sort_order: payload.sort_order,
    updated_at: now,
  });

  if (!updated) {
    throw new CustomGroupValidationError('Failed to update custom group.');
  }

  return updated;
}

/**
 * Soft delete a custom group.
 */
export function softDeleteCustomGroup(
  repo: CustomGroupRepository,
  groupId: string
): { id: string; deleted_at: string } {
  if (!groupId) {
    throw new CustomGroupValidationError('Group ID is required.');
  }
  const existing = repo.getGroupById(groupId);
  if (!existing) {
    throw new CustomGroupValidationError('Custom group not found.');
  }

  const now = new Date().toISOString();
  repo.softDeleteGroup(groupId, now);
  return { id: groupId, deleted_at: now };
}

/**
 * Restore a soft-deleted custom group.
 */
export function restoreCustomGroup(
  repo: CustomGroupRepository,
  groupId: string
): CustomGroup {
  if (!groupId) {
    throw new CustomGroupValidationError('Group ID is required.');
  }
  const groups = repo.getAllGroups(true);
  const group = groups.find((g) => g.id === groupId);
  if (!group) {
    throw new CustomGroupValidationError('Custom group not found.');
  }

  // Refuse restore if active group with same name exists
  const conflict = repo.getGroupByName(group.name, groupId);
  if (conflict) {
    throw new CustomGroupValidationError(`Cannot restore: a custom group named "${group.name}" already exists.`);
  }

  const now = new Date().toISOString();
  repo.restoreGroup(groupId, now);

  const restored = repo.getGroupById(groupId);
  if (!restored) {
    throw new CustomGroupValidationError('Failed to restore custom group.');
  }
  return restored;
}

/**
 * Get impact of deleting a group (tasks and projects affected).
 */
export function getDeleteImpact(
  repo: CustomGroupRepository,
  groupId: string
): DeleteImpactResult {
  if (!groupId) {
    throw new CustomGroupValidationError('Group ID is required.');
  }
  return repo.getDeleteImpact(groupId);
}

/**
 * Create a section in a custom group.
 */
export function createCustomGroupSection(
  repo: CustomGroupRepository,
  payload: CreateCustomGroupSectionPayload
): CustomGroupSection {
  if (!payload.group_id) {
    throw new CustomGroupValidationError('Group ID is required.');
  }
  const group = repo.getGroupById(payload.group_id);
  if (!group) {
    throw new CustomGroupValidationError('Custom group not found.');
  }

  // Check section cap
  const activeCount = repo.countActiveSections(payload.group_id);
  if (activeCount >= MAX_SECTIONS_PER_GROUP) {
    throw new CustomGroupValidationError(`Cannot add section: maximum limit of ${MAX_SECTIONS_PER_GROUP} sections reached.`);
  }

  const name = validateName(payload.name, 'Section name');
  const duplicate = repo.getSectionByName(payload.group_id, name);
  if (duplicate) {
    throw new CustomGroupValidationError(`A section named "${name}" already exists in this group.`);
  }

  const now = new Date().toISOString();
  return repo.createSection({
    id: uuidv4(),
    group_id: payload.group_id,
    name,
    sort_order: payload.sort_order ?? activeCount,
    created_at: now,
    updated_at: now,
  });
}

/**
 * Update custom group section name or sort order.
 */
export function updateCustomGroupSection(
  repo: CustomGroupRepository,
  payload: UpdateCustomGroupSectionPayload
): CustomGroupSection {
  if (!payload.id) {
    throw new CustomGroupValidationError('Section ID is required.');
  }

  const existing = repo.getSectionById(payload.id);
  if (!existing || existing.deleted_at !== null) {
    throw new CustomGroupValidationError('Section not found.');
  }

  let name: string | undefined = undefined;
  if (payload.name !== undefined) {
    name = validateName(payload.name, 'Section name');
    const duplicate = repo.getSectionByName(existing.group_id, name, payload.id);
    if (duplicate) {
      throw new CustomGroupValidationError(`A section named "${name}" already exists in this group.`);
    }
  }

  const now = new Date().toISOString();
  const updated = repo.updateSection(payload.id, {
    name,
    sort_order: payload.sort_order,
    updated_at: now,
  });

  if (!updated) {
    throw new CustomGroupValidationError('Failed to update section.');
  }

  return updated;
}

/**
 * Soft delete a section.
 */
export function softDeleteCustomGroupSection(
  repo: CustomGroupRepository,
  sectionId: string
): { id: string; deleted_at: string } {
  if (!sectionId) {
    throw new CustomGroupValidationError('Section ID is required.');
  }
  const existing = repo.getSectionById(sectionId);
  if (!existing) {
    throw new CustomGroupValidationError('Section not found.');
  }

  const now = new Date().toISOString();
  repo.softDeleteSection(sectionId, now);
  return { id: sectionId, deleted_at: now };
}

/**
 * Restore a soft-deleted section.
 */
export function restoreCustomGroupSection(
  repo: CustomGroupRepository,
  sectionId: string
): CustomGroupSection {
  if (!sectionId) {
    throw new CustomGroupValidationError('Section ID is required.');
  }
  const existing = repo.getSectionById(sectionId);
  if (!existing) {
    throw new CustomGroupValidationError('Section not found.');
  }

  // Refuse restore if active section with same name exists in group
  const duplicate = repo.getSectionByName(existing.group_id, existing.name, sectionId);
  if (duplicate) {
    throw new CustomGroupValidationError(`Cannot restore: a section named "${existing.name}" already exists in this group.`);
  }

  // Refuse restore if group is at max section cap
  const activeCount = repo.countActiveSections(existing.group_id);
  if (activeCount >= MAX_SECTIONS_PER_GROUP) {
    throw new CustomGroupValidationError(`Cannot restore: group is at maximum limit of ${MAX_SECTIONS_PER_GROUP} sections.`);
  }

  const now = new Date().toISOString();
  repo.restoreSection(sectionId, now);

  const restored = repo.getSectionById(sectionId);
  if (!restored) {
    throw new CustomGroupValidationError('Failed to restore section.');
  }
  return restored;
}

/**
 * Reorder sections in a custom group.
 */
export function reorderCustomGroupSections(
  repo: CustomGroupRepository,
  groupId: string,
  updates: Array<{ id: string; sort_order: number }>
): void {
  if (!groupId) {
    throw new CustomGroupValidationError('Group ID is required.');
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    return;
  }
  const now = new Date().toISOString();
  repo.reorderSections(groupId, updates, now);
}

/**
 * Set project group override (hide, rename, sort).
 * Enforces rule: Hide is blocked while the section holds open tasks in that project.
 */
export function setProjectGroupOverride(
  repo: CustomGroupRepository,
  payload: SetProjectGroupOverridePayload
): ProjectGroupOverride {
  if (!payload.project_id || !payload.section_id) {
    throw new CustomGroupValidationError('Project ID and Section ID are required.');
  }

  const section = repo.getSectionById(payload.section_id);
  if (!section) {
    throw new CustomGroupValidationError('Section not found.');
  }

  const isHiddenNum = payload.is_hidden ? 1 : 0;

  // Rule: Hide is blocked while the section holds open tasks in that project
  if (isHiddenNum === 1) {
    const openTasksCount = repo.countOpenTasksInSection(payload.project_id, payload.section_id);
    if (openTasksCount > 0) {
      throw new CustomGroupValidationError(
        `Cannot hide section: it holds ${openTasksCount} open task${openTasksCount === 1 ? '' : 's'} in this project.`
      );
    }
  }

  let nameOverride: string | null = null;
  if (payload.name_override !== undefined && payload.name_override !== null) {
    nameOverride = validateName(payload.name_override, 'Name override');
  }

  const now = new Date().toISOString();
  return repo.setProjectOverride({
    project_id: payload.project_id,
    section_id: payload.section_id,
    is_hidden: isHiddenNum,
    name_override: nameOverride,
    sort_override: payload.sort_override ?? null,
    created_at: now,
    updated_at: now,
  });
}

/**
 * Clear project group override.
 */
export function clearProjectGroupOverride(
  repo: CustomGroupRepository,
  projectId: string,
  sectionId: string
): boolean {
  if (!projectId || !sectionId) {
    throw new CustomGroupValidationError('Project ID and Section ID are required.');
  }
  return repo.clearProjectOverride(projectId, sectionId);
}

/**
 * Atomically move tasks between sections and optionally set sortOrder.
 * Optional sortOrder is allowed only when exactly one task is sent.
 */
export function moveTasks(
  repo: CustomGroupRepository,
  payload: MoveTasksPayload
): MoveTasksResult {
  if (!Array.isArray(payload.taskIds) || payload.taskIds.length === 0) {
    throw new CustomGroupValidationError('At least one task ID is required.');
  }
  if (!payload.groupId) {
    throw new CustomGroupValidationError('Group ID is required.');
  }

  if (payload.sortOrder !== undefined && payload.taskIds.length > 1) {
    throw new CustomGroupValidationError('sortOrder can only be specified when moving a single task.');
  }

  // Validate target section if not null (Unsorted)
  if (payload.sectionId !== null) {
    const section = repo.getSectionById(payload.sectionId);
    if (!section || section.group_id !== payload.groupId || section.deleted_at !== null) {
      throw new CustomGroupValidationError('Target section does not belong to the active group or is deleted.');
    }
  }

  const now = new Date().toISOString();
  const previousLocations = repo.moveTasks(
    payload.taskIds,
    payload.groupId,
    payload.sectionId,
    payload.sortOrder,
    now
  );

  return {
    updatedCount: previousLocations.length,
    groupId: payload.groupId,
    targetSectionId: payload.sectionId,
    targetSortOrder: payload.sortOrder,
    previousLocations,
  };
}
