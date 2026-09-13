import React from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  children,
  ...props
}: ButtonProps): React.ReactElement {
  const variantClass =
    variant === 'ghost'
      ? styles.variantGhost
      : variant === 'danger'
        ? styles.variantDanger
        : styles.variantPrimary;

  const sizeClass = size === 'sm' ? styles.sizeSm : styles.sizeMd;

  return (
    <button
      type="button"
      className={`${styles.button} ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
