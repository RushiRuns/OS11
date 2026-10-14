import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { useCustomGroupStore } from '../../stores/customGroupStore.js';
import { useViewGroupStore } from '../../stores/viewGroupStore.js';
import type { CustomGroup, DeleteImpactResult } from '@shared/types/index.js';
import styles from './CustomGroupEditorModal.module.css';

interface CustomGroupEditorModalProps {
  group?: CustomGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (group: CustomGroup) => void;
  currentProjectId?: string;
}

interface LocalSection {
  id?: string;
  name: string;
  sort_order: number;
}

const MAX_SECTIONS = 12;
const MAX_CHAR_LIMIT = 40;

export function CustomGroupEditorModal({
  group,
  isOpen,
  onClose,
  onSaved,
  currentProjectId,
}: CustomGroupEditorModalProps): React.ReactElement {
  const {
    groups,
    createGroup,
    updateGroup,
    deleteGroup,
    getDeleteImpact,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
  } = useCustomGroupStore();

  const [groupName, setGroupName] = useState(group?.name ?? '');
  const [sections, setSections] = useState<LocalSection[]>(() =>
    (group?.sections ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      sort_order: s.sort_order,
    }))
  );
  const [newSectionName, setNewSectionName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete group confirmation state
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpactResult | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);

  const isEditMode = Boolean(group);

  useEffect(() => {
    if (isOpen) {
      if (group) {
        setGroupName(group.name);
        const secList = (group.sections ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          sort_order: s.sort_order,
        }));
        setSections(secList);
      } else {
        setGroupName('');
        setSections([]);
      }
      setNewSectionName('');
      setError(null);
      setIsConfirmingDelete(false);
      setDeleteImpact(null);
    }
  }, [isOpen, group]);

  const handleAddSection = () => {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_CHAR_LIMIT) {
      setError(`Section name cannot exceed ${MAX_CHAR_LIMIT} characters`);
      return;
    }

    if (sections.length >= MAX_SECTIONS) {
      setError(`A custom group cannot have more than ${MAX_SECTIONS} sections`);
      return;
    }

    const lower = trimmed.toLowerCase();
    if (sections.some((s) => s.name.toLowerCase() === lower)) {
      setError(`Section "${trimmed}" already exists in this group`);
      return;
    }

    setError(null);
    const nextOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.sort_order)) + 1 : 1;
    setSections([...sections, { name: trimmed, sort_order: nextOrder }]);
    setNewSectionName('');
  };

  const handleSectionNameChange = (index: number, newName: string) => {
    setSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: newName };
      return next;
    });
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    setSections((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next.map((s, idx) => ({ ...s, sort_order: idx + 1 }));
    });
  };

  const handleDeleteSection = async (index: number) => {
    const target = sections[index];
    if (target.id && isEditMode) {
      try {
        await deleteSection(target.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return;
      }
    }
    setSections((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleStartDeleteGroup = async () => {
    if (!group) return;
    try {
      setIsLoadingImpact(true);
      const impact = await getDeleteImpact(group.id);
      setDeleteImpact(impact);
      setIsConfirmingDelete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingImpact(false);
    }
  };

  const handleConfirmDeleteGroup = async () => {
    if (!group) return;
    try {
      setIsSubmitting(true);
      await deleteGroup(group.id);

      // If this group was active on the current project, reset groupBy to 'none'
      if (currentProjectId) {
        const viewId = `project:${currentProjectId}`;
        const activeGroup = useViewGroupStore.getState().getActiveCustomGroup(viewId);
        if (activeGroup === group.id) {
          useViewGroupStore.getState().setActiveCustomGroup(viewId, null);
          useViewGroupStore.getState().setGroupBy(viewId, 'none');
          await useCustomGroupStore.getState().setActiveProjectAndGroup(currentProjectId, null);
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    const trimmedGroupName = groupName.trim();
    if (!trimmedGroupName) {
      setError('Group name cannot be empty');
      return;
    }
    if (trimmedGroupName.length > MAX_CHAR_LIMIT) {
      setError(`Group name cannot exceed ${MAX_CHAR_LIMIT} characters`);
      return;
    }

    // Name uniqueness check
    const otherGroups = groups.filter((g) => g.id !== group?.id);
    if (otherGroups.some((g) => g.name.toLowerCase() === trimmedGroupName.toLowerCase())) {
      setError(`A custom group named "${trimmedGroupName}" already exists`);
      return;
    }

    if (sections.length > MAX_SECTIONS) {
      setError(`Maximum ${MAX_SECTIONS} sections allowed`);
      return;
    }

    // Validate section names
    const sectionNames = new Set<string>();
    for (const sec of sections) {
      const sTrimmed = sec.name.trim();
      if (!sTrimmed) {
        setError('Section name cannot be empty');
        return;
      }
      if (sTrimmed.length > MAX_CHAR_LIMIT) {
        setError(`Section "${sTrimmed}" exceeds ${MAX_CHAR_LIMIT} characters`);
        return;
      }
      const lower = sTrimmed.toLowerCase();
      if (sectionNames.has(lower)) {
        setError(`Duplicate section name "${sTrimmed}"`);
        return;
      }
      sectionNames.add(lower);
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (!isEditMode) {
        // Create new group
        const created = await createGroup({
          name: trimmedGroupName,
          initialSections: sections.map((s) => s.name.trim()),
        });
        onSaved?.(created);
        onClose();
      } else if (group) {
        // Update existing group
        let updatedGroup: CustomGroup = group;
        if (trimmedGroupName !== group.name) {
          updatedGroup = await updateGroup({
            id: group.id,
            name: trimmedGroupName,
          });
        }

        // Apply section edits
        for (let idx = 0; idx < sections.length; idx++) {
          const sec = sections[idx];
          if (!sec.id) {
            // New section added in edit mode
            await createSection({
              group_id: group.id,
              name: sec.name.trim(),
              sort_order: idx + 1,
            });
          } else {
            // Existing section: update name if changed
            const original = group.sections?.find((s) => s.id === sec.id);
            if (original && original.name !== sec.name.trim()) {
              await updateSection({
                id: sec.id,
                name: sec.name.trim(),
              });
            }
          }
        }

        // Reorder sections
        const reorderPayload = sections
          .filter((s): s is LocalSection & { id: string } => Boolean(s.id))
          .map((s, idx) => ({ id: s.id, sort_order: idx + 1 }));

        if (reorderPayload.length > 0) {
          await reorderSections(group.id, reorderPayload);
        }

        // Refresh group in store
        await useCustomGroupStore.getState().loadGroups();
        const fresh = useCustomGroupStore.getState().groups.find((g) => g.id === group.id) ?? updatedGroup;
        onSaved?.(fresh);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isEditMode ? `Edit Custom Group` : 'New Custom Group'}
      description={
        isEditMode
          ? 'Modify group name and manage sections in this custom group.'
          : 'Define a new reusable custom group and its sections.'
      }
    >
      <div className={styles.container}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Group Name Input */}
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="custom-group-name" className={styles.label}>
              Group Name
            </label>
            <span className={styles.charCount}>
              {groupName.length}/{MAX_CHAR_LIMIT}
            </span>
          </div>
          <input
            id="custom-group-name"
            type="text"
            className={styles.input}
            placeholder="e.g., Coding, Marketing, Priority"
            value={groupName}
            maxLength={MAX_CHAR_LIMIT}
            onChange={(e) => {
              setGroupName(e.target.value);
              setError(null);
            }}
          />
        </div>

        {/* Sections Header */}
        <div className={styles.sectionHeader}>
          <label className={styles.label}>Sections</label>
          <span className={styles.badge}>
            {sections.length} of {MAX_SECTIONS}
          </span>
        </div>

        {/* Sections List */}
        <div className={styles.sectionList} role="list">
          {sections.map((sec, idx) => (
            <div key={sec.id ?? `new-${idx}`} className={styles.sectionRow} role="listitem">
              <input
                type="text"
                className={styles.sectionInput}
                value={sec.name}
                maxLength={MAX_CHAR_LIMIT}
                onChange={(e) => handleSectionNameChange(idx, e.target.value)}
                placeholder="Section name"
              />

              <button
                type="button"
                className={styles.iconBtn}
                title="Move up"
                aria-label="Move up"
                disabled={idx === 0}
                onClick={() => handleMoveSection(idx, 'up')}
              >
                ▲
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                title="Move down"
                aria-label="Move down"
                disabled={idx === sections.length - 1}
                onClick={() => handleMoveSection(idx, 'down')}
              >
                ▼
              </button>
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.deleteIconBtn}`}
                title="Delete section"
                aria-label="Delete section"
                onClick={() => handleDeleteSection(idx)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add Section Row */}
        {sections.length < MAX_SECTIONS && (
          <div className={styles.addSectionRow}>
            <input
              type="text"
              className={styles.addInput}
              placeholder="New section name..."
              value={newSectionName}
              maxLength={MAX_CHAR_LIMIT}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSection();
                }
              }}
            />
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleAddSection}
              disabled={!newSectionName.trim()}
            >
              + Add Section
            </button>
          </div>
        )}

        {/* Delete Confirmation Warning */}
        {isConfirmingDelete && deleteImpact && (
          <div className={styles.confirmBox}>
            <p className={styles.confirmText}>
              Delete group &ldquo;{group?.name}&rdquo;?
              <br />
              This group is used by <strong>{deleteImpact.projectCount}</strong> project(s) and affects{' '}
              <strong>{deleteImpact.taskCount}</strong> task(s). All affected tasks will move to Unsorted.
              This can be undone.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setIsConfirmingDelete(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.dangerConfirmBtn}
                onClick={handleConfirmDeleteGroup}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className={styles.footer}>
          {isEditMode && !isConfirmingDelete && (
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={handleStartDeleteGroup}
              disabled={isLoadingImpact || isSubmitting}
            >
              {isLoadingImpact ? 'Checking...' : 'Delete Group'}
            </button>
          )}

          <div className={styles.rightActions}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleSave}
              disabled={isSubmitting || !groupName.trim()}
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
