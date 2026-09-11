/**
 * render.js
 * Builds the full HTML document for a server-rendered product page
 * (functions/shop/[id].js). This is the one page in the project that MUST
 * be rendered on the server rather than hydrated client-side, because
 * social/search crawlers need real <title>, <meta>, and JSON-LD in the
 * initial response — client-injected meta tags are invisible to most of them.
 *
 * The header/footer markup here is kept in sync with public/index.html,
 * public/shop.html, etc. If you redesign the header or footer, update it
 * in both places (or extract further into an includes step at deploy time).
 */

const SKULL_MARK = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="1.4"/>
  <path d="M24 12c-6.6 0-11 4.6-11 10.4 0 3.4 1.7 5.7 3.6 7.2v3.1c0 .9.7 1.6 1.6 1.6h1.1v-2.4h2v2.4h4.4v-2.4h2v2.4h1.1c.9 0 1.6-.7 1.6-1.6v-3.1c1.9-1.5 3.6-3.8 3.6-7.2C35 16.6 30.6 12 24 12z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
  <circle cx="19.5" cy="22.5" r="2.1" stroke="currentColor" stroke-width="1.2"/>
  <circle cx="28.5" cy="22.5" r="2.1" stroke="currentColor" stroke-width="1.2"/>
  <path d="M23 24.5l-1 3h4l-1-3" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/>
</svg>`;

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/shop.html', label: 'Shop' },
  { href: '/about.html', label: 'About' },
  { href: '/shipping.html', label: 'Shipping' },
  { href: '/returns.html', label: 'Returns' },
];

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function header(activePath) {
  const links = NAV_LINKS.map(
    (l) =>
      `<a href="${l.href}"${l.href === activePath ? ' aria-current="page"' : ''}>${l.label}</a>`
  ).join('');
  return `
  <div class="utility-bar">Free shipping on every specimen &middot; Checkout securely on Etsy</div>
  <header class="site-header">
    <div class="container">
      <a href="/" class="wordmark">${SKULL_MARK}<span>Wild Bone Workers</span></a>
      <nav class="main-nav" aria-label="Primary">
        <ul>${links}</ul>
      </nav>
      <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
    </div>
  </header>
  <nav class="mobile-nav" id="mobileNav" aria-label="Mobile">${NAV_LINKS.map(
    (l) => `<a href="${l.href}">${l.label}</a>`
  ).join('')}</nav>`;
}

function footer() {
  const year = new Date().getFullYear();
  return `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <h4>Wild Bone Workers</h4>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/shop.html">Shop</a></li>
            <li><a href="/about.html">About</a></li>
          </ul>
        </div>
        <div>
          <h4>Help</h4>
          <ul>
            <li><a href="/shipping.html">Shipping</a></li>
            <li><a href="/returns.html">Returns &amp; exchanges</a></li>
            <li><a href="https://www.etsy.com/shop/WildBoneWorkers" target="_blank" rel="noopener">Contact on Etsy</a></li>
          </ul>
        </div>
        <div>
          <h4>Specimens</h4>
          <ul id="footerCategoryList"><li><a href="/shop.html">Browse all</a></li></ul>
        </div>
        <div>
          <h4>Checkout</h4>
          <p style="font-size:0.9rem;color:#55503f;max-width:26ch;">Every order is placed and paid for securely on Etsy. We only display the live catalog here.</p>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; ${year} Wild Bone Workers. Specimens sold via Etsy.</span>
        <span>Ethically sourced &middot; Not from threatened or endangered species</span>
      </div>
    </div>
  </footer>`;
}

/**
 * Renders a full HTML document.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string} opts.canonicalUrl
 * @param {string} [opts.ogImage]
 * @param {string} opts.bodyHtml - inner <main> content
 * @param {string} [opts.jsonLd] - JSON-LD string to embed
 * @param {string} [opts.activePath]
 * @param {string} [opts.extraScripts]
 */
export function renderPage({
  title,
  description,
  canonicalUrl,
  ogImage,
  bodyHtml,
  jsonLd,
  activePath = '',
  extraScripts = '',
}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:type" content="product">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonicalUrl}">
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/style.css">
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
</head>
<body>
${header(activePath)}
<main>
${bodyHtml}
</main>
${footer()}
<script src="/js/main.js" defer></script>
${extraScripts}
</body>
</html>`;
}
