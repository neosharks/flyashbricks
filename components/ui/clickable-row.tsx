'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SELECTED_CARD, SELECTED_ROW } from './selection';

/** Wide enough for a list and a record side by side; matches `xl` in SplitView. */
const SPLIT_QUERY = '(min-width: 80rem)';

/** Something inside the row that does its own thing when clicked. */
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="button"]';

function wantsNewTab(event: React.MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1;
}

/**
 * Where a row goes: beside the list on a wide screen when the list has a
 * panel, otherwise the record's own page.
 */
function useOpen(href: string, panelHref: string | undefined) {
  const router = useRouter();
  return () => {
    if (panelHref && window.matchMedia(SPLIT_QUERY).matches) {
      router.push(panelHref, { scroll: false });
    } else {
      router.push(href);
    }
  };
}

/**
 * A table row that opens its record wherever it is clicked. Links and buttons
 * inside it (a customer's name on a sale, say) still go where they point, and
 * Ctrl/⌘-click opens the record's page in a new tab. Keyboard users reach the
 * record through the row's first-column link, a `PanelLink`.
 */
export function ClickableRow({
  href,
  panelHref,
  selected = false,
  className,
  children,
}: {
  href: string;
  panelHref?: string | undefined;
  selected?: boolean;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const open = useOpen(href, panelHref);
  return (
    <tr
      onClick={(event) => {
        if ((event.target as Element).closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return;
        if (wantsNewTab(event)) window.open(href, '_blank', 'noopener');
        else open();
      }}
      onAuxClick={(event) => {
        if (event.button === 1 && !(event.target as Element).closest(INTERACTIVE)) {
          window.open(href, '_blank', 'noopener');
        }
      }}
      aria-current={selected || undefined}
      className={cn(
        'hover:bg-surface-muted cursor-pointer transition-colors',
        selected && SELECTED_ROW,
        className,
      )}
    >
      {children}
    </tr>
  );
}

/** A card that opens its record when clicked anywhere but its own buttons. */
export function ClickableCard({
  href,
  panelHref,
  selected = false,
  className,
  children,
}: {
  href: string;
  panelHref?: string | undefined;
  selected?: boolean;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const open = useOpen(href, panelHref);
  return (
    // The card's name is a real link for keyboard users; this is the larger target.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <article
      onClick={(event) => {
        if ((event.target as Element).closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return;
        if (wantsNewTab(event)) window.open(href, '_blank', 'noopener');
        else open();
      }}
      aria-current={selected || undefined}
      className={cn('cursor-pointer', className, selected && SELECTED_CARD)}
    >
      {children}
    </article>
  );
}

/**
 * A link to a record that opens it beside the list on a wide screen. A plain
 * click is taken over; Ctrl/⌘-click, middle-click and "open in new tab" use the
 * real address, so the record's own page is always one step away.
 */
export function PanelLink({
  href,
  panelHref,
  selected = false,
  className,
  children,
}: {
  href: string;
  panelHref?: string | undefined;
  /** A card for the record open in the panel. */
  selected?: boolean;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-current={selected || undefined}
      className={cn(className, selected && SELECTED_CARD)}
      onClick={(event) => {
        if (!panelHref || wantsNewTab(event) || event.button !== 0) return;
        if (!window.matchMedia(SPLIT_QUERY).matches) return;
        event.preventDefault();
        router.push(panelHref, { scroll: false });
      }}
    >
      {children}
    </Link>
  );
}
