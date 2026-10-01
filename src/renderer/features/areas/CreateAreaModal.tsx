import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { EmojiPicker } from '../../components/EmojiPicker/EmojiPicker.js';
import { Button } from '../../components/Button/Button.js';
import { useAreaStore } from '../../stores/areaStore.js';
import type { Area } from '@shared/types/Area.js';
import styles from './CreateAreaModal.module.css';

interface CreateAreaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areaToEdit?: Area | null;
  onSaved?: (area: Area) => void;
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

export function CreateAreaModal({
  open,
  onOpenChange,
  areaToEdit,
  onSaved,
}: CreateAreaModalProps): React.ReactElement {
  const { createArea, updateArea } = useAreaStore();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (areaToEdit) {
      setName(areaToEdit.name);
      setIcon(areaToEdit.icon ?? '📁');
      setColor(areaToEdit.color ?? PRESET_COLORS[0]);
      setShowEmojiPicker(false);
      setError(null);
    } else if (open) {
      setName('');
      setIcon('📁');
      setColor(PRESET_COLORS[0]);
      setShowEmojiPicker(false);
      setError(null);
    }
  }, [areaToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (areaToEdit) {
        const updated = await updateArea(areaToEdit.id, {
          name: name.trim(),
          icon,
          color,
        });
        onSaved?.(updated);
      } else {
        const created = await createArea({
          name: name.trim(),
          icon,
          color,
        });
        onSaved?.(created);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={areaToEdit ? 'Edit Area' : 'New Area'}
      description="Areas are ongoing context containers like Personal, Work, or Health."
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <div style={{ color: 'var(--priority-critical, #e74c3c)', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div className={styles.row}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              title="Pick an emoji"
            >
              {icon}
            </button>
            {showEmojiPicker && (
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 8 }}>
                <EmojiPicker
                  onSelect={(selected) => {
                    setIcon(selected);
                    setShowEmojiPicker(false);
                  }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="area-name">Area Name</label>
            <input
              id="area-name"
              type="text"
              className={styles.input}
              placeholder="e.g. Work, Personal, Side Projects"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={100}
            />
          </div>
        </div>

        <div className={styles.inputGroup}>
          <span className={styles.label}>Accent Color</span>
          <div className={styles.colorPicker}>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchSelected : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!name.trim() || isSubmitting}
          >
            {areaToEdit ? 'Save Changes' : 'Create Area'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export default CreateAreaModal;
