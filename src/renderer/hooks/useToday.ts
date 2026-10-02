import { useState, useEffect } from 'react';
import { toISODateOnly } from '@shared/utils/date.js';

export function getTodayString(): string {
  return toISODateOnly(new Date());
}

/**
 * Hook that returns today's local date as YYYY-MM-DD string.
 * Automatically updates when local midnight crosses, and refreshes
 * immediately on window focus or visibility change (e.g. system wake/resume).
 */
export function useToday(): string {
  const [today, setToday] = useState<string>(getTodayString);

  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;

    const scheduleNextMidnight = () => {
      if (timerId) clearTimeout(timerId);

      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1,
        0 // 1 second past midnight to avoid race condition
      );
      const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

      timerId = setTimeout(() => {
        const nextToday = getTodayString();
        setToday(nextToday);
        scheduleNextMidnight();
      }, msUntilMidnight);
    };

    const handleRefresh = () => {
      const currentToday = getTodayString();
      setToday(prev => (prev !== currentToday ? currentToday : prev));
      scheduleNextMidnight();
    };

    scheduleNextMidnight();

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('visibilitychange', handleRefresh);

    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('visibilitychange', handleRefresh);
    };
  }, []);

  return today;
}

export default useToday;
