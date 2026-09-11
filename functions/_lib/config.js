/**
 * config.js
 * Non-secret constants shared across functions. The Etsy shop ID is a public
 * identifier (visible in the shop's own Etsy URL), not a credential, so it's
 * safe to keep in source. API keys and tokens are never stored here — those
 * live only in Cloudflare secrets (see README.md).
 */

// From https://www.etsy.com/shop/WildBoneWorkers -> numeric shop id.
export const ETSY_SHOP_ID = '66138533';

// Cache lifetimes, in seconds. Tune these against Etsy's rate limit
// (10 req/sec, 10,000 req/day per app key) vs. how "live" you need the
// catalog to feel. 10 minutes is a good default for a small, slow-moving
// wholesale-lot shop like this one.
export const CACHE_TTL = {
  listings: 600, // 10 minutes
  listingDetail: 600,
  sections: 3600, // 1 hour — sections change rarely
  shop: 3600,
  sitemap: 3600,
};
