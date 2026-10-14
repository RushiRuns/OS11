import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchCollapse } from '../../src/renderer/features/search/SearchCollapse.js';

describe('SearchCollapse Component', () => {
  it('renders expanded state by default', () => {
    const html = renderToStaticMarkup(
      <SearchCollapse>
        <div>Content item</div>
      </SearchCollapse>
    );

    expect(html).toContain('data-collapsed="false"');
    expect(html).toContain('data-animate="true"');
    expect(html).toContain('Content item');
    expect(html).not.toContain('aria-hidden="true"');
  });

  it('renders collapsed state with data-collapsed and aria-hidden', () => {
    const html = renderToStaticMarkup(
      <SearchCollapse collapsed={true}>
        <div>Hidden row</div>
      </SearchCollapse>
    );

    expect(html).toContain('data-collapsed="true"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('Hidden row');
  });

  it('renders custom tag element (e.g. li)', () => {
    const html = renderToStaticMarkup(
      <SearchCollapse as="li" collapsed={false}>
        <span>List item</span>
      </SearchCollapse>
    );

    expect(html.startsWith('<li')).toBe(true);
    expect(html.endsWith('</li>')).toBe(true);
    expect(html).toContain('List item');
  });

  it('supports animate={false} to disable transition', () => {
    const html = renderToStaticMarkup(
      <SearchCollapse animate={false}>
        <div>Instant row</div>
      </SearchCollapse>
    );

    expect(html).toContain('data-animate="false"');
  });
});
