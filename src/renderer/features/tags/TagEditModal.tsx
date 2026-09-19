import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { useTagStore, TAG_COLOR_PALETTE } from '../../stores/tagStore.js';
import type { Tag } from '@shared/types/Tag.js';
import styles from '../lists/CreateListModal.module.css';

interface TagEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tagToEdit: Tag | null;
  onSaved?: (tag: Tag) => void;
}

export function TagEditModal({
  open,
  onOpenChange,
  tagToEdit,
  onSaved,
}: TagEditModalProps): React.ReactElement {
  const { updateTag } = useTagStore();

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(TAG_COLOR_PALETTE[0].token);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (tagToEdit) {
      setName(tagToEdit.name);
      setColor(tagToEdit.color ?? TAG_COLOR_PALETTE[0].token);
    } else {
      setName('');
      setColor(TAG_COLOR_PALETTE[0].token);
    }
  }, [tagToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.replace(/^#+/, '').trim();
    if (!cleanName || !tagToEdit) return;

    setIsSubmitting(true);
    try {
      const updated = await updateTag(tagToEdit.id, {
        name: cleanName,
        color,
      });
      onSaved?.(updated);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to update tag:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Tag"
      description="Update tag name and color accent. Changes will reflect across all tasks."
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Tag Name Input */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Tag Name</label>
          <input
            type="text"
            className={styles.textInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. work, urgent, ideas"
            autoFocus
          />
        </div>

        {/* Color Palette */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Color Accent</label>
          <div className={styles.colorSwatches}>
            {TAG_COLOR_PALETTE.map((c) => (
              <button
                key={c.token}
                type="button"
                className={`${styles.colorSwatch} ${color === c.token || color === c.hex ? styles.colorSwatchActive : ''}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => setColor(c.token)}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
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
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default TagEditModal;
