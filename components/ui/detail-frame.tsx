import { Page, type PageSize } from './page';

/** Where a record is shown: as its own page, or in the panel beside its list. */
export type DetailVariant = 'page' | 'panel';

/**
 * A record's outer frame. On its own page it takes the page width it always
 * had; in a panel it fills the panel. Either way it is a size container, so
 * its columns follow the room it has rather than the screen.
 */
export function DetailFrame({
  variant,
  size,
  children,
}: {
  variant: DetailVariant;
  size: PageSize;
  children: React.ReactNode;
}) {
  if (variant === 'panel') return <div className="@container">{children}</div>;
  return (
    <Page size={size} className="@container">
      {children}
    </Page>
  );
}
