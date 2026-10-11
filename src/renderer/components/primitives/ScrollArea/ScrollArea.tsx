import React from 'react';
import * as RadixScrollArea from '@radix-ui/react-scroll-area';
import styles from './ScrollArea.module.css';

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  orientation?: 'vertical' | 'horizontal' | 'both';
  type?: 'auto' | 'always' | 'scroll' | 'hover';
  scrollHideDelay?: number;
}

export function ScrollArea({
  children,
  className,
  orientation = 'vertical',
  type = 'scroll',
  scrollHideDelay = 1000,
}: ScrollAreaProps): React.ReactElement {
  return (
    <RadixScrollArea.Root
      className={`${styles.root} ${className ?? ''}`}
      type={type}
      scrollHideDelay={scrollHideDelay}
    >
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
