// Convenience test endpoint. It uses the same secure Etsy credentials as the product-sync endpoint.
const BASE = 'https://api.etsy.com/v3';

async function getToken(env) {
  if (!env.ETSY_KEYSTRING || !env.ETSY_REFRESH_TOKEN) throw new Error('Missing ETSY_KEYSTRING or ETSY_REFRESH_TOKEN.');
  const body = new URLSearchParams({ grant_type: 'refresh_token', client_id: env.ETSY_KEYSTRING, refresh_token: env.ETSY_REFRESH_TOKEN });
  const r = await fetch('https://api.etsy.com/v3/public/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new Error(`Token refresh failed (${r.status}): ${(await r.text()).slice(0, 500)}`);
  return (await r.json()).access_token;
}

export async function onRequestGet(context) {
  const id = new URL(context.request.url).searchParams.get('listing_id') || '4516295013';
  if (!/^\d+$/.test(id)) return new Response(JSON.stringify({ error: 'Invalid listing_id.' }), { status: 400, headers: { 'content-type': 'application/json' } });
  try {
    const token = await getToken(context.env);
    const r = await fetch(`${BASE}/application/listings/${id}`, {
      headers: { 'x-api-key': `${context.env.ETSY_KEYSTRING}:${context.env.ETSY_SHARED_SECRET}`, 'authorization': `Bearer ${token}`, 'accept': 'application/json' },
    });
    return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 502, headers: { 'content-type': 'application/json' } });
  }
}
