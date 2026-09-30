import React, { useState, useEffect } from 'react';
import { Dialog } from '../../components/primitives/Dialog/Dialog.js';
import { useListStore } from '../../stores/listStore.js';
import type { ListGroup } from '@shared/types/ListGroup.js';
import styles from './ListGroupModal.module.css';

interface ListGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupToEdit?: ListGroup | null;
  onSaved?: (group: ListGroup) => void;
  title?: string;
  description?: string;
}

export function ListGroupModal({
  open,
  onOpenChange,
  groupToEdit,
  onSaved,
  title,
  description,
}: ListGroupModalProps): React.ReactElement {
  const { createGroup, updateGroup } = useListStore();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (groupToEdit) {
      setName(groupToEdit.name);
    } else {
      setName('');
    }
  }, [groupToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (groupToEdit) {
        const updated = await updateGroup(groupToEdit.id, { name: name.trim() });
        onSaved?.(updated);
      } else {
        const created = await createGroup({ name: name.trim() });
        onSaved?.(created);
      }
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save list group:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultTitle = groupToEdit ? 'Edit Folder' : 'New Folder';
  const defaultDescription = 'Create a folder to organize projects and lists in the sidebar.';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title ?? defaultTitle}
      description={description ?? defaultDescription}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Folder Name</label>
          <input
            type="text"
            className={styles.textInput}
            placeholder="e.g. Work or Clients"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>

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
            {groupToEdit ? 'Save Changes' : 'Create Folder'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default ListGroupModal;
