import React from 'react';
import { TaskList } from '../tasks/TaskList.js';
import type { Task } from '@shared/types/task.js';
import styles from './MyDayView.module.css';

interface MyDayViewProps {
  onSelectTask?: (task: Task | null) => void;
  selectedTaskId?: string | null;
  isSuggestionsOpen?: boolean;
  onToggleSuggestions?: () => void;
  isSchedulerOpen?: boolean;
  onToggleScheduler?: () => void;
}

export function MyDayView({
  onSelectTask,
  selectedTaskId,
  isSuggestionsOpen,
  onToggleSuggestions,
  isSchedulerOpen,
  onToggleScheduler,
}: MyDayViewProps): React.ReactElement {
  return (
    <div className={styles.container}>
      <TaskList
        onSelectTask={onSelectTask}
        selectedTaskId={selectedTaskId}
        isMyDayList={true}
        isSuggestionsOpen={isSuggestionsOpen}
        onToggleSuggestions={onToggleSuggestions}
        isSchedulerOpen={isSchedulerOpen}
        onToggleScheduler={onToggleScheduler}
      />
    </div>
  );
}

export default MyDayView;
