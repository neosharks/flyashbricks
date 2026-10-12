import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CalendarDays, CalendarRange, Factory, PackageX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPills } from '@/components/ui/filter-pills';
import { GroupedTable } from '@/components/ui/grouped-table';
import { Page } from '@/components/ui/page';
import { SortSelect } from '@/components/ui/sort-select';
import { TableSearch } from '@/components/ui/table-search';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import {
  NoResults,
  Pagination,
  SortableTH,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui/data-table';
import { DateRangeFilter } from '@/components/production/date-range-filter';
import { LogProductionDialog } from '@/components/production/log-production-dialog';
import { ProductionChart } from '@/components/production/production-chart';
import { VoidProductionDialog } from '@/components/production/void-production-dialog';
import {
  dailyProduction,
  groupProduction,
  listProductionEntries,
  PRODUCTION_GROUPS,
  PRODUCTION_SORTS,
  productionOptions,
  productionSummary,
} from '@/features/production/queries';
import { defectRate } from '@/features/production/consumption';
import { parseDayRange } from '@/features/production/range';
import { brokenShare, bucketLabel, isTimeUnit, parseGroup } from '@/features/production/grouping';
import { tableHref } from '@/lib/table-href';
import { getOrgTimezone } from '@/lib/org';
import { todayKey } from '@/lib/dates';
import { can } from '@/lib/permissions';
import { formatQuantity } from '@/lib/quantity';
import { requirePermissionPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { cn, formatDate, formatNumber, formatPercent } from '@/lib/utils';
import type { ProductionEntryRow } from '@/features/production/types';
import { BrickPress } from '@/components/illustrations';

export const metadata: Metadata = { title: 'Bricks made' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermissionPage('/production', 'production:read');
  const query = await searchParams;
  const timezone = await getOrgTimezone(viewer.orgId);
  const table = parseTableParams(query, PRODUCTION_SORTS, { sort: 'date', dir: 'desc' });
  const range = parseDayRange(query, todayKey(timezone), '30d');
  const rawProduct = Array.isArray(query.product) ? query.product[0] : query.product;
  const group = parseGroup(query, PRODUCTION_GROUPS);
  const filters = { productId: rawProduct ?? null, range, q: table.q };
  const canWrite = can(viewer, 'production:write');

  const [t, tc, locale, options, summary, series, page, groups] = await Promise.all([
    getTranslations('production'),
    getTranslations('common'),
    getLocale(),
    productionOptions(viewer),
    productionSummary(viewer, timezone, range),
    // Twice the shown 30 days, so the chart can compare with the 30 before.
    dailyProduction(viewer, timezone, 60),
    group
      ? Promise.resolve(null)
      : listProductionEntries(viewer, { ...table, ...filters }, timezone),
    group ? groupProduction(viewer, group, filters, timezone) : Promise.resolve(null),
  ]);
  const rate = defectRate(summary.rangeGood, summary.rangeDefective);
  const hasAny = summary.monthGood + summary.rangeEntries > 0 || (page?.rows.length ?? 0) > 0;

  const materials = (row: ProductionEntryRow) =>
    row.consumption
      .map(
        (line) =>
          `${line.materialName} ${formatQuantity(line.qtyMilli, locale)} ${tc(`units.${line.unit}`)}`,
      )
      .join(', ');

  return (
    <Page size="wide">
      <PageHeader
        title={t('title')}
        description={canWrite ? t('description') : t('readOnly')}
        actions={canWrite && <LogProductionDialog products={options} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t('summary.today')}
          value={formatNumber(summary.todayGood, locale)}
          hint={
            summary.todayDefective > 0 ? (
              <span className="text-danger">
                {t('summary.todayHint', { count: summary.todayDefective })}
              </span>
            ) : (
              t('summary.todayHint', { count: summary.todayDefective })
            )
          }
          icon={CalendarDays}
          tone="action"
        />
        <StatCard
          label={t('summary.month')}
          value={formatNumber(summary.monthGood, locale)}
          hint={t('summary.monthHint')}
          icon={Factory}
        />
        <StatCard
          label={t('summary.inRange')}
          value={formatNumber(summary.rangeGood, locale)}
          hint={t('summary.inRangeHint', { count: summary.rangeEntries })}
          icon={CalendarRange}
        />
        <StatCard
          label={t('summary.defectRate')}
          value={rate === null ? '—' : formatPercent(rate, locale)}
          hint={t('summary.defectRateHint')}
          icon={PackageX}
          tone={rate === null ? 'neutral' : rate > 0 ? 'danger' : 'success'}
        />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('chart.title')}</CardTitle>
        </CardHeader>
        <CardBody>
          <ProductionChart data={series.slice(-30)} history={series} />
        </CardBody>
      </Card>

      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <TableSearch placeholder={t('table.searchPlaceholder')} />
          {!group && (
            <SortSelect
              className="md:hidden"
              sort={table.sort}
              dir={table.dir}
              options={[
                { sort: 'date', dir: 'desc', label: t('table.sort.newest') },
                { sort: 'date', dir: 'asc', label: t('table.sort.oldest') },
                { sort: 'goodQty', dir: 'desc', label: t('table.sort.mostGood') },
                { sort: 'goodQty', dir: 'asc', label: t('table.sort.leastGood') },
                { sort: 'defectiveQty', dir: 'desc', label: t('table.sort.mostBroken') },
                { sort: 'productName', dir: 'asc', label: t('table.sort.brickType') },
              ]}
            />
          )}
        </div>
        <DateRangeFilter range={range} />
        <FilterPills
          label={t('table.groups.label')}
          param="group"
          basePath="/production"
          query={query}
          options={[
            { value: null, label: t('table.groups.none') },
            ...PRODUCTION_GROUPS.map((value) => ({ value, label: t(`table.groups.${value}`) })),
          ]}
        />
        {options.length > 1 && (
          <FilterPills
            label={t('brickFilter.label')}
            param="product"
            basePath="/production"
            query={query}
            options={[
              { value: null, label: t('brickFilter.all') },
              ...options.map((option) => ({ value: option.id, label: option.name })),
            ]}
          />
        )}
      </div>

      {groups ? (
        groups.length === 0 ? (
          <NoResults />
        ) : (
          <>
            <GroupedTable
              caption={t('title')}
              groupLabel={t(`table.groups.${group ?? 'day'}`)}
              columns={[
                { key: 'good', label: t('table.groupColumns.good'), format: 'number', bar: true },
                { key: 'broken', label: t('table.groupColumns.broken'), format: 'number' },
                { key: 'brokenRate', label: t('table.groupColumns.brokenRate'), format: 'percent' },
                { key: 'entries', label: t('table.groupColumns.entries'), format: 'number' },
              ]}
              rows={groups.map((row) => ({
                key: row.key,
                label: isTimeUnit(group) ? bucketLabel(row.label, group, locale) : row.label,
                href: tableHref('/production', query, {
                  group: null,
                  ...('from' in row.link
                    ? { range: 'custom', from: row.link.from, to: row.link.to }
                    : 'productId' in row.link
                      ? { product: row.link.productId }
                      : { q: row.link.q }),
                }),
                values: {
                  good: row.good,
                  broken: row.defective,
                  brokenRate: brokenShare(row.good, row.defective) ?? '',
                  entries: row.entries,
                },
              }))}
              totals={(() => {
                const good = groups.reduce((sum, row) => sum + row.good, 0);
                const broken = groups.reduce((sum, row) => sum + row.defective, 0);
                return {
                  good,
                  broken,
                  brokenRate: brokenShare(good, broken) ?? '',
                  entries: groups.reduce((sum, row) => sum + row.entries, 0),
                };
              })()}
            />
            <p className="text-foreground-muted mt-2 text-xs">{t('table.groupHint')}</p>
          </>
        )
      ) : !page || page.rows.length === 0 ? (
        hasAny ? (
          <NoResults />
        ) : (
          <EmptyState
            illustration={<BrickPress className="h-full w-auto" />}
            icon={Factory}
            title={t('emptyTitle')}
            description={t('emptyBody')}
          />
        )
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {page.rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  'border-border bg-surface rounded-lg border p-3',
                  row.voided && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground-muted text-xs">
                      {formatDate(`${row.day}T00:00:00Z`, locale, 'UTC')} · {row.productName}
                    </p>
                    <p
                      className={cn(
                        'text-2xl font-semibold tabular-nums',
                        row.voided ? 'line-through' : 'text-success',
                      )}
                    >
                      {formatNumber(row.goodQty, locale)}
                    </p>
                    <p className="text-foreground-muted text-xs">
                      <span className={cn(!row.voided && row.defectiveQty > 0 && 'text-danger')}>
                        {t('summary.todayHint', { count: row.defectiveQty })}
                      </span>{' '}
                      · {row.createdByName}
                    </p>
                  </div>
                  {row.voided ? (
                    <Badge tone="neutral">{t('cancelled')}</Badge>
                  ) : (
                    canWrite && <VoidProductionDialog id={row.id} />
                  )}
                </div>
                {row.consumption.length > 0 && (
                  <p className="text-foreground-muted mt-2 text-xs">{materials(row)}</p>
                )}
                {row.voided && row.voidReason && (
                  <p className="text-foreground-muted mt-1 text-xs">
                    {t('cancelledReason', { reason: row.voidReason })}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <Table caption={t('title')} className="hidden md:block" minWidth="56rem">
            <THead>
              <SortableTH
                column="date"
                label={t('columns.date')}
                sort={table.sort}
                dir={table.dir}
                basePath="/production"
                query={query}
                defaultDir="desc"
              />
              <SortableTH
                column="productName"
                label={t('columns.brickType')}
                sort={table.sort}
                dir={table.dir}
                basePath="/production"
                query={query}
              />
              <SortableTH
                column="goodQty"
                label={t('columns.good')}
                sort={table.sort}
                dir={table.dir}
                basePath="/production"
                query={query}
                align="right"
                defaultDir="desc"
              />
              <SortableTH
                column="defectiveQty"
                label={t('columns.defective')}
                sort={table.sort}
                dir={table.dir}
                basePath="/production"
                query={query}
                align="right"
                defaultDir="desc"
              />
              <TH>{t('columns.materials')}</TH>
              <TH>{t('columns.by')}</TH>
              <TH>
                <span className="sr-only">{t('columns.actions')}</span>
              </TH>
            </THead>
            <TBody>
              {page.rows.map((row) => (
                <TR key={row.id} className={row.voided ? 'opacity-60' : ''}>
                  <TD muted className="whitespace-nowrap">
                    {formatDate(`${row.day}T00:00:00Z`, locale, 'UTC')}
                  </TD>
                  <TD>
                    {row.productName}
                    {row.note && <p className="text-foreground-muted text-xs">{row.note}</p>}
                  </TD>
                  <TD
                    align="right"
                    className={cn('font-semibold', row.voided ? 'line-through' : 'text-success')}
                  >
                    {formatNumber(row.goodQty, locale)}
                  </TD>
                  <TD
                    align="right"
                    muted={row.voided || row.defectiveQty === 0}
                    className={cn(!row.voided && row.defectiveQty > 0 && 'text-danger font-medium')}
                  >
                    {formatNumber(row.defectiveQty, locale)}
                  </TD>
                  <TD muted className="max-w-xs text-xs">
                    {materials(row) || '—'}
                  </TD>
                  <TD muted>{row.createdByName}</TD>
                  <TD align="right">
                    {row.voided ? (
                      <Badge tone="neutral" title={row.voidReason ?? undefined}>
                        {t('cancelled')}
                      </Badge>
                    ) : (
                      canWrite && <VoidProductionDialog id={row.id} />
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination
            basePath="/production"
            query={query}
            next={page.next}
            prev={page.prev}
            count={page.rows.length}
          />
        </>
      )}
    </Page>
  );
}
