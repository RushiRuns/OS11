import React, { useEffect, useState } from 'react';
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
  duration = 5000,
}: ToastProps): React.ReactElement {
  const [isDismissing, setIsDismissing] = useState(false);

  const handleDismiss = React.useCallback(() => {
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss(id);
    }, 150);
  }, [id, onDismiss]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, handleDismiss]);

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
    >
      <span className={styles.message}>{message}</span>

      {variant === 'undo' && (
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
