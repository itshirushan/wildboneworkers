import { getListingDetail } from '../../_lib/etsy.js';
import { cachedJson } from '../../_lib/cache.js';
import { CACHE_TTL } from '../../_lib/config.js';

/** GET /api/listings/:id — full detail for one listing (images, variations, stock). */
export async function onRequestGet({ request, env, params, waitUntil }) {
  const id = params.id;
  if (!id || !/^\d+$/.test(id)) {
    return new Response(JSON.stringify({ error: 'Invalid listing id' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const listing = await cachedJson(
      request,
      { waitUntil },
      `listing:${id}`,
      CACHE_TTL.listingDetail,
      () => getListingDetail(env, id)
    );

    return new Response(JSON.stringify(listing), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=60',
      },
    });
  } catch (err) {
    console.error(`GET /api/listings/${id} failed`, err);
    const status = err.status === 404 ? 404 : 502;
    return new Response(
      JSON.stringify({
        error:
          status === 404
            ? 'That specimen could not be found — it may have sold or been removed.'
            : 'Catalog is temporarily unavailable. Please try again shortly.',
      }),
      { status, headers: { 'content-type': 'application/json' } }
    );
  }
}
