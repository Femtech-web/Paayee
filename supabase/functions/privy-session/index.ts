import { PrivyClient } from 'npm:@privy-io/node@0.28.0';
import { SignJWT } from 'npm:jose@6.1.3';

const corsHeaders = {
  'access-control-allow-headers': 'authorization, apikey, content-type',
  'access-control-allow-origin': '*',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const appId = requireSecret('PRIVY_APP_ID');
    const appSecret = requireSecret('PRIVY_APP_SECRET');
    const jwtSecret = requireSecret('PAAYEE_SUPABASE_JWT_SECRET');
    const authorization = request.headers.get('authorization');
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!accessToken) {
      return json({ error: 'Missing Privy access token.' }, 401);
    }

    const privy = new PrivyClient({ appId, appSecret });
    const verified = await privy.utils().auth().verifyAccessToken(accessToken);
    const expiresIn = 600;
    const databaseToken = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(verified.user_id)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(new TextEncoder().encode(jwtSecret));

    return json({ accessToken: databaseToken, expiresIn });
  } catch (error) {
    console.error('[paayee.privy_session]', error instanceof Error ? error.message : error);
    return json({ error: 'Your Paayee session could not be verified.' }, 401);
  }
});

function requireSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
