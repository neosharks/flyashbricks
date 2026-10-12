import { connectDb } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { reportUnexpected } from '@/lib/logger';
import { storage } from '@/lib/storage';
import { getAssetForOrg, isImageVariant } from '@/features/assets/service';

export const dynamic = 'force-dynamic';

/**
 * Serves one stored version of an asset to signed-in members of the owning
 * organisation only. The URL contains the asset id, which changes whenever the
 * photo is replaced, so browsers may keep it forever; `private` keeps shared
 * caches and proxies from storing it.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; variant: string }> },
): Promise<Response> {
  const { id, variant } = await params;
  const user = await getSessionUser();
  // Someone still on a temporary password may only set a new one.
  if (!user || user.mustChangePassword) return new Response(null, { status: 401 });
  if (!isImageVariant(variant)) return new Response(null, { status: 404 });

  try {
    await connectDb();
    const asset = await getAssetForOrg(user.orgId, id);
    // Staff photos follow the staff section's access; login photos are visible
    // to everyone in the organisation, as they are in the header and lists.
    if (!asset || (asset.purpose === 'staff_photo' && !can(user, 'staff:read'))) {
      return new Response(null, { status: 404 });
    }

    const etag = `"${id}-${variant}"`;
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    const object = await storage().get(asset.variants[variant].key);
    if (!object) return new Response(null, { status: 404 });

    return new Response(object.body, {
      headers: {
        'Content-Type': asset.contentType,
        'Content-Length': String(object.bytes),
        'Cache-Control': 'private, max-age=31536000, immutable',
        ETag: etag,
        'X-Content-Type-Options': 'nosniff',
        // An image needs no script, styles or frames even if opened directly.
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  } catch (err) {
    reportUnexpected(err, 'asset read failed', { asset_id: id });
    return new Response(null, { status: 500 });
  }
}
