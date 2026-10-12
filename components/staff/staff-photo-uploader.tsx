'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Camera, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CartoonPicker } from '@/components/ui/cartoon-picker';
import type { Gender } from '@/models/constants';

/** Longest side sent to the server; it keeps 1600px at most anyway. */
const UPLOAD_MAX_SIDE = 1600;

/**
 * Shrinks a photo in the browser before upload: a 12-megapixel phone photo
 * goes from ~4 MB to a few hundred KB, which matters on yard mobile data.
 * Drawing to a canvas also decodes formats like HEIC where the browser can.
 * If the browser cannot decode it, the original is sent and the server decides.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.88);
    });
    return blob ?? file;
  } catch {
    return file;
  }
}

export function StaffPhotoUploader({
  staffId,
  name,
  imageId,
  canEdit,
  gender,
  variant,
  size = 'xl',
}: {
  staffId: string;
  name: string;
  imageId: string | null;
  canEdit: boolean;
  gender: Gender;
  variant: number;
  size?: 'lg' | 'xl';
}) {
  const t = useTranslations('staff.photo');
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(imageId);
  const [pending, startTransition] = useTransition();

  async function upload(file: File): Promise<void> {
    const body = new FormData();
    body.set('file', await shrink(file), 'photo.jpg');
    const response = await fetch(`/api/staff/${staffId}/photo`, { method: 'POST', body });
    const result = (await response.json().catch(() => ({}))) as { assetId?: string; code?: string };
    if (response.ok && result.assetId) {
      setCurrent(result.assetId);
      toast.success(t('saved'));
      router.refresh();
    } else {
      toast.error(
        t(
          `errors.${result.code === 'VALIDATION_FAILED' ? 'invalid' : result.code === 'STORAGE_FULL' ? 'full' : 'failed'}`,
        ),
      );
    }
  }

  async function remove(): Promise<void> {
    const response = await fetch(`/api/staff/${staffId}/photo`, { method: 'DELETE' });
    if (response.ok) {
      setCurrent(null);
      toast.success(t('removed'));
      router.refresh();
    } else {
      toast.error(t('errors.failed'));
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <Avatar name={name} imageId={current} gender={gender} variant={variant} size={size} />
        {pending && (
          <span className="bg-surface/70 absolute inset-0 flex items-center justify-center rounded-full">
            <Spinner label={t('uploading')} className="size-6" />
          </span>
        )}
      </div>
      {canEdit && (
        <div className="flex min-w-0 flex-col gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) startTransition(() => upload(file));
            }}
          />
          <Button variant="outline" disabled={pending} onClick={() => input.current?.click()}>
            <Camera aria-hidden />
            {current ? t('change') : t('add')}
          </Button>
          {!current && (
            <CartoonPicker kind="staff" id={staffId} gender={gender} current={variant} />
          )}
          {current && (
            <Button
              variant="ghost"
              className="text-danger hover:bg-danger-subtle"
              disabled={pending}
              onClick={() => startTransition(remove)}
            >
              <Trash2 aria-hidden />
              {t('remove')}
            </Button>
          )}
          <p className="text-foreground-muted text-xs">{t('hint')}</p>
        </div>
      )}
    </div>
  );
}
