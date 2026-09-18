import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { useProjectStore } from '../../stores/projectStore.js';
import type { Project } from '@shared/types/index.js';
import { EmojiPicker } from '../../components/EmojiPicker/EmojiPicker.js';
import styles from './CreateProjectModal.module.css';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: Project) => void;
  projectToEdit?: Project | null;
  onSaved?: (project: Project) => void;
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

const DEFAULT_VIEWS: Array<{ value: 'list' | 'board' | 'timeline' | 'calendar' | 'table'; label: string }> = [
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'table', label: 'Table' },
];

export function CreateProjectModal({
  open,
  onOpenChange,
  onCreated,
  projectToEdit,
  onSaved,
}: CreateProjectModalProps): React.ReactElement {
  const { createProject, updateProject, setSelectedProjectId } = useProjectStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [defaultView, setDefaultView] = useState<'list' | 'board' | 'timeline' | 'calendar' | 'table'>('list');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name);
      setDescription(projectToEdit.description ?? '');
      setIcon(projectToEdit.icon ?? '📁');
      setColor(projectToEdit.color ?? PRESET_COLORS[0]);
      setDefaultView(projectToEdit.default_view ?? 'list');
      setShowEmojiPicker(false);
      setIsSubmitting(false);
    } else if (open) {
      setName('');
      setDescription('');
      setIcon('📁');
      setColor(PRESET_COLORS[0]);
      setDefaultView('list');
      setShowEmojiPicker(false);
      setIsSubmitting(false);
    }
  }, [open, projectToEdit]);

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
          <label className={styles.label}>Default View</label>
          <select
            className={styles.selectInput}
            value={defaultView}
            onChange={(e) => setDefaultView(e.target.value as any)}
          >
            {DEFAULT_VIEWS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
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
