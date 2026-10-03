import React, { useState, useEffect } from 'react';
import { PIXELS_PER_MINUTE, GUTTER_WIDTH } from './useSchedulerLayout.js';
import styles from './SchedulerPanel.module.css';

export function NowLine(): React.ReactElement {
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    };

    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, []);

  const top = currentMinutes * PIXELS_PER_MINUTE;

  return (
    <div
      className={styles.nowLineContainer}
      style={{ top: `${top}px` }}
      aria-hidden="true"
    >
      <div className={styles.nowLineDot} style={{ left: `${GUTTER_WIDTH - 5}px` }} />
      <div className={styles.nowLineBar} style={{ left: `${GUTTER_WIDTH}px` }} />
    </div>
  );
}
