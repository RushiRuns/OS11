import React, { useState, useEffect, useCallback } from 'react';
import styles from './AttachmentStrip.module.css';
import { ipc } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import type { Attachment } from '@shared/types/index.js';

interface AttachmentStripProps {
  taskId: string;
  onAttachmentsChanged?: (count: number) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string, isLink?: number): string {
  if (isLink === 1) return '🔗';
  if (mimeType.includes('pdf')) return '📑';
  if (mimeType.includes('image')) return '🖼️';
  if (mimeType.includes('zip') || mimeType.includes('tar')) return '📦';
  if (mimeType.includes('text') || mimeType.includes('markdown')) return '📝';
  if (mimeType.includes('word') || mimeType.includes('officedocument')) return '📄';
  if (mimeType.includes('excel') || mimeType.includes('sheet') || mimeType.includes('csv')) return '📊';
  return '📁';
}

import { useAttachmentStore } from '../../stores/attachmentStore.js';

export const AttachmentStrip: React.FC<AttachmentStripProps> = ({
  taskId,
  onAttachmentsChanged,
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [selectedImage, setSelectedImage] = useState<Attachment | null>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      const data = await ipc.invoke<Attachment[]>(IPC.ATTACHMENTS.GET_ALL, taskId);
      const count = data?.length || 0;
      setAttachments(data || []);
      useAttachmentStore.getState().setCount(taskId, count);
      onAttachmentsChanged?.(count);
    } catch (err) {
      console.error('Failed to load attachments', err);
    }
  }, [taskId, onAttachmentsChanged]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handlePickAndUpload = async () => {
    try {
      const res = await ipc.invoke<Attachment[]>(IPC.ATTACHMENTS.PICK_AND_UPLOAD, { taskId });
      if (res && res.length > 0) {
        await fetchAttachments();
      }
    } catch (err) {
      console.error('Pick and upload failed', err);
    }
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;

    try {
      await ipc.invoke(IPC.ATTACHMENTS.ADD_LINK, {
        taskId,
        url: linkUrl.trim(),
        title: linkTitle.trim() || undefined,
      });
      setLinkUrl('');
      setLinkTitle('');
      setShowLinkForm(false);
      await fetchAttachments();
    } catch (err) {
      console.error('Add link failed', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await ipc.invoke(IPC.ATTACHMENTS.DELETE, id);
      await fetchAttachments();
    } catch (err) {
      console.error('Delete attachment failed', err);
    }
  };

  const handleCardClick = (att: Attachment) => {
    if (att.mime_type.startsWith('image/')) {
      setSelectedImage(att);
      return;
    }
    // Open external URL or system file
    ipc.invoke(IPC.ATTACHMENTS.OPEN, att.local_path).catch((err) => {
      console.error('Failed to open attachment', err);
    });
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // In Electron, File objects have a .path property
      const filePath = (file as unknown as { path?: string }).path;
      if (filePath) {
        try {
          await ipc.invoke(IPC.ATTACHMENTS.UPLOAD, { taskId, sourcePath: filePath });
        } catch (err) {
          console.error(`Failed to upload dropped file ${filePath}`, err);
        }
      }
    }
    await fetchAttachments();
  };

  return (
    <div className={styles.stripContainer}>
      <div className={styles.headerRow}>
        <span className={styles.sectionHeader}>
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </span>

        <div className={styles.actionButtonGroup}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handlePickAndUpload}
            title="Attach file from your computer"
          >
            📎 Add File
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setShowLinkForm((prev) => !prev)}
            title="Link Google Drive, Dropbox, or web URL"
          >
            🔗 Add Link
          </button>
        </div>
      </div>

      {/* Cloud Link Input Form */}
      {showLinkForm && (
        <form className={styles.linkForm} onSubmit={handleAddLink}>
          <input
            type="url"
            className={styles.linkInput}
            placeholder="https://drive.google.com/... or URL"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            autoFocus
            required
          />
          <input
            type="text"
            className={styles.linkInput}
            placeholder="Link Title (optional)"
            value={linkTitle}
            onChange={(e) => setLinkTitle(e.target.value)}
          />
          <button type="submit" className={styles.actionBtn}>
            Save
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setShowLinkForm(false)}
          >
            Cancel
          </button>
        </form>
      )}

      {/* Drag & Drop Horizontal Strip */}
      <div
        className={`${styles.scrollStrip} ${isDragOver ? styles.dropZoneActive : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {attachments.length === 0 ? (
          <div className={styles.emptyDropTarget}>
            <span>📎</span>
            <span>Drag and drop files here, paste from clipboard (Ctrl+V), or add links</span>
          </div>
        ) : (
          attachments.map((att) => {
            const isImage = att.mime_type.startsWith('image/');
            const icon = getFileIcon(att.mime_type, att.is_link);

            return (
              <div
                key={att.id}
                className={styles.attachmentCard}
                onClick={() => handleCardClick(att)}
                title={att.is_link === 1 ? `Open Link: ${att.local_path}` : `Open ${att.original_name}`}
              >
                <div className={styles.cardPreviewArea}>
                  {isImage && att.thumbnail_path ? (
                    <img
                      src={att.thumbnail_path}
                      alt={att.original_name}
                      className={styles.imageThumbnail}
                    />
                  ) : (
                    <span className={styles.iconPreview}>{icon}</span>
                  )}

                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={(e) => handleDelete(e, att.id)}
                    title="Delete attachment"
                    aria-label={`Delete ${att.original_name}`}
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.cardInfo}>
                  <span className={styles.fileName}>{att.original_name}</span>
                  <div className={styles.fileMeta}>
                    <span>{att.is_link === 1 ? 'Link' : formatBytes(att.size_bytes)}</span>
                    {att.is_link === 1 && <span>↗</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Full-size Image Viewer Modal */}
      {selectedImage && (
        <div className={styles.modalOverlay} onClick={() => setSelectedImage(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{selectedImage.original_name}</span>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedImage(null)}
                aria-label="Close image preview"
              >
                ✕
              </button>
            </div>
            <img
              src={selectedImage.thumbnail_path || `file://${selectedImage.local_path}`}
              alt={selectedImage.original_name}
              className={styles.modalImage}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentStrip;
