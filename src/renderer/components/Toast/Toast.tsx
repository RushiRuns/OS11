import React, { useEffect, useRef, useState, useCallback } from 'react';
import styles from './Toast.module.css';

export type ToastVariant = 'default' | 'success' | 'error' | 'undo';

export interface ToastProps {
  id: string;
  message: string;
  variant?: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: (id: string) => void;
  duration?: number;
}

export function Toast({
  id,
  message,
  variant = 'default',
  actionLabel = 'Undo',
  onAction,
  onDismiss,
  duration = 4000,
}: ToastProps): React.ReactElement {
  const [isDismissing, setIsDismissing] = useState(false);
  const remainingTimeRef = useRef(duration);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = useCallback(() => {
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss(id);
    }, 180);
  }, [id, onDismiss]);

  const startTimer = useCallback(() => {
    if (remainingTimeRef.current <= 0) {
      handleDismiss();
      return;
    }
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, remainingTimeRef.current);
  }, [handleDismiss]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }
  }, []);

  useEffect(() => {
    remainingTimeRef.current = duration;
    startTimer();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [duration, startTimer]);

  const handleAction = () => {
    if (onAction) {
      onAction();
    }
    handleDismiss();
  };

  const variantClass =
    variant === 'success'
      ? styles.variantSuccess
      : variant === 'error'
        ? styles.variantError
        : variant === 'undo'
          ? styles.variantUndo
          : styles.variantDefault;

  return (
    <div
      role="alert"
      className={`${styles.toast} ${variantClass} ${isDismissing ? styles.toastDismissing : ''}`}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
    >
      {variant === 'success' && (
        <span className={styles.icon} aria-hidden="true">
          ✓
        </span>
      )}
      <span className={styles.message}>{message}</span>

      {actionLabel && (variant === 'undo' || Boolean(onAction)) && (
        <button type="button" className={styles.actionButton} onClick={handleAction}>
          {actionLabel}
        </button>
      )}

      <button
        type="button"
        className={styles.closeButton}
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

export default Toast;
