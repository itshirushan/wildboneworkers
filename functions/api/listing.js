const ETSY_API_BASE = 'https://api.etsy.com/v3';
const ACCESS_TOKEN_CACHE_KEY = 'https://wildboneworkers.com/__etsy_access_token_cache__';
const ACCESS_TOKEN_TTL = 50 * 60;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? 'public, max-age=300, s-maxage=300' : 'no-store',
      ...extraHeaders,
    },
  });
}

function corsHeaders(origin) {
  const allowed = origin === 'https://wildboneworkers.com' || origin === 'https://www.wildboneworkers.com';
  return {
    'access-control-allow-origin': allowed ? origin : 'https://wildboneworkers.com',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

async function getAccessToken(env) {
  const cache = caches.default;
  const cached = await cache.match(ACCESS_TOKEN_CACHE_KEY);
  if (cached) return cached.text();

  if (!env.ETSY_KEYSTRING || !env.ETSY_SHARED_SECRET || !env.ETSY_REFRESH_TOKEN) {
    throw new Error('Missing Etsy API secrets. Add ETSY_KEYSTRING, ETSY_SHARED_SECRET and ETSY_REFRESH_TOKEN to Cloudflare Pages secrets.');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.ETSY_KEYSTRING,
    refresh_token: env.ETSY_REFRESH_TOKEN,
  });

  const response = await fetch('https://api.etsy.com/v3/public/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Etsy token refresh failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const token = await response.json();
  if (!token.access_token) throw new Error('Etsy token refresh returned no access token.');

  // Cache the short-lived access token at the edge to avoid refreshing on every product request.
  await cache.put(
    ACCESS_TOKEN_CACHE_KEY,
    new Response(token.access_token, { headers: { 'cache-control': `max-age=${ACCESS_TOKEN_TTL}` } }),
  );
  return token.access_token;
}

async function etsyFetch(path, env, token) {
  const response = await fetch(`${ETSY_API_BASE}${path}`, {
    headers: {
      'x-api-key': `${env.ETSY_KEYSTRING}:${env.ETSY_SHARED_SECRET}`,
      'authorization': `Bearer ${token}`,
      'accept': 'application/json',
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Etsy request failed (${response.status}) for ${path}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

function normalizePrice(value) {
  if (typeof value === 'number') return value > 1000 ? value / 100 : value;
  if (Array.isArray(value)) {
    const candidate = value[value.length - 1];
    return normalizePrice(candidate);
  }
  if (value && typeof value === 'object') {
    if ('amount' in value) {
      const divisor = value.divisor || 100;
      return Number(value.amount) / divisor;
    }
    if ('value' in value) return Number(value.value);
  }
  const n = Number(value);
  return Number.isFinite(n) ? (n > 1000 ? n / 100 : n) : null;
}

function normalizeImage(image) {
  return {
    id: image.listing_image_id ?? image.image_id ?? null,
    src: image.url_570xN || image.url_fullxfull || image.url_170x135 || image.url_75x75,
    full: image.url_fullxfull || image.url_570xN || image.url_170x135,
    alt: image.alt_text || '',
    rank: image.rank ?? 0,
  };
}

function normalizeInventory(inventory) {
  const products = Array.isArray(inventory?.products) ? inventory.products : [];
  const variationMap = new Map();
  const variants = products.map((product) => {
    const values = [];
    for (const prop of (product.property_values || [])) {
      const name = prop.property_name || prop.name || `Option ${prop.property_id}`;
      const vals = Array.isArray(prop.values) ? prop.values : [];
      const normalizedValues = vals.length ? vals.map(String) : (prop.value ? [String(prop.value)] : []);
      values.push({ name, values: normalizedValues });
      for (const value of normalizedValues) {
        if (!variationMap.has(name)) variationMap.set(name, new Set());
        variationMap.get(name).add(value);
      }
    }
    const offerings = Array.isArray(product.offerings) ? product.offerings : [];
    const offering = offerings.find(o => o.is_enabled !== false) || offerings[0] || {};
    const quantity = Number(offering.quantity ?? product.quantity ?? 0);
    const price = normalizePrice(offering.price ?? product.price);
    return { values, quantity: Number.isFinite(quantity) ? quantity : 0, price, enabled: offering.is_enabled !== false };
  });
  return {
    variations: [...variationMap.entries()].map(([name, set]) => ({ name, values: [...set] })),
    variants,
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const origin = context.request.headers.get('Origin') || '';
  const listingId = url.searchParams.get('listing_id');

  if (!listingId || !/^\d+$/.test(listingId)) {
    return json({ error: 'A numeric listing_id is required.' }, 400, corsHeaders(origin));
  }

  try {
    const token = await getAccessToken(context.env);
    const [listing, inventory, images] = await Promise.all([
      etsyFetch(`/application/listings/${listingId}`, context.env, token),
      etsyFetch(`/application/listings/${listingId}/inventory`, context.env, token),
      etsyFetch(`/application/listings/${listingId}/images`, context.env, token),
    ]);

    const normalizedImages = (images?.results || []).map(normalizeImage).filter(i => i.src).sort((a,b) => a.rank - b.rank);
    const normalizedInventory = normalizeInventory(inventory);

    const data = {
      listing_id: Number(listing.listing_id || listingId),
      title: listing.title || '',
      description: listing.description || '',
      price: normalizePrice(listing.price),
      currency_code: listing.currency_code || 'USD',
      quantity: Number(listing.quantity ?? 0),
      state: listing.state || '',
      url: listing.url || `https://www.etsy.com/listing/${listingId}`,
      images: normalizedImages,
      variations: normalizedInventory.variations,
      variants: normalizedInventory.variants,
      fetched_at: new Date().toISOString(),
    };

    return json(data, 200, corsHeaders(origin));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unable to load Etsy data.' }, 502, {
      ...corsHeaders(origin),
      'cache-control': 'no-store',
    });
  }
}

export function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
