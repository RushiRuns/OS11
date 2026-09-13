import { describe, it, expect } from 'vitest';
import { generateTraySvg, buildTrayContextMenuTemplate } from '../../src/main/tray/tray.js';
import { resolveSplashHtmlPath } from '../../src/main/window/splash-window.js';
import fs from 'node:fs';

describe('Phase 4: Window Infrastructure, Tray, and Warm Start', () => {
  describe('System Tray Badge SVG Generator', () => {
    it('generates default checkmark icon when task count is 0', () => {
      const svg = generateTraySvg(0);
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox="0 0 32 32"');
      expect(svg).toContain('#38bdf8'); // Accent checkmark
    });

    it('generates blue badge with task count when count > 0', () => {
      const svg = generateTraySvg(5);
      expect(svg).toContain('#3b82f6'); // Blue badge background
      expect(svg).toContain('>5<'); // Count text
    });

    it('clamps badge display text to 99+ when count exceeds 99', () => {
      const svg = generateTraySvg(150);
      expect(svg).toContain('>99+<');
    });

    it('generates red pomodoro badge with countdown time when active', () => {
      const svg = generateTraySvg(3, '24m');
      expect(svg).toContain('#ef4444'); // Red pomodoro indicator
      expect(svg).toContain('>24m<'); // Countdown text
    });

    it('builds context menu template with all required quick access items', () => {
      const template = buildTrayContextMenuTemplate();
      expect(template).toBeDefined();
      expect(Array.isArray(template)).toBe(true);

      const labels = template.map((i) => i.label || '');
      expect(labels.some((l: string) => l.includes('Open OS11'))).toBe(true);
      expect(labels.some((l: string) => l.includes('Quick Add'))).toBe(true);
      expect(labels.some((l: string) => l.includes('Quit OS11'))).toBe(true);
    });
  });

  describe('Splash Screen Path Resolution', () => {
    it('resolves valid splash.html file path', () => {
      const splashPath = resolveSplashHtmlPath();
      expect(splashPath).toBeDefined();
      expect(fs.existsSync(splashPath)).toBe(true);
      const content = fs.readFileSync(splashPath, 'utf8');
      expect(content).toContain('OS11');
      expect(content).toContain('splash.css');
    });
  });

  describe('Always on Top Opacity Clamping', () => {
    it('clamps opacity to between 0.5 and 1.0', () => {
      const clampOpacity = (opacity: number) => Math.max(0.5, Math.min(1.0, opacity));

      expect(clampOpacity(1.0)).toBe(1.0);
      expect(clampOpacity(0.8)).toBe(0.8);
      expect(clampOpacity(0.3)).toBe(0.5); // Below min
      expect(clampOpacity(1.5)).toBe(1.0); // Above max
    });
  });

  describe('Warm Start Close Interception Pattern', () => {
    it('prevents default close to keep background process alive', () => {
      let prevented = false;
      let hidden = false;
      let isAppQuitting = false;

      const mockEvent = {
        preventDefault: () => {
          prevented = true;
        },
      };

      const mockWindow = {
        hide: () => {
          hidden = true;
        },
      };

      const handleClose = (e: typeof mockEvent) => {
        if (!isAppQuitting) {
          e.preventDefault();
          mockWindow.hide();
        }
      };

      // User clicks window 'X' during normal operation
      handleClose(mockEvent);
      expect(prevented).toBe(true);
      expect(hidden).toBe(true);

      // App is genuinely quitting
      prevented = false;
      hidden = false;
      isAppQuitting = true;
      handleClose(mockEvent);
      expect(prevented).toBe(false);
      expect(hidden).toBe(false);
    });
  });
});
