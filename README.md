# Wild Bone Workers — storefront

A fast, static storefront for the [Wild Bone Workers Etsy shop](https://www.etsy.com/shop/WildBoneWorkers), styled as a classic natural-history specimen catalog. Every product — title, images, description, price, stock, and up to three variation types — is pulled **live from Etsy's Open API v3**, never scraped and never hand-entered. Every product links straight to its exact Etsy listing for checkout.

## How it's built

- **Frontend:** plain HTML/CSS/JS (no framework, no build step) — fast to load, easy to edit, good Core Web Vitals.
- **Backend:** [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/) — small serverless routes that call Etsy on the server, cache the result at the edge, and hand back clean JSON to the browser. **Your Etsy credentials never reach the browser.**
- **Product pages** (`/shop/{id}-{slug}`) are server-rendered per request so search engines and social previews (Open Graph) see real titles, descriptions, prices, and images — not a blank JS shell.

```
public/                 the static site (deploy target)
  index.html             Home
  shop.html               Shop + category/price/stock filters
  about.html, shipping.html, returns.html
  css/style.css
  js/*.js                 client-side rendering & filtering, calls /api/* only
functions/               Cloudflare Pages Functions (server-side)
  _lib/etsy.js             the ONLY file that talks to Etsy
  _lib/cache.js            edge caching helper
  _lib/config.js           shop id + cache TTLs (no secrets)
  _lib/render.js           HTML shell used by the SSR product page
  api/listings.js          GET /api/listings
  api/listings/[id].js     GET /api/listings/:id
  api/sections.js          GET /api/sections   (categories)
  api/shop.js              GET /api/shop
  shop/[id].js             SSR product page  /shop/:id-:slug
  sitemap.xml.js           dynamic sitemap
  robots.txt.js
wrangler.toml
.dev.vars.example        copy to .dev.vars for local dev — not committed
```

## 1. Get your Etsy API credentials

1. Go to the [Etsy Developer portal](https://www.etsy.com/developers/register) and create an app (any name, e.g. "Wild Bone Workers Storefront").
2. Copy the **Keystring** — this is your `ETSY_API_KEY`. It's all you need for this project: reading a shop's active listings, images, inventory, and sections is public data on Etsy's API and only requires the API key, not full OAuth.
3. (Optional, not required for this storefront) If you later add features that need OAuth scopes — e.g. reading draft listings — you'd also generate a `ETSY_SHARED_SECRET` and complete Etsy's OAuth 2.0 PKCE flow to get a long-lived `ETSY_REFRESH_TOKEN`. The code in `functions/_lib/etsy.js` already checks for these and will use a Bearer token automatically if they're present; until then they're simply unused.

Your shop's numeric ID (`66138533`, from etsy.com/shop/WildBoneWorkers) is **not** a secret — it's already in `functions/_lib/config.js`. Only the API key/tokens are secrets.

## 2. Local development

```bash
npm install
cp .dev.vars.example .dev.vars
# edit .dev.vars and paste your real ETSY_API_KEY
npm run dev
```

This runs the site with Wrangler's local Pages emulator at `http://localhost:8788`, with Functions and the Etsy API calls fully working against your real shop.

## 3. Deploy to Cloudflare Pages

```bash
npx wrangler login
npx wrangler pages project create wildboneworkers
wrangler pages secret put ETSY_API_KEY --project-name wildboneworkers
# paste your keystring when prompted

npm run deploy
```

Or connect the repo in the Cloudflare dashboard (Pages → Create a project → Connect to Git) and set `ETSY_API_KEY` under **Settings → Environment variables → Encrypt** for both Production and Preview. Build output directory: `public`. No build command needed.

Once deployed, attach your custom domain under **Custom domains** in the Pages project settings.

## How the data flow stays honest

- The browser only ever calls this site's own `/api/*` routes and its own `/shop/:id` pages — never Etsy directly, and no Etsy key is present in any client-side code.
- `functions/_lib/etsy.js` is the single place that calls `openapi.etsy.com`. If Etsy ever changes a field name, that's the only file to touch.
- Nothing about a product (title, price, images, description, stock, variations) is hardcoded anywhere in this repo. If Etsy is unreachable, the UI shows an honest "catalog temporarily unavailable" message with a link to the shop on Etsy — it never falls back to fabricated data.
- Categories on the Shop page and in the footer are pulled from your real **Etsy Shop Sections** (`GET /shops/{shop_id}/sections`). If you haven't organized your listings into sections yet, do that on Etsy — the filter list here will pick it up automatically on the next cache refresh.

## Caching & Etsy's rate limit

Etsy's Open API allows roughly 10 requests/second and 10,000/day per app key. A storefront that called Etsy on every visitor page-load would blow through that fast, so every route caches its Etsy response at Cloudflare's edge (`functions/_lib/cache.js`) before returning JSON:

| Data | Cache TTL |
|---|---|
| Listings (title/price/stock/images/variations) | 10 minutes |
| Shop sections (categories) | 1 hour |
| Shop info | 1 hour |

Tune these in `functions/_lib/config.js`. Lower TTLs = fresher stock/price display but more Etsy API calls; this shop is small and slow-moving, so 10 minutes is a sensible default. There's also a `purgeCacheKey()` helper in `cache.js` if you want to wire up a manual "refresh now" action later.

## SEO / Open Graph / sitemap

- Every product URL (`/shop/{id}-{slug}`) is server-rendered with a real `<title>`, meta description, canonical URL, Open Graph tags (including the listing's own photo), and `Product` JSON-LD — so it previews correctly when shared and indexes correctly in search.
- `/sitemap.xml` is generated on request from the live Etsy catalog (so new listings appear automatically) plus the five static pages.
- `/robots.txt` points at the sitemap using whatever domain the site is actually deployed on.

## Things to double-check before going fully live

Etsy's Open API v3 field names and endpoint availability do shift over time. `functions/_lib/etsy.js` reads every field defensively (with fallbacks) and is written against the documented v3 shape, but since this project was built without live Etsy API access, **do one real request per endpoint after you add your key** and confirm the shapes still match the current docs at <https://developer.etsy.com/documentation/reference>. The three spots most worth a second look:

1. `getAllActiveListings` / `normalizeListing` in `etsy.js` — listing + inventory field names.
2. `normalizeVariations` — how Etsy structures `property_values` and `offerings` on the inventory endpoint (this is what produces the up-to-3 variation blocks on each product page).
3. `normalizeShop` — shop banner/icon field names, used for the About page and social previews.

## What's static vs. live

- **Live from Etsy, always:** every product's title, description, images, price, stock, variations, and its category (Shop Section).
- **Static, edited by you in this repo:** the About story, Shipping and Returns page copy, and the site's visual design. These are written to point back to Etsy for anything order-specific (exact shipping cost, return windows) rather than guessing at policy details this API doesn't expose — edit them freely to match your actual policies.

## Design notes

No reference image was provided for this build, so the visual direction — a warm-parchment, ink-and-drawer-green "museum specimen catalog" look with a double-rule engraved frame as the one recurring motif — is an interpretation of "classic natural-history storefront" built to match what Wild Bone Workers actually sells (skulls, bones, preserved specimens). Colors, type, and the hero illustration all live in `public/css/style.css` and are straightforward to swap if you'd like to match a specific reference image instead — send it over and this can be adjusted precisely.
