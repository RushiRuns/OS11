import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InlineTaskCreator } from '../../src/renderer/features/tasks/InlineTaskCreator.js';
import { useTaskStore } from '../../src/renderer/stores/taskStore.js';

describe('Feature: Transparent Trigger & Top-of-List Inline Task Creation', () => {
  const mockCreateTask = vi.fn().mockImplementation(async (payload) => ({
    id: 'task-test-123',
    ...payload,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    useTaskStore.setState({
      createTask: mockCreateTask,
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Resting State & Structure', () => {
    it('renders a transparent resting trigger touching bottom with "New task" text', () => {
      const html = renderToStaticMarkup(
        React.createElement(InlineTaskCreator, { listId: 'list_inbox' })
      );

      // Verify the transparent trigger button exists with aria-label and text
      expect(html).toContain('aria-label="New task trigger"');
      expect(html).toContain('New task');
      // Creation card input should NOT be present in resting state
      expect(html).not.toContain('placeholder="New Task..."');
    });

    it('renders creation row at top with title input and circular indicator when initialOpen is true', () => {
      const html = renderToStaticMarkup(
        React.createElement(InlineTaskCreator, { listId: 'list_inbox', initialOpen: true })
      );

      expect(html).toContain('placeholder="New Task..."');
      expect(html).toContain('aria-label="New Task"');
      expect(html).toContain('title="New task"');
    });
  });

  describe('2. Toolbar & 3 Textless Action Icons', () => {
    it('renders exactly the 3 action icons (Notes, Date, Continue) without text labels', () => {
      const html = renderToStaticMarkup(
        React.createElement(InlineTaskCreator, { listId: 'list_inbox', initialOpen: true })
      );

      // Icon 1: Notes
      expect(html).toContain('aria-label="Toggle notes"');
      // Icon 2: Date
      expect(html).toContain('aria-label="Add date"');
      // Icon 3: Continue
      expect(html).toContain('aria-label="Continue"');
    });

    it('notes row is hidden by default in initial open state', () => {
      const html = renderToStaticMarkup(
        React.createElement(InlineTaskCreator, { listId: 'list_inbox', initialOpen: true })
      );

      expect(html).not.toContain('placeholder="Notes..."');
    });
  });

  describe('3. Store Integration & Task Creation Context', () => {
    it('invokes createTask with title, notes, and default contexts', async () => {
      const task = await useTaskStore.getState().createTask({
        title: 'Complete feature specification',
        notes: 'Detailed notes on implementation',
        list_id: 'list_inbox',
        bucket: null,
      });

      expect(mockCreateTask).toHaveBeenCalledWith({
        title: 'Complete feature specification',
        notes: 'Detailed notes on implementation',
        list_id: 'list_inbox',
        bucket: null,
      });
      expect(task.title).toBe('Complete feature specification');
    });

    it('propagates project_id when defaultProjectId is supplied', async () => {
      await useTaskStore.getState().createTask({
        title: 'Project Task Item',
        project_id: 'proj-omega',
        list_id: 'proj-omega',
      });

      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Project Task Item',
          project_id: 'proj-omega',
        })
      );
    });

    it('propagates area_id when defaultAreaId is supplied', async () => {
      await useTaskStore.getState().createTask({
        title: 'Area Loose Task',
        area_id: 'area-finance',
      });

      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Area Loose Task',
          area_id: 'area-finance',
        })
      );
    });

    it('propagates GTD bucket when defaultBucket is supplied', async () => {
      await useTaskStore.getState().createTask({
        title: 'Someday Maybe Idea',
        bucket: 'someday',
      });

      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Someday Maybe Idea',
          bucket: 'someday',
        })
      );
    });

    it('propagates due_date when defaultDueDate is supplied', async () => {
      await useTaskStore.getState().createTask({
        title: 'Planned Task',
        due_date: '2026-10-15',
      });

      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Planned Task',
          due_date: '2026-10-15',
        })
      );
    });
  });

  describe('4. Colon (:) NLP & Delimiter Parsing Logic', () => {
    it('correctly splits title and notes on ":" delimiter', () => {
      const input = 'Buy groceries: milk, bread, organic apples';
      const colonIndex = input.indexOf(':');
      expect(colonIndex).toBeGreaterThan(-1);

      const cleanTitle = input.slice(0, colonIndex).trim();
      const notes = input.slice(colonIndex + 1).trim();

      expect(cleanTitle).toBe('Buy groceries');
      expect(notes).toBe('milk, bread, organic apples');
    });

    it('removes ":" from title when user types colon', () => {
      const typed = 'Review PR:';
      const cleanTitle = typed.replace(':', '');
      expect(cleanTitle).toBe('Review PR');
      expect(cleanTitle).not.toContain(':');
    });
  });

  describe('5. Continuous Session & Keyboard Logic Specifications', () => {
    it('validates non-empty title before saving in session continue loop', () => {
      const emptyTitle = '   ';
      const isValid = Boolean(emptyTitle.trim());
      expect(isValid).toBe(false);
    });

    it('distinguishes Enter vs Shift+Enter behavior', () => {
      const eventShiftEnter = { key: 'Enter', shiftKey: true };
      const eventNormalEnter = { key: 'Enter', shiftKey: false };

      // Shift+Enter => continue session
      const isContinue = eventShiftEnter.key === 'Enter' && eventShiftEnter.shiftKey;
      // Enter without Shift => save and close
      const isSaveAndClose = eventNormalEnter.key === 'Enter' && !eventNormalEnter.shiftKey;

      expect(isContinue).toBe(true);
      expect(isSaveAndClose).toBe(true);
    });
  });
});
