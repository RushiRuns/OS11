import React from 'react';
import type { Task } from '@shared/types/task.js';
import { TaskList } from '../tasks/TaskList.js';
import styles from './InboxTriageList.module.css';

export interface InboxTriageListProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
}

export function InboxTriageList({
  onSelectTask,
  selectedTaskId,
}: InboxTriageListProps): React.ReactElement {
  return (
    <div className={styles.container}>
      <TaskList
        onSelectTask={onSelectTask}
        selectedTaskId={selectedTaskId}
      />
    </div>
  );
}

export default InboxTriageList;
