import type {
  SchedulingState,
  SchedulingCommand,
  TransitionEffects,
  TaskBucket,
} from '../../shared/types/Scheduling.js';

export function createDefaultSchedulingState(): SchedulingState {
  return {
    bucket: null,
    dueDate: null,
    dueTime: null,
    allDay: true,
    recurrenceRule: null,
    waitingOn: null,
    waitingSince: null,
    followUpDate: null,
    followUpNotifiedOn: null,
    reviewedAt: null,
  };
}

/**
 * Pure state transition engine for task scheduling.
 * Enforces:
 * - R2: Date and bucket never coexist (exclusive).
 * - R3: Waiting and Someday never coexist (exclusive).
 * - R4: Someday cancels all reminders.
 */
export function applySchedulingTransition(
  state: SchedulingState,
  command: SchedulingCommand,
  context?: { today?: string; timestamp?: string }
): { nextState: SchedulingState; effects: TransitionEffects } {
  const currentTimestamp = context?.timestamp ?? (context?.today ? `${context.today}T00:00:00.000Z` : new Date().toISOString());

  const nextState: SchedulingState = { ...state };
  const effects: TransitionEffects = {
    cancelReminders: false,
    clearBucket: false,
    clearDate: false,
    clearWaiting: false,
  };

  switch (command.type) {
    case 'SET_DATE': {
      // Setting a date clears any existing bucket (R2)
      if (state.bucket !== null) {
        effects.clearBucket = true;
        nextState.bucket = null;
      }
      nextState.dueDate = command.dueDate;
      nextState.dueTime = command.dueTime ?? null;
      nextState.allDay = command.allDay ?? (command.dueTime ? false : true);
      nextState.recurrenceRule = command.recurrenceRule ?? null;
      // Waiting overlay is preserved if present
      break;
    }

    case 'CLEAR_DATE': {
      if (state.dueDate !== null) {
        effects.clearDate = true;
        effects.cancelReminders = true;
      }
      nextState.dueDate = null;
      nextState.dueTime = null;
      nextState.allDay = true;
      nextState.recurrenceRule = null;
      break;
    }

    case 'SET_BUCKET': {
      if (command.bucket === 'anytime') {
        // Clearing date and cancelling reminders if dated (R2)
        if (state.dueDate !== null) {
          effects.clearDate = true;
          effects.cancelReminders = true;
          nextState.dueDate = null;
          nextState.dueTime = null;
          nextState.allDay = true;
          nextState.recurrenceRule = null;
        }
        nextState.bucket = 'anytime';
        // Waiting overlay is preserved (AnytimeWaiting is valid)
      } else if (command.bucket === 'someday') {
        // Clearing date and cancelling reminders if dated (R2, R4)
        if (state.dueDate !== null) {
          effects.clearDate = true;
          effects.cancelReminders = true;
          nextState.dueDate = null;
          nextState.dueTime = null;
          nextState.allDay = true;
          nextState.recurrenceRule = null;
        } else {
          // R4: Someday clears reminders regardless
          effects.cancelReminders = true;
        }

        // R3: Someday and Waiting never coexist -> clears waiting
        if (state.waitingSince !== null || state.waitingOn !== null) {
          effects.clearWaiting = true;
          nextState.waitingOn = null;
          nextState.waitingSince = null;
          nextState.followUpDate = null;
          nextState.followUpNotifiedOn = null;
        }

        nextState.bucket = 'someday';
      }
      break;
    }

    case 'CLEAR_BUCKET': {
      if (state.bucket !== null) {
        effects.clearBucket = true;
      }
      nextState.bucket = null;
      break;
    }

    case 'SET_WAITING': {
      const trimmedWaitingOn = command.waitingOn.trim();
      nextState.waitingOn = trimmedWaitingOn;
      nextState.waitingSince = state.waitingSince ?? currentTimestamp;
      nextState.followUpDate = command.followUpDate ?? null;

      // R3: Waiting and Someday never coexist -> clears someday bucket
      if (state.bucket === 'someday') {
        effects.clearBucket = true;
        nextState.bucket = null;
      }
      // If task was anytime, bucket remains anytime (AnytimeWaiting)
      // If task was dated, date remains (ScheduledWaiting)
      break;
    }

    case 'CLEAR_WAITING': {
      if (state.waitingSince !== null || state.waitingOn !== null) {
        effects.clearWaiting = true;
      }
      nextState.waitingOn = null;
      nextState.waitingSince = null;
      nextState.followUpDate = null;
      nextState.followUpNotifiedOn = null;
      break;
    }

    case 'MARK_SOMEDAY_REVIEWED': {
      nextState.reviewedAt = command.reviewedAt ?? currentTimestamp;
      break;
    }

    case 'ADD_TO_MY_DAY': {
      // Adding a someday task to My Day activates it to Anytime
      if (state.bucket === 'someday') {
        nextState.bucket = 'anytime';
      }
      break;
    }

    case 'COMPLETE_TASK': {
      if (command.autoClearWaiting) {
        if (state.waitingSince !== null || state.waitingOn !== null) {
          effects.clearWaiting = true;
          nextState.waitingOn = null;
          nextState.waitingSince = null;
          nextState.followUpDate = null;
          nextState.followUpNotifiedOn = null;
        }
      }
      break;
    }
  }

  // Safety invariant checks
  if (nextState.bucket !== null && nextState.dueDate !== null) {
    throw new Error('Invariant violation: bucket and dueDate cannot coexist.');
  }
  if (nextState.bucket === 'someday' && nextState.waitingSince !== null) {
    throw new Error('Invariant violation: Someday and Waiting cannot coexist.');
  }

  return { nextState, effects };
}

// ------------------------------------------------------------
// Pure Predicates
// ------------------------------------------------------------

export function isActionable(state: { bucket?: TaskBucket; waitingSince?: string | null }): boolean {
  return state.bucket !== 'someday' && !state.waitingSince;
}

export function isWaiting(state: { waitingSince?: string | null; waitingOn?: string | null }): boolean {
  return Boolean(state.waitingSince && state.waitingOn);
}

export function isSomeday(state: { bucket?: TaskBucket }): boolean {
  return state.bucket === 'someday';
}

export function isAnytime(state: { bucket?: TaskBucket }): boolean {
  return state.bucket === 'anytime';
}

export function isUntriaged(task: {
  area_id?: string | null;
  project_id?: string | null;
  parent_task_id?: string | null;
  due_date?: string | null;
  bucket?: string | null;
  waiting_since?: string | null;
}): boolean {
  return (
    !task.area_id &&
    !task.project_id &&
    !task.parent_task_id &&
    !task.due_date &&
    !task.bucket &&
    !task.waiting_since
  );
}

export function isFollowUpDue(followUpDate: string | null | undefined, today: string): boolean {
  if (!followUpDate) return false;
  return followUpDate <= today;
}

export function isFollowUpOverdue(followUpDate: string | null | undefined, today: string): boolean {
  if (!followUpDate) return false;
  return followUpDate < today;
}
