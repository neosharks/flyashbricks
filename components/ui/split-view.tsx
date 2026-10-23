import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Maximize2, X } from 'lucide-react';

/**
 * A list with the record it opened beside it, on a wide screen. Below that
 * width a row opens the record's own page instead (see `ClickableRow`), so the
 * panel is never shown there even when the URL names one.
 *
 * Both columns are size containers: what is inside lays itself out by the
 * room it has, so a list squeezed beside a panel turns into cards.
 */
export function SplitView({
  panel,
  children,
}: {
  panel: React.ReactNode | null;
  children: React.ReactNode;
}) {
  if (!panel) return <div className="@container">{children}</div>;
  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-start xl:gap-5">
      <div className="@container min-w-0">{children}</div>
      <aside className="border-border bg-canvas sticky top-[4.5rem] hidden max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-xl border shadow-sm xl:block">
        {panel}
      </aside>
    </div>
  );
}

/** The panel's frame: a way to the full page and a way to close it, then the record. */
export async function DetailPanel({
  fullHref,
  closeHref,
  children,
}: {
  fullHref: string;
  closeHref: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations('common.panel');
  const button =
    'text-foreground-muted hover:text-foreground hover:bg-surface-muted inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium';
  return (
    <>
      <div className="border-border bg-canvas/95 sticky top-0 z-10 flex items-center justify-end gap-1 border-b px-3 py-1.5 backdrop-blur">
        <Link href={fullHref} className={button}>
          <Maximize2 aria-hidden className="size-4" />
          {t('openFull')}
        </Link>
        <Link href={closeHref} scroll={false} className={button} aria-label={t('close')}>
          <X aria-hidden className="size-4" />
        </Link>
      </div>
      <div className="@container p-5">{children}</div>
    </>
  );
}

/** When the record named in the URL is gone or not this company's. */
export async function PanelMissing() {
  const t = await getTranslations('common.panel');
  return <p className="text-foreground-muted">{t('missing')}</p>;
}
