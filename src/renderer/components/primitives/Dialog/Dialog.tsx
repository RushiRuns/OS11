import React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { getRadixPortalContainer } from '../portal.js';
import styles from './Dialog.module.css';

interface DialogProps {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dialog({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
}: DialogProps): React.ReactElement {
  const portalContainer = getRadixPortalContainer();

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal container={portalContainer}>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content className={styles.content}>
          <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
          {description && (
            <RadixDialog.Description className={styles.description}>
              {description}
            </RadixDialog.Description>
          )}
          {children}
          <RadixDialog.Close asChild>
            <button
              type="button"
              className={styles.closeButton}
              aria-label="Close dialog"
            >
              ✕
            </button>
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export default Dialog;
