import React from 'react';
import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';
import { getRadixPortalContainer } from '../portal.js';
import styles from './DropdownMenu.module.css';

export interface DropdownMenuItemConfig {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: (DropdownMenuItemConfig | 'separator')[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function DropdownMenu({
  trigger,
  items,
  open,
  onOpenChange,
  align = 'end',
  side = 'bottom',
}: DropdownMenuProps): React.ReactElement {
  const portalContainer = getRadixPortalContainer();

  return (
    <RadixDropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <RadixDropdownMenu.Trigger asChild>{trigger}</RadixDropdownMenu.Trigger>
      <RadixDropdownMenu.Portal container={portalContainer}>
        <RadixDropdownMenu.Content
          className={styles.content}
          align={align}
          side={side}
          sideOffset={4}
        >
          {items.map((item, index) => {
            if (item === 'separator') {
              return (
                <RadixDropdownMenu.Separator
                  key={`sep-${index}`}
                  className={styles.separator}
                />
              );
            }
            return (
              <RadixDropdownMenu.Item
                key={item.id}
                className={`${styles.item} ${item.danger ? styles.itemDanger : ''}`}
                disabled={item.disabled}
                onSelect={item.onClick}
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
              </RadixDropdownMenu.Item>
            );
          })}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  );
}

export default DropdownMenu;
