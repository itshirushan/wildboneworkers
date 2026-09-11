import { getShop } from '../_lib/etsy.js';
import { cachedJson } from '../_lib/cache.js';
import { ETSY_SHOP_ID, CACHE_TTL } from '../_lib/config.js';

/** GET /api/shop — basic shop info used for the header/footer and About page. */
export async function onRequestGet({ request, env, waitUntil }) {
  try {
    const shop = await cachedJson(request, { waitUntil }, 'shop:info', CACHE_TTL.shop, () =>
      getShop(env, ETSY_SHOP_ID)
    );
    return new Response(JSON.stringify(shop), {
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=600' },
    });
  } catch (err) {
    console.error('GET /api/shop failed', err);
    return new Response(JSON.stringify({ error: 'Shop info unavailable' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
