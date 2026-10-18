import { z } from 'zod';
import webPush from 'web-push';

interface Env {
  REMINDERS: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}

const MAX_BODY = 4096;

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
});

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, x-installation-token',
} as const;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function readBody(request: Request): Promise<z.infer<typeof pushSubscriptionSchema> | null> {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    return pushSubscriptionSchema.parse(JSON.parse(text));
  } catch {
    return null;
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

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  if (request.method === 'GET' && url.pathname === '/v1/vapid-public-key') {
    return json({ publicKey: env.VAPID_PUBLIC_KEY });
  }

  if (request.method === 'POST' && url.pathname === '/v1/subscribe') {
    const body = await readBody(request);
    if (body === null) return json({ error: 'Requête invalide' }, 400);
    const key = `sub:${await sha256Hex(body.installationToken)}`;
    await env.REMINDERS.put(key, JSON.stringify({ endpoint: body.endpoint, keys: body.keys }));
    return json({ ok: true });
  }

  if (request.method === 'DELETE' && url.pathname === '/v1/subscribe') {
    const token = request.headers.get('x-installation-token');
    if (token === null || !/^[0-9a-f]{64}$/.test(token)) {
      return json({ error: "Jeton d'installation manquant" }, 401);
    }
    await env.REMINDERS.delete(`sub:${await sha256Hex(token)}`);
    return json({ ok: true });
  }

  if (request.method === 'POST' && url.pathname === '/v1/test-push') {
    const token = request.headers.get('x-installation-token');
    if (token === null || !/^[0-9a-f]{64}$/.test(token)) {
      return json({ error: "Jeton d'installation manquant" }, 401);
    }
    const stored = await env.REMINDERS.get<{
      endpoint: string;
      keys: { p256dh: string; auth: string };
    }>(`sub:${await sha256Hex(token)}`, 'json');
    if (stored === null) return json({ error: 'Installation non enregistrée' }, 404);

    let payload = { title: 'Test Planificateur', body: 'Les rappels fonctionnent.' };
    const text = await request.text();
    if (text.length > 0 && text.length <= MAX_BODY) {
      try {
        const parsed = testPushSchema.partial().parse(JSON.parse(text));
        payload = { title: parsed.title ?? payload.title, body: parsed.body ?? payload.body };
      } catch {
        return json({ error: 'Corps de requête invalide' }, 400);
      }
    }

    try {
      const status = await sendPush(env, stored, payload);
      return json({ ok: true, status });
    } catch {
      return json({ error: 'Échec de l’envoi de la notification' }, 502);
    }
  }

  return json({ error: 'Introuvable' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch {
      // Jamais de détail interne au client (secure error handling).
      return json({ error: 'Erreur interne' }, 500);
    }
  },
  // Planification des rappels des 14 prochains jours : implémentée au jalon J6.
  async scheduled(): Promise<void> {
    // Rien à faire tant que le planning n'est pas envoyé par l'application.
  },
} satisfies ExportedHandler<Env>;
