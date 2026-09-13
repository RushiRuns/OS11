import React from 'react';
import * as RadixCollapsible from '@radix-ui/react-collapsible';
import styles from './Collapsible.module.css';

interface CollapsibleProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Collapsible({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  children,
  className,
}: CollapsibleProps): React.ReactElement {
  return (
    <RadixCollapsible.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      className={`${styles.root} ${className ?? ''}`}
    >
      <RadixCollapsible.Trigger asChild className={styles.trigger}>
        {trigger}
      </RadixCollapsible.Trigger>
      <RadixCollapsible.Content className={styles.content}>
        {children}
      </RadixCollapsible.Content>
    </RadixCollapsible.Root>
  );
}

export default Collapsible;
