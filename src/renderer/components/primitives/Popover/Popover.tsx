import React from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import { getRadixPortalContainer } from '../portal.js';
import styles from './Popover.module.css';

export interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
}

export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  align = 'center',
  side = 'bottom',
  sideOffset = 6,
}: PopoverProps): React.ReactElement {
  const portalContainer = getRadixPortalContainer();

  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal container={portalContainer}>
        <RadixPopover.Content
          className={styles.content}
          align={align}
          side={side}
          sideOffset={sideOffset}
        >
          {children}
          <RadixPopover.Arrow className={styles.arrow} />
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export default Popover;
