import { z } from 'zod';
import webPush from 'web-push';

export interface Env {
  REMINDERS: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}

const MAX_BODY_BYTES = 4096;
// Après la réponse, Cloudflare n'accorde que 30 s d'exécution étendue
// (ctx.waitUntil). On garde une marge pour l'appel HTTPS au service de push.
const MAX_DELAY_SECONDS = 25;
// Un abonnement push devenu inutile (téléphone réinstallé, navigateur nettoyé)
// doit finir par disparaître : l'application le renouvelle à chaque démarrage.
const SUBSCRIPTION_TTL_SECONDS = 90 * 24 * 60 * 60;
// Seules ces origines peuvent appeler le service : l'application déployée sur
// GitHub Pages et la page de test servie en local.
const ALLOWED_ORIGINS: readonly string[] = ['http://localhost:5173', 'https://veynom007.github.io'];

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1024),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
  installationToken: z.string().regex(/^[0-9a-f]{64}$/, "jeton d'installation invalide"),
});

const testPushSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  body: z.string().min(1).max(200).optional(),
  delaySeconds: z.number().int().min(0).max(MAX_DELAY_SECONDS).optional(),
});

type BodyError = 'too-large' | 'invalid-json';

function isAllowedOrigin(origin: string | null): origin is string {
  return origin !== null && ALLOWED_ORIGINS.includes(origin);
}

/**
 * Les en-têtes CORS ne sont renvoyés que pour les origines autorisées : un
 * navigateur d'une autre origine ne peut ni déclencher ni lire la réponse.
 */
function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, x-installation-token',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
  if (isAllowedOrigin(origin)) {
    headers['access-control-allow-origin'] = origin;
  }
  return headers;
}

function json(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
    },
  });
}

function bodyErrorResponse(error: BodyError, origin: string | null): Response {
  if (error === 'too-large') {
    return json({ error: 'Corps de requête trop volumineux' }, 413, origin);
  }
  return json({ error: 'Corps de requête invalide' }, 400, origin);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Lit un corps JSON en refusant d'emblée les requêtes trop volumineuses
 * (4 ko maximum, en octets et non en caractères).
 */
async function readJsonBody(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; error: BodyError }> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isFinite(length) || length > MAX_BODY_BYTES) {
      return { ok: false, error: 'too-large' };
    }
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { ok: false, error: 'too-large' };
  }
  if (text.trim().length === 0) return { ok: true, data: {} };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
}

async function sendPush(
  env: Env,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string },
): Promise<number> {
  const result = await webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    },
    JSON.stringify(payload),
    {
      vapidDetails: {
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
      },
      TTL: 120,
      urgency: 'high',
    },
  );
  return result.statusCode;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

/**
 * Envoi différé : permet de fermer l'application (ou le navigateur) juste après
 * l'appel HTTP, la notification partant plus tard. L'exécution étendue
 * (ctx.waitUntil) est plafonnée à 30 s par Cloudflare, d'où MAX_DELAY_SECONDS.
 */
async function schedulePush(
  env: Env,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { title: string; body: string },
  delaySeconds: number,
): Promise<void> {
  await sleep(delaySeconds * 1000);
  try {
    await sendPush(env, subscription, payload);
  } catch {
    console.error('Envoi différé de la notification impossible.');
  }
}

async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  origin: string | null,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method === 'GET' && url.pathname === '/v1/vapid-public-key') {
    return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, origin);
  }

  if (request.method === 'POST' && url.pathname === '/v1/subscribe') {
    const body = await readJsonBody(request);
    if (!body.ok) return bodyErrorResponse(body.error, origin);
    const parsed = pushSubscriptionSchema.safeParse(body.data);
    if (!parsed.success) return json({ error: 'Requête invalide' }, 400, origin);
    const key = `sub:${await sha256Hex(parsed.data.installationToken)}`;
    await env.REMINDERS.put(
      key,
      JSON.stringify({ endpoint: parsed.data.endpoint, keys: parsed.data.keys }),
      { expirationTtl: SUBSCRIPTION_TTL_SECONDS },
    );
    return json({ ok: true }, 200, origin);
  }

  if (request.method === 'DELETE' && url.pathname === '/v1/subscribe') {
    const token = request.headers.get('x-installation-token');
    if (token === null || !/^[0-9a-f]{64}$/.test(token)) {
      return json({ error: "Jeton d'installation manquant" }, 401, origin);
    }
    await env.REMINDERS.delete(`sub:${await sha256Hex(token)}`);
    return json({ ok: true }, 200, origin);
  }

  if (request.method === 'POST' && url.pathname === '/v1/test-push') {
    const token = request.headers.get('x-installation-token');
    if (token === null || !/^[0-9a-f]{64}$/.test(token)) {
      return json({ error: "Jeton d'installation manquant" }, 401, origin);
    }
    const stored = await env.REMINDERS.get<{
      endpoint: string;
      keys: { p256dh: string; auth: string };
    }>(`sub:${await sha256Hex(token)}`, 'json');
    if (stored === null) return json({ error: 'Installation non enregistrée' }, 404, origin);

    const body = await readJsonBody(request);
    if (!body.ok) return bodyErrorResponse(body.error, origin);
    const parsed = testPushSchema.safeParse(body.data);
    if (!parsed.success) return json({ error: 'Corps de requête invalide' }, 400, origin);

    const payload = {
      title: parsed.data.title ?? 'Test Planificateur',
      body: parsed.data.body ?? 'Les rappels fonctionnent.',
    };
    const delaySeconds = parsed.data.delaySeconds ?? 0;

    if (delaySeconds > 0) {
      ctx.waitUntil(schedulePush(env, stored, payload, delaySeconds));
      return json({ ok: true, scheduled: true, delaySeconds }, 202, origin);
    }

    try {
      const status = await sendPush(env, stored, payload);
      return json({ ok: true, status }, 200, origin);
    } catch {
      return json({ error: 'Échec de l’envoi de la notification' }, 502, origin);
    }
  }

  return json({ error: 'Introuvable' }, 404, origin);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('origin');
    // Origine présente mais non autorisée : refus explicite, sans en-tête CORS.
    if (origin !== null && !isAllowedOrigin(origin)) {
      return json({ error: 'Origine non autorisée' }, 403, origin);
    }
    try {
      return await handleRequest(request, env, ctx, origin);
    } catch {
      // Jamais de détail interne au client (secure error handling).
      return json({ error: 'Erreur interne' }, 500, origin);
    }
  },
  // Planification des rappels des 14 prochains jours : implémentée au jalon J6.
  async scheduled(): Promise<void> {
    // Rien à faire tant que le planning n'est pas envoyé par l'application.
  },
} satisfies ExportedHandler<Env>;
