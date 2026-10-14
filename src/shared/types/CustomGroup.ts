export interface CustomGroup {
  id: string;
  name: string;
  sort_order: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sections?: CustomGroupSection[];
}

export interface CustomGroupSection {
  id: string;
  group_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectGroupOverride {
  project_id: string;
  section_id: string;
  is_hidden: number; // 0 | 1
  name_override: string | null;
  sort_override: number | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCustomValue {
  task_id: string;
  group_id: string;
  section_id: string;
  created_at: string;
  updated_at: string;
}

// Payloads
export interface CreateCustomGroupPayload {
  name: string;
  sort_order?: number;
  initialSections?: string[];
}

export interface UpdateCustomGroupPayload {
  id: string;
  name?: string;
  sort_order?: number;
}

export interface CreateCustomGroupSectionPayload {
  group_id: string;
  name: string;
  sort_order?: number;
}

export interface UpdateCustomGroupSectionPayload {
  id: string;
  name?: string;
  sort_order?: number;
}

export interface ReorderCustomGroupSectionsPayload {
  group_id: string;
  updates: Array<{ id: string; sort_order: number }>;
}

export interface SetProjectGroupOverridePayload {
  project_id: string;
  section_id: string;
  is_hidden?: boolean | number;
  name_override?: string | null;
  sort_override?: number | null;
}

export interface ClearProjectGroupOverridePayload {
  project_id: string;
  section_id: string;
}

export interface MoveTasksPayload {
  taskIds: string[];
  groupId: string;
  sectionId: string | null;
  sortOrder?: number;
}

export interface TaskPreviousLocation {
  taskId: string;
  previousSectionId: string | null;
  previousSortOrder: number;
}

export interface MoveTasksResult {
  updatedCount: number;
  groupId: string;
  targetSectionId: string | null;
  targetSortOrder?: number;
  previousLocations: TaskPreviousLocation[];
}

export interface DeleteImpactResult {
  taskCount: number;
  projectCount: number;
}

export interface SoftDeleteResult {
  id: string;
  deleted_at: string;
}

export interface CustomGroupRestoreResult {
  id: string;
  restored: boolean;
}
