/**
 * slug.js
 * Turns a listing title into a URL-safe slug for pretty product URLs like
 * /shop/4520781334-real-mink-skulls-set-of-10. The numeric id at the front
 * is what's actually used to look up the listing — the slug is cosmetic
 * (good for SEO/readability) and never trusted for routing on its own.
 */
export function slugify(title) {
  return (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
