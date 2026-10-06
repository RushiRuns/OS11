import React from 'react';
import * as RadixPopover from '@radix-ui/react-popover';
import { getRadixPortalContainer } from '../primitives/portal.js';
import styles from './Popover.module.css';

export interface PopoverProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  variant?: 'default' | 'glass';
  showArrow?: boolean;
  className?: string;
}

export function Popover({
  trigger,
  children,
  open,
  onOpenChange,
  align = 'center',
  side = 'bottom',
  sideOffset = 6,
  variant = 'default',
  showArrow,
  className,
}: PopoverProps): React.ReactElement {
  const portalContainer = getRadixPortalContainer();
  const shouldShowArrow = showArrow !== undefined ? showArrow : variant !== 'glass';
  const contentClassName = `${variant === 'glass' ? styles.glassContent : styles.content} ${
    className || ''
  }`.trim();

  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal container={portalContainer}>
        <RadixPopover.Content
          className={contentClassName}
          align={align}
          side={side}
          sideOffset={sideOffset}
        >
          {children}
          {shouldShowArrow && <RadixPopover.Arrow className={styles.arrow} />}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

export default Popover;
