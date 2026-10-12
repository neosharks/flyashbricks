import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Page } from '@/components/ui/page';
import { NotificationOpener } from '@/components/notifications/notification-opener';
import { getOwnNotification } from '@/features/notifications/queries';
import { requireUserPage } from '@/lib/session';

export const metadata: Metadata = { title: 'Opening…' };

/**
 * Deep-link entry: `/n/<id>`. Signed-out visitors are sent to sign in and
 * brought straight back here. Someone else's notification is a 404 — the id
 * alone reveals nothing.
 */
export default async function OpenNotificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireUserPage(`/n/${id}`);
  const notification = await getOwnNotification(viewer, id);
  if (!notification) notFound();

  return (
    <Page size="compact">
      <NotificationOpener id={id} fallbackHref={notification.href} />
    </Page>
  );
}
