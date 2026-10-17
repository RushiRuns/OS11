import type { Task } from '@shared/types/task.js';

export const OPTIONAL_FIELDS = [
  'repeat',
  'key_result',
  'waitingFor',
  'habit',
  'dependsOn',
  'attachments',
] as const;

export type OptionalField = (typeof OPTIONAL_FIELDS)[number];

export interface FieldValueContext {
  hasKeyResult?: boolean;
  hasGoal?: boolean;
  hasDependencies?: boolean;
  hasAttachments?: boolean;
}

export function fieldsWithValue(
  task: Partial<Task> | null | undefined,
  context?: FieldValueContext
): Set<OptionalField> {
  const set = new Set<OptionalField>();
  if (!task) return set;

  if (task.recurrence_rule) {
    set.add('repeat');
  }
  if (context?.hasKeyResult || context?.hasGoal || Boolean(task.key_result_id)) {
    set.add('key_result');
  }
  if (task.waiting_on) {
    set.add('waitingFor');
  }
  if (task.is_habit === 1) {
    set.add('habit');
  }
  if (context?.hasDependencies) {
    set.add('dependsOn');
  }
  if (context?.hasAttachments) {
    set.add('attachments');
  }

  return set;
}

export function hiddenFields(
  visible: Set<OptionalField> | readonly OptionalField[]
): OptionalField[] {
  const visibleSet = visible instanceof Set ? visible : new Set(visible);
  return OPTIONAL_FIELDS.filter((field) => !visibleSet.has(field));
}
