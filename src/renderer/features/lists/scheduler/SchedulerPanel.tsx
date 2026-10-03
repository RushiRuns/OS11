import React, { useRef, useState, useCallback, useEffect } from 'react';
import { SchedulerHeader } from './SchedulerHeader.js';
import { SchedulerGrid } from './SchedulerGrid.js';
import { useAutoScrollToNow } from './useSchedulerLayout.js';
import { useSchedulerUiStore } from '../../../stores/schedulerUiStore.js';
import styles from './SchedulerPanel.module.css';

export function SchedulerPanel(): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  useAutoScrollToNow(scrollRef);

  const panelWidth = useSchedulerUiStore((s) => s.panelWidth);
  const setPanelWidth = useSchedulerUiStore((s) => s.setPanelWidth);

  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = panelWidth;
    },
    [panelWidth]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startXRef.current - e.clientX;
      setPanelWidth(startWidthRef.current + delta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setPanelWidth]);

  return (
    <aside
      className={styles.panelRoot}
      aria-label="Time blocking scheduler"
      data-testid="scheduler-panel"
    >
      {/* Left draggable border resize handle */}
      <div
        data-resize-handle="true"
        className={`${styles.resizeHandle} ${isResizing ? styles.resizeHandleActive : ''}`}
        onMouseDown={handleMouseDown}
        title="Drag to resize panel"
      />

      {/* Header */}
      <SchedulerHeader />

      {/* Scrollable 24-hour grid */}
      <div ref={scrollRef} className={styles.scrollContainer}>
        <SchedulerGrid />
      </div>
    </aside>
  );
}

export default SchedulerPanel;
