import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { matchesShortcut, DEFAULT_SHORTCUTS_MAP } from '../../src/shared/constants/shortcuts.js';
import { useShortcutStore } from '../../src/renderer/stores/shortcutStore.js';

describe('In-View Task Creation Shortcut', () => {
  let registeredListeners: Record<string, ((e: any) => void)[]> = {};

  const fakeWindow = {
    addEventListener: (type: string, listener: (e: any) => void) => {
      if (!registeredListeners[type]) registeredListeners[type] = [];
      registeredListeners[type].push(listener);
    },
    removeEventListener: (type: string, listener: (e: any) => void) => {
      if (registeredListeners[type]) {
        registeredListeners[type] = registeredListeners[type].filter((l) => l !== listener);
      }
    },
    dispatchEvent: (type: string, eventObj: any) => {
      const list = registeredListeners[type] || [];
      for (const l of list) {
        l(eventObj);
      }
    },
  };

  beforeEach(() => {
    registeredListeners = {};
    useShortcutStore.setState({
      shortcuts: { ...DEFAULT_SHORTCUTS_MAP, new_task_in_view: ['C'] },
      isSuspended: false,
    });
  });

  afterEach(() => {
    registeredListeners = {};
  });

  // Simulates the exact hook/listener inside InlineTaskCreator
  function setupInlineCreatorListener(options: { customValue?: any } = {}) {
    let isOpen = false;
    let focused = false;

    const titleInput = {
      focus: () => {
        focused = true;
      },
    };

    const handleKeyDown = (e: any) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (useShortcutStore.getState().isSuspended) {
        return;
      }

      if (options.customValue) {
        return;
      }

      const shortcuts = useShortcutStore.getState().shortcuts;
      const viewShortcut = shortcuts['new_task_in_view'] || ['C'];

      const matchesViewShortcut = matchesShortcut(e, viewShortcut);
      const matchesLegacyCtrlN = (e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'n' && !e.shiftKey;

      if (matchesViewShortcut || matchesLegacyCtrlN) {
        e.preventDefault();
        isOpen = true;
        titleInput.focus();
      }
    };

    const handleCustomOpen = () => {
      if (!options.customValue) {
        isOpen = true;
        titleInput.focus();
      }
    };

    fakeWindow.addEventListener('keydown', handleKeyDown);
    fakeWindow.addEventListener('os11:open-inline-creator', handleCustomOpen);

    return {
      getIsOpen: () => isOpen,
      isFocused: () => focused,
      close: () => {
        isOpen = false;
      },
      cleanup: () => {
        fakeWindow.removeEventListener('keydown', handleKeyDown);
        fakeWindow.removeEventListener('os11:open-inline-creator', handleCustomOpen);
      },
    };
  }

  it('TC-SHORTCUT-01: pressing shortcut key "C" expands the inline creator and focuses input', () => {
    const creator = setupInlineCreatorListener();
    expect(creator.getIsOpen()).toBe(false);
    expect(creator.isFocused()).toBe(false);

    fakeWindow.dispatchEvent('keydown', {
      key: 'c',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    });

    expect(creator.getIsOpen()).toBe(true);
    expect(creator.isFocused()).toBe(true);
    creator.cleanup();
  });

  it('TC-SHORTCUT-02: shortcut is ignored when focus is currently inside an INPUT, TEXTAREA, or contentEditable', () => {
    const creator = setupInlineCreatorListener();

    // From inside an input
    fakeWindow.dispatchEvent('keydown', {
      key: 'c',
      target: { tagName: 'INPUT' },
      preventDefault: vi.fn(),
    });
    expect(creator.getIsOpen()).toBe(false);

    // From inside a textarea
    fakeWindow.dispatchEvent('keydown', {
      key: 'c',
      target: { tagName: 'TEXTAREA' },
      preventDefault: vi.fn(),
    });
    expect(creator.getIsOpen()).toBe(false);

    // From inside a contenteditable
    fakeWindow.dispatchEvent('keydown', {
      key: 'c',
      target: { isContentEditable: true },
      preventDefault: vi.fn(),
    });
    expect(creator.getIsOpen()).toBe(false);

    creator.cleanup();
  });

  it('TC-SHORTCUT-03: supports customized shortcuts from shortcutStore', () => {
    useShortcutStore.setState({
      shortcuts: { ...DEFAULT_SHORTCUTS_MAP, new_task_in_view: ['Shift', 'N'] },
      isSuspended: false,
    });

    const creator = setupInlineCreatorListener();

    // 'c' should not trigger when customized
    fakeWindow.dispatchEvent('keydown', {
      key: 'c',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    });
    expect(creator.getIsOpen()).toBe(false);

    // Shift+N triggers
    fakeWindow.dispatchEvent('keydown', {
      key: 'N',
      shiftKey: true,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    });
    expect(creator.getIsOpen()).toBe(true);

    creator.cleanup();
  });

  it('TC-SHORTCUT-04: responds to custom os11:open-inline-creator window event', () => {
    const creator = setupInlineCreatorListener();

    fakeWindow.dispatchEvent('os11:open-inline-creator', {});
    expect(creator.getIsOpen()).toBe(true);
    expect(creator.isFocused()).toBe(true);

    creator.cleanup();
  });

  it('TC-SHORTCUT-05: ignores shortcut if shortcut recording is suspended in settings', () => {
    useShortcutStore.setState({
      shortcuts: { ...DEFAULT_SHORTCUTS_MAP, new_task_in_view: ['C'] },
      isSuspended: true,
    });

    const creator = setupInlineCreatorListener();

    fakeWindow.dispatchEvent('keydown', {
      key: 'c',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    });

    expect(creator.getIsOpen()).toBe(false);
    creator.cleanup();
  });

  it('TC-SHORTCUT-06: nested section-level creators in grouped views ignore view-level shortcut', () => {
    const topCreator = setupInlineCreatorListener({ customValue: null });
    const sectionCreator = setupInlineCreatorListener({ customValue: { groupId: 'g1', sectionId: 's1' } });

    fakeWindow.dispatchEvent('keydown', {
      key: 'c',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      target: { tagName: 'DIV' },
      preventDefault: vi.fn(),
    });

    // Top creator opens, section-level creator stays closed
    expect(topCreator.getIsOpen()).toBe(true);
    expect(sectionCreator.getIsOpen()).toBe(false);

    topCreator.cleanup();
    sectionCreator.cleanup();
  });
});
