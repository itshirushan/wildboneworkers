import { getAllActiveListings } from './_lib/etsy.js';
import { cachedJson } from './_lib/cache.js';
import { ETSY_SHOP_ID, CACHE_TTL } from './_lib/config.js';
import { slugify } from './_lib/slug.js';

function isoDate(unixSeconds) {
  if (!unixSeconds) return new Date().toISOString();
  return new Date(unixSeconds * 1000).toISOString();
}

export async function onRequestGet({ request, env, waitUntil }) {
  const siteUrl = new URL(request.url).origin;

  let listings = [];
  try {
    listings = await cachedJson(request, { waitUntil }, 'listings:active', CACHE_TTL.listings, () =>
      getAllActiveListings(env, ETSY_SHOP_ID)
    );
  } catch (err) {
    console.error('sitemap.xml: listings fetch failed, emitting static pages only', err);
  }

  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/shop.html', priority: '0.9', changefreq: 'daily' },
    { loc: '/about.html', priority: '0.5', changefreq: 'monthly' },
    { loc: '/shipping.html', priority: '0.4', changefreq: 'monthly' },
    { loc: '/returns.html', priority: '0.4', changefreq: 'monthly' },
  ];

  const productUrls = listings.map(
    (l) => `
  <url>
    <loc>${siteUrl}/shop/${l.id}-${slugify(l.title)}</loc>
    <lastmod>${isoDate(l.lastModifiedTimestamp)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
  );

  const staticUrls = staticPages.map(
    (p) => `
  <url>
    <loc>${siteUrl}${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticUrls.join('')}${productUrls.join('')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
