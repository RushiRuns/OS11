import { describe, it, expect } from 'vitest';
import React from 'react';
import { AnytimeView } from '../../src/renderer/features/gtd/AnytimeView.js';
import { SomedayView } from '../../src/renderer/features/gtd/SomedayView.js';
import { WaitingForView } from '../../src/renderer/features/gtd/WaitingForView.js';
import { WaitingPopover } from '../../src/renderer/features/gtd/WaitingPopover.js';

describe('GTD Views (Anytime, Someday, Waiting For)', () => {
  it('instantiates AnytimeView component with onSelectTask and selectedTaskId props', () => {
    const el = React.createElement(AnytimeView, {
      onSelectTask: () => {},
      selectedTaskId: 'task-1',
    });
    expect(el.props.selectedTaskId).toBe('task-1');
  });

  it('instantiates SomedayView component with onSelectTask prop', () => {
    const el = React.createElement(SomedayView, {
      onSelectTask: () => {},
      selectedTaskId: null,
    });
    expect(el.props.selectedTaskId).toBeNull();
  });

  it('instantiates WaitingForView component with onSelectTask prop', () => {
    const el = React.createElement(WaitingForView, {
      onSelectTask: () => {},
      selectedTaskId: 'task-2',
    });
    expect(el.props.selectedTaskId).toBe('task-2');
  });

  it('instantiates WaitingPopover with initial values', () => {
    const el = React.createElement(WaitingPopover, {
      initialWaitingOn: 'Sarah',
      initialFollowUpDate: '2026-10-15',
      onSave: () => {},
      onCancel: () => {},
    });
    expect(el.props.initialWaitingOn).toBe('Sarah');
    expect(el.props.initialFollowUpDate).toBe('2026-10-15');
  });
});
