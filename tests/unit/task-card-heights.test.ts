import { describe, it, expect } from 'vitest';

/**
 * Height budget validation for OS11 Redesigned Task Card
 *
 * Exact component heights:
 * - Padding: 10px top / 10px bottom (standard), 8px top / 8px bottom (subtask)
 * - Row gap: 3px
 * - Title line: 20px (standard), 18px (subtask)
 * - Notes line: 17px
 * - Meta line: 16px
 */
describe('TaskCard Height Budget Calculations', () => {
  const SIZES = {
    standardPaddingY: 10 * 2, // 20px
    subtaskPaddingY: 8 * 2, // 16px
    rowGap: 3,
    standardTitleHeight: 20,
    subtaskTitleHeight: 18,
    notesHeight: 17,
    metaHeight: 16,
  };

  it('calculates standard card heights matching spec', () => {
    // 1. Title only
    const titleOnly = SIZES.standardPaddingY + SIZES.standardTitleHeight;
    expect(titleOnly).toBe(40);

    // 2. Title + notes
    const titleNotes = titleOnly + SIZES.rowGap + SIZES.notesHeight;
    expect(titleNotes).toBe(60);

    // 3. Title + meta
    const titleMeta = titleOnly + SIZES.rowGap + SIZES.metaHeight;
    expect(titleMeta).toBe(59);

    // 4. Title + notes + meta
    const titleNotesMeta = titleOnly + SIZES.rowGap + SIZES.notesHeight + SIZES.rowGap + SIZES.metaHeight;
    expect(titleNotesMeta).toBe(79);
  });

  it('calculates subtask card heights matching spec', () => {
    // 1. Subtask title only
    const subtaskTitleOnly = SIZES.subtaskPaddingY + SIZES.subtaskTitleHeight;
    expect(subtaskTitleOnly).toBe(34);

    // 2. Subtask title + notes
    const subtaskTitleNotes = subtaskTitleOnly + SIZES.rowGap + SIZES.notesHeight;
    expect(subtaskTitleNotes).toBe(54);

    // 3. Subtask title + meta
    const subtaskTitleMeta = subtaskTitleOnly + SIZES.rowGap + SIZES.metaHeight;
    expect(subtaskTitleMeta).toBe(53);

    // 4. Subtask title + notes + meta
    const subtaskTitleNotesMeta = subtaskTitleOnly + SIZES.rowGap + SIZES.notesHeight + SIZES.rowGap + SIZES.metaHeight;
    expect(subtaskTitleNotesMeta).toBe(73);
  });
});
