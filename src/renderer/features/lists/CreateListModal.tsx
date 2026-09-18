import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { useListStore } from '../../stores/listStore.js';
import type { List } from '@shared/types/List.js';
import { EmojiPicker } from '../../components/EmojiPicker/EmojiPicker.js';
import styles from './CreateListModal.module.css';

interface CreateListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listToEdit?: List | null;
  onSaved?: (list: List) => void;
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

export function CreateListModal({
  open,
  onOpenChange,
  listToEdit,
  onSaved,
}: CreateListModalProps): React.ReactElement {
  const { createList, updateList, listGroupsById, orderedGroupIds } = useListStore();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState<string | null>(PRESET_COLORS[0]);
  const [groupId, setGroupId] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (listToEdit) {
      setName(listToEdit.name);
      setIcon(listToEdit.icon ?? '📁');
      setColor(listToEdit.color ?? PRESET_COLORS[0]);
      setGroupId(listToEdit.group_id ?? '');
    } else {
      setName('');
      setIcon('📁');
      setColor(PRESET_COLORS[0]);
      setGroupId('');
    }
  }, [listToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (listToEdit) {
        const updated = await updateList(listToEdit.id, {
          name: name.trim(),
          icon,
          color,
          group_id: groupId ? groupId : null,
        });
        onSaved?.(updated);
      } else {
        const created = await createList({
          name: name.trim(),
          icon,
          color,
          group_id: groupId ? groupId : null,
        });
        onSaved?.(created);
      }
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save list:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={listToEdit ? 'Edit List' : 'New List'}
      description="Organize your tasks with custom icons, colors, and folders."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Name & Icon Row */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Name & Icon</label>
          <div className={styles.inputRow}>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={styles.emojiSelectButton}
                onClick={() => setShowEmojiPicker((v) => !v)}
                title="Choose emoji"
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
              placeholder="e.g. Project Launch"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
        </div>

        {/* Color Swatches */}
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
              />
            ))}
          </div>
        </div>

        {/* Group / Folder */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Folder (Optional)</label>
          <select
            className={styles.selectInput}
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            <option value="">No folder</option>
            {orderedGroupIds.map((id) => (
              <option key={id} value={id}>
                {listGroupsById[id]?.name ?? id}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || !name.trim()}
          >
            {listToEdit ? 'Save Changes' : 'Create List'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default CreateListModal;
