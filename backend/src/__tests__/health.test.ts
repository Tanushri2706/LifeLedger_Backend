import assert from 'node:assert';
import http from 'node:http';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { getHealth, HealthCheckData } from '../controllers/health.controller';
import { Request, Response } from 'express';
import { ApiResponse } from '../types';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('LIFELEDGER BACKEND: HEALTH ENDPOINT REGRESSION SUITE');
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

  // Save original readyState descriptor to restore after test suite
  const originalDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');

  function setMongooseReadyState(state: number) {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: state,
      configurable: true,
      writable: true
    });
  }

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ---------------------------------------------------------------------------
    // TEST GROUP 1: BASE HEALTH ENDPOINT (/health)
    // ---------------------------------------------------------------------------
    console.log('--- GROUP 1: Base Health Endpoint (/health) ---');

    await test('GET /health returns HTTP 200 with status "ok" when MongoDB is connected (readyState = 1)', async () => {
      setMongooseReadyState(1);

      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 200, 'HTTP status should be 200 when connected');
      
      const body = (await res.json()) as ApiResponse<HealthCheckData>;
      assert.strictEqual(body.success, true, 'Envelope success must be true');
      assert.strictEqual(body.message, 'LifeLedger API is healthy and operational');
      assert.ok(body.data, 'Response must contain data payload');
      assert.strictEqual(body.data?.status, 'ok', 'data.status must be "ok"');
      assert.strictEqual(body.data?.database, 'connected', 'data.database must be "connected"');
      assert.strictEqual(typeof body.data?.uptime, 'number', 'data.uptime must be a number');
      assert.ok(!isNaN(Date.parse(body.data?.timestamp || '')), 'data.timestamp must be a valid ISO string');
    });

    await test('GET /health returns HTTP 503 with status "degraded" when MongoDB is disconnected (readyState = 0)', async () => {
      setMongooseReadyState(0);

      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 503, 'HTTP status should be 503 when disconnected');

      const body = (await res.json()) as ApiResponse<HealthCheckData>;
      assert.strictEqual(body.success, false, 'Envelope success must be false for 503 degraded state');
      assert.strictEqual(body.message, 'LifeLedger API is operating in a degraded state: database is disconnected');
      assert.ok(body.data, 'Response must contain data payload with diagnostics');
      assert.strictEqual(body.data?.status, 'degraded', 'data.status must be "degraded"');
      assert.strictEqual(body.data?.database, 'disconnected', 'data.database must be "disconnected"');
      assert.strictEqual(typeof body.data?.uptime, 'number', 'data.uptime must be preserved as a number');
      assert.ok(!isNaN(Date.parse(body.data?.timestamp || '')), 'data.timestamp must be preserved as valid ISO string');
    });

    // ---------------------------------------------------------------------------
    // TEST GROUP 2: VERSIONED HEALTH ENDPOINT (/api/v1/health)
    // ---------------------------------------------------------------------------
    console.log('\n--- GROUP 2: Versioned Health Endpoint (/api/v1/health) ---');

    await test('GET /api/v1/health returns HTTP 200 when connected (shared controller mount)', async () => {
      setMongooseReadyState(1);

      const res = await fetch(`${baseUrl}/api/v1/health`);
      assert.strictEqual(res.status, 200, 'HTTP status should be 200 on /api/v1/health');

      const body = (await res.json()) as ApiResponse<HealthCheckData>;
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data?.status, 'ok');
      assert.strictEqual(body.data?.database, 'connected');
    });

    await test('GET /api/v1/health returns HTTP 503 when disconnected (shared controller mount)', async () => {
      setMongooseReadyState(0);

      const res = await fetch(`${baseUrl}/api/v1/health`);
      assert.strictEqual(res.status, 503, 'HTTP status should be 503 on /api/v1/health');

      const body = (await res.json()) as ApiResponse<HealthCheckData>;
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.data?.status, 'degraded');
      assert.strictEqual(body.data?.database, 'disconnected');
    });

    // ---------------------------------------------------------------------------
    // TEST GROUP 3: CONNECTION TRANSITION STATES
    // ---------------------------------------------------------------------------
    console.log('\n--- GROUP 3: Connection Transition Lifecycle States ---');

    await test('GET /health returns HTTP 503 during connecting state (readyState = 2)', async () => {
      setMongooseReadyState(2);

      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 503, 'Connecting state must be treated as unavailable (503)');
      const body = (await res.json()) as ApiResponse<HealthCheckData>;
      assert.strictEqual(body.data?.status, 'degraded');
      assert.strictEqual(body.data?.database, 'disconnected');
    });

    await test('GET /health returns HTTP 503 during disconnecting state (readyState = 3)', async () => {
      setMongooseReadyState(3);

      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 503, 'Disconnecting state must be treated as unavailable (503)');
      const body = (await res.json()) as ApiResponse<HealthCheckData>;
      assert.strictEqual(body.data?.status, 'degraded');
      assert.strictEqual(body.data?.database, 'disconnected');
    });

    await test('GET /health immediately transitions back to HTTP 200 upon reconnection (readyState = 1)', async () => {
      // First disconnected
      setMongooseReadyState(0);
      let res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 503);

      // Reconnects
      setMongooseReadyState(1);
      res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 200);
      const body = (await res.json()) as ApiResponse<HealthCheckData>;
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data?.status, 'ok');
      assert.strictEqual(body.data?.database, 'connected');
    });

    // ---------------------------------------------------------------------------
    // TEST GROUP 4: CONTROLLER UNIT BEHAVIOR
    // ---------------------------------------------------------------------------
    console.log('\n--- GROUP 4: Controller Unit Behavior ---');

    await test('getHealth controller directly executes and writes 200/503 responses to Express Response', () => {
      // 1. Connected state
      setMongooseReadyState(1);
      let capturedStatusCode = 0;
      let capturedPayload: any = null;

      const mockResConnected = {
        status(code: number) {
          capturedStatusCode = code;
          return this;
        },
        json(payload: any) {
          capturedPayload = payload;
          return this;
        }
      } as unknown as Response;

      getHealth({} as Request, mockResConnected);
      assert.strictEqual(capturedStatusCode, 200);
      assert.strictEqual(capturedPayload.success, true);
      assert.strictEqual(capturedPayload.data.status, 'ok');
      assert.strictEqual(capturedPayload.data.database, 'connected');

      // 2. Disconnected state
      setMongooseReadyState(0);
      capturedStatusCode = 0;
      capturedPayload = null;

      const mockResDisconnected = {
        status(code: number) {
          capturedStatusCode = code;
          return this;
        },
        json(payload: any) {
          capturedPayload = payload;
          return this;
        }
      } as unknown as Response;

      getHealth({} as Request, mockResDisconnected);
      assert.strictEqual(capturedStatusCode, 503);
      assert.strictEqual(capturedPayload.success, false);
      assert.strictEqual(capturedPayload.data.status, 'degraded');
      assert.strictEqual(capturedPayload.data.database, 'disconnected');
    });

  } finally {
    // Restore original property descriptor
    if (originalDescriptor) {
      Object.defineProperty(mongoose.connection, 'readyState', originalDescriptor);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${testsPassed} / ${testsTotal} TESTS PASSED`);
  console.log('===============================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Health test suite failed:', err);
  process.exit(1);
});
