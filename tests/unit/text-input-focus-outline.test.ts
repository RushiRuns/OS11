import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Regression: Text input focus outline and ring elimination', () => {
  const tokensCssPath = path.resolve(process.cwd(), 'src/renderer/styles/tokens.css');
  const tokensCss = fs.readFileSync(tokensCssPath, 'utf-8');

  it('TC-01: ensures global :focus-visible excludes text inputs, textareas, and editable fields from shadow-focus', () => {
    // The bare :focus-visible { box-shadow: var(--shadow-focus); } causes Chromium to paint a blue ring
    // around inputs/textareas even when clicked, because Chromium treats text inputs as always :focus-visible.
    // The selector must explicitly exclude inputs/textareas/selects/contenteditable.
    const hasUnscopedFocusVisible = /^[ \t]*:focus-visible\s*\{/m.test(tokensCss);
    expect(hasUnscopedFocusVisible).toBe(false);

    // It must exclude text editable elements from :focus-visible
    expect(tokensCss).toMatch(
      /:focus-visible:not\(input\):not\(textarea\):not\(select\):not\(\[contenteditable=['"]true['"]\]\)/
    );
  });

  it('TC-02: universally suppresses outline and box-shadow on focused text inputs and textareas', () => {
    // Both :focus and :focus-visible on text inputs/textareas must be stripped with !important
    expect(tokensCss).toMatch(
      /input:not\(\[type=['"]checkbox['"]\]\):not\(\[type=['"]radio['"]\]\):focus[\s\S]*box-shadow:\s*none\s*!important/
    );
    expect(tokensCss).toMatch(
      /input:not\(\[type=['"]checkbox['"]\]\):not\(\[type=['"]radio['"]\]\):focus[\s\S]*outline:\s*none\s*!important/
    );
    expect(tokensCss).toMatch(/textarea:focus[\s\S]*box-shadow:\s*none\s*!important/);
    expect(tokensCss).toMatch(/textarea:focus[\s\S]*outline:\s*none\s*!important/);
  });

  it('TC-03: preserves focus-visible ring for keyboard navigation on checkboxes and radio buttons', () => {
    expect(tokensCss).toMatch(/input\[type=['"]checkbox['"]\]:focus-visible/);
    expect(tokensCss).toMatch(/input\[type=['"]radio['"]\]:focus-visible/);
  });
});
