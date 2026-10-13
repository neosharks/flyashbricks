'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, ExternalLink, RotateCw } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Spinner } from '@/components/ui/spinner';
import { requestUpdate } from '@/features/system/actions';
import type { Release } from '@/features/system/releases';
import type { UpdaterState } from '@/features/system/updater';

const POLL_MS = 4000;

type UpdatePanelProps = {
  current: string;
  latest: Release | null;
  newer: boolean;
  initial: UpdaterState;
};

/**
 * Offers the newest release and follows an update while the host runs it.
 * The app itself restarts part-way through, so failed polls are expected and
 * shown as "restarting" rather than as an error.
 */
export function UpdatePanel({ current, latest, newer, initial }: UpdatePanelProps) {
  const t = useTranslations('system');
  const [state, setState] = useState(initial);
  const [serverVersion, setServerVersion] = useState(current);
  const [restarting, setRestarting] = useState(false);

  const busy = state.pending || state.status?.state === 'running';
  const status = state.status;
  const finished = status?.state === 'succeeded' && serverVersion !== current;

  useEffect(() => {
    if (!busy && !restarting) return;
    const poll = async () => {
      try {
        const response = await fetch('/api/system/update', { cache: 'no-store' });
        if (!response.ok) throw new Error(String(response.status));
        const next = (await response.json()) as UpdaterState & { current: string };
        setRestarting(false);
        setServerVersion(next.current);
        setState(next);
      } catch {
        setRestarting(true);
      }
    };
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [busy, restarting]);

  if (!state.available) {
    return (
      <Alert tone="info" title={t('unavailable.title')}>
        {t('unavailable.body')}
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {busy && (
        <Alert tone="info">
          <span className="flex items-center gap-2">
            <Spinner label={null} />
            {restarting
              ? t('status.restarting')
              : state.pending
                ? t('status.pending')
                : t('status.running', { version: status?.version ?? '' })}
          </span>
        </Alert>
      )}

      {finished && (
        <Alert tone="success" title={t('status.succeeded', { version: serverVersion })}>
          <Button className="mt-2" size="sm" onClick={() => window.location.reload()}>
            <RotateCw aria-hidden className="size-4" />
            {t('status.reload')}
          </Button>
        </Alert>
      )}

      {!busy && status?.state === 'failed' && (
        <Alert tone="danger" title={t('status.failed', { version: status.version })}>
          {t('status.failedBody')}
        </Alert>
      )}

      {latest && newer && !busy && !finished && (
        <Card>
          <CardHeader>
            <CardTitle>{t('notes.title', { version: latest.version })}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {latest.notes && (
              <pre className="bg-surface-muted max-h-80 overflow-auto rounded-md p-3 font-sans text-sm whitespace-pre-wrap">
                {latest.notes}
              </pre>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <a
                href={latest.url}
                target="_blank"
                rel="noreferrer"
                className="text-action inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
              >
                {t('notes.viewOnGithub')}
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
              <ConfirmButton
                variant="primary"
                confirmVariant="primary"
                title={t('update.confirmTitle', { version: latest.version })}
                description={t('update.confirmBody')}
                confirmLabel={t('update.confirm')}
                successMessage={t('update.started')}
                action={() => requestUpdate(latest.version)}
              >
                <Download aria-hidden className="size-4" />
                {t('update.button', { version: latest.version })}
              </ConfirmButton>
            </div>
          </CardBody>
        </Card>
      )}

      {state.log && (
        <details open={status?.state === 'failed'} className="text-sm">
          <summary className="text-foreground-muted cursor-pointer">{t('status.log')}</summary>
          <pre className="bg-surface-muted mt-2 max-h-96 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
            {state.log}
          </pre>
        </details>
      )}
    </div>
  );
}
