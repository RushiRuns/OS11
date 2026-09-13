import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { useListStore } from '../../stores/listStore.js';
import type { List } from '@shared/types/List.js';
import styles from './CreateListModal.module.css';

interface CreateListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listToEdit?: List | null;
  onSaved?: (list: List) => void;
}

const PRESET_EMOJIS = ['📁', '🚀', '💼', '🏠', '💡', '📚', '🎯', '🛒', '🎨', '🎵', '✈️', '💻', '⚡', '☕', '🔥'];
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
  const [backgroundType, setBackgroundType] = useState<'none' | 'solid' | 'gradient'>('none');
  const [backgroundValue, setBackgroundValue] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (listToEdit) {
      setName(listToEdit.name);
      setIcon(listToEdit.icon ?? '📁');
      setColor(listToEdit.color ?? PRESET_COLORS[0]);
      setGroupId(listToEdit.group_id ?? '');
      setBackgroundType((listToEdit.background_type as 'none' | 'solid' | 'gradient') ?? 'none');
      setBackgroundValue(listToEdit.background_value ?? '');
    } else {
      setName('');
      setIcon('📁');
      setColor(PRESET_COLORS[0]);
      setGroupId('');
      setBackgroundType('none');
      setBackgroundValue('');
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
          background_type: backgroundType,
          background_value: backgroundValue || null,
        });
        onSaved?.(updated);
      } else {
        const created = await createList({
          name: name.trim(),
          icon,
          color,
          group_id: groupId ? groupId : null,
          background_type: backgroundType,
          background_value: backgroundValue || null,
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
      description="Organize your tasks with custom icons, colors, and backgrounds."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Name & Icon Row */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Name & Icon</label>
          <div className={styles.inputRow}>
            <button
              type="button"
              className={styles.emojiSelectButton}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Choose emoji"
            >
              {icon}
            </button>
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

        {/* Background Theming */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Background Theme</label>
          <select
            className={styles.selectInput}
            value={backgroundType}
            onChange={(e) => setBackgroundType(e.target.value as 'none' | 'solid' | 'gradient')}
          >
            <option value="none">Default (None)</option>
            <option value="solid">Solid Tint</option>
            <option value="gradient">Soft Gradient</option>
          </select>

          {backgroundType === 'solid' && (
            <input
              type="text"
              className={styles.textInput}
              placeholder="Hex or CSS color, e.g. #f4f6f8"
              value={backgroundValue}
              onChange={(e) => setBackgroundValue(e.target.value)}
            />
          )}

          {backgroundType === 'gradient' && (
            <input
              type="text"
              className={styles.textInput}
              placeholder="e.g. linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              value={backgroundValue}
              onChange={(e) => setBackgroundValue(e.target.value)}
            />
          )}
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
