import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN_SUFFIXES = [
  '.lovable.app',
  '.lovableproject.com',
  '.lovable.dev',
];

const ALLOWED_ORIGIN_EXACT = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
];

const BASE_HEADERS =
  'authorization, x-client-info, apikey, content-type, x-internal-token, x-webhook-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version';

function extraAllowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGIN_EXACT.includes(origin)) return true;
  if (extraAllowedOrigins().includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_ORIGIN_SUFFIXES.some((s) => host.endsWith(s));
  } catch {
    return false;
  }
}

/**
 * CORS headers restricted to the app's own origins.
 * Server-to-server callers (no Origin header) are unaffected by CORS.
 */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const allowed = isAllowedOrigin(origin) ? origin! : 'null';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': BASE_HEADERS,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
    status,
  });
}

/** Generic client-facing error; details stay in server logs only. */
export function errorResponse(
  req: Request,
  context: string,
  detail: unknown,
  status = 500,
  publicMessage = 'Request could not be completed',
): Response {
  console.error(`[${context}]`, detail instanceof Error ? detail.message : detail);
  return jsonResponse(req, { success: false, error: publicMessage }, status);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies a shared secret provided via header or query string.
 * Returns false when the secret is not configured (fail closed).
 */
export function hasValidSharedSecret(req: Request, secretEnvName: string): boolean {
  const expected = Deno.env.get(secretEnvName);
  if (!expected) {
    console.error(`[security] ${secretEnvName} is not configured; rejecting request`);
    return false;
  }
  const url = new URL(req.url);
  const provided =
    req.headers.get('x-internal-token') ??
    req.headers.get('x-webhook-secret') ??
    req.headers.get('x-telegram-bot-api-secret-token') ??
    url.searchParams.get('token') ??
    '';
  return provided.length > 0 && timingSafeEqual(provided, expected);
}

export interface AuthedUser {
  id: string;
  email?: string;
  roles: string[];
}

/** Validates the caller's Supabase JWT and loads their roles. Returns null when unauthenticated. */
export async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: roleRows } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', data.user.id);

  return {
    id: data.user.id,
    email: data.user.email ?? undefined,
    roles: (roleRows ?? []).map((r: { role: string }) => r.role),
  };
}

/**
 * Allows either an authenticated app user or a trusted server-side caller
 * presenting the internal shared secret (cron jobs, integrations).
 */
export async function requireUserOrInternalSecret(
  req: Request,
  secretEnvName = 'INTERNAL_FUNCTION_SECRET',
): Promise<{ user: AuthedUser | null; internal: boolean } | null> {
  if (hasValidSharedSecret(req, secretEnvName)) {
    return { user: null, internal: true };
  }
  const user = await getAuthedUser(req);
  if (user) return { user, internal: false };
  return null;
}

export function unauthorized(req: Request): Response {
  return jsonResponse(req, { success: false, error: 'Unauthorized' }, 401);
}

/** Verifies Facebook's X-Hub-Signature-256 header against FACEBOOK_APP_SECRET. */
export async function verifyFacebookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
  if (!appSecret) {
    console.error('[security] FACEBOOK_APP_SECRET not configured; rejecting webhook');
    return false;
  }
  if (!signatureHeader?.startsWith('sha256=')) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)),
  );
  const expected = Array.from(sigBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(signatureHeader.slice('sha256='.length), expected);
}
