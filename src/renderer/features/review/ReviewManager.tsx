import React, { useState, useEffect } from 'react';
import { invoke } from '../../services/ipc.js';
import { IPC } from '@shared/ipc-channels.js';
import { WeeklyReviewModal } from './WeeklyReviewModal.js';
import { MonthlyReviewModal } from './MonthlyReviewModal.js';

export function getIsoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getMonthString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function ReviewManager(): React.ReactElement | null {
  const [isWeeklyOpen, setIsWeeklyOpen] = useState(false);
  const [isMonthlyOpen, setIsMonthlyOpen] = useState(false);

  useEffect(() => {
    async function checkReviewSchedules() {
      try {
        const settings = await invoke<Record<string, unknown>>(IPC.SETTINGS.GET_ALL);
        if (!settings) return;

        const now = new Date();
        const currentWeek = getIsoWeek(now);
        const currentMonth = getMonthString(now);

        // Weekly review check (Default: Friday at 17:00 or later)
        const weeklyEnabled = settings.weekly_review_enabled !== false;
        const targetDay = typeof settings.weekly_review_day === 'number' ? settings.weekly_review_day : 5; // Friday
        const targetTime = typeof settings.weekly_review_time === 'string' ? settings.weekly_review_time : '17:00';
        const lastWeekly = settings.last_weekly_review_week as string | undefined;

        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        if (weeklyEnabled && now.getDay() === targetDay && currentTimeStr >= targetTime) {
          if (lastWeekly !== currentWeek) {
            setIsWeeklyOpen(true);
            return;
          }
        }

        // Monthly review check (Default: 1st of month)
        const monthlyEnabled = settings.monthly_review_enabled !== false;
        const targetMonthDay = typeof settings.monthly_review_day === 'number' ? settings.monthly_review_day : 1;
        const lastMonthly = settings.last_monthly_review_month as string | undefined;

        if (monthlyEnabled && now.getDate() === targetMonthDay) {
          if (lastMonthly !== currentMonth) {
            setIsMonthlyOpen(true);
          }
        }
      } catch {
        // Silently handle error
      }
    }

    checkReviewSchedules();

    // Event listeners for manual triggers from Settings or Command Palette
    const handleStartWeekly = () => setIsWeeklyOpen(true);
    const handleStartMonthly = () => setIsMonthlyOpen(true);

    window.addEventListener('os11:start-weekly-review', handleStartWeekly);
    window.addEventListener('os11:start-monthly-review', handleStartMonthly);

    return () => {
      window.removeEventListener('os11:start-weekly-review', handleStartWeekly);
      window.removeEventListener('os11:start-monthly-review', handleStartMonthly);
    };
  }, []);

  const handleCloseWeekly = async () => {
    setIsWeeklyOpen(false);
    try {
      await invoke(IPC.SETTINGS.SET, {
        key: 'last_weekly_review_week',
        value: getIsoWeek(),
      });
    } catch {
      // ignore
    }
  };

  const handleCloseMonthly = async () => {
    setIsMonthlyOpen(false);
    try {
      await invoke(IPC.SETTINGS.SET, {
        key: 'last_monthly_review_month',
        value: getMonthString(),
      });
    } catch {
      // ignore
    }
  };

  return (
    <>
      {isWeeklyOpen && <WeeklyReviewModal onClose={handleCloseWeekly} />}
      {isMonthlyOpen && <MonthlyReviewModal onClose={handleCloseMonthly} />}
    </>
  );
}

export default ReviewManager;
