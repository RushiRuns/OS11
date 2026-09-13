import React from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { getRadixPortalContainer } from '../primitives/portal.js';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: React.ReactNode;
  shortcut?: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
}

export function Tooltip({
  content,
  shortcut,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 300,
}: TooltipProps): React.ReactElement {
  const portalContainer = getRadixPortalContainer();

  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal container={portalContainer}>
          <RadixTooltip.Content
            className={styles.content}
            side={side}
            align={align}
            sideOffset={4}
          >
            <span>{content}</span>
            {shortcut && <kbd className={styles.shortcut}>{shortcut}</kbd>}
            <RadixTooltip.Arrow className={styles.arrow} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

export default Tooltip;
