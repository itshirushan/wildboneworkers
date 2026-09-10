function readCookie(header, name) {
  if (!header) return null;
  const parts = header.split(';').map(v => v.trim());
  const prefix = `${name}=`;
  const part = parts.find(v => v.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : null;
}

function html(body, status = 200) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Etsy Connection</title><style>body{font-family:Georgia,serif;background:#f4ead8;color:#3d291d;margin:0;padding:40px}.card{max-width:760px;margin:auto;background:#fffaf1;padding:32px;border:1px solid #d8c6a8;box-shadow:0 8px 24px #0001}code,pre{word-break:break-all;background:#f0e5d3;padding:10px;border-radius:4px}a{color:#7a4b24}</style></head><body><main class="card">${body}</main></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function onRequestGet(context) {
  const env = context.env;
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const cookieValue = readCookie(context.request.headers.get('Cookie'), 'etsy_oauth');

  if (error) return html(`<h1>Etsy authorization was not completed</h1><p>${error}</p><p>${url.searchParams.get('error_description') || ''}</p>`, 400);
  if (!code || !state || !cookieValue) return html('<h1>OAuth callback is missing required data.</h1><p>Start the connection again.</p>', 400);

  let stored;
  try { stored = JSON.parse(cookieValue); } catch { return html('<h1>Invalid OAuth session.</h1><p>Start the connection again.</p>', 400); }
  if (stored.state !== state) return html('<h1>OAuth state validation failed.</h1><p>Please restart the connection.</p>', 400);

  if (!env.ETSY_KEYSTRING) return html('<h1>Missing Etsy API key</h1><p>Add ETSY_KEYSTRING in Cloudflare Pages Variables and Secrets.</p>', 500);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.ETSY_KEYSTRING,
    redirect_uri: stored.redirectUri,
    code,
    code_verifier: stored.verifier,
  });

  const response = await fetch('https://api.etsy.com/v3/public/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payloadText = await response.text();
  if (!response.ok) return html(`<h1>Etsy token exchange failed</h1><pre>${payloadText.slice(0, 2000)}</pre>`, 502);

  let token;
  try { token = JSON.parse(payloadText); } catch { return html('<h1>Invalid Etsy response.</h1>', 502); }
  if (!token.refresh_token || !token.access_token) return html('<h1>Etsy did not return the expected tokens.</h1>', 502);

  const safeRefresh = token.refresh_token.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return html(`<h1>Etsy connected successfully</h1><p>Copy the refresh token below into the Cloudflare Pages secret named <strong>ETSY_REFRESH_TOKEN</strong>. Do not put it in GitHub or frontend JavaScript.</p><pre>${safeRefresh}</pre><p><strong>Granted scope:</strong> ${(token.scope || '').replace(/</g,'&lt;')}</p><p><strong>Next:</strong> save the token as a secret, then open <a href="/api/etsy/listing?listing_id=4516295013">the Etsy API test</a>.</p>`, 200);
}
