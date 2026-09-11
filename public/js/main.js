/**
 * main.js — loaded on every page.
 * Handles the mobile nav toggle, footer year, footer category links, and
 * exposes a shared product-card renderer used by home.js and shop.js so the
 * markup for a "specimen card" only lives in one place.
 */
(function () {
  // ---- Mobile nav ----
  const toggle = document.getElementById('navToggle');
  const mobileNav = document.getElementById('mobileNav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // ---- Footer year ----
  const yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- Footer category quick-links (best-effort; fails silently) ----
  const footerList = document.getElementById('footerCategoryList');
  if (footerList) {
    fetch('/api/sections')
      .then((r) => r.json())
      .then((data) => {
        const sections = (data.results || []).filter((s) => s.activeListingCount > 0);
        if (!sections.length) return;
        footerList.innerHTML =
          '<li><a href="/shop.html">Browse all</a></li>' +
          sections
            .slice(0, 6)
            .map(
              (s) =>
                `<li><a href="/shop.html?category=${encodeURIComponent(s.id)}">${escapeHtml(
                  s.title
                )}</a></li>`
            )
            .join('');
      })
      .catch(() => {
        /* footer categories are a nice-to-have, not critical */
      });
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slugify(title) {
    return (title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function stockBadge(listing) {
    if (listing.quantity <= 0) return '<span class="card-badge sold">Sold out</span>';
    if (listing.quantity <= 3)
      return `<span class="card-badge low">Only ${listing.quantity} left</span>`;
    return '';
  }

  /** Renders one specimen card. Shared between the Home "latest" grid and the Shop grid. */
  function renderProductCard(listing) {
    const img = listing.images && listing.images[0];
    const href = `/shop/${listing.id}-${slugify(listing.title)}`;
    return `
    <a class="card" href="${href}">
      <div class="card-media">
        ${
          img
            ? `<img src="${escapeHtml(img.thumbnailUrl || img.url)}" alt="${escapeHtml(
                img.altText || listing.title
              )}" loading="lazy" width="400" height="400">`
            : ''
        }
        ${stockBadge(listing)}
      </div>
      <div class="card-body">
        <span class="card-tag">No. ${String(listing.id).slice(-4)}</span>
        <span class="card-title">${escapeHtml(listing.title)}</span>
        <span class="card-price">${
          listing.price ? `$${listing.price.amount.toFixed(2)}` : 'See on Etsy'
        }</span>
      </div>
    </a>`;
  }

  window.WBW = { renderProductCard, escapeHtml, slugify };
})();
