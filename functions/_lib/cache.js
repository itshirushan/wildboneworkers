/**
 * cache.js
 * Thin wrapper around the Cloudflare Cache API (`caches.default`).
 *
 * Why this exists:
 * Etsy's Open API v3 rate limit is small (10 req/sec, 10,000 req/day per app).
 * A storefront that calls Etsy on every visitor page load would blow through
 * that fast. Instead, every route in /functions/api/* and /functions/shop/*
 * reads from the edge cache first and only calls Etsy on a cache miss or
 * once the TTL expires. This also makes the storefront itself very fast,
 * since most requests never leave Cloudflare's edge.
 */

/**
 * Get-or-populate a cached JSON response at the edge.
 *
 * @param {Request} request - the incoming request (used to build a stable cache key)
 * @param {ExecutionContext} ctx - Pages Function context (for waitUntil)
 * @param {string} cacheKeySuffix - a string unique to this data (e.g. "listings:active")
 * @param {number} ttlSeconds - how long to keep the cached copy at the edge
 * @param {() => Promise<any>} producer - async function that returns fresh JSON-able data
 * @returns {Promise<any>} the cached or freshly-produced data
 */
export async function cachedJson(request, ctx, cacheKeySuffix, ttlSeconds, producer) {
  const cache = caches.default;
  const cacheUrl = new URL(request.url);
  // Normalize the cache key so query-string order etc. doesn't fragment the cache.
  const cacheKey = new Request(`${cacheUrl.origin}/__cache__/${cacheKeySuffix}`, {
    method: 'GET',
  });

  const cached = await cache.match(cacheKey);
  if (cached) {
    const data = await cached.json();
    return data;
  }

  const fresh = await producer();

  const response = new Response(JSON.stringify(fresh), {
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${ttlSeconds}`,
    },
  });

  // Don't block the response on writing to cache.
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    await cache.put(cacheKey, response.clone());
  }

  return fresh;
}

/**
 * Purge a single cache key. Useful if you wire up an Etsy webhook or a manual
 * "refresh catalog now" admin action later.
 */
export async function purgeCacheKey(request, cacheKeySuffix) {
  const cache = caches.default;
  const cacheUrl = new URL(request.url);
  const cacheKey = new Request(`${cacheUrl.origin}/__cache__/${cacheKeySuffix}`, {
    method: 'GET',
  });
  return cache.delete(cacheKey);
}
