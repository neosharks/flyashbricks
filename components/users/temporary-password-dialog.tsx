'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

/** Shows a freshly issued temporary password exactly once. */
export function TemporaryPasswordDialog({
  name,
  password,
  onDone,
}: {
  name: string;
  password: string | null;
  onDone: () => void;
}) {
  const t = useTranslations('users.temporaryPassword');
  const [copied, setCopied] = useState(false);

  return (
    <Dialog open={password !== null} onOpenChange={(open) => !open && onDone()}>
      <DialogContent title={t('title')} description={t('description', { name })}>
        <div className="bg-surface-muted flex items-center gap-3 rounded-lg p-4">
          <KeyRound aria-hidden className="text-action size-5 shrink-0" />
          <code className="flex-1 font-mono text-lg font-semibold tracking-wider select-all">
            {password}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!password) return;
              navigator.clipboard.writeText(password).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? t('copied') : t('copy')}
          </Button>
        </div>
        <Button onClick={onDone}>{t('done')}</Button>
      </DialogContent>
    </Dialog>
  );
}
