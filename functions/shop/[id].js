import { getListingDetail } from '../_lib/etsy.js';
import { cachedJson } from '../_lib/cache.js';
import { CACHE_TTL } from '../_lib/config.js';
import { renderPage } from '../_lib/render.js';
import { slugify } from '../_lib/slug.js';

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stockBadge(listing) {
  if (listing.quantity <= 0) return '<span class="card-badge sold">Sold out</span>';
  if (listing.quantity <= 3) return `<span class="card-badge low">Only ${listing.quantity} left</span>`;
  return `<span class="card-badge">In stock</span>`;
}

function renderVariations(listing) {
  if (!listing.variations?.length) return '';
  return listing.variations
    .map(
      (v) => `
    <div class="variation-block">
      <h4>${escapeHtml(v.name)}</h4>
      <div class="variation-options">
        ${v.options
          .map(
            (o) =>
              `<span class="variation-pill${o.quantity <= 0 ? ' out' : ''}">${escapeHtml(o.value)}${
                o.price ? ` &middot; $${o.price.amount.toFixed(2)}` : ''
              }</span>`
          )
          .join('')}
      </div>
    </div>`
    )
    .join('');
}

function renderGallery(listing) {
  const images = listing.images?.length ? listing.images : [];
  if (!images.length) {
    return `<div class="gallery-main"><div class="empty-state">No photo available — view full listing photos on Etsy.</div></div>`;
  }
  const [first, ...rest] = images;
  return `
    <div class="gallery-main"><img src="${escapeHtml(first.url)}" alt="${escapeHtml(
    first.altText || listing.title
  )}" id="galleryMainImg" width="800" height="800" fetchpriority="high"></div>
    <div class="gallery-thumbs" id="galleryThumbs">
      ${[first, ...rest]
        .map(
          (img, i) =>
            `<button type="button" data-full="${escapeHtml(img.url)}" class="${i === 0 ? 'is-active' : ''}"><img src="${escapeHtml(
              img.thumbnailUrl || img.url
            )}" alt="" loading="lazy"></button>`
        )
        .join('')}
    </div>`;
}

export async function onRequestGet({ request, env, params, waitUntil }) {
  const rawId = params.id ?? '';
  const numericId = (rawId.match(/^\d+/) || [])[0];

  if (!numericId) {
    return new Response('Not found', { status: 404 });
  }

  let listing;
  try {
    listing = await cachedJson(
      request,
      { waitUntil },
      `listing:${numericId}`,
      CACHE_TTL.listingDetail,
      () => getListingDetail(env, numericId)
    );
  } catch (err) {
    console.error(`Product page ${numericId} failed`, err);
    const status = err.status === 404 ? 404 : 502;
    const html = renderPage({
      title: 'Specimen unavailable — Wild Bone Workers',
      description: 'This specimen could not be loaded right now.',
      canonicalUrl: new URL(request.url).href,
      bodyHtml: `<div class="container"><div class="error-banner">
        ${status === 404
          ? 'This specimen could not be found — it may have sold or been removed from the shop.'
          : 'The catalog is temporarily unavailable. Please try again shortly, or view the shop directly on Etsy.'}
        <p><a class="btn btn-outline" href="https://www.etsy.com/shop/WildBoneWorkers" target="_blank" rel="noopener">Visit the Etsy shop</a></p>
      </div></div>`,
    });
    return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  const canonicalSlugPath = `/shop/${listing.id}-${slugify(listing.title)}`;
  const canonicalUrl = new URL(canonicalSlugPath, new URL(request.url).origin).href;
  const heroImage = listing.images?.[0]?.url;
  const plainDescription = (listing.description || '').replace(/\s+/g, ' ').trim().slice(0, 155);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    image: (listing.images || []).map((i) => i.url),
    url: canonicalUrl,
    offers: {
      '@type': 'Offer',
      price: listing.price?.amount,
      priceCurrency: listing.price?.currencyCode ?? 'USD',
      availability:
        listing.quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      url: listing.url,
    },
  });

  const bodyHtml = `
  <div class="container">
    <p style="margin:1.5rem 0 0;"><a href="/shop.html">&larr; Back to Shop</a></p>
    <div class="product-detail">
      <div class="gallery">
        ${renderGallery(listing)}
      </div>
      <div class="product-info">
        <span class="card-tag">Specimen No. ${String(listing.id).slice(-4)}</span>
        <h1>${escapeHtml(listing.title)}</h1>
        <div class="product-price-row">
          <span class="product-price">${
            listing.price ? `$${listing.price.amount.toFixed(2)}` : 'See price on Etsy'
          }</span>
          ${stockBadge(listing)}
        </div>
        ${renderVariations(listing)}
        <a class="btn btn-primary btn-block" href="${escapeHtml(
          listing.url
        )}" target="_blank" rel="noopener sponsored">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/></svg>
          View &amp; buy on Etsy
        </a>
        <p class="etsy-note">Checkout, payment, and shipping are handled securely by Etsy. This page mirrors the live listing so you can browse quickly — the price, stock, and variations shown are synced directly from Etsy.</p>
        <div class="product-description">${escapeHtml(listing.description)}</div>
      </div>
    </div>
  </div>`;

  const extraScripts = `<script src="/js/product.js" defer></script>`;

  const html = renderPage({
    title: `${listing.title} — Wild Bone Workers`,
    description: plainDescription || 'Ethically sourced animal skulls and bone specimens.',
    canonicalUrl,
    ogImage: heroImage,
    bodyHtml,
    jsonLd,
    extraScripts,
  });

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
