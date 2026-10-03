import { useEffect, type RefObject } from 'react';

export const HOUR_HEIGHT = 80;
export const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60; // 1.3333... px per min
export const GUTTER_WIDTH = 56;

export function minutesToPixels(minutes: number): number {
  return minutes * PIXELS_PER_MINUTE;
}

export function pixelsToMinutes(pixels: number): number {
  return Math.round(pixels / PIXELS_PER_MINUTE);
}

export function formatTimeRange(startMin: number, durationMin: number): string {
  const endMin = startMin + durationMin;

  const formatMin = (m: number) => {
    const wrapped = ((m % 1440) + 1440) % 1440;
    const hours24 = Math.floor(wrapped / 60);
    const mins = wrapped % 60;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const padMins = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hours12}:${padMins} ${period}`;
  };

  return `${formatMin(startMin)} – ${formatMin(endMin)}`;
}

export function useAutoScrollToNow(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!containerRef.current) return;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    // Position now line roughly ~1 hour from the top of the viewport
    const targetY = Math.max(0, (currentMinutes - 60) * PIXELS_PER_MINUTE);
    containerRef.current.scrollTop = targetY;
  }, [containerRef]);
}
