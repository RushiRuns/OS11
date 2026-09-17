import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * AutoHidingTitlebarController encapsulating the state machine logic
 * for the hover-triggered auto-hiding topbar / system bar.
 */
export class AutoHidingTitlebarController {
  private autoHideEnabled: boolean;
  private isHovered: boolean = false;
  private isFocused: boolean = false;
  private isMenuOpen: boolean = false;
  private graceDelayMs: number;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private onVisibilityChange?: (visible: boolean) => void;

  constructor(options: {
    autoHideEnabled?: boolean;
    graceDelayMs?: number;
    onVisibilityChange?: (visible: boolean) => void;
  } = {}) {
    this.autoHideEnabled = options.autoHideEnabled ?? true;
    this.graceDelayMs = options.graceDelayMs ?? 0;
    this.onVisibilityChange = options.onVisibilityChange;
  }

  public isVisible(): boolean {
    if (!this.autoHideEnabled) {
      return true; // Pin override: permanently visible
    }
    return this.isHovered || this.isFocused || this.isMenuOpen;
  }

  public setAutoHideEnabled(enabled: boolean): void {
    this.autoHideEnabled = enabled;
    this.notifyChange();
  }

  public handleMouseEnter(): void {
    this.cancelHideTimer();
    this.isHovered = true;
    this.notifyChange();
  }

  public handleMouseLeave(): void {
    this.cancelHideTimer();
    if (this.graceDelayMs > 0) {
      this.hideTimer = setTimeout(() => {
        this.isHovered = false;
        this.notifyChange();
      }, this.graceDelayMs);
    } else {
      this.isHovered = false;
      this.notifyChange();
    }
  }

  public handleFocus(): void {
    this.cancelHideTimer();
    this.isFocused = true;
    this.notifyChange();
  }

  public handleBlur(): void {
    this.isFocused = false;
    this.notifyChange();
  }

  public setMenuOpen(open: boolean): void {
    this.cancelHideTimer();
    this.isMenuOpen = open;
    this.notifyChange();
  }

  private cancelHideTimer(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private notifyChange(): void {
    if (this.onVisibilityChange) {
      this.onVisibilityChange(this.isVisible());
    }
  }

  public dispose(): void {
    this.cancelHideTimer();
  }
}

describe('Auto-Hiding System Titlebar / Topbar Feature Unit Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Initial State: Should be hidden when auto-hide is enabled and idle', () => {
    const controller = new AutoHidingTitlebarController({ autoHideEnabled: true });
    expect(controller.isVisible()).toBe(false);
  });

  it('2. Mouse Hover: Should become visible immediately when user hovers over top 25px hit area', () => {
    const visibilityChanges: boolean[] = [];
    const controller = new AutoHidingTitlebarController({
      autoHideEnabled: true,
      onVisibilityChange: (visible) => visibilityChanges.push(visible),
    });

    controller.handleMouseEnter();

    expect(controller.isVisible()).toBe(true);
    expect(visibilityChanges).toEqual([true]);
  });

  it('3. Instant Exit: Should hide instantly on mouse leave when grace delay is 0 (default)', () => {
    const visibilityChanges: boolean[] = [];
    const controller = new AutoHidingTitlebarController({
      autoHideEnabled: true,
      graceDelayMs: 0,
      onVisibilityChange: (visible) => visibilityChanges.push(visible),
    });

    controller.handleMouseEnter();
    expect(controller.isVisible()).toBe(true);

    controller.handleMouseLeave();
    // Instant hide without delay
    expect(controller.isVisible()).toBe(false);
    expect(visibilityChanges).toEqual([true, false]);
  });

  it('4. Optional Grace Delay: When configured, should remain visible during grace delay then hide', () => {
    const visibilityChanges: boolean[] = [];
    const controller = new AutoHidingTitlebarController({
      autoHideEnabled: true,
      graceDelayMs: 300,
      onVisibilityChange: (visible) => visibilityChanges.push(visible),
    });

    controller.handleMouseEnter();
    controller.handleMouseLeave();

    // Still visible before timer completes
    vi.advanceTimersByTime(200);
    expect(controller.isVisible()).toBe(true);

    // Past grace period
    vi.advanceTimersByTime(150);
    expect(controller.isVisible()).toBe(false);
    expect(visibilityChanges).toEqual([true, false]);
  });

  it('5. Re-enter Hover Cancellation: Should cancel hide timer if mouse re-enters before timer expires', () => {
    const controller = new AutoHidingTitlebarController({ autoHideEnabled: true, graceDelayMs: 300 });

    controller.handleMouseEnter();
    controller.handleMouseLeave();

    vi.advanceTimersByTime(200);
    expect(controller.isVisible()).toBe(true);

    // User re-enters titlebar area
    controller.handleMouseEnter();
    vi.advanceTimersByTime(500);

    // Should STILL be visible because timer was cancelled by re-entry
    expect(controller.isVisible()).toBe(true);
  });

  it('6. Open Submenu Lock: Should remain visible when Notification Center menu is open even if mouse leaves', () => {
    const controller = new AutoHidingTitlebarController({ autoHideEnabled: true, graceDelayMs: 300 });

    controller.handleMouseEnter();
    controller.setMenuOpen(true);
    controller.handleMouseLeave();

    vi.advanceTimersByTime(500);
    // Menu is still open -> must stay visible
    expect(controller.isVisible()).toBe(true);

    // Menu closes -> becomes hidden
    controller.setMenuOpen(false);
    expect(controller.isVisible()).toBe(false);
  });

  it('7. Keyboard Accessibility Lock: Should remain visible while keyboard focus is inside titlebar', () => {
    const controller = new AutoHidingTitlebarController({ autoHideEnabled: true });

    controller.handleFocus();
    expect(controller.isVisible()).toBe(true);

    controller.handleBlur();
    expect(controller.isVisible()).toBe(false);
  });

  it('8. Pin / Unpin Override: Should stay permanently visible when auto-hide is disabled', () => {
    const controller = new AutoHidingTitlebarController({ autoHideEnabled: false });

    // Pinned -> always visible regardless of mouse actions
    expect(controller.isVisible()).toBe(true);

    controller.handleMouseLeave();
    vi.advanceTimersByTime(1000);
    expect(controller.isVisible()).toBe(true);

    // Dynamic toggle
    controller.setAutoHideEnabled(true);
    expect(controller.isVisible()).toBe(false);
  });
});
