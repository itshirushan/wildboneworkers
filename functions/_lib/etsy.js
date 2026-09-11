/**
 * etsy.js
 * ---------------------------------------------------------------------------
 * The ONLY module in this project that talks to Etsy. Every other file gets
 * shop/listing data by calling functions exported from here, never by
 * fetching Etsy directly and never by hardcoding product data.
 *
 * Credentials:
 *   - env.ETSY_API_KEY        (required) - your Etsy app "Keystring".
 *   - env.ETSY_SHARED_SECRET  (optional) - required only if you enable OAuth.
 *   - env.ETSY_REFRESH_TOKEN  (optional) - required only if you enable OAuth.
 * These are set as Cloudflare Pages secrets (`wrangler pages secret put ...`)
 * and are never sent to the browser. See README.md for setup.
 *
 * Auth model:
 *   Reading a shop's active listings, images, inventory, and sections is
 *   PUBLIC data on Etsy's API and only needs the `x-api-key` header (your
 *   keystring) - no OAuth required. This file defaults to that path.
 *
 *   OAuth (Bearer token via a long-lived refresh token) is wired up and used
 *   automatically IF you set ETSY_REFRESH_TOKEN + ETSY_SHARED_SECRET, in case
 *   you later add scopes that require it (e.g. reading draft listings, or
 *   shop-owner-only fields). Until then, it's simply unused.
 *
 * IMPORTANT: Etsy's exact response field names occasionally shift between
 * API versions/changelogs. Every normalizer below reads fields defensively
 * (optional chaining + fallbacks) and is written against the documented
 * v3 shape as of this project's writing. Before going live, do one real
 * request per endpoint and confirm field names against the current docs at
 * https://developer.etsy.com/documentation/reference — adjust the small
 * `pick*` helpers below if anything has changed, not the rest of the app.
 */

const ETSY_API_BASE = 'https://openapi.etsy.com/v3/application';
const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';

/** How many "variation" property types to surface per product, per the brief. */
export const MAX_VARIATIONS = 3;

// ---------------------------------------------------------------------------
// Low-level request plumbing
// ---------------------------------------------------------------------------

