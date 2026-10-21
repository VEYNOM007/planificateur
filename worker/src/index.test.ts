import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendNotification = vi.hoisted(() => vi.fn(async () => ({ statusCode: 201 })));

vi.mock('web-push', () => ({
  default: { sendNotification },
}));

import worker, { type Env } from './index';

const TOKEN = 'a'.repeat(64);
const ALLOWED_ORIGIN = 'http://localhost:5173';
const SUBSCRIPTION = {
  endpoint: 'https://push.example.com/endpoint',
  keys: { p256dh: 'key-p256dh', auth: 'key-auth' },
};
const SUBSCRIPTION_TTL_SECONDS = 90 * 24 * 60 * 60;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

class FakeKV {
  private readonly store = new Map<string, string>();
  readonly putOptions = new Map<string, { expirationTtl?: number }>();

  async get(key: string, type?: string): Promise<unknown> {
    const value = this.store.get(key) ?? null;
    if (value === null) return null;
    return type === 'json' ? JSON.parse(value) : value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
    this.putOptions.set(key, options ?? {});
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

async function seedKv(): Promise<FakeKV> {
  const kv = new FakeKV();
  await kv.put(`sub:${await sha256Hex(TOKEN)}`, JSON.stringify(SUBSCRIPTION));
  return kv;
}

function createEnv(kv: FakeKV): Env {
  return {
    REMINDERS: kv as unknown as KVNamespace,
    VAPID_PUBLIC_KEY: 'public-key',
    VAPID_PRIVATE_KEY: 'private-key',
    VAPID_SUBJECT: 'https://github.com/VEYNOM007/planificateur',
  };
}

function createContext(): { ctx: ExecutionContext; pending: Promise<unknown>[] } {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise);
    },
    passThroughOnException() {},
  } as unknown as ExecutionContext;
  return { ctx, pending };
}

function request(path: string, init: RequestInit & { origin?: string } = {}): Request {
  const headers = new Headers(init.headers);
  if (init.origin !== undefined) headers.set('origin', init.origin);
  return new Request(`https://worker.test${path}`, { ...init, headers });
}

function testPushRequest(body: unknown, token: string | null = TOKEN): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (token !== null) headers.set('x-installation-token', token);
  return new Request('https://worker.test/v1/test-push', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('CORS', () => {
  it('répond au préflight OPTIONS pour une origine autorisée', async () => {
    const { ctx } = createContext();
    const response = await worker.fetch(
      request('/v1/test-push', { method: 'OPTIONS', origin: ALLOWED_ORIGIN }),
      createEnv(new FakeKV()),
      ctx,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get('access-control-allow-headers')).toContain('x-installation-token');
    expect(response.headers.get('access-control-allow-headers')).toContain('content-type');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it("accepte l'origine GitHub Pages", async () => {
    const { ctx } = createContext();
    const response = await worker.fetch(
      request('/v1/vapid-public-key', { origin: 'https://veynom007.github.io' }),
      createEnv(new FakeKV()),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://veynom007.github.io');
  });

  it('refuse une origine non autorisée', async () => {
    const { ctx } = createContext();
    const response = await worker.fetch(
      request('/v1/vapid-public-key', { origin: 'https://attaquant.example' }),
      createEnv(new FakeKV()),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('accepte une requête sans origine (client hors navigateur)', async () => {
    const { ctx } = createContext();
    const response = await worker.fetch(
      request('/v1/vapid-public-key'),
      createEnv(new FakeKV()),
      ctx,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('POST /v1/subscribe', () => {
  it("enregistre l'abonnement avec une expiration", async () => {
    const kv = new FakeKV();
    const { ctx } = createContext();

    const response = await worker.fetch(
      request('/v1/subscribe', {
        method: 'POST',
        origin: ALLOWED_ORIGIN,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...SUBSCRIPTION, installationToken: TOKEN }),
      }),
      createEnv(kv),
      ctx,
    );

    expect(response.status).toBe(200);
    const options = kv.putOptions.get(`sub:${await sha256Hex(TOKEN)}`);
    expect(options?.expirationTtl).toBe(SUBSCRIPTION_TTL_SECONDS);
  });

  it('refuse un corps trop volumineux', async () => {
    const { ctx } = createContext();
    const response = await worker.fetch(
      request('/v1/subscribe', {
        method: 'POST',
        origin: ALLOWED_ORIGIN,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...SUBSCRIPTION,
          installationToken: TOKEN,
          padding: 'x'.repeat(5000),
        }),
      }),
      createEnv(new FakeKV()),
      ctx,
    );

    expect(response.status).toBe(413);
  });

  it("refuse un corps qui n'est pas du JSON", async () => {
    const { ctx } = createContext();
    const response = await worker.fetch(
      request('/v1/subscribe', {
        method: 'POST',
        origin: ALLOWED_ORIGIN,
        headers: { 'content-type': 'application/json' },
        body: 'pas-du-json',
      }),
      createEnv(new FakeKV()),
      ctx,
    );

    expect(response.status).toBe(400);
  });
});

describe('POST /v1/test-push', () => {
  beforeEach(() => {
    sendNotification.mockClear();
  });

  it('envoie immédiatement la notification quand aucun délai est demandé', async () => {
    const env = createEnv(await seedKv());
    const { ctx } = createContext();

    const response = await worker.fetch(
      testPushRequest({ title: 'Planificateur', body: 'Test' }),
      env,
      ctx,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: 201 });
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("diffère l'envoi et répond 202 sans envoyer tout de suite", async () => {
    vi.useFakeTimers();
    try {
      const env = createEnv(await seedKv());
      const { ctx, pending } = createContext();

      const response = await worker.fetch(
        testPushRequest({ title: 'Planificateur', body: 'Test', delaySeconds: 15 }),
        env,
        ctx,
      );

      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        scheduled: true,
        delaySeconds: 15,
      });
      expect(pending).toHaveLength(1);
      expect(sendNotification).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(15_000);
      await Promise.all(pending);

      expect(sendNotification).toHaveBeenCalledTimes(1);
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ endpoint: SUBSCRIPTION.endpoint }),
        expect.any(String),
        expect.objectContaining({ TTL: 120 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuse un délai hors limites', async () => {
    const env = createEnv(await seedKv());
    const { ctx } = createContext();

    const response = await worker.fetch(testPushRequest({ delaySeconds: 99 }), env, ctx);

    expect(response.status).toBe(400);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('refuse un corps trop volumineux', async () => {
    const env = createEnv(await seedKv());
    const { ctx } = createContext();

    const response = await worker.fetch(testPushRequest({ title: 'x'.repeat(5000) }), env, ctx);

    expect(response.status).toBe(413);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("exige le jeton d'installation", async () => {
    const env = createEnv(await seedKv());
    const { ctx } = createContext();

    const response = await worker.fetch(testPushRequest({}, null), env, ctx);

    expect(response.status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('refuse une installation inconnue', async () => {
    const env = createEnv(new FakeKV());
    const { ctx } = createContext();

    const response = await worker.fetch(testPushRequest({}), env, ctx);

    expect(response.status).toBe(404);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
