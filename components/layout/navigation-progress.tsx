'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * A thin progress bar across the top of the page for the whole time a
 * navigation is in flight.
 *
 * Route-level `loading.tsx` files cover the gap once the new segment starts
 * rendering, but there is a window before that — while the router fetches the
 * next payload — where nothing on screen changes. On a fast connection that is
 * invisible; on a slow one it reads as a dead click. This closes it.
 *
 * The App Router exposes no navigation-start event, so the start is taken from
 * a capture-phase click on same-origin links (and `popstate` for back/forward),
 * and the end from the pathname or query actually changing. Form submissions and
 * `router.push` calls already carry their own pending state.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[] | null>(null);

  useEffect(() => {
    function clearTimers(): void {
      for (const timer of timers.current ?? []) clearTimeout(timer);
      timers.current = [];
    }

    function start(): void {
      clearTimers();
      setActive(true);
      setProgress(8);

      // Creeps towards 90% without ever claiming to be finished: the real
      // completion comes from the route actually changing.
      timers.current = [
        setTimeout(() => setProgress(35), 100),
        setTimeout(() => setProgress(65), 350),
        setTimeout(() => setProgress(85), 900),
        // A navigation that never completes (a redirect back to the same URL,
        // or a download) must not leave the bar stuck on screen.
        setTimeout(() => setActive(false), 10_000),
      ];
    }

    function onClick(event: MouseEvent): void {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin) return;
      // An in-page anchor is not a navigation.
      if (target.pathname === window.location.pathname && target.search === window.location.search)
        return;

      start();
    }

    document.addEventListener('click', onClick, { capture: true });
    window.addEventListener('popstate', start);

    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      window.removeEventListener('popstate', start);
      clearTimers();
    };
  }, []);

  // The new route is on screen: jump to full. Adjusted during render rather
  // than in an effect, so there is no extra render with a stale bar.
  const location = `${pathname}?${searchParams.toString()}`;
  const [seenLocation, setSeenLocation] = useState(location);
  if (seenLocation !== location) {
    setSeenLocation(location);
    setProgress(100);
  }

  // Then fade out.
  useEffect(() => {
    if (progress !== 100) return;
    const timer = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 220);
    return () => clearTimeout(timer);
  }, [progress]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      data-active={active}
    >
      <div
        className="bg-action h-full transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: active ? 1 : 0 }}
      />
    </div>
  );
}
