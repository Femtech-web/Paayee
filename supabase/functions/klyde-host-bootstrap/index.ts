import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get('Authorization');

    if (!authorization) {
      return json({ error: 'Missing authorization header.' }, 401);
    }

    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');
    const assertionSecret = requireEnv('KLYDE_HOST_APP_ASSERTION_SECRET');
    const appId = Deno.env.get('KLYDE_APP_ID') ?? 'app_paayee_local';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return json({ error: 'Invalid Supabase session.' }, 401);
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      appId,
      email: data.user.email,
      exp: now + 60,
      iat: now,
      nonce: crypto.randomUUID(),
      sub: data.user.id,
    };
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = await sign(encodedPayload, assertionSecret);

    return json({ assertion: `${encodedPayload}.${signature}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create Klyde assertion.';

    return json({ error: message }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

function requireEnv(key: string): string {
  const value = Deno.env.get(key);

  if (!value) {
    throw new Error(`${key} is not configured.`);
  }

  return value;
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));

  return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
