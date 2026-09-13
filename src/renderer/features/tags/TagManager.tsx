import React, { useState, useEffect } from 'react';
import { useTagStore, TAG_COLOR_PALETTE } from '../../stores/tagStore.js';
import { useUserLists } from '../../stores/listStore.js';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import styles from './TagManager.module.css';

export function TagManager(): React.ReactElement {
  const { tagsById, loadTags, updateTag, deleteTag, mergeTags } = useTagStore();
  const userLists = useUserLists();

  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');

  // Auto-tag rules: Record<listId, string[]>
  const [autoTagRules, setAutoTagRules] = useState<Record<string, string[]>>({});
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [selectedTagId, setSelectedTagId] = useState<string>('');

  useEffect(() => {
    loadTags();
    // Load auto-tag rules from settings
    ipc
      .invoke<Record<string, string[]>>(IPC.SETTINGS.GET, 'auto_tag_rules')
      .then((rules) => {
        if (rules && typeof rules === 'object') {
          setAutoTagRules(rules);
        }
      })
      .catch(() => {
        // Default empty
      });
  }, [loadTags]);

  const allTags = Object.values(tagsById);

  // Cycle to next color in palette
  const handleCycleColor = async (tagId: string, currentColor?: string | null) => {
    const currentIdx = TAG_COLOR_PALETTE.findIndex(
      (c) => c.token === currentColor || c.hex === currentColor
    );
    const nextIdx = (currentIdx + 1) % TAG_COLOR_PALETTE.length;
    const nextColor = TAG_COLOR_PALETTE[nextIdx].token;
    await updateTag(tagId, { color: nextColor });
  };

  const handleExecuteMerge = async () => {
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;
    try {
      await mergeTags(mergeSourceId, mergeTargetId);
      setMergeSourceId(null);
      setMergeTargetId('');
    } catch (err) {
      console.error('Failed to merge tags:', err);
    }
  };

  const handleAddAutoTagRule = async () => {
    if (!selectedListId || !selectedTagId) return;

    const currentTagIds = autoTagRules[selectedListId] || [];
    if (currentTagIds.includes(selectedTagId)) return;

    const updatedRules: Record<string, string[]> = {
      ...autoTagRules,
      [selectedListId]: [...currentTagIds, selectedTagId],
    };

    setAutoTagRules(updatedRules);
    await ipc.invoke(IPC.SETTINGS.SET, { key: 'auto_tag_rules', value: updatedRules });
    setSelectedTagId('');
  };

  const handleRemoveAutoTagRule = async (listId: string, tagId: string) => {
    const currentTagIds = autoTagRules[listId] || [];
    const updatedTags = currentTagIds.filter((id) => id !== tagId);

    const updatedRules: Record<string, string[]> = {
      ...autoTagRules,
      [listId]: updatedTags,
    };

    if (updatedTags.length === 0) {
      delete updatedRules[listId];
    }

    setAutoTagRules(updatedRules);
    await ipc.invoke(IPC.SETTINGS.SET, { key: 'auto_tag_rules', value: updatedRules });
  };

  return (
    <div className={styles.managerContainer}>
      {/* 1. Tag Directory Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Tags & Hierarchy</h2>
            <p className={styles.sectionDesc}>
              Manage tags, assign parent hierarchy, and customize color accents.
            </p>
          </div>
        </div>

        {allTags.length === 0 ? (
          <p className={styles.sectionDesc}>No tags created yet.</p>
        ) : (
          <div className={styles.tagTable}>
            {allTags.map((tag) => (
              <div key={tag.id} className={styles.tagRow}>
                {/* Color Dot Button */}
                <button
                  type="button"
                  className={styles.colorPickerBtn}
                  style={{ background: tag.color ?? 'var(--tag-gray)' }}
                  onClick={() => handleCycleColor(tag.id, tag.color)}
                  title="Click to cycle color"
                />

                {/* Tag Name Input */}
                <input
                  type="text"
                  className={styles.nameInput}
                  defaultValue={tag.name}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && val !== tag.name) {
                      updateTag(tag.id, { name: val });
                    } else {
                      e.target.value = tag.name;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />

                {/* Parent Tag Selector */}
                <select
                  className={styles.parentSelect}
                  value={tag.parent_tag_id ?? ''}
                  onChange={(e) => {
                    const newParent = e.target.value || null;
                    updateTag(tag.id, { parent_tag_id: newParent });
                  }}
                  title="Parent Tag"
                >
                  <option value="">No Parent</option>
                  {allTags
                    .filter((other) => other.id !== tag.id)
                    .map((other) => (
                      <option key={other.id} value={other.id}>
                        Parent: #{other.name}
                      </option>
                    ))}
                </select>

                {/* Merge Button */}
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setMergeSourceId(tag.id)}
                  title="Merge into another tag"
                >
                  Merge...
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => deleteTag(tag.id)}
                  title="Delete tag"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Merge Tags Panel */}
      {mergeSourceId && (
        <div className={styles.mergeSection}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
            Merge <strong>#{tagsById[mergeSourceId]?.name}</strong> into:
          </span>
          <select
            className={styles.selectInput}
            value={mergeTargetId}
            onChange={(e) => setMergeTargetId(e.target.value)}
          >
            <option value="">Select target tag...</option>
            {allTags
              .filter((t) => t.id !== mergeSourceId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            className={styles.addRuleBtn}
            onClick={handleExecuteMerge}
            disabled={!mergeTargetId}
          >
            Confirm Merge
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setMergeSourceId(null)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* 3. Auto-Tag Rules Section */}
      <section className={styles.section}>
        <div>
          <h2 className={styles.sectionTitle}>Auto-Tag Rules</h2>
          <p className={styles.sectionDesc}>
            Automatically attach tags to tasks when created in a specific list.
          </p>
        </div>

        {/* Existing Rules */}
        <div className={styles.ruleList}>
          {Object.entries(autoTagRules).map(([listId, tagIds]) => {
            const list = userLists.find((l) => l.id === listId);
            const listName = list?.name ?? listId;

            return tagIds.map((tagId) => {
              const tag = tagsById[tagId];
              const tagName = tag?.name ?? tagId;

              return (
                <div key={`${listId}_${tagId}`} className={styles.ruleRow}>
                  <div className={styles.ruleText}>
                    <span>Tasks in <strong>{listName}</strong></span>
                    <span>→</span>
                    <span>Auto-tag <strong>#{tagName}</strong></span>
                  </div>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleRemoveAutoTagRule(listId, tagId)}
                    title="Remove rule"
                  >
                    ✕
                  </button>
                </div>
              );
            });
          })}
        </div>

        {/* Add New Rule */}
        <div className={styles.ruleAddRow}>
          <select
            className={styles.selectInput}
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
          >
            <option value="">Select list...</option>
            {userLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <span>→</span>

          <select
            className={styles.selectInput}
            value={selectedTagId}
            onChange={(e) => setSelectedTagId(e.target.value)}
          >
            <option value="">Select tag...</option>
            {allTags.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.addRuleBtn}
            onClick={handleAddAutoTagRule}
            disabled={!selectedListId || !selectedTagId}
          >
            + Add Rule
          </button>
        </div>
      </section>
    </div>
  );
}

export default TagManager;
