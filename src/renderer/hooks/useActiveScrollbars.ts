import { useEffect } from 'react';

/**
 * Global active scrollbar listener:
 * Listens for scroll events in the capture phase on any scrollable element across the app.
 * Adds `data-scrolling="true"` to the element when scrolling begins and removes it
 * 1000ms after scrolling stops.
 *
 * This pairs with global CSS rules in `tokens.css` to only reveal sleek scrollbars
 * while the user is actively scrolling, fading out smoothly when idle.
 */
export function useActiveScrollbars(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const scrollTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

    const handleGlobalScroll = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

      target.setAttribute('data-scrolling', 'true');
      const prevTimer = scrollTimers.get(target);
      if (prevTimer) {
        clearTimeout(prevTimer);
      }

      const timer = setTimeout(() => {
        target.removeAttribute('data-scrolling');
        scrollTimers.delete(target);
      }, 1000);
      scrollTimers.set(target, timer);
    };

    window.addEventListener('scroll', handleGlobalScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener('scroll', handleGlobalScroll, { capture: true });
    };
  }, []);
}

export default useActiveScrollbars;
