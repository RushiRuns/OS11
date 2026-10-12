import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Checkbox } from '../../src/renderer/components/Checkbox/Checkbox.js';

describe('Checkbox Component', () => {
  it('renders default square shape with 20px size and no circle class', () => {
    const html = renderToStaticMarkup(
      <Checkbox checked={false} onChange={() => {}} ariaLabel="Test checkbox" />
    );
    expect(html).toContain('width:20px');
    expect(html).toContain('height:20px');
    expect(html).not.toContain('circle');
    expect(html).toContain('role="checkbox"');
  });

  it('renders circle shape with 18px default size', () => {
    const html = renderToStaticMarkup(
      <Checkbox checked={false} onChange={() => {}} shape="circle" ariaLabel="Circle checkbox" />
    );
    expect(html).toContain('width:18px');
    expect(html).toContain('height:18px');
    expect(html).toContain('circle');
  });

  it('renders circle shape with custom size (e.g. 16px for subtasks)', () => {
    const html = renderToStaticMarkup(
      <Checkbox checked={false} onChange={() => {}} shape="circle" size={16} ariaLabel="Subtask checkbox" />
    );
    expect(html).toContain('width:16px');
    expect(html).toContain('height:16px');
    expect(html).toContain('circle');
  });

  it('renders checked checkmark polyline in circle mode', () => {
    const html = renderToStaticMarkup(
      <Checkbox checked={true} onChange={() => {}} shape="circle" size={18} />
    );
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('points="20 6 9 17 4 12"');
    expect(html).toContain('circleCheckmarkPolyline');
  });
});
