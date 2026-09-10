function base64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomString(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64url(data);
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64url(new Uint8Array(digest));
}

export async function onRequestGet(context) {
  const env = context.env;
  if (!env.ETSY_KEYSTRING) {
    return new Response('Missing ETSY_KEYSTRING Cloudflare secret.', { status: 500 });
  }

  const origin = new URL(context.request.url).origin;
  const redirectUri = `${origin}/api/etsy/callback`;
  const state = randomString(32);
  const verifier = randomString(48);
  const challenge = await sha256Base64Url(verifier);

  const scope = 'listings_r shops_r';
  const authUrl = new URL('https://www.etsy.com/oauth/connect');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', env.ETSY_KEYSTRING);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const cookie = `etsy_oauth=${encodeURIComponent(JSON.stringify({ state, verifier, redirectUri }))}; Path=/api/etsy; Max-Age=600; HttpOnly; Secure; SameSite=Lax`;
  return new Response(null, {
    status: 302,
    headers: { Location: authUrl.toString(), 'Set-Cookie': cookie },
  });
}
