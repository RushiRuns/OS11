import React from 'react';

export const CARD_GLYPHS = {
  goal: () => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" />
      <circle cx="8" cy="8" r="3.5" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  ),
  repeat: () => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 1.5l3 2.5-3 2.5" />
      <path d="M2.5 7V6a3 3 0 0 1 3-3h8.5" />
      <path d="M5 14.5l-3-2.5 3-2.5" />
      <path d="M13.5 9v1a3 3 0 0 1-3 3H2.5" />
    </svg>
  ),
  clip: () => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.2 7.2l-5.8 5.8a3.8 3.8 0 0 1-5.4-5.4l6.1-6.1a2.5 2.5 0 0 1 3.5 3.5l-6 6a1.2 1.2 0 0 1-1.7-1.7l5.4-5.4" />
    </svg>
  ),
  subtasks: () => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="12" height="3.5" rx="1.5" />
      <path d="M4 5.5v3.5a2 2 0 0 0 2 2h1" />
      <rect x="7" y="9.5" width="7" height="3.5" rx="1.5" />
    </svg>
  ),
  chevron: () => (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  star: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  starOutline: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  details: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M15 3v18" />
    </svg>
  ),
  clock: () => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" />
      <polyline points="8 4 8 8 11 9.5" />
    </svg>
  ),
  sun: () => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="3.5" />
      <line x1="8" y1="1" x2="8" y2="2.5" />
      <line x1="8" y1="13.5" x2="8" y2="15" />
      <line x1="1" y1="8" x2="2.5" y2="8" />
      <line x1="13.5" y1="8" x2="15" y2="8" />
    </svg>
  ),
  bolt: () => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="9 1 3 9 8 9 7 15 13 7 8 7 9 1" fill="currentColor" />
    </svg>
  ),
  box: () => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 4l6-2.5L14 4v8l-6 2.5L2 12V4z" />
      <line x1="8" y1="1.5" x2="8" y2="14.5" />
    </svg>
  ),
  hourglass: () => (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 2h8M4 14h8M5 2v3a3 3 0 0 0 3 3 3 3 0 0 0 3-3V2M5 14v-3a3 3 0 0 1 3-3 3 3 0 0 1 3 3v3" />
    </svg>
  ),
} as const;

export type CardGlyphName = keyof typeof CARD_GLYPHS;

export interface CardGlyphProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: CardGlyphName;
  title?: string;
  className?: string;
}

export const CardGlyph: React.FC<CardGlyphProps> = ({ name, title, className, style, ...rest }) => {
  const Svg = CARD_GLYPHS[name];
  if (!Svg) return null;
  return (
    <span
      className={className}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        ...style,
      }}
      {...rest}
    >
      <Svg />
    </span>
  );
};
