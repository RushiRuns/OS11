import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { useProjectStore } from '../../stores/projectStore.js';
import type { Project } from '@shared/types/index.js';
import styles from './CreateProjectModal.module.css';

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: Project) => void;
}

const PRESET_EMOJIS = ['📁', '🚀', '💼', '🎯', '💡', '📚', '🎨', '💻', '⚡', '🔥', '📊', '🛠️', '✨', '🏷️', '📦'];
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
}: CreateProjectModalProps): React.ReactElement {
  const { createProject, setSelectedProjectId } = useProjectStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [defaultView, setDefaultView] = useState<'list' | 'board' | 'timeline' | 'calendar' | 'table'>('list');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setIcon('📁');
      setColor(PRESET_COLORS[0]);
      setDefaultView('list');
      setShowEmojiPicker(false);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
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
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Project"
      description="Create a new structured project with sections, milestones, and views."
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Project Name</label>
          <div className={styles.inputRow}>
            <button
              type="button"
              className={styles.emojiSelectButton}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Choose icon"
            >
              {icon}
            </button>
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
          {showEmojiPicker && (
            <div className={styles.presetGrid}>
              {PRESET_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={styles.presetEmoji}
                  onClick={() => {
                    setIcon(emoji);
                    setShowEmojiPicker(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
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
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default CreateProjectModal;
