import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProgressRing } from '../../src/renderer/features/goals/ProgressRing.js';
import { PeriodSelector } from '../../src/renderer/features/goals/PeriodSelector.js';
import { PeriodPopover } from '../../src/renderer/features/goals/PeriodPopover.js';

describe('OKR UI Components', () => {
  describe('ProgressRing', () => {
    it('renders svg with specified size and default strokeWidth', () => {
      const html = renderToStaticMarkup(<ProgressRing progress={50} size={30} />);
      expect(html).toContain('width="30"');
      expect(html).toContain('height="30"');
      expect(html).toContain('viewBox="0 0 30 30"');
      expect(html).toContain('stroke-dasharray');
      expect(html).toContain('stroke-dashoffset');
    });

    it('clamps 0% progress correctly', () => {
      const html = renderToStaticMarkup(<ProgressRing progress={0} size={20} strokeWidth={2} />);
      expect(html).toContain('<svg');
      // radius = (20 - 2) / 2 = 9
      // circumference = 2 * pi * 9 ~= 56.548
      // offset at 0% should equal circumference
      expect(html).toContain('stroke-dashoffset="56.548667764616276"');
    });

    it('clamps 100% progress correctly', () => {
      const html = renderToStaticMarkup(<ProgressRing progress={100} size={20} strokeWidth={2} />);
      // offset at 100% should be 0
      expect(html).toContain('stroke-dashoffset="0"');
    });

    it('clamps negative and >100 values', () => {
      const htmlNeg = renderToStaticMarkup(<ProgressRing progress={-20} size={20} strokeWidth={2} />);
      const htmlOver = renderToStaticMarkup(<ProgressRing progress={150} size={20} strokeWidth={2} />);
      expect(htmlNeg).toContain('stroke-dashoffset="56.548667764616276"');
      expect(htmlOver).toContain('stroke-dashoffset="0"');
    });
  });

  describe('PeriodSelector', () => {
    it('renders preset buttons and date inputs', () => {
      const html = renderToStaticMarkup(
        <PeriodSelector
          startDate="2026-10-01"
          endDate="2026-12-31"
          periodKind="quarter"
          onChange={() => {}}
        />
      );
      expect(html).toContain('This quarter');
      expect(html).toContain('Next quarter');
      expect(html).toContain('Custom');
    });

    it('renders start and end date inputs when kind is custom', () => {
      const html = renderToStaticMarkup(
        <PeriodSelector
          startDate="2026-11-01"
          endDate="2026-11-30"
          periodKind="custom"
          onChange={() => {}}
        />
      );
      expect(html).toContain('value="2026-11-01"');
      expect(html).toContain('value="2026-11-30"');
    });
  });

  describe('PeriodPopover', () => {
    it('renders quarter label when period_kind is quarter', () => {
      const html = renderToStaticMarkup(
        <PeriodPopover
          objective={{
            id: 'obj-1',
            title: 'Test Goal',
            notes: null,
            area_id: null,
            cadence: 'weekly',
            period_start: '2026-10-01',
            period_end: '2026-12-31',
            period_kind: 'quarter',
            status: 'active',
            created_at: '2026-10-16T00:00:00.000Z',
            updated_at: '2026-10-16T00:00:00.000Z',
          }}
          onSave={async () => {}}
        />
      );
      expect(html).toContain('Q4 2026');
    });

    it('renders formatted date range when period_kind is custom', () => {
      const html = renderToStaticMarkup(
        <PeriodPopover
          objective={{
            id: 'obj-2',
            title: 'Test Goal Custom',
            notes: null,
            area_id: null,
            cadence: 'weekly',
            period_start: '2026-10-01',
            period_end: '2026-12-31',
            period_kind: 'custom',
            status: 'active',
            created_at: '2026-10-16T00:00:00.000Z',
            updated_at: '2026-10-16T00:00:00.000Z',
          }}
          onSave={async () => {}}
        />
      );
      expect(html).toContain('1 Oct to 31 Dec');
    });
  });
});
