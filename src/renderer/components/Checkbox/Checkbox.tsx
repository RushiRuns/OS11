import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './Checkbox.module.css';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  projectColor?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function Checkbox({
  checked,
  onChange,
  projectColor,
  ariaLabel,
  disabled = false,
}: CheckboxProps): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onChange(!checked);
    }
  };

  const customStyle: React.CSSProperties = {};
  if (projectColor) {
    if (checked) {
      customStyle.backgroundColor = projectColor;
      customStyle.borderColor = projectColor;
    } else {
      customStyle.borderColor = projectColor;
    }
  }

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`${styles.checkbox} ${checked ? styles.checked : ''}`}
      style={customStyle}
      onClick={handleClick}
      animate={
        !shouldReduceMotion && checked
          ? { scale: [1, 1.2, 1] }
          : { scale: 1 }
      }
      transition={{
        duration: 0.18,
        ease: [0.34, 1.56, 0.64, 1.0], // --ease-spring
      }}
    >
      {checked && (
        <svg
          className={styles.checkIcon}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </motion.button>
  );
}

export default Checkbox;
