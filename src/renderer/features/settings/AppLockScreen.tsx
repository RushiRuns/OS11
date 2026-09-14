import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import styles from './AppLockScreen.module.css';

interface AppLockScreenProps {
  onUnlock: () => void;
}

export function AppLockScreen({ onUnlock }: AppLockScreenProps): React.ReactElement {
  const [pin, setPin] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyEnteredPin = useCallback(async (enteredPin: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    try {
      const ok = await invoke<boolean>(IPC.SECURITY.VERIFY_PIN, { pin: enteredPin });
      if (ok) {
        setIsError(false);
        setErrorMessage('');
        onUnlock();
      } else {
        setIsError(true);
        setErrorMessage('Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch {
      setIsError(true);
      setErrorMessage('Verification failed. Try again.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  }, [isVerifying, onUnlock]);

  const handleDigit = useCallback((digit: string) => {
    if (pin.length >= 6) return;
    setIsError(false);
    setErrorMessage('');
    const next = pin + digit;
    setPin(next);

    if (next.length >= 4) {
      verifyEnteredPin(next);
    }
  }, [pin, verifyEnteredPin]);

  const handleBackspace = useCallback(() => {
    setIsError(false);
    setErrorMessage('');
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setIsError(false);
    setErrorMessage('');
    setPin('');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleBackspace, handleClear]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="App Lock">
      <div className={`${styles.lockCard} ${isError ? styles.shake : ''}`}>
        <div className={styles.iconWrap}>
          🔒
        </div>

        <div>
          <h1 className={styles.title}>OS11 is Locked</h1>
          <p className={styles.subtitle}>Enter your PIN to unlock</p>
        </div>

        <div className={styles.pinDots} aria-label={`PIN: ${pin.length} digits entered`}>
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`${styles.pinDot} ${idx < pin.length ? styles.pinDotFilled : ''}`}
            />
          ))}
        </div>

        <div className={styles.errorMessage}>{errorMessage}</div>

        <div className={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              className={styles.keyBtn}
              onClick={() => handleDigit(digit)}
              disabled={isVerifying}
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.keyBtn} ${styles.actionBtn}`}
            onClick={handleClear}
            disabled={isVerifying || pin.length === 0}
          >
            Clear
          </button>
          <button
            type="button"
            className={styles.keyBtn}
            onClick={() => handleDigit('0')}
            disabled={isVerifying}
          >
            0
          </button>
          <button
            type="button"
            className={`${styles.keyBtn} ${styles.actionBtn}`}
            onClick={handleBackspace}
            disabled={isVerifying || pin.length === 0}
            title="Backspace"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}

export default AppLockScreen;