async function getAccessToken(env) {
  if (!env.ETSY_REFRESH_TOKEN || !env.ETSY_SHARED_SECRET) return null;

  const cache = caches.default;
  const tokenCacheKey = new Request('https://internal.cache/__etsy_oauth_token__');
  const cached = await cache.match(tokenCacheKey);
  if (cached) {
    const { access_token, expires_at } = await cached.json();
    if (Date.now() < expires_at - 60_000) return access_token;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.ETSY_API_KEY,
    refresh_token: env.ETSY_REFRESH_TOKEN,
  });

  const res = await fetch(ETSY_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    console.error('Etsy OAuth token refresh failed', res.status, await safeText(res));
    return null;
  }

  const json = await res.json();
  const expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;

  const toStore = new Response(
    JSON.stringify({ access_token: json.access_token, expires_at: expiresAt }),
    { headers: { 'cache-control': `public, max-age=${json.expires_in ?? 3600}` } }
  );
  await cache.put(tokenCacheKey, toStore);

  return json.access_token;
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * Call the Etsy Open API. Always sends the API key (required on every
 * request per Etsy's docs); adds a Bearer token too if OAuth is configured.
 */
async function etsyFetch(env, path, { searchParams } = {}) {
  if (!env.ETSY_API_KEY) {
    throw new Error(
      'ETSY_API_KEY is not configured. Set it with `wrangler pages secret put ETSY_API_KEY`.'
    );
  }

  const url = new URL(`${ETSY_API_BASE}${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers = { 'x-api-key': env.ETSY_API_KEY };
  const accessToken = await getAccessToken(env);
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    const detail = await safeText(res);
    const err = new Error(`Etsy API ${res.status} on ${path}: ${detail.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Public data-fetching functions
// ---------------------------------------------------------------------------

/** Basic shop info: name, url, icon, banner, announcement. */
export async function getShop(env, shopId) {
  const raw = await etsyFetch(env, `/shops/${shopId}`);
  return normalizeShop(raw);
}

/** Shop sections, used as the site's category filters. */
export async function getShopSections(env, shopId) {
  const raw = await etsyFetch(env, `/shops/${shopId}/sections`);
  return (raw.results ?? []).map(normalizeSection);
}

/**
 * All active listings for the shop, each enriched with images and inventory
 * (price/stock/variations). Small shops (a few dozen listings, like this one)
 * can be fetched in full and filtered/sorted on the edge; see README for
 * notes on scaling this up for a larger catalog.
 */
export async function getAllActiveListings(env, shopId) {
  const limit = 100;
  let offset = 0;
  let all = [];

  while (true) {
    const page = await etsyFetch(env, `/shops/${shopId}/listings/active`, {
      searchParams: { limit, offset, includes: 'Images,Shop' },
    });
    const results = page.results ?? [];
    all = all.concat(results);
    if (results.length < limit) break;
    offset += limit;
    if (offset > 1000) break; // safety valve
  }

  // Fetch inventory (variations + per-offering stock/price) for each listing
  // in parallel. Etsy's rate limit is per-second, not per-batch, so this is
  // fine for a shop of this size; see README if your catalog is much larger.
  const withInventory = await Promise.all(
    all.map(async (listing) => {
      let inventory = null;
      try {
        inventory = await etsyFetch(env, `/listings/${listing.listing_id}/inventory`);
      } catch (e) {
        console.error('Inventory fetch failed for', listing.listing_id, e.message);
      }
      return normalizeListing(listing, inventory);
    })
  );

  return withInventory;
}

/** A single listing, with full images + inventory, for the product page. */
export async function getListingDetail(env, listingId) {
  const [listing, images, inventory] = await Promise.all([
    etsyFetch(env, `/listings/${listingId}`),
    etsyFetch(env, `/listings/${listingId}/images`),
    etsyFetch(env, `/listings/${listingId}/inventory`).catch(() => null),
  ]);

  const normalized = normalizeListing(listing, inventory);
  normalized.images = (images.results ?? []).map(normalizeImage);
  return normalized;
}

// ---------------------------------------------------------------------------
// Normalizers — map Etsy's raw shapes to the shape the frontend expects.
// Keeping this in one place means a future Etsy field-name change only needs
// an edit here.
// ---------------------------------------------------------------------------

function normalizeShop(raw) {
  return {
    id: raw.shop_id,
    name: raw.shop_name ?? '',
    title: raw.title ?? '',
    announcement: raw.announcement ?? '',
    url: raw.url ?? '',
    iconUrl: raw.icon_url_fullxfull ?? '',
    numFavorers: raw.num_favorers ?? null,
    listingActiveCount: raw.listing_active_count ?? null,
    currencyCode: raw.currency_code ?? 'USD',
  };
}

function normalizeSection(raw) {
  return {
    id: raw.shop_section_id,
    title: raw.title ?? '',
    activeListingCount: raw.active_listing_count ?? 0,
  };
}

function normalizeImage(raw) {
  return {
    id: raw.listing_image_id,
    url: raw.url_fullxfull ?? raw.url_570xN ?? raw.url_170x135 ?? '',
    thumbnailUrl: raw.url_170x135 ?? raw.url_570xN ?? '',
    altText: raw.alt_text ?? '',
    rank: raw.rank ?? 0,
  };
}

function money(priceObj) {
  if (!priceObj) return null;
  const amount = priceObj.amount ?? 0;
  const divisor = priceObj.divisor ?? 100;
  return {
    amount: amount / divisor,
    currencyCode: priceObj.currency_code ?? 'USD',
  };
}

/**
 * Pulls up to MAX_VARIATIONS property types (e.g. "Size", "Bundle Size")
 * out of the inventory response, each with its list of option values and
 * the per-option price/stock deltas.
 */
function normalizeVariations(inventory) {
  if (!inventory || !Array.isArray(inventory.products)) return [];

  const propertyMap = new Map(); // property_name -> Set of values, with stock/price samples

  for (const product of inventory.products) {
    const offering = (product.offerings ?? []).find((o) => o.is_enabled) ?? product.offerings?.[0];
    for (const pv of product.property_values ?? []) {
      const key = pv.property_name ?? `Option ${pv.property_id}`;
      if (!propertyMap.has(key)) propertyMap.set(key, new Map());
      const valuesMap = propertyMap.get(key);
      const label = (pv.values ?? []).join(' / ');
      if (!valuesMap.has(label)) {
        valuesMap.set(label, {
          value: label,
          quantity: offering?.quantity ?? 0,
          price: money(offering?.price),
        });
      }
    }
  }

  return Array.from(propertyMap.entries())
    .slice(0, MAX_VARIATIONS)
    .map(([name, valuesMap]) => ({
      name,
      options: Array.from(valuesMap.values()),
    }));
}

function totalInventoryQuantity(inventory, fallback) {
  if (!inventory || !Array.isArray(inventory.products)) return fallback ?? 0;
  let total = 0;
  for (const product of inventory.products) {
    for (const offering of product.offerings ?? []) {
      if (offering.is_enabled) total += offering.quantity ?? 0;
    }
  }
  return total;
}

function normalizeListing(raw, inventory) {
  const price = money(raw.price);
  return {
    id: raw.listing_id,
    title: raw.title ?? '',
    description: raw.description ?? '',
    url: raw.url ?? '',
    state: raw.state ?? 'active',
    price,
    quantity: totalInventoryQuantity(inventory, raw.quantity),
    tags: raw.tags ?? [],
    sectionId: raw.shop_section_id ?? null,
    createdTimestamp: raw.created_timestamp ?? null,
    lastModifiedTimestamp: raw.last_modified_timestamp ?? null,
    images: (raw.images ?? []).map(normalizeImage),
    variations: normalizeVariations(inventory),
  };
}
