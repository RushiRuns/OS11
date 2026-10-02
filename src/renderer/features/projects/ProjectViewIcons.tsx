import React from 'react';
import type { ProjectViewMode } from '@shared/types/index.js';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export const ListIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <line x1="6" y1="4" x2="14" y2="4" />
    <line x1="6" y1="8" x2="14" y2="8" />
    <line x1="6" y1="12" x2="14" y2="12" />
    <circle cx="2.5" cy="4" r="0.75" fill="currentColor" />
    <circle cx="2.5" cy="8" r="0.75" fill="currentColor" />
    <circle cx="2.5" cy="12" r="0.75" fill="currentColor" />
  </svg>
);

export const BoardIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <rect x="2" y="2.5" width="3.5" height="11" rx="0.75" />
    <rect x="6.25" y="2.5" width="3.5" height="7.5" rx="0.75" />
    <rect x="10.5" y="2.5" width="3.5" height="9.5" rx="0.75" />
  </svg>
);

export const TimelineIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <line x1="2" y1="4.5" x2="9" y2="4.5" />
    <line x1="5.5" y1="8" x2="14" y2="8" />
    <line x1="3" y1="11.5" x2="10.5" y2="11.5" />
  </svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <rect x="2" y="3.5" width="12" height="10" rx="1.5" />
    <line x1="2" y1="7" x2="14" y2="7" />
    <line x1="5" y1="1.75" x2="5" y2="3.5" />
    <line x1="11" y1="1.75" x2="11" y2="3.5" />
  </svg>
);

export const TableIcon: React.FC<IconProps> = ({ size = 16, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
    <line x1="2" y1="6.5" x2="14" y2="6.5" />
    <line x1="6.5" y1="2.5" x2="6.5" y2="13.5" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 14, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <line x1="8" y1="3" x2="8" y2="13" />
    <line x1="3" y1="8" x2="13" y2="8" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 12, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
  </svg>
);

export function renderViewIcon(view: ProjectViewMode, size = 16): React.ReactElement {
  switch (view) {
    case 'list':
      return <ListIcon size={size} />;
    case 'board':
      return <BoardIcon size={size} />;
    case 'timeline':
      return <TimelineIcon size={size} />;
    case 'calendar':
      return <CalendarIcon size={size} />;
    case 'table':
      return <TableIcon size={size} />;
  }
}
