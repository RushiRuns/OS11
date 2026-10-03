import React, { forwardRef } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    children,
    ...props
  },
  ref
): React.ReactElement {
  const variantClass =
    variant === 'ghost'
      ? styles.variantGhost
      : variant === 'danger'
        ? styles.variantDanger
        : styles.variantPrimary;

  const sizeClass = size === 'sm' ? styles.sizeSm : styles.sizeMd;

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.button} ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
