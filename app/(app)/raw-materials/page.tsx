import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { AlertTriangle, Clock, IndianRupee, Package } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPills } from '@/components/ui/filter-pills';
import { Page } from '@/components/ui/page';
import { SortSelect } from '@/components/ui/sort-select';
import { TableSearch } from '@/components/ui/table-search';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { MaterialCard } from '@/components/raw-materials/material-card';
import { MaterialDialog } from '@/components/raw-materials/material-dialog';
import { listMaterials, purchaseSpendThisMonth } from '@/features/raw-materials/queries';
import {
  arrangeMaterials,
  MATERIAL_SHOW,
  MATERIAL_SORTS,
  parseMaterialShow,
  parseMaterialSort,
} from '@/features/raw-materials/arrange';
import { getOrgTimezone } from '@/lib/org';
import { can } from '@/lib/permissions';
import { formatMoney } from '@/lib/money';
import { requirePermissionPage } from '@/lib/session';
import { formatNumber } from '@/lib/utils';
import { Silo } from '@/components/illustrations';

export const metadata: Metadata = { title: 'Raw materials' };

type SearchParams = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function RawMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requirePermissionPage('/raw-materials', 'rawMaterials:read');
  const query = await searchParams;
  const q = (one(query.q) ?? '').slice(0, 80);
  const sort = parseMaterialSort(one(query.sort));
  const show = parseMaterialShow(one(query.show));
  const timezone = await getOrgTimezone(viewer.orgId);
  const [t, locale, materials, spend] = await Promise.all([
    getTranslations('rawMaterials'),
    getLocale(),
    listMaterials(viewer, timezone),
    purchaseSpendThisMonth(viewer, timezone),
  ]);
  const canWrite = can(viewer, 'rawMaterials:write');

  const active = materials.filter((material) => material.isActive);
  const low = active.filter((material) => material.level === 'critical');
  const shown = arrangeMaterials(materials, { q, sort, show });
  const firstOut = active
    .filter((material) => material.runwayDays !== null)
    .toSorted((a, b) => (a.runwayDays ?? 0) - (b.runwayDays ?? 0))[0];

  return (
    <Page size="wide">
      <PageHeader
        title={t('title')}
        description={canWrite ? t('description') : t('noAccessWrite')}
        actions={canWrite && <MaterialDialog />}
      />

      {materials.length === 0 ? (
        <EmptyState
          illustration={<Silo className="h-full w-auto" />}
          icon={Package}
          title={t('emptyTitle')}
          description={t('emptyBody')}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={t('stats.low')}
              value={formatNumber(low.length, locale)}
              hint={t('stats.lowHint')}
              icon={AlertTriangle}
              tone={low.length > 0 ? 'danger' : 'success'}
            />
            <StatCard
              label={t('stats.shortestRunway')}
              value={firstOut ? t('runway.days', { count: firstOut.runwayDays ?? 0 }) : '—'}
              hint={
                firstOut ? t('stats.shortestRunwayHint', { name: firstOut.name }) : t('runway.none')
              }
              icon={Clock}
              tone={firstOut && (firstOut.runwayDays ?? 0) <= 7 ? 'danger' : 'neutral'}
            />
            <StatCard
              label={t('stats.spend')}
              value={formatMoney(spend.spendPaise, locale)}
              hint={t('stats.spendHint', { count: spend.purchases })}
              icon={IndianRupee}
              tone="action"
            />
            <StatCard
              label={t('stats.materials')}
              value={formatNumber(active.length, locale)}
              icon={Package}
            />
          </div>

          <div className="mb-3 flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <TableSearch placeholder={t('list.searchPlaceholder')} />
              <SortSelect
                className="sm:w-60"
                sort={sort}
                dir="asc"
                options={MATERIAL_SORTS.map((value) => ({
                  sort: value,
                  dir: 'asc',
                  label: t(`list.sort.${value}`),
                }))}
              />
            </div>
            <FilterPills
              label={t('list.show.label')}
              param="show"
              basePath="/raw-materials"
              query={query}
              options={MATERIAL_SHOW.map((value) => ({
                value: value === 'active' ? null : value,
                label: t(`list.show.${value}`),
              }))}
            />
          </div>

          {shown.length === 0 && (
            <p className="text-foreground-muted py-6 text-center text-sm">{t('list.noMatch')}</p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((material) => (
              <MaterialCard key={material.id} material={material} canWrite={canWrite} />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
