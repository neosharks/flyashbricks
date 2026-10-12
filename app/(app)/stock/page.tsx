import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { AlertTriangle, Boxes, Factory } from 'lucide-react';
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
import { ProductCard } from '@/components/stock/product-card';
import { ProductDialog } from '@/components/stock/product-dialog';
import { materialOptions } from '@/features/raw-materials/queries';
import {
  groupStockMovements,
  listProducts,
  listStockMovements,
  STOCK_MOVEMENT_GROUPS,
  STOCK_MOVEMENT_SORTS,
} from '@/features/stock/queries';
import { arrangeProducts, parseCardSort } from '@/features/stock/arrange';
import { bucketLabel, bucketRange, parseGroup } from '@/features/production/grouping';
import { tableHref } from '@/lib/table-href';
import { parseDayRange } from '@/features/production/range';
import { getOrgTimezone } from '@/lib/org';
import { todayKey } from '@/lib/dates';
import { can } from '@/lib/permissions';
import { requirePermissionPage } from '@/lib/session';
import { parseTableParams } from '@/lib/table';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { STOCK_MOVEMENT_TYPES, type StockMovementType } from '@/models/constants';
import { BrickPallet } from '@/components/illustrations';

export const metadata: Metadata = { title: 'Brick stock' };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function StockPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const viewer = await requirePermissionPage('/stock', 'production:read');
  const query = await searchParams;
  const timezone = await getOrgTimezone(viewer.orgId);
  const table = parseTableParams(query, STOCK_MOVEMENT_SORTS, { sort: 'occurredAt', dir: 'desc' });
  const range = parseDayRange(query, todayKey(timezone), '30d');
  const rawType = Array.isArray(query.type) ? query.type[0] : query.type;
  const type: StockMovementType | null =
    STOCK_MOVEMENT_TYPES.find((value) => value === rawType) ?? null;
  const rawProduct = Array.isArray(query.product) ? query.product[0] : query.product;
  const group = parseGroup(query, STOCK_MOVEMENT_GROUPS);
  const filters = { productId: rawProduct ?? null, type, range, q: table.q };
  const cards = parseTableParams(query, ['name'] as const, { sort: 'name', dir: 'asc' }, 'card_');
  const cardSort = parseCardSort(
    Array.isArray(query.card_sort) ? query.card_sort[0] : query.card_sort,
  );

  const canWrite = can(viewer, 'production:write');
  const [t, locale, products, materials, page, groups] = await Promise.all([
    getTranslations('production'),
    getLocale(),
    listProducts(viewer),
    canWrite ? materialOptions(viewer) : Promise.resolve([]),
    group ? Promise.resolve(null) : listStockMovements(viewer, { ...table, ...filters }, timezone),
    group ? groupStockMovements(viewer, group, filters, timezone) : Promise.resolve(null),
  ]);
  const shownProducts = arrangeProducts(products, cards.q, cardSort);

  const active = products.filter((product) => product.isActive);
  const total = active.reduce((sum, product) => sum + product.stockGood, 0);
  const low = active.filter((product) => product.level === 'critical').length;
  const makeable = active.reduce((sum, product) => sum + (product.canMake ?? 0), 0);

  return (
    <Page size="wide">
      <PageHeader
        title={t('stock.title')}
        description={t('stock.description')}
        actions={canWrite && <ProductDialog materials={materials} />}
      />

      {products.length === 0 ? (
        <EmptyState
          illustration={<BrickPallet className="h-full w-auto" />}
          icon={Boxes}
          title={t('stock.emptyTitle')}
          description={t('stock.emptyBody')}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard
              label={t('stock.total')}
              value={formatNumber(total, locale)}
              hint={t('stock.totalHint')}
              icon={Boxes}
              tone="action"
            />
            <StatCard
              label={t('stock.levels.critical')}
              value={formatNumber(low, locale)}
              icon={AlertTriangle}
              tone={low > 0 ? 'danger' : 'success'}
            />
            <StatCard
              label={t('stock.canMakeTotal')}
              value={formatNumber(makeable, locale)}
              hint={t('stock.canMakeTotalHint')}
              icon={Factory}
              className="col-span-2 lg:col-span-1"
            />
          </div>

          {products.length > 3 && (
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <TableSearch prefix="card_" placeholder={t('stock.cards.searchPlaceholder')} />
              <SortSelect
                prefix="card_"
                className="sm:w-56"
                sort={cardSort}
                dir="asc"
                options={(['name', 'stockHigh', 'stockLow', 'canMake'] as const).map((value) => ({
                  sort: value,
                  dir: 'asc',
                  label: t(`stock.cards.sort.${value}`),
                }))}
              />
            </div>
          )}
          {shownProducts.length === 0 && (
            <p className="text-foreground-muted py-6 text-center text-sm">
              {t('stock.cards.noMatch')}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shownProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                canWrite={canWrite}
                materials={materials}
              />
            ))}
          </div>

          <section className="mt-8" aria-labelledby="stock-history">
            <h2 id="stock-history" className="mb-3 text-lg font-semibold">
              {t('stock.historyTitle')}
            </h2>
            <div className="mb-3 flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <TableSearch placeholder={t('stock.movements.searchPlaceholder')} />
                {!group && (
                  <SortSelect
                    className="md:hidden"
                    sort={table.sort}
                    dir={table.dir}
                    options={[
                      { sort: 'occurredAt', dir: 'desc', label: t('stock.movements.sort.newest') },
                      { sort: 'occurredAt', dir: 'asc', label: t('stock.movements.sort.oldest') },
                      { sort: 'qty', dir: 'desc', label: t('stock.movements.sort.biggestIn') },
                      { sort: 'qty', dir: 'asc', label: t('stock.movements.sort.biggestOut') },
                    ]}
                  />
                )}
              </div>
              <DateRangeFilter range={range} />
              {products.length > 1 && (
                <FilterPills
                  label={t('brickFilter.label')}
                  param="product"
                  basePath="/stock"
                  query={query}
                  options={[
                    { value: null, label: t('brickFilter.all') },
                    ...products.map((product) => ({ value: product.id, label: product.name })),
                  ]}
                />
              )}
              <FilterPills
                label={t('stock.movements.typeFilter')}
                param="type"
                basePath="/stock"
                query={query}
                options={[
                  { value: null, label: t('stock.movements.all') },
                  ...STOCK_MOVEMENT_TYPES.map((value) => ({
                    value,
                    label: t(`stock.movementTypes.${value}`),
                  })),
                ]}
              />
              <FilterPills
                label={t('stock.movements.groups.label')}
                param="group"
                basePath="/stock"
                query={query}
                options={[
                  { value: null, label: t('stock.movements.groups.none') },
                  ...STOCK_MOVEMENT_GROUPS.map((value) => ({
                    value,
                    label: t(`stock.movements.groups.${value}`),
                  })),
                ]}
              />
            </div>

            {groups ? (
              groups.length === 0 ? (
                <NoResults />
              ) : (
                <GroupedTable
                  caption={t('stock.historyTitle')}
                  groupLabel={t(`stock.movements.groups.${group ?? 'type'}`)}
                  columns={[
                    {
                      key: 'in',
                      label: t('stock.movements.groupColumns.in'),
                      format: 'number',
                      bar: true,
                    },
                    { key: 'out', label: t('stock.movements.groupColumns.out'), format: 'number' },
                    { key: 'net', label: t('stock.movements.groupColumns.net'), format: 'number' },
                    {
                      key: 'changes',
                      label: t('stock.movements.groupColumns.changes'),
                      format: 'number',
                    },
                  ]}
                  rows={groups.map((row) => {
                    const isType = group === 'type';
                    const month = isType ? null : bucketRange(row.key, 'month');
                    return {
                      key: row.key,
                      label: isType
                        ? t(`stock.movementTypes.${row.key as StockMovementType}`)
                        : bucketLabel(row.key, 'month', locale),
                      href: tableHref('/stock', query, {
                        group: null,
                        ...(month
                          ? { range: 'custom', from: month.from, to: month.to }
                          : { type: row.key }),
                      }),
                      values: {
                        in: row.bricksIn,
                        out: row.bricksOut,
                        net: row.bricksIn - row.bricksOut,
                        changes: row.changes,
                      },
                    };
                  })}
                  totals={{
                    in: groups.reduce((sum, row) => sum + row.bricksIn, 0),
                    out: groups.reduce((sum, row) => sum + row.bricksOut, 0),
                    net: groups.reduce((sum, row) => sum + row.bricksIn - row.bricksOut, 0),
                    changes: groups.reduce((sum, row) => sum + row.changes, 0),
                  }}
                />
              )
            ) : !page || page.rows.length === 0 ? (
              <p className="text-foreground-muted brick-pattern rounded-lg p-6 text-center text-sm">
                {t('stock.movements.empty')}
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-2 md:hidden">
                  {page.rows.map((row) => (
                    <li
                      key={row.id}
                      className="border-border bg-surface flex items-start justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {t(`stock.movementTypes.${row.type}`)}
                        </p>
                        <p className="text-foreground-muted text-xs">
                          {row.productName} · {formatDate(row.occurredAt, locale, timezone)}
                        </p>
                        {row.note && (
                          <p className="text-foreground-muted truncate text-xs">{row.note}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            'font-semibold tabular-nums',
                            row.qty > 0 ? 'text-success' : 'text-danger',
                          )}
                        >
                          {row.qty > 0 ? '+' : '−'}
                          {formatNumber(Math.abs(row.qty), locale)}
                        </p>
                        <p className="text-foreground-muted text-xs tabular-nums">
                          {formatNumber(row.balanceAfter, locale)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Table
                  caption={t('stock.historyTitle')}
                  className="hidden md:block"
                  minWidth="48rem"
                >
                  <THead>
                    <SortableTH
                      column="occurredAt"
                      label={t('stock.movements.columns.date')}
                      sort={table.sort}
                      dir={table.dir}
                      basePath="/stock"
                      query={query}
                      defaultDir="desc"
                    />
                    <TH>{t('stock.movements.columns.brickType')}</TH>
                    <TH>{t('stock.movements.columns.type')}</TH>
                    <SortableTH
                      column="qty"
                      label={t('stock.movements.columns.change')}
                      sort={table.sort}
                      dir={table.dir}
                      basePath="/stock"
                      query={query}
                      align="right"
                      defaultDir="desc"
                    />
                    <TH align="right">{t('stock.movements.columns.balance')}</TH>
                    <TH>{t('stock.movements.columns.note')}</TH>
                    <TH>{t('stock.movements.columns.by')}</TH>
                  </THead>
                  <TBody>
                    {page.rows.map((row) => (
                      <TR key={row.id}>
                        <TD muted className="whitespace-nowrap">
                          {formatDate(row.occurredAt, locale, timezone)}
                        </TD>
                        <TD>{row.productName}</TD>
                        <TD>{t(`stock.movementTypes.${row.type}`)}</TD>
                        <TD
                          align="right"
                          className={
                            row.qty > 0 ? 'text-success font-medium' : 'text-danger font-medium'
                          }
                        >
                          {row.qty > 0 ? '+' : '−'}
                          {formatNumber(Math.abs(row.qty), locale)}
                        </TD>
                        <TD align="right" muted>
                          {formatNumber(row.balanceAfter, locale)}
                        </TD>
                        <TD muted className="max-w-xs truncate text-xs">
                          {row.note ?? ''}
                        </TD>
                        <TD muted>{row.createdByName ?? '—'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                <Pagination
                  basePath="/stock"
                  query={query}
                  next={page.next}
                  prev={page.prev}
                  count={page.rows.length}
                />
              </>
            )}
          </section>
        </>
      )}
    </Page>
  );
}
