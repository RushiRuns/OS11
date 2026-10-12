import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Toast } from '../../src/renderer/components/Toast/Toast.js';

describe('Toast Component Minimal Pill Styling & Markup', () => {
  it('renders sleek notification message with close button', () => {
    const html = renderToStaticMarkup(
      <Toast
        id="toast-1"
        message="Completed: Design review"
        onDismiss={() => {}}
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Completed: Design review');
    expect(html).toContain('aria-label="Dismiss notification"');
    expect(html).toContain('✕');
  });

  it('renders success icon when variant is success', () => {
    const html = renderToStaticMarkup(
      <Toast
        id="toast-2"
        message="Goal reached"
        variant="success"
        onDismiss={() => {}}
      />
    );

    expect(html).toContain('✓');
    expect(html).toContain('variantSuccess');
  });

  it('renders Action/Undo button when variant is undo', () => {
    const html = renderToStaticMarkup(
      <Toast
        id="toast-3"
        message="Task moved to trash"
        variant="undo"
        actionLabel="Undo"
        onAction={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(html).toContain('Undo');
    expect(html).toContain('actionButton');
  });
});
