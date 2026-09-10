WildBoneWorkers website — Step 5D: Live Etsy Product Sync

Built from Step 5C. Product pages now connect to a secure Cloudflare Pages Function at /api/listing. The browser sends only the Etsy listing ID; Etsy credentials stay server-side in Cloudflare secrets.

When the Etsy connection is configured, each product page can receive the current listing title, full description, price/currency, quantity, all listing images, up to three variations, per-variant quantity/price, listing URL and state. The existing static gallery/content remains as a graceful fallback when the API is not configured or temporarily unavailable.

The homepage hero uses the selected Mink skull Etsy image. The top-left wordmark is exactly “WildBoneWorkers”.
