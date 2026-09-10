# WildBoneWorkers — Etsy Open API setup

This build adds the Step 5D live Etsy sync layer. The site stays static and lightweight; a Cloudflare Pages Function calls Etsy securely so API credentials are never placed in browser JavaScript or GitHub.

## What this step syncs

Each product page reads its Etsy listing ID from the HTML and requests `/api/listing?listing_id=...`. The Pages Function fetches the listing, inventory, and listing images from Etsy and returns only the fields needed by the storefront: title, full description, price/currency, quantity, gallery images, variation options, per-variant quantity/price, listing URL, and state.

Etsy currently requires an API key on every v3 request and OAuth 2.0 for scoped endpoints. Listing/inventory data includes quantity, price, image IDs and variation information. Etsy also supports up to three variations, so this integration reads up to three.

## Before deploying

1. Create an Etsy Seller App in the Etsy Developer Portal: https://developers.etsy.com/
2. Authorize the app for your own shop with the `listings_r` scope.
3. Keep the API key string, shared secret, and OAuth refresh token private. Do **not** paste them into HTML, JavaScript, GitHub, or chat.
4. In Cloudflare Pages, open the project → Settings → Variables and Secrets and add these encrypted variables for the Production environment:

   - `ETSY_KEYSTRING` = your Etsy app keystring
   - `ETSY_SHARED_SECRET` = your Etsy app shared secret
   - `ETSY_REFRESH_TOKEN` = the OAuth 2.0 refresh token for the shop

5. Deploy the site. The function lives at `functions/api/listing.js`, so Cloudflare Pages will expose it as `/api/listing`.

## Important token note

Etsy access tokens are short-lived (currently about 1 hour). This build uses the refresh token and caches the access token at the edge for about 50 minutes, keeping credentials server-side. The refresh token itself should remain a Cloudflare secret.

## Test

After deployment, open one product page and check the browser Network tab for a request similar to:

`/api/listing?listing_id=4516295013`

A successful response is JSON. If the API is not configured yet, the site keeps the static fallback content and the Etsy purchase button still works.

## Official Etsy references

Authentication: https://developers.etsy.com/documentation/essentials/authentication/
Listings and inventory: https://developers.etsy.com/documentation/tutorials/listings/
Third variation support: https://developers.etsy.com/documentation/tutorials/third-variation/

## Step 5C — OAuth authorization (already included in this build)

1. In Etsy Developers, add this exact Redirect URI to the app:
   `https://wildboneworkers.com/api/etsy/callback`
2. Make sure the app has the required seller/private access. Etsy's current OAuth flow requires Authorization Code + PKCE.
3. In Cloudflare Pages, add `ETSY_KEYSTRING` as a secret/variable.
4. Deploy this build and open `/connect-etsy/` on your domain.
5. Click **Connect Etsy account** and approve the requested `listings_r` and `shops_r` scopes.
6. Etsy redirects back to `/api/etsy/callback`; copy the returned refresh token into the Cloudflare Pages secret `ETSY_REFRESH_TOKEN`.
7. Make sure `ETSY_SHARED_SECRET` is also stored as a Cloudflare secret for the protected listing endpoint.
8. Test with `/api/etsy/listing?listing_id=4516295013`.

Do not leave the refresh token in page source, browser localStorage, GitHub, or screenshots. Etsy's current documentation states that OAuth access tokens last about one hour and refresh tokens are used to obtain new access tokens. The refresh response can also include a replacement refresh token, so for a production implementation the stored refresh token should be managed in server-side durable storage rather than hard-coded in source.


## Step 5D — Live product-page sync

After the Etsy OAuth connection is complete and the three Cloudflare secrets are set, the product pages automatically call:

`/api/listing?listing_id=<ETSY_LISTING_ID>`

The response is normalized for the storefront. The page updates the title, current price, Etsy purchase link, full description, complete image gallery, inventory/availability and up to three listing variations.

The endpoint is cached for a few minutes at the edge, which reduces repeated Etsy API calls while keeping the site lightweight.
