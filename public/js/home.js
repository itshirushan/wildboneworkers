/**
 * home.js — populates the category rail and "latest additions" grid on the
 * home page from the site's own /api/* endpoints (never calls Etsy directly).
 */
(function () {
  const grid = document.getElementById('latestGrid');
  const errorEl = document.getElementById('latestError');
  const rail = document.getElementById('categoryRail');

  fetch('/api/sections')
    .then((r) => r.json())
    .then((data) => {
      const sections = (data.results || []).filter((s) => s.activeListingCount > 0);
      if (!rail || !sections.length) return;
      rail.innerHTML =
        '<a href="/shop.html" class="category-chip is-active">All</a>' +
        sections
          .map(
            (s) =>
              `<a href="/shop.html?category=${encodeURIComponent(s.id)}" class="category-chip">${WBW.escapeHtml(
                s.title
              )}</a>`
          )
          .join('');
    })
    .catch(() => {
      /* category rail is progressive enhancement */
    });

  fetch('/api/listings?sort=recent')
    .then((r) => {
      if (!r.ok) throw new Error('bad response');
      return r.json();
    })
    .then((data) => {
      const items = (data.results || []).slice(0, 8);
      if (!grid) return;
      if (!items.length) {
        grid.innerHTML = '<div class="empty-state">No specimens are listed right now — check back soon.</div>';
        return;
      }
      grid.innerHTML = items.map(WBW.renderProductCard).join('');
    })
    .catch(() => {
      if (grid) grid.innerHTML = '';
      if (errorEl) errorEl.hidden = false;
    });
})();
