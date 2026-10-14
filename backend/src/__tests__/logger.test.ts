import assert from 'node:assert';
import { sanitizeUrlForLogging, requestLogger } from '../middleware/logger.middleware';
import express, { Request, Response } from 'express';
import http from 'node:http';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('LIFELEDGER BACKEND: LOGGER SANITIZATION & REDACTION SUITE');
  console.log('===============================================================\n');

  let testsPassed = 0;
  let testsTotal = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    testsTotal++;
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      testsPassed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: QUERY PARAMETER SENSITIVE VALUE REDACTION
  // ---------------------------------------------------------------------------
  console.log('--- GROUP 1: Sensitive Query Parameter Redaction (Case-Insensitive) ---');

  const sensitiveQueryCases = [
    {
      input: '/api/v1/emergency/info?token=secret_emergency_token_123',
      expected: '/api/v1/emergency/info?token=[REDACTED]'
    },
    {
      input: '/api/v1/emergency/info?TOKEN=uppercase_token_value',
      expected: '/api/v1/emergency/info?TOKEN=[REDACTED]'
    },
    {
      input: '/api/v1/medical-shares/public/session/reports?sessionToken=secret_session_token_456',
      expected: '/api/v1/medical-shares/public/session/reports?sessionToken=[REDACTED]'
    },
    {
      input: '/api/v1/medical-shares/public/session/reports?SessionToken=secret_session_token_456',
      expected: '/api/v1/medical-shares/public/session/reports?SessionToken=[REDACTED]'
    },
    {
      input: '/api/v1/auth/verify?code=123456&otp=987654',
      expected: '/api/v1/auth/verify?code=[REDACTED]&otp=[REDACTED]'
    },
    {
      input: '/api/v1/external?apiKey=secret_key_abc&secret=my_secret_val&password=pass',
      expected: '/api/v1/external?apiKey=[REDACTED]&secret=[REDACTED]&password=[REDACTED]'
    }
  ];

  for (const tc of sensitiveQueryCases) {
    test(`Redacts sensitive parameter in "${tc.input}"`, () => {
      const result = sanitizeUrlForLogging(tc.input);
      assert.strictEqual(result, tc.expected);
    });
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: PUBLIC TOKEN PATH SEGMENT REDACTION
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 2: Token-Bearing Path Segment Redaction ---');

  const tokenPathCases = [
    {
      input: '/api/v1/public/medical-shares/c7b2a9d8e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9',
      expected: '/api/v1/public/medical-shares/[REDACTED]'
    },
    {
      input: '/api/v1/public/medical-shares/c7b2a9d8e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9/access',
      expected: '/api/v1/public/medical-shares/[REDACTED]/access'
    },
    {
      input: '/api/v1/medical-shares/public/c7b2a9d8e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9',
      expected: '/api/v1/medical-shares/public/[REDACTED]'
    },
    {
      input: '/api/v1/medical-shares/public/c7b2a9d8e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9/access',
      expected: '/api/v1/medical-shares/public/[REDACTED]/access'
    },
    {
      input: '/api/v1/emergency/info/e5f6a7b8c9d01234567890abcdef12345678',
      expected: '/api/v1/emergency/info/[REDACTED]'
    }
  ];

  for (const tc of tokenPathCases) {
    test(`Redacts path token in "${tc.input}"`, () => {
      const result = sanitizeUrlForLogging(tc.input);
      assert.strictEqual(result, tc.expected);
    });
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: PRESERVATION OF SAFE QUERY PARAMETERS & MIXED QUERIES
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 3: Preservation of Safe Query Parameters ---');

  test('Preserves pagination, coordinates, and filters without mutation', () => {
    const input = '/api/v1/hospitals?latitude=28.6139&longitude=77.2090&radiusKm=10&page=1&limit=20';
    const result = sanitizeUrlForLogging(input);
    assert.strictEqual(result, input);
  });

  test('Redacts sensitive token while preserving co-existing safe parameters', () => {
    const input = '/api/v1/medical-shares/public/session/reports?page=2&sessionToken=secret123&limit=20';
    const result = sanitizeUrlForLogging(input);
    assert.strictEqual(result, '/api/v1/medical-shares/public/session/reports?page=2&sessionToken=[REDACTED]&limit=20');
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: ORDINARY ROUTES AND NON-SENSITIVE IDS REMAIN INTACT
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 4: Non-Sensitive Routes & Resource IDs Intact ---');

  const nonSensitiveCases = [
    '/health',
    '/api/v1/health',
    '/api/v1/auth/profile',
    '/api/v1/reports/66ef1234567890abcdef1234',
    '/api/v1/reports/66ef1234567890abcdef1234/download',
    '/api/v1/doctors/66ef9876543210fedcba4321/slots',
    '/api/v1/emergency/contacts/66ef55555555555555555555',
    '/api/v1/medical-shares/public/session/reports',
    '/api/v1/medical-shares/public/session/reports/66ef12345/download',
    '/api/v1/public/medical-shares/session/reports'
  ];

  for (const path of nonSensitiveCases) {
    test(`Preserves non-sensitive route "${path}"`, () => {
      const result = sanitizeUrlForLogging(path);
      assert.strictEqual(result, path);
    });
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: MALFORMED URL AND EDGE CASE HANDLING
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 5: Fail-Safe Handling on Edge Cases & Malformed Inputs ---');

  test('Handles empty string and nullish inputs safely', () => {
    assert.strictEqual(sanitizeUrlForLogging(''), '/');
    assert.strictEqual(sanitizeUrlForLogging(null as any), '/');
    assert.strictEqual(sanitizeUrlForLogging(undefined as any), '/');
  });

  test('Handles URLs with empty query strings', () => {
    assert.strictEqual(sanitizeUrlForLogging('/api/v1/emergency/info?'), '/api/v1/emergency/info');
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 6: END-TO-END REQUEST LOGGER INTEGRATION
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 6: End-to-End Request Logger Middleware Integration ---');

  await new Promise<void>((resolve, reject) => {
    const app = express();

    // Capture console output during test
    let capturedLog = '';
    const originalConsoleLog = console.log;
    console.log = (msg: string) => {
      capturedLog = msg;
    };

    // Explicitly test requestLogger middleware
    app.use(requestLogger);
    app.get('/api/v1/emergency/info', (_req: Request, res: Response) => {
      res.status(200).json({ ok: true });
    });

    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', async () => {
      const address = server.address() as { port: number };
      try {
        await fetch(`http://127.0.0.1:${address.port}/api/v1/emergency/info?token=live_test_secret_123`);

        // Restore original console.log
        console.log = originalConsoleLog;

        test('requestLogger outputs sanitized log line to console', () => {
          assert.ok(capturedLog.includes('[HTTP] GET /api/v1/emergency/info?token=[REDACTED] 200'), `Log should contain redacted token, got: "${capturedLog}"`);
          assert.ok(!capturedLog.includes('live_test_secret_123'), 'Log must not contain raw secret token');
        });

        server.close(() => resolve());
      } catch (err) {
        console.log = originalConsoleLog;
        server.close(() => reject(err));
      }
    });
  });

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${testsPassed} / ${testsTotal} TESTS PASSED`);
  console.log('===============================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Logger test suite failed:', err);
  process.exit(1);
});
