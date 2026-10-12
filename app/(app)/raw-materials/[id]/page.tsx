import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Clock, IndianRupee } from 'lucide-react';
import { SiloGauge } from '@/components/charts/silo-gauge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { FilterPills } from '@/components/ui/filter-pills';
import { GroupedTable } from '@/components/ui/grouped-table';
import { SortSelect } from '@/components/ui/sort-select';
import { TableSearch } from '@/components/ui/table-search';
import { Meter } from '@/components/ui/meter';
import { PageHeader } from '@/components/ui/page-header';
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
import { AdjustDialog } from '@/components/raw-materials/adjust-dialog';
import { ConsumptionChart } from '@/components/raw-materials/consumption-chart';
import { LevelBadge } from '@/components/raw-materials/level-badge';
import { MaterialDialog } from '@/components/raw-materials/material-dialog';
import { PurchaseDialog } from '@/components/raw-materials/purchase-dialog';
import {
  averageRatePaise,
  dailyConsumption,
  getMaterial,
  groupMaterialMovements,
  listMaterialMovements,
  MOVEMENT_GROUPS,
  MOVEMENT_SORTS,
} from '@/features/raw-materials/queries';
import { bucketLabel, bucketRange, parseGroup } from '@/features/production/grouping';
import { tableHref } from '@/lib/table-href';
import { parseDayRange } from '@/features/production/range';
import { getOrgTimezone } from '@/lib/org';
import { todayKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { can } from '@/lib/permissions';
import { formatQuantity } from '@/lib/quantity';
import { requirePermissionPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { cn, formatDate } from '@/lib/utils';
import { MATERIAL_MOVEMENT_TYPES, type MaterialMovementType } from '@/models/constants';
import { Page } from '@/components/ui/page';

export const metadata: Metadata = { title: 'Raw material' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function MaterialDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const viewer = await requirePermissionPage(`/raw-materials/${id}`, 'rawMaterials:read');
  const query = await searchParams;
  const timezone = await getOrgTimezone(viewer.orgId);
  const table = parseTableParams(query, MOVEMENT_SORTS, { sort: 'occurredAt', dir: 'desc' });
  const range = parseDayRange(query, todayKey(timezone), 'all');
  const rawType = Array.isArray(query.type) ? query.type[0] : query.type;
  const type: MaterialMovementType | null =
    MATERIAL_MOVEMENT_TYPES.find((value) => value === rawType) ?? null;

  const group = parseGroup(query, MOVEMENT_GROUPS);
  const filters = { type, range, q: table.q };

  const material = await getMaterial(viewer, id, timezone);
  if (!material) notFound();

  const [t, tc, locale, series, page, groups] = await Promise.all([
    getTranslations('rawMaterials'),
    getTranslations('common'),
    getLocale(),
    // Twice the shown 30 days, so the chart can compare with the 30 before.
    dailyConsumption(viewer, id, timezone, 60),
    group
      ? Promise.resolve(null)
      : listMaterialMovements(viewer, id, { ...table, ...filters }, timezone),
    group ? groupMaterialMovements(viewer, id, group, filters, timezone) : Promise.resolve(null),
  ]);
  const canWrite = can(viewer, 'rawMaterials:write');
  const unit = tc(`units.${material.unit}`);
  const basePath = `/raw-materials/${id}`;
  const amount = (milli: number) => `${formatQuantity(milli, locale)} ${unit}`;
  const signed = (milli: number) =>
    `${milli > 0 ? '+' : '−'}${formatQuantity(Math.abs(milli), locale)} ${unit}`;

  return (
    <Page size="medium">
      <PageHeader title={material.name} back={{ href: '/raw-materials', label: t('title') }}>
        <p className="text-foreground-muted mt-1 text-sm">{t(`kinds.${material.kind}`)}</p>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <SiloGauge
                ratio={material.fill}
                thresholdRatio={
                  material.capacityMilli ? material.lowThresholdMilli / material.capacityMilli : 0.5
                }
                level={material.level}
                className="h-28"
              />
              <div>
                <p className="text-foreground-muted text-sm">{t('quantity')}</p>
                <p className="text-3xl font-semibold tracking-tight">
                  {formatQuantity(material.quantityMilli, locale)}{' '}
                  <span className="text-foreground-muted text-lg font-normal">{unit}</span>
                </p>
                <div className="mt-1">
                  <LevelBadge level={material.level} label={t(`levels.${material.level}`)} />
                </div>
              </div>
            </div>
            <Meter
              value={Math.round(material.fill * 100)}
              max={100}
              level={material.level}
              label={t('fill', { name: material.name })}
            />
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-start gap-2">
                <Clock aria-hidden className="text-foreground-muted mt-0.5 size-4 shrink-0" />
                <div>
                  <p>
                    {material.runwayDays === null ? (
                      t('runway.none')
                    ) : (
                      <>
                        {t('runway.label')}{' '}
                        <strong>{t('runway.days', { count: material.runwayDays })}</strong>
                      </>
                    )}
                  </p>
                  {material.dailyUseMilli !== null && (
                    <p className="text-foreground-muted text-xs">
                      {t('runway.perDay', {
                        qty: formatQuantity(Math.round(material.dailyUseMilli), locale),
                        unit,
                      })}
                    </p>
                  )}
                </div>
              </div>
              {material.lastRatePaise !== null && (
                <div className="flex items-center gap-2">
                  <IndianRupee aria-hidden className="text-foreground-muted size-4 shrink-0" />
                  <p>
                    {t('lastRate', { rate: formatMoney(material.lastRatePaise, locale), unit })}
                  </p>
                </div>
              )}
              <p className="text-foreground-muted text-xs">
                {t('threshold', { qty: formatQuantity(material.lowThresholdMilli, locale), unit })}
              </p>
            </div>
            {canWrite && (
              <div className="flex flex-col gap-2">
                {material.isActive && <PurchaseDialog material={material} className="w-full" />}
                {material.isActive && <AdjustDialog material={material} className="w-full" />}
                <div className="self-end">
                  <MaterialDialog material={material} />
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('chart.title')}</CardTitle>
          </CardHeader>
          <CardBody>
            <ConsumptionChart data={series.slice(-30)} history={series} unit={unit} />
          </CardBody>
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="movements-title">
        <h2 id="movements-title" className="mb-3 text-lg font-semibold">
          {t('movements.title')}
        </h2>
        <div className="mb-3 flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <TableSearch placeholder={t('movements.searchPlaceholder')} />
            {!group && (
              <SortSelect
                className="md:hidden"
                sort={table.sort}
                dir={table.dir}
                options={[
                  { sort: 'occurredAt', dir: 'desc', label: t('movements.sort.newest') },
                  { sort: 'occurredAt', dir: 'asc', label: t('movements.sort.oldest') },
                  { sort: 'qtyMilli', dir: 'desc', label: t('movements.sort.biggestIn') },
                  { sort: 'qtyMilli', dir: 'asc', label: t('movements.sort.biggestOut') },
                  ...(type === 'purchase'
                    ? [
                        {
                          sort: 'costPaise',
                          dir: 'desc' as const,
                          label: t('movements.sort.costHigh'),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </div>
          <DateRangeFilter range={range} />
          <FilterPills
            label={t('movements.typeFilter')}
            param="type"
            basePath={basePath}
            query={query}
            options={[
              { value: null, label: t('movements.all') },
              ...MATERIAL_MOVEMENT_TYPES.map((value) => ({
                value,
                label: t(`movementTypes.${value}`),
              })),
            ]}
          />
          <FilterPills
            label={t('movements.groups.label')}
            param="group"
            basePath={basePath}
            query={query}
            options={[
              { value: null, label: t('movements.groups.none') },
              ...MOVEMENT_GROUPS.map((value) => ({ value, label: t(`movements.groups.${value}`) })),
            ]}
          />
        </div>

        {groups ? (
          groups.length === 0 ? (
            <NoResults />
          ) : group === 'supplier' ? (
            <GroupedTable
              caption={t('movements.title')}
              groupLabel={t('movements.groups.supplier')}
              columns={[
                {
                  key: 'spend',
                  label: t('movements.groupColumns.spend'),
                  format: 'money',
                  bar: true,
                },
                { key: 'purchased', label: t('movements.groupColumns.purchased'), format: 'text' },
                { key: 'avgRate', label: t('movements.groupColumns.avgRate'), format: 'text' },
                {
                  key: 'purchases',
                  label: t('movements.groupColumns.purchases'),
                  format: 'number',
                },
              ]}
              rows={groups.map((row) => {
                const rate = averageRatePaise(row.spendPaise, row.purchasedMilli);
                return {
                  key: row.key || '—',
                  label: row.key || t('movements.noSupplier'),
                  ...(row.key
                    ? {
                        href: tableHref(basePath, query, {
                          group: null,
                          type: 'purchase',
                          q: row.key,
                        }),
                      }
                    : {}),
                  values: {
                    spend: row.spendPaise,
                    purchased: amount(row.purchasedMilli),
                    avgRate:
                      rate === null
                        ? '—'
                        : t('movements.perUnit', { rate: formatMoney(rate, locale), unit }),
                    purchases: row.purchases,
                  },
                };
              })}
              totals={{
                spend: groups.reduce((sum, row) => sum + row.spendPaise, 0),
                purchased: amount(groups.reduce((sum, row) => sum + row.purchasedMilli, 0)),
                avgRate: '',
                purchases: groups.reduce((sum, row) => sum + row.purchases, 0),
              }}
            />
          ) : (
            <GroupedTable
              caption={t('movements.title')}
              groupLabel={t('movements.groups.month')}
              columns={[
                { key: 'purchased', label: t('movements.groupColumns.purchased'), format: 'text' },
                {
                  key: 'spend',
                  label: t('movements.groupColumns.spend'),
                  format: 'money',
                  bar: true,
                },
                { key: 'used', label: t('movements.groupColumns.used'), format: 'text' },
                { key: 'adjusted', label: t('movements.groupColumns.adjusted'), format: 'text' },
              ]}
              rows={groups.map((row) => {
                const month = bucketRange(row.key, 'month');
                return {
                  key: row.key,
                  label: bucketLabel(row.key, 'month', locale),
                  href: tableHref(basePath, query, {
                    group: null,
                    range: 'custom',
                    from: month.from,
                    to: month.to,
                  }),
                  values: {
                    purchased: amount(row.purchasedMilli),
                    spend: row.spendPaise,
                    used: amount(Math.max(0, row.usedMilli)),
                    adjusted: row.adjustedMilli === 0 ? '—' : signed(row.adjustedMilli),
                  },
                };
              })}
              totals={{
                purchased: amount(groups.reduce((sum, row) => sum + row.purchasedMilli, 0)),
                spend: groups.reduce((sum, row) => sum + row.spendPaise, 0),
                used: amount(
                  Math.max(
                    0,
                    groups.reduce((sum, row) => sum + row.usedMilli, 0),
                  ),
                ),
                adjusted: '',
              }}
            />
          )
        ) : !page || page.rows.length === 0 ? (
          <p className="text-foreground-muted brick-pattern rounded-lg p-6 text-center text-sm">
            {t('movements.empty')}
          </p>
        ) : (
          <>
            {/* Phone: one card per movement, the amount big. */}
            <ul className="flex flex-col gap-2 md:hidden">
              {page.rows.map((row) => (
                <li
                  key={row.id}
                  className="border-border bg-surface flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t(`movementTypes.${row.type}`)}</p>
                    <p className="text-foreground-muted text-xs">
                      {formatDate(row.occurredAt, locale, timezone)}
                      {row.createdByName ? ` · ${row.createdByName}` : ''}
                    </p>
                    {(row.note ?? row.supplier) && (
                      <p className="text-foreground-muted truncate text-xs">
                        {row.supplier ?? row.note}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        'font-semibold tabular-nums',
                        row.qtyMilli > 0 ? 'text-success' : 'text-danger',
                      )}
                    >
                      {signed(row.qtyMilli)}
                    </p>
                    <p className="text-foreground-muted text-xs tabular-nums">
                      {formatQuantity(row.balanceAfterMilli, locale)} {unit}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <Table caption={t('movements.title')} className="hidden md:block" minWidth="48rem">
              <THead>
                <SortableTH
                  column="occurredAt"
                  label={t('movements.columns.date')}
                  sort={table.sort}
                  dir={table.dir}
                  basePath={basePath}
                  query={query}
                  defaultDir="desc"
                />
                <TH>{t('movements.columns.type')}</TH>
                <SortableTH
                  column="qtyMilli"
                  label={t('movements.columns.change')}
                  sort={table.sort}
                  dir={table.dir}
                  basePath={basePath}
                  query={query}
                  align="right"
                  defaultDir="desc"
                />
                <TH align="right">{t('movements.columns.balance')}</TH>
                {type === 'purchase' ? (
                  <SortableTH
                    column="costPaise"
                    label={t('movements.columns.details')}
                    sort={table.sort}
                    dir={table.dir}
                    basePath={basePath}
                    query={query}
                    defaultDir="desc"
                  />
                ) : (
                  <TH>{t('movements.columns.details')}</TH>
                )}
                <TH>{t('movements.columns.by')}</TH>
              </THead>
              <TBody>
                {page.rows.map((row) => (
                  <TR key={row.id}>
                    <TD muted className="whitespace-nowrap">
                      {formatDate(row.occurredAt, locale, timezone)}
                    </TD>
                    <TD>{t(`movementTypes.${row.type}`)}</TD>
                    <TD
                      align="right"
                      className={
                        row.qtyMilli > 0 ? 'text-success font-medium' : 'text-danger font-medium'
                      }
                    >
                      {signed(row.qtyMilli)}
                    </TD>
                    <TD align="right" muted>
                      {formatQuantity(row.balanceAfterMilli, locale)} {unit}
                    </TD>
                    <TD muted className="max-w-xs truncate text-xs">
                      {[
                        row.supplier,
                        row.costPaise ? formatMoney(row.costPaise, locale) : null,
                        row.note,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </TD>
                    <TD muted>{row.createdByName ?? '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              basePath={basePath}
              query={query}
              next={page.next}
              prev={page.prev}
              count={page.rows.length}
            />
          </>
        )}
      </section>
    </Page>
  );
}
