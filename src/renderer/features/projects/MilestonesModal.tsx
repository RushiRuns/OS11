import React, { useState } from 'react';
import type { Milestone } from '@shared/types/index.js';
import { useProjectStore } from '../../stores/projectStore.js';
import styles from './MilestonesModal.module.css';

interface MilestonesModalProps {
  projectId: string;
  milestones: Milestone[];
  onClose: () => void;
}

export function MilestonesModal({
  projectId,
  milestones,
  onClose,
}: MilestonesModalProps): React.ReactElement {
  const { createMilestone, toggleMilestone, deleteMilestone } = useProjectStore();
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;

    await createMilestone({
      project_id: projectId,
      title: newTitle.trim(),
      due_date: newDate,
    });
    setNewTitle('');
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <span>◆</span>
            <span>Project Milestones</span>
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {milestones.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', margin: 0 }}>
              No milestones defined yet. Add key target dates below.
            </p>
          ) : (
            milestones.map((m) => {
              const isDone = m.is_completed === 1;
              return (
                <div key={m.id} className={styles.milestoneRow}>
                  <div className={styles.milestoneLeft}>
                    <span
                      className={`${styles.diamondIcon} ${isDone ? styles.diamondCompleted : ''}`}
                      onClick={() => toggleMilestone(m.id)}
                      title={isDone ? 'Mark uncompleted' : 'Mark completed'}
                    >
                      ◆
                    </span>
                    <span
                      className={`${styles.milestoneTitle} ${
                        isDone ? styles.milestoneCompletedText : ''
                      }`}
                    >
                      {m.title}
                    </span>
                  </div>
                  <span className={styles.milestoneDate}>{m.due_date}</span>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => deleteMilestone(m.id)}
                    title="Delete milestone"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}

          <form onSubmit={handleAdd} className={styles.addForm}>
            <input
              type="text"
              className={styles.input}
              placeholder="Milestone title (e.g. Beta Release)..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <input
              type="date"
              className={`${styles.input} ${styles.dateInput}`}
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
            <button type="submit" className={styles.addBtn}>
              + Add
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default MilestonesModal;
