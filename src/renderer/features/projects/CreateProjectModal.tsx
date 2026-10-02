import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { useProjectStore } from '../../stores/projectStore.js';
import { useListStore } from '../../stores/listStore.js';
import { useAreaStore } from '../../stores/areaStore.js';
import type { Project, ProjectViewMode } from '@shared/types/index.js';
import { EmojiPicker } from '../../components/EmojiPicker/EmojiPicker.js';
import { renderViewIcon, CheckIcon } from './ProjectViewIcons.js';
import styles from './CreateProjectModal.module.css';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: Project) => void;
  projectToEdit?: Project | null;
  onSaved?: (project: Project) => void;
  initialGroupId?: string | null;
  initialAreaId?: string | null;
}

const PRESET_COLORS = [
  '#1B88FF', // Blue
  '#27AE60', // Green
  '#E67E22', // Orange
  '#E74C3C', // Red
  '#9B59B6', // Purple
  '#E91E63', // Pink
  '#34495E', // Slate
];

const ALL_VIEWS: Array<{ id: ProjectViewMode; label: string }> = [
  { id: 'list', label: 'List' },
  { id: 'board', label: 'Board' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'table', label: 'Table' },
];

export function CreateProjectModal({
  open,
  onOpenChange,
  onCreated,
  projectToEdit,
  onSaved,
  initialGroupId,
  initialAreaId,
}: CreateProjectModalProps): React.ReactElement {
  const { createProject, updateProject, setSelectedProjectId, addProjectFolder } = useProjectStore();
  const { listGroupsById, orderedGroupIds, createGroup } = useListStore();
  const { areasById, orderedAreaIds } = useAreaStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [selectedViews, setSelectedViews] = useState<ProjectViewMode[]>(['list']);
  const [defaultView, setDefaultView] = useState<ProjectViewMode>('list');
  const [groupId, setGroupId] = useState<string>('');
  const [areaId, setAreaId] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name);
      setDescription(projectToEdit.description ?? '');
      setIcon(projectToEdit.icon ?? '📁');
      setColor(projectToEdit.color ?? PRESET_COLORS[0]);
      const editViews =
        projectToEdit.views && projectToEdit.views.length > 0
          ? projectToEdit.views
          : [projectToEdit.default_view ?? 'list'];
      setSelectedViews(editViews);
      setDefaultView(
        projectToEdit.default_view && editViews.includes(projectToEdit.default_view)
          ? projectToEdit.default_view
          : editViews[0] ?? 'list'
      );
      setGroupId(projectToEdit.group_id ?? '');
      setAreaId(projectToEdit.area_id ?? orderedAreaIds[0] ?? 'area_default');
      setShowEmojiPicker(false);
      setIsSubmitting(false);
      setIsCreatingFolder(false);
      setNewFolderName('');
    } else if (open) {
      setName('');
      setDescription('');
      setIcon('📁');
      setColor(PRESET_COLORS[0]);
      setSelectedViews(['list']);
      setDefaultView('list');
      setGroupId(initialGroupId ?? '');
      setAreaId(initialAreaId ?? orderedAreaIds[0] ?? 'area_default');
      setShowEmojiPicker(false);
      setIsSubmitting(false);
      setIsCreatingFolder(false);
      setNewFolderName('');
    }
  }, [open, projectToEdit, initialGroupId, initialAreaId, orderedAreaIds]);

  const handleQuickCreateFolder = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      setIsCreatingFolder(false);
      return;
    }
    try {
      const created = await createGroup({ name: newFolderName.trim() });
      addProjectFolder(created.id);
      setGroupId(created.id);
      setIsCreatingFolder(false);
      setNewFolderName('');
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleToggleViewSelection = (viewId: ProjectViewMode) => {
    if (selectedViews.includes(viewId)) {
      if (selectedViews.length <= 1) return;
      const remaining = selectedViews.filter((v) => v !== viewId);
      setSelectedViews(remaining);
      if (defaultView === viewId) {
        setDefaultView(remaining[0]);
      }
    } else {
      setSelectedViews([...selectedViews, viewId]);
    }
  };

  const handleSelectOrSetDefault = (viewId: ProjectViewMode) => {
    if (!selectedViews.includes(viewId)) {
      setSelectedViews([...selectedViews, viewId]);
    } else {
      setDefaultView(viewId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (projectToEdit) {
        const updated = await updateProject(projectToEdit.id, {
          name: name.trim(),
          description: description.trim() || null,
          color,
          icon,
          default_view: defaultView,
          views: selectedViews,
          area_id: areaId || 'area_default',
          group_id: groupId ? groupId : null,
        });
        onSaved?.(updated);
        onOpenChange(false);
      } else {
        const created = await createProject({
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          icon,
          default_view: defaultView,
          views: selectedViews,
          area_id: areaId || 'area_default',
          group_id: groupId ? groupId : null,
        });
        setSelectedProjectId(created.id);
        onCreated?.(created);
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Failed to save project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={projectToEdit ? 'Edit Project' : 'Create Project'}
      description={projectToEdit ? 'Update project details, appearance, and default view.' : 'Create a new structured project with sections, milestones, and views.'}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Project Name</label>
          <div className={styles.inputRow}>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={styles.emojiSelectButton}
                onClick={() => setShowEmojiPicker((v) => !v)}
                title="Choose icon"
              >
                {icon}
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  selectedEmoji={icon}
                  onSelect={(selected) => {
                    setIcon(selected);
                    setShowEmojiPicker(false);
                  }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
            <input
              type="text"
              className={styles.textInput}
              placeholder="e.g. Website Redesign, Mobile App v2..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
        </div>

        {/* Group / Folder */}
        <div className={styles.fieldGroup}>
          <div className={styles.labelRow}>
            <label className={styles.label}>Folder / Group (Optional)</label>
            {!isCreatingFolder && (
              <button
                type="button"
                className={styles.inlineActionBtn}
                onClick={() => setIsCreatingFolder(true)}
              >
                + New Folder
              </button>
            )}
          </div>
          {isCreatingFolder ? (
            <div className={styles.inlineFolderCreate}>
              <input
                type="text"
                className={styles.textInput}
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickCreateFolder(e);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsCreatingFolder(false);
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                className={styles.inlineConfirmBtn}
                onClick={handleQuickCreateFolder}
                disabled={!newFolderName.trim()}
              >
                Add
              </button>
              <button
                type="button"
                className={styles.inlineCancelBtn}
                onClick={() => setIsCreatingFolder(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <select
              className={styles.selectInput}
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              <option value="">No folder (Root)</option>
              {orderedGroupIds.map((id) => (
                <option key={id} value={id}>
                  📁 {listGroupsById[id]?.name ?? id}
                </option>
              ))}
            </select>
          )}
        </div>

        {orderedAreaIds.length >= 2 && (
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Area</label>
            <select
              className={styles.selectInput}
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
            >
              {orderedAreaIds.map((id) => (
                <option key={id} value={id}>
                  {areasById[id]?.icon || '📁'} {areasById[id]?.name ?? id}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Color</label>
          <div className={styles.colorSwatches}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchActive : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.labelRow}>
            <label className={styles.label}>Views</label>
            <span className={styles.viewsHint}>Tap checkbox to toggle. Tap label to set default.</span>
          </div>
          <div className={styles.viewChips} role="group" aria-label="Available project views">
            {ALL_VIEWS.map((v) => {
              const isSelected = selectedViews.includes(v.id);
              const isDefault = defaultView === v.id;
              const isOnlySelected = isSelected && selectedViews.length === 1;

              return (
                <div
                  key={v.id}
                  className={`${styles.viewChip} ${isSelected ? styles.viewChipActive : ''}`}
                >
                  <button
                    type="button"
                    className={`${styles.viewChipCheckbox} ${
                      isSelected ? styles.viewChipCheckboxActive : ''
                    } ${isOnlySelected ? styles.viewChipCheckboxDisabled : ''}`}
                    onClick={() => handleToggleViewSelection(v.id)}
                    disabled={isOnlySelected}
                    title={
                      isOnlySelected
                        ? 'At least one view must be enabled'
                        : isSelected
                        ? `Remove ${v.label} view`
                        : `Enable ${v.label} view`
                    }
                    aria-label={`Toggle ${v.label} view`}
                    aria-pressed={isSelected}
                  >
                    {isSelected && <CheckIcon size={11} />}
                  </button>
                  <button
                    type="button"
                    className={styles.viewChipMain}
                    onClick={() => handleSelectOrSetDefault(v.id)}
                    title={
                      isSelected
                        ? isDefault
                          ? `${v.label} is the default view`
                          : `Click to set ${v.label} as default view`
                        : `Enable ${v.label} view`
                    }
                  >
                    <span className={styles.viewChipIcon}>{renderViewIcon(v.id, 14)}</span>
                    <span className={styles.viewChipLabel}>{v.label}</span>
                    {isDefault && <span className={styles.defaultBadge}>Default</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Description (Optional)</label>
          <input
            type="text"
            className={styles.textInput}
            placeholder="Brief description of the project..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting
              ? projectToEdit ? 'Saving...' : 'Creating...'
              : projectToEdit ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default CreateProjectModal;
