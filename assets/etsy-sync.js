(() => {
  const body = document.body;
  const listingId = body?.dataset?.etsyListingId;
  if (!listingId) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const galleryImage = $('#gallery-image');
  const galleryThumbs = $('#gallery-thumbs');
  const galleryCount = $('#gallery-count');
  const prev = $('#gallery-prev');
  const next = $('#gallery-next');
  const title = $('h1');
  const price = $('.product-price');
  const descriptionPanel = $('#description');
  const metaDescription = $('meta[name="description"]');
  const buy = $('.buy');

  function money(value, currency) {
    if (value == null || Number.isNaN(Number(value))) return '';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(Number(value));
    } catch { return `${currency || 'USD'} ${Number(value).toFixed(2)}`; }
  }

  function renderGallery(images) {
    if (!galleryImage || !galleryThumbs || !images?.length) return;
    let index = 0;
    galleryThumbs.innerHTML = '';
    images.forEach((image, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gallery-thumb';
      button.setAttribute('aria-label', `Image ${i + 1}`);
      button.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      const img = document.createElement('img');
      img.src = image.src;
      img.alt = '';
      img.width = 72; img.height = 72; img.loading = i === 0 ? 'eager' : 'lazy';
      button.append(img);
      button.addEventListener('click', () => show(i));
      galleryThumbs.append(button);
    });
    const thumbs = [...galleryThumbs.querySelectorAll('.gallery-thumb')];
    function show(nextIndex) {
      index = (nextIndex + images.length) % images.length;
      const image = images[index];
      galleryImage.src = image.src;
      galleryImage.alt = image.alt || title?.textContent?.trim() || 'Product image';
      galleryCount.textContent = `${index + 1} / ${images.length}`;
      thumbs.forEach((button, i) => button.setAttribute('aria-current', i === index ? 'true' : 'false'));
      if (prev) prev.disabled = images.length < 2;
      if (next) next.disabled = images.length < 2;
    }
    prev?.addEventListener('click', () => show(index - 1));
    next?.addEventListener('click', () => show(index + 1));
    show(0);
  }

  function renderLiveBox(data) {
    let box = $('#etsy-live-data');
    if (!box) {
      box = document.createElement('div');
      box.id = 'etsy-live-data';
      box.className = 'etsy-live-data';
      $('.product-info')?.append(box);
    }
    box.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'etsy-live-heading';
    heading.textContent = 'Live Etsy availability';
    box.append(heading);

    const variants = Array.isArray(data.variants) ? data.variants : [];
    const enabledVariants = variants.filter(v => v.enabled !== false && !v.is_deleted);
    const baseAvailable = Number(data.quantity || 0) > 0;
    const variantAvailable = enabledVariants.some(v => Number(v.quantity) > 0);

    const status = document.createElement('div');
    status.className = 'etsy-stock';
    status.textContent = (enabledVariants.length ? variantAvailable : baseAvailable)
      ? (baseAvailable ? `${Number(data.quantity)} available` : 'Available on Etsy')
      : 'Currently unavailable on Etsy';
    box.append(status);

    const variations = Array.isArray(data.variations) ? data.variations.filter(v => Array.isArray(v.values) && v.values.length) : [];
    if (!variations.length || !variants.length) return;

    const controls = document.createElement('div');
    controls.className = 'etsy-variations';
    const variationTitle = document.createElement('div');
    variationTitle.className = 'etsy-variation-title';
    variationTitle.textContent = 'Choose options';
    controls.append(variationTitle);

    const selects = [];
    variations.slice(0, 3).forEach((variation) => {
      const label = document.createElement('label');
      label.className = 'etsy-variation';
      const span = document.createElement('span');
      span.textContent = variation.name;
      const select = document.createElement('select');
      select.dataset.variationName = variation.name;
      variation.values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.append(option);
      });
      label.append(span, select);
      controls.append(label);
      selects.push(select);
    });

    const liveVariant = document.createElement('div');
    liveVariant.className = 'etsy-selected-variant';
    controls.append(liveVariant);
    box.append(controls);

    function variantMatches(variant) {
      return selects.every(select => {
        const name = select.dataset.variationName;
        const chosen = select.value;
        const property = (variant.values || []).find(item => item.name === name);
        return property && Array.isArray(property.values) && property.values.includes(chosen);
      });
    }

    function updateVariant() {
      const variant = variants.find(variantMatches);
      if (!variant) {
        liveVariant.textContent = 'Select an available option combination.';
        return;
      }
      const quantity = Number(variant.quantity || 0);
      const enabled = variant.enabled !== false && !variant.is_deleted;
      liveVariant.textContent = enabled && quantity > 0
        ? `${quantity} available${variant.price != null ? ` · ${money(variant.price, data.currency_code)}` : ''}`
        : 'Out of stock';
      if (price && variant.price != null) price.textContent = money(variant.price, data.currency_code);
    }

    selects.forEach(select => select.addEventListener('change', updateVariant));
    updateVariant();
  }

  async function sync() {
    try {
      const response = await fetch(`/api/listing?listing_id=${encodeURIComponent(listingId)}`, {
        headers: { 'accept': 'application/json' },
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Live Etsy data is not available yet.');
      const data = await response.json();

      if (title && data.title) title.textContent = data.title;
      if (price && data.price != null) price.textContent = money(data.price, data.currency_code);
      if (buy && data.url) buy.href = data.url;
      if (metaDescription && data.description) metaDescription.content = data.description.slice(0, 155);

      if (descriptionPanel && data.description) {
        descriptionPanel.innerHTML = '<h2>Product Description</h2>';
        data.description.split(/\r?\n\s*\r?\n/).filter(Boolean).forEach(paragraph => {
          const p = document.createElement('p');
          p.textContent = paragraph.trim();
          descriptionPanel.append(p);
        });
      }

      if (Array.isArray(data.images) && data.images.length) renderGallery(data.images);
      renderLiveBox(data);
      document.documentElement.dataset.etsySync = 'ok';
    } catch (error) {
      document.documentElement.dataset.etsySync = 'fallback';
      // The static Etsy links/gallery remain usable when the API is unavailable.
      console.warn('[WildBoneWorkers] Etsy sync:', error.message);
    }
  }

  sync();
})();
