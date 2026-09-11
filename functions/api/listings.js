import { getAllActiveListings } from '../_lib/etsy.js';
import { cachedJson } from '../_lib/cache.js';
import { ETSY_SHOP_ID, CACHE_TTL } from '../_lib/config.js';

/**
 * GET /api/listings
 * Optional query params (all applied on the edge, after the cached fetch):
 *   section   - shop_section_id, filters to one category
 *   sort      - "recent" (default) | "price_asc" | "price_desc"
 *   q         - free-text search against title + tags
 *
 * Never exposes an API key or any Etsy credential — this route runs
 * server-side in the Cloudflare Pages Function and the client only ever
 * talks to this same-origin endpoint.
 */
export async function onRequestGet({ request, env, waitUntil }) {
  try {
    const listings = await cachedJson(
      request,
      { waitUntil },
      'listings:active',
      CACHE_TTL.listings,
      () => getAllActiveListings(env, ETSY_SHOP_ID)
    );

    const url = new URL(request.url);
    const section = url.searchParams.get('section');
    const sort = url.searchParams.get('sort') ?? 'recent';
    const q = url.searchParams.get('q')?.trim().toLowerCase();

    let results = listings;

    if (section) {
      results = results.filter((l) => String(l.sectionId) === String(section));
    }

    if (q) {
      results = results.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    results = [...results].sort((a, b) => {
      if (sort === 'price_asc') return (a.price?.amount ?? 0) - (b.price?.amount ?? 0);
      if (sort === 'price_desc') return (b.price?.amount ?? 0) - (a.price?.amount ?? 0);
      // "recent" — newest first
      return (b.createdTimestamp ?? 0) - (a.createdTimestamp ?? 0);
    });

    return new Response(JSON.stringify({ count: results.length, results }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=60', // short client-side cache; edge cache above governs freshness
      },
    });
  } catch (err) {
    console.error('GET /api/listings failed', err);
    return new Response(
      JSON.stringify({ error: 'Catalog is temporarily unavailable. Please try again shortly.' }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    );
  }
}
