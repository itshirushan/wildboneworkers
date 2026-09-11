/**
 * shop.js — the Shop page's filtering/sorting UI. All filtering logic runs
 * against the site's own /api/listings endpoint; category options come from
 * /api/sections. Filter state is reflected in the URL so results are
 * shareable and bookmarkable.
 */
(function () {
  const grid = document.getElementById('shopGrid');
  const errorEl = document.getElementById('shopError');
  const emptyEl = document.getElementById('emptyState');
  const resultCount = document.getElementById('resultCount');
  const categoryFilters = document.getElementById('categoryFilters');
  const sortSelect = document.getElementById('sortSelect');
  const searchInput = document.getElementById('searchInput');
  const inStockOnly = document.getElementById('inStockOnly');
  const filtersToggle = document.getElementById('filtersToggle');
  const filtersPanel = document.getElementById('filtersPanel');

  const params = new URLSearchParams(window.location.search);
  const state = {
    category: params.get('category') || '',
    price: params.get('price') || '',
    sort: params.get('sort') || 'recent',
    q: params.get('q') || '',
    inStockOnly: params.get('inStock') === '1',
  };

  if (sortSelect) sortSelect.value = state.sort;
  if (searchInput) searchInput.value = state.q;
  if (inStockOnly) inStockOnly.checked = state.inStockOnly;

  // ---- Mobile filters toggle ----
  if (filtersToggle && filtersPanel) {
    filtersToggle.addEventListener('click', () => {
      const collapsed = filtersPanel.classList.toggle('is-collapsed');
      filtersToggle.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  // ---- Populate category filter options ----
  fetch('/api/sections')
    .then((r) => r.json())
    .then((data) => {
      const sections = (data.results || []).filter((s) => s.activeListingCount > 0);
      if (!categoryFilters || !sections.length) return;
      const optionsHtml = sections
        .map(
          (s) => `
        <label class="filter-option">
          <input type="radio" name="category" value="${s.id}" ${
            String(state.category) === String(s.id) ? 'checked' : ''
          }>
          ${WBW.escapeHtml(s.title)}
          <span class="count">${s.activeListingCount}</span>
        </label>`
        )
        .join('');
      categoryFilters.innerHTML =
        `<label class="filter-option"><input type="radio" name="category" value="" ${
          state.category ? '' : 'checked'
        }> All specimens</label>` + optionsHtml;
      categoryFilters.addEventListener('change', (e) => {
        if (e.target.name === 'category') {
          state.category = e.target.value;
          syncUrlAndFetch();
        }
      });
    })
    .catch(() => {
      /* category filter is progressive enhancement */
    });

  // ---- Wire up other controls ----
  document.querySelectorAll('input[name="price"]').forEach((el) => {
    if (el.value === state.price) el.checked = true;
    el.addEventListener('change', () => {
      state.price = el.value;
      syncUrlAndFetch();
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.sort = sortSelect.value;
      syncUrlAndFetch();
    });
  }

  if (inStockOnly) {
    inStockOnly.addEventListener('change', () => {
      state.inStockOnly = inStockOnly.checked;
      syncUrlAndFetch();
    });
  }

  let searchDebounce;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.q = searchInput.value.trim();
        syncUrlAndFetch();
      }, 300);
    });
  }

  function syncUrlAndFetch() {
    const url = new URL(window.location.href);
    url.searchParams.set('sort', state.sort);
    if (state.category) url.searchParams.set('category', state.category);
    else url.searchParams.delete('category');
    if (state.price) url.searchParams.set('price', state.price);
    else url.searchParams.delete('price');
    if (state.q) url.searchParams.set('q', state.q);
    else url.searchParams.delete('q');
    if (state.inStockOnly) url.searchParams.set('inStock', '1');
    else url.searchParams.delete('inStock');
    window.history.replaceState({}, '', url);
    fetchAndRender();
  }

  function passesPriceFilter(listing) {
    if (!state.price) return true;
    const amount = listing.price?.amount ?? 0;
    const [minStr, maxStr] = state.price.split('-');
    const min = Number(minStr || 0);
    const max = maxStr === '' || maxStr === undefined ? Infinity : Number(maxStr);
    return amount >= min && amount <= max;
  }

  function fetchAndRender() {
    if (grid) grid.setAttribute('aria-busy', 'true');
    if (resultCount) resultCount.textContent = 'Loading catalog\u2026';
    if (errorEl) errorEl.hidden = true;
    if (emptyEl) emptyEl.hidden = true;

    const apiParams = new URLSearchParams();
    apiParams.set('sort', state.sort);
    if (state.category) apiParams.set('section', state.category);
    if (state.q) apiParams.set('q', state.q);

    fetch(`/api/listings?${apiParams.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error('bad response');
        return r.json();
      })
      .then((data) => {
        let results = data.results || [];
        results = results.filter(passesPriceFilter);
        if (state.inStockOnly) results = results.filter((l) => l.quantity > 0);

        if (!results.length) {
          if (grid) grid.innerHTML = '';
          if (emptyEl) emptyEl.hidden = false;
          if (resultCount) resultCount.textContent = '0 specimens';
          return;
        }

        if (grid) grid.innerHTML = results.map(WBW.renderProductCard).join('');
        if (resultCount) {
          resultCount.textContent = `${results.length} specimen${results.length === 1 ? '' : 's'}`;
        }
      })
      .catch(() => {
        if (grid) grid.innerHTML = '';
        if (errorEl) errorEl.hidden = false;
        if (resultCount) resultCount.textContent = '';
      })
      .finally(() => {
        if (grid) grid.removeAttribute('aria-busy');
      });
  }

  fetchAndRender();
})();
