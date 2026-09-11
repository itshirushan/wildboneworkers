import { getShopSections } from '../_lib/etsy.js';
import { cachedJson } from '../_lib/cache.js';
import { ETSY_SHOP_ID, CACHE_TTL } from '../_lib/config.js';

/** GET /api/sections — the shop's Etsy sections, used as site category filters. */
export async function onRequestGet({ request, env, waitUntil }) {
  try {
    const sections = await cachedJson(
      request,
      { waitUntil },
      'sections',
      CACHE_TTL.sections,
      () => getShopSections(env, ETSY_SHOP_ID)
    );
    return new Response(JSON.stringify({ results: sections }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('GET /api/sections failed', err);
    // Categories are a progressive enhancement — fail soft with an empty list
    // rather than breaking the Shop page.
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
}
