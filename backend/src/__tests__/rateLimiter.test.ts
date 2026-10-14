import assert from 'node:assert';
import express, { Request, Response } from 'express';
import http from 'node:http';
import { createRateLimiter } from '../middleware/rateLimiter.middleware';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('LIFELEDGER BACKEND: RATE LIMITER & IP HANDLING REGRESSION SUITE');
  console.log('===============================================================\n');

  let testsPassed = 0;
  let testsTotal = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    testsTotal++;
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      testsPassed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: IP SPOOFING RESISTANCE BEHIND REVERSE PROXY
  // ---------------------------------------------------------------------------
  console.log('--- GROUP 1: Spoofed X-Forwarded-For Header Resistance Behind Proxy ---');

  await test('Rate limiter keys on Express resolved req.ip and blocks spoofed header rotations', async () => {
    const app = express();
    // In production behind 1 reverse proxy (e.g. Render/Railway), trust proxy is 1
    app.set('trust proxy', 1);

    const testLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      limit: 5,
      message: 'Rate limit exceeded'
    });

    app.get('/test-limit', testLimiter, (req: Request, res: Response) => {
      res.status(200).json({ success: true, clientIp: req.ip });
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };
    const port = address.port;

    try {
      const realClientIp = '192.0.2.100';

      // An attacker attempts to bypass rate limits by sending different spoofed prefixes.
      // The upstream reverse proxy appends the real socket IP at the end of X-Forwarded-For:
      // "spoofed_ip_1, 192.0.2.100", "spoofed_ip_2, 192.0.2.100", etc.
      for (let i = 1; i <= 5; i++) {
        const response = await fetch(`http://127.0.0.1:${port}/test-limit`, {
          headers: {
            'X-Forwarded-For': `10.0.0.${i}, ${realClientIp}`
          }
        });
        assert.strictEqual(response.status, 200, `Request ${i} should succeed (200)`);
        const data = (await response.json()) as { clientIp?: string };
        assert.strictEqual(data.clientIp, realClientIp, 'Express should resolve req.ip to the verified client IP');
      }

      // 6th request with another spoofed prefix must be BLOCKED (429) because req.ip is 192.0.2.100
      const blockedResponse = await fetch(`http://127.0.0.1:${port}/test-limit`, {
        headers: {
          'X-Forwarded-For': `10.0.0.99, ${realClientIp}`
        }
      });
      assert.strictEqual(blockedResponse.status, 429, 'Request 6 must be blocked with HTTP 429 despite rotated spoofed prefix');
      
      const body = (await blockedResponse.json()) as { success?: boolean; message?: string };
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.message, 'Rate limit exceeded');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: INDEPENDENT CLIENT IP ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 2: Independent Client IP Isolation ---');

  await test('Different legitimate client IPs receive independent rate-limit buckets', async () => {
    const app = express();
    app.set('trust proxy', 1);

    const testLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      limit: 3,
      message: 'Rate limit exceeded'
    });

    app.get('/test-isolation', testLimiter, (req: Request, res: Response) => {
      res.status(200).json({ success: true, ip: req.ip });
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };
    const port = address.port;

    try {
      const clientA = '198.51.100.1';
      const clientB = '198.51.100.2';

      // Exhaust rate limit for Client A (3 requests)
      for (let i = 0; i < 3; i++) {
        const resA = await fetch(`http://127.0.0.1:${port}/test-isolation`, {
          headers: { 'X-Forwarded-For': clientA }
        });
        assert.strictEqual(resA.status, 200);
      }

      // 4th request from Client A should be blocked
      const blockedA = await fetch(`http://127.0.0.1:${port}/test-isolation`, {
        headers: { 'X-Forwarded-For': clientA }
      });
      assert.strictEqual(blockedA.status, 429, 'Client A should be rate limited');

      // Request from Client B should SUCCEED (independent bucket)
      const resB = await fetch(`http://127.0.0.1:${port}/test-isolation`, {
        headers: { 'X-Forwarded-For': clientB }
      });
      assert.strictEqual(resB.status, 200, 'Client B should have independent bucket and succeed');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: RFC DRAFT-7 STANDARD HEADERS
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 3: RateLimit Standard Headers ---');

  await test('Rate limiter provides RFC draft-7 RateLimit headers', async () => {
    const app = express();
    app.set('trust proxy', 1);

    const testLimiter = createRateLimiter({
      windowMs: 60 * 1000,
      limit: 10
    });

    app.get('/test-headers', testLimiter, (_req: Request, res: Response) => {
      res.status(200).json({ success: true });
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };
    const port = address.port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/test-headers`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers.has('ratelimit-policy') || res.headers.has('ratelimit'), 'Must contain standard draft-7 RateLimit header');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${testsPassed} / ${testsTotal} TESTS PASSED`);
  console.log('===============================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Rate limiter test suite failed:', err);
  process.exit(1);
});
