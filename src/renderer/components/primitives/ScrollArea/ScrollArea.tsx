import React from 'react';
import * as RadixScrollArea from '@radix-ui/react-scroll-area';
import styles from './ScrollArea.module.css';

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  orientation?: 'vertical' | 'horizontal' | 'both';
}

export function ScrollArea({
  children,
  className,
  orientation = 'vertical',
}: ScrollAreaProps): React.ReactElement {
  return (
    <RadixScrollArea.Root className={`${styles.root} ${className ?? ''}`}>
      <RadixScrollArea.Viewport className={styles.viewport}>
        {children}
      </RadixScrollArea.Viewport>
      {(orientation === 'vertical' || orientation === 'both') && (
        <RadixScrollArea.Scrollbar
          className={styles.scrollbar}
          orientation="vertical"
        >
          <RadixScrollArea.Thumb className={styles.thumb} />
        </RadixScrollArea.Scrollbar>
      )}
      {(orientation === 'horizontal' || orientation === 'both') && (
        <RadixScrollArea.Scrollbar
          className={styles.scrollbar}
          orientation="horizontal"
        >
          <RadixScrollArea.Thumb className={styles.thumb} />
        </RadixScrollArea.Scrollbar>
      )}
      <RadixScrollArea.Corner className={styles.corner} />
    </RadixScrollArea.Root>
  );
}

export default ScrollArea;
