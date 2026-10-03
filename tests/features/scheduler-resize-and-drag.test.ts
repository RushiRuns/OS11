import { describe, it, expect, beforeEach } from 'vitest';
import {
  resizeLimits,
  snapToGrid,
  yToMinutes,
  type BlockInterval,
} from '../../src/shared/utils/schedulerMath.js';
import { HOUR_HEIGHT } from '../../src/renderer/features/lists/scheduler/useSchedulerLayout.js';
import { useUndoRedoStore } from '../../src/renderer/hooks/useUndoRedo.js';

describe('Scheduler Time Block Resize & Drag Mathematics', () => {
  beforeEach(() => {
    useUndoRedoStore.setState({ undoStack: [], redoStack: [] });
  });

  describe('resizeLimits', () => {
    it('calculates bottom resize limits bounded by the next block', () => {
      const currentBlock: BlockInterval = { id: 'block-1', start: 600, duration: 60 }; // 10:00 to 11:00
      const nextBlock: BlockInterval = { id: 'block-2', start: 720, duration: 60 }; // 12:00 to 13:00
      const others = [nextBlock];

      const limits = resizeLimits(others, currentBlock, 'bottom');
      // Minimum end: start (600) + MIN_DURATION (15) = 615
      expect(limits.min).toBe(615);
      // Maximum end: next block start (720)
      expect(limits.max).toBe(720);
    });

    it('calculates bottom resize limits bounded by MAX_DURATION when no next block', () => {
      const currentBlock: BlockInterval = { id: 'block-1', start: 600, duration: 60 }; // 10:00
      const others: BlockInterval[] = [];

      const limits = resizeLimits(others, currentBlock, 'bottom');
      expect(limits.min).toBe(615);
      // 600 + 480 = 1080
      expect(limits.max).toBe(1080);
    });

    it('calculates top resize limits bounded by previous block', () => {
      const prevBlock: BlockInterval = { id: 'block-prev', start: 480, duration: 60 }; // 8:00 to 9:00 (ends 540)
      const currentBlock: BlockInterval = { id: 'block-curr', start: 600, duration: 60 }; // ends 660
      const others = [prevBlock];

      const limits = resizeLimits(others, currentBlock, 'top');
      // Min start: previous block end (540)
      expect(limits.min).toBe(540);
      // Max start: current end (660) - MIN_DURATION (15) = 645
      expect(limits.max).toBe(645);
    });

    it('calculates top resize limits bounded by 0 and MAX_DURATION when no previous block', () => {
      const currentBlock: BlockInterval = { id: 'block-curr', start: 120, duration: 60 }; // ends 180
      const others: BlockInterval[] = [];

      const limits = resizeLimits(others, currentBlock, 'top');
      // Min start: max(0, 180 - 480) = 0
      expect(limits.min).toBe(0);
      // Max start: 180 - 15 = 165
      expect(limits.max).toBe(165);
    });
  });

  describe('Grid Snap & Coordinate Precision', () => {
    it('translates viewport pointer coordinates to grid minutes without double-counting scroll', () => {
      // Simulating grid rect when container is scrolled down 800px (to 10:00 AM)
      // Viewport top of grid: -700px.
      // Pointer clientY: 100px (user pointing at 10:00 AM)
      const gridRectTop = -700;
      const pointerY = 100;

      const yInGrid = Math.max(0, pointerY - gridRectTop);
      expect(yInGrid).toBe(800); // 800px from top of grid

      const minutes = yToMinutes(yInGrid, HOUR_HEIGHT);
      expect(minutes).toBe(600); // 10:00 AM (600 min)
      expect(snapToGrid(minutes)).toBe(600);
    });

    it('snaps arbitrary pixel offsets to 15-minute grid intervals', () => {
      // 15 min * (80px / 60min) = 20px
      // 10px -> 7.5 min -> snaps to 0 or 15
      expect(snapToGrid(yToMinutes(20, HOUR_HEIGHT))).toBe(15);
      expect(snapToGrid(yToMinutes(40, HOUR_HEIGHT))).toBe(30);
      expect(snapToGrid(yToMinutes(58, HOUR_HEIGHT))).toBe(45);
    });
  });

  describe('Resize Undo / Redo Recording', () => {
    it('creates single undo and redo action for a block resize', async () => {
      let currentStart = 540;
      let currentDuration = 30;

      const initialStart = 540;
      const initialDuration = 30;
      const finalStart = 510;
      const finalDuration = 60;

      useUndoRedoStore.getState().pushAction({
        description: 'Resized "Design Review"',
        undoFn: async () => {
          currentStart = initialStart;
          currentDuration = initialDuration;
        },
        redoFn: async () => {
          currentStart = finalStart;
          currentDuration = finalDuration;
        },
      });

      // Initially resized
      currentStart = finalStart;
      currentDuration = finalDuration;
      expect(currentStart).toBe(510);
      expect(currentDuration).toBe(60);

      // Undo
      await useUndoRedoStore.getState().undo();
      expect(currentStart).toBe(540);
      expect(currentDuration).toBe(30);

      // Redo
      await useUndoRedoStore.getState().redo();
      expect(currentStart).toBe(510);
      expect(currentDuration).toBe(60);
    });
  });
});
