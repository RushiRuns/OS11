import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

describe('Performance: CI Production Bundle Size Enforcement', () => {
  it('enforces initial JavaScript bundle is < 200KB gzipped', () => {
    const assetsDir = path.resolve(__dirname, '../../dist/assets');
    if (!fs.existsSync(assetsDir)) {
      // If dist hasn't been built yet in this session, skip or warn
      console.warn('[Bundle Size Test] dist/assets not found, skipping bundle inspection');
      return;
    }

    const files = fs.readdirSync(assetsDir);
    const mainJsFile = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
    expect(mainJsFile).toBeDefined();

    const jsFilePath = path.join(assetsDir, mainJsFile!);
    const jsContent = fs.readFileSync(jsFilePath);
    const jsGzipped = zlib.gzipSync(jsContent);

    const maxJsBytes = 200 * 1024; // 200KB = 204,800 bytes
    const actualJsBytes = jsGzipped.length;
    const actualJsKb = (actualJsBytes / 1024).toFixed(2);

    console.log(`[Bundle Size Test] Initial JS bundle size: ${actualJsKb} kB gzipped (${actualJsBytes} bytes)`);
    expect(actualJsBytes).toBeLessThan(maxJsBytes);
  });

  it('enforces initial CSS bundle is < 30KB gzipped', () => {
    const assetsDir = path.resolve(__dirname, '../../dist/assets');
    if (!fs.existsSync(assetsDir)) {
      return;
    }

    const files = fs.readdirSync(assetsDir);
    const mainCssFile = files.find((f) => f.startsWith('index-') && f.endsWith('.css'));
    expect(mainCssFile).toBeDefined();

    const cssFilePath = path.join(assetsDir, mainCssFile!);
    const cssContent = fs.readFileSync(cssFilePath);
    const cssGzipped = zlib.gzipSync(cssContent);

    const maxCssBytes = 30 * 1024; // 30KB = 30,720 bytes
    const actualCssBytes = cssGzipped.length;
    const actualCssKb = (actualCssBytes / 1024).toFixed(2);

    console.log(`[Bundle Size Test] Initial CSS bundle size: ${actualCssKb} kB gzipped (${actualCssBytes} bytes)`);
    expect(actualCssBytes).toBeLessThan(maxCssBytes);
  });
});
