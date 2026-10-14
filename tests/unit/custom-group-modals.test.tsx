import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomGroup } from '@shared/types/index.js';

// Hoist mocks before module imports
const { mockIpc } = vi.hoisted(() => {
  return {
    mockIpc: {
      invoke: vi.fn(),
    },
  };
});

vi.mock('../../src/renderer/services/ipc.js', () => ({
  ipc: mockIpc,
}));

vi.mock('../../src/renderer/components/primitives/Dialog/Dialog.js', () => ({
  Dialog: ({ open, title, description, children }: any) => {
    if (!open) return null;
    return (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {children}
      </div>
    );
  },
  default: ({ open, title, description, children }: any) => {
    if (!open) return null;
    return (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {children}
      </div>
    );
  },
}));

import { CustomGroupPickerModal } from '../../src/renderer/features/projects/CustomGroupPickerModal.js';
import { CustomGroupEditorModal } from '../../src/renderer/features/projects/CustomGroupEditorModal.js';
import { useCustomGroupStore } from '../../src/renderer/stores/customGroupStore.js';
import { useViewGroupStore } from '../../src/renderer/stores/viewGroupStore.js';

describe('CustomGroupPickerModal & CustomGroupEditorModal', () => {
  const dummyGroups: CustomGroup[] = [
    {
      id: 'g-coding',
      name: 'Coding',
      sort_order: 1,
      last_used_at: '2026-10-01T12:00:00.000Z',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      deleted_at: null,
      sections: [
        {
          id: 'sec-bugs',
          group_id: 'g-coding',
          name: 'Bugs to be fixed',
          sort_order: 1,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
          deleted_at: null,
        },
        {
          id: 'sec-features',
          group_id: 'g-coding',
          name: 'Features to be implemented',
          sort_order: 2,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
          deleted_at: null,
        },
      ],
    },
    {
      id: 'g-marketing',
      name: 'Marketing Campaign',
      sort_order: 2,
      last_used_at: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      deleted_at: null,
      sections: [
        {
          id: 'sec-content',
          group_id: 'g-marketing',
          name: 'Content Drafts',
          sort_order: 1,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
          deleted_at: null,
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useCustomGroupStore.setState({
      groups: dummyGroups,
      activeProjectId: 'proj-1',
      activeGroupId: 'g-coding',
      overrides: [],
      taskValues: {},
      isLoading: false,
    });
    useViewGroupStore.setState({
      activeCustomGroupMap: { 'project:proj-1': 'g-coding' },
      hideEmptyMap: {},
      groupByMap: { 'project:proj-1': 'custom' },
    });
  });

  describe('CustomGroupPickerModal', () => {
    it('renders the picker modal with groups, preview of section names, search input, and none option', () => {
      const html = renderToStaticMarkup(
        <CustomGroupPickerModal
          isOpen={true}
          onClose={vi.fn()}
          onOpenEditor={vi.fn()}
          projectId="proj-1"
        />
      );

      // Dialog title
      expect(html).toContain('Group by Custom');
      // Search box placeholder
      expect(html).toContain('Search custom groups...');
      // None option
      expect(html).toContain('None');
      expect(html).toContain('Switch custom grouping off');
      // New custom group button
      expect(html).toContain('New custom group');
      // Group names
      expect(html).toContain('Coding');
      expect(html).toContain('Marketing Campaign');
      // Section previews
      expect(html).toContain('Bugs to be fixed, Features to be implemented');
      expect(html).toContain('Content Drafts');
      // Active group indicator
      expect(html).toContain('✓');
    });

    it('renders empty library prompt when there are no groups', () => {
      useCustomGroupStore.setState({ groups: [] });

      const html = renderToStaticMarkup(
        <CustomGroupPickerModal
          isOpen={true}
          onClose={vi.fn()}
          onOpenEditor={vi.fn()}
          projectId="proj-1"
        />
      );

      expect(html).toContain('No custom groups yet');
      expect(html).toContain('Create one to organize tasks into custom sections.');
      expect(html).toContain('Create custom group');
    });

    it('does not render modal content when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <CustomGroupPickerModal
          isOpen={false}
          onClose={vi.fn()}
          onOpenEditor={vi.fn()}
          projectId="proj-1"
        />
      );

      expect(html).not.toContain('Group by Custom');
      expect(html).not.toContain('Search custom groups...');
    });
  });

  describe('CustomGroupEditorModal', () => {
    it('renders the editor in creation mode with section count badge and empty state', () => {
      const html = renderToStaticMarkup(
        <CustomGroupEditorModal
          isOpen={true}
          onClose={vi.fn()}
          group={null}
        />
      );

      expect(html).toContain('New Custom Group');
      expect(html).toContain('Group Name');
      expect(html).toContain('0 of 12');
      expect(html).toContain('Add Section');
      expect(html).toContain('Cancel');
      expect(html).toContain('Create Group');
    });

    it('renders the editor in edit mode with loaded group and sections in sort order', () => {
      const html = renderToStaticMarkup(
        <CustomGroupEditorModal
          isOpen={true}
          onClose={vi.fn()}
          group={dummyGroups[0]}
        />
      );

      expect(html).toContain('Edit Custom Group');
      expect(html).toContain('2 of 12');
      expect(html).toContain('Bugs to be fixed');
      expect(html).toContain('Features to be implemented');
      expect(html).toContain('Delete Group');
      expect(html).toContain('Save Changes');
    });

    it('caps section limit at 12 and disables adding sections when limit reached', () => {
      const twelveSections = Array.from({ length: 12 }, (_, i) => ({
        id: `sec-${i + 1}`,
        group_id: 'g-twelve',
        name: `Section ${i + 1}`,
        sort_order: i + 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deleted_at: null,
      }));

      const twelveGroup: CustomGroup = {
        id: 'g-twelve',
        name: 'Twelve Group',
        sort_order: 1,
        last_used_at: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deleted_at: null,
        sections: twelveSections,
      };

      const html = renderToStaticMarkup(
        <CustomGroupEditorModal
          isOpen={true}
          onClose={vi.fn()}
          group={twelveGroup}
        />
      );

      expect(html).toContain('12 of 12');
      // The add input should be disabled or have reached limit
      expect(html).toContain('disabled=""');
    });
  });
});
