import React, { useState, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './Checkbox.module.css';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  projectColor?: string;
  ariaLabel?: string;
  disabled?: boolean;
  shape?: 'square' | 'circle';
  size?: number;
}

export function Checkbox({
  checked,
  onChange,
  projectColor,
  ariaLabel,
  disabled = false,
  shape = 'square',
  size,
}: CheckboxProps): React.ReactElement {
  const shouldReduceMotion = useReducedMotion();
  const [justDone, setJustDone] = useState(false);
  const prevCheckedRef = useRef(checked);

  useEffect(() => {
    if (!prevCheckedRef.current && checked) {
      setJustDone(true);
      const timer = setTimeout(() => setJustDone(false), 400);
      return () => clearTimeout(timer);
    }
    prevCheckedRef.current = checked;
  }, [checked]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onChange(!checked);
    }
  };

  const currentSize = size ?? (shape === 'circle' ? 18 : 20);
  const customStyle: React.CSSProperties = {
    width: `${currentSize}px`,
    height: `${currentSize}px`,
  };

  if (projectColor) {
    if (checked) {
      customStyle.backgroundColor = projectColor;
      customStyle.borderColor = projectColor;
    } else {
      customStyle.borderColor = projectColor;
    }
  }

  const iconSize = Math.max(10, Math.round(currentSize * 0.62));

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-just-done={justDone ? 'true' : undefined}
      className={`${styles.checkbox} ${shape === 'circle' ? styles.circle : ''} ${
        checked ? styles.checked : ''
      }`}
      style={customStyle}
      onClick={handleClick}
      onPointerDown={e => e.stopPropagation()}
      animate={
        shape !== 'circle' && !shouldReduceMotion && checked
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
          style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <polyline
            points="20 6 9 17 4 12"
            className={shape === 'circle' ? styles.circleCheckmarkPolyline : undefined}
          />
        </svg>
      )}
    </motion.button>
  );
}

export default Checkbox;
