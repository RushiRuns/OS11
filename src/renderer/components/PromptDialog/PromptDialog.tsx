import React, { useState, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { Dialog } from '../primitives/Dialog/Dialog.js';
import styles from './PromptDialog.module.css';

export interface PromptOptions {
  title?: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PromptState extends PromptOptions {
  isOpen: boolean;
  resolve: ((value: string | null) => void) | null;
}

export const usePromptStore = create<PromptState>(() => ({
  isOpen: false,
  title: 'Input',
  message: '',
  defaultValue: '',
  placeholder: '',
  confirmLabel: 'Save',
  cancelLabel: 'Cancel',
  resolve: null,
}));

export function showPrompt(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    usePromptStore.setState({
      isOpen: true,
      title: options.title ?? 'Input',
      message: options.message,
      defaultValue: options.defaultValue ?? '',
      placeholder: options.placeholder ?? '',
      confirmLabel: options.confirmLabel ?? 'Save',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      resolve,
    });
  });
}

export function PromptDialog(): React.ReactElement | null {
  const {
    isOpen,
    title,
    message,
    defaultValue,
    placeholder,
    confirmLabel,
    cancelLabel,
    resolve,
  } = usePromptStore();

  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue ?? '');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, defaultValue]);

  const handleClose = (result: string | null) => {
    usePromptStore.setState({ isOpen: false, resolve: null });
    resolve?.(result);
  };

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose(null);
      }}
      title={title ?? 'Input'}
      description={message}
    >
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          handleClose(value);
        }}
      >
        <div className={styles.fieldGroup}>
          <input
            ref={inputRef}
            type="text"
            className={styles.textInput}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => handleClose(null)}
          >
            {cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
          >
            {confirmLabel ?? 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default PromptDialog;
