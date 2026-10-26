import assert from 'node:assert';
import http from 'node:http';
import express, { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { aiRateLimiter } from '../middleware/rateLimiter.middleware';
import { aiHealthAnalysisService } from '../services/aiAnalysis.service';
import { MedicalReport } from '../models/medicalReport.model';
import { ProcessingStatus, UserRole } from '../types';
import { AppError } from '../utils';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('LIFELEDGER BACKEND: AI RATE LIMITER & CONCURRENCY GUARD SUITE');
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
  // TEST GROUP 1: AI RATE LIMITER PER-USER QUOTA & 429 ENFORCEMENT
  // ---------------------------------------------------------------------------
  console.log('--- GROUP 1: AI Rate Limiter Enforcement (15 req / 15 min) ---');

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  // Middleware simulating authentication based on custom header for testing
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const testUserId = req.headers['x-test-user-id'] as string;
    if (testUserId) {
      req.user = {
        id: testUserId,
        email: `${testUserId}@example.com`,
        role: UserRole.PATIENT,
        isVerified: true
      };
    }
    next();
  });

  // Mount aiRateLimiter across multiple simulated AI routes
  app.post('/api/v1/ai/analyze', aiRateLimiter, (req: Request, res: Response) => {
    res.status(200).json({ success: true, route: '/api/v1/ai/analyze', force: req.body?.forceReanalyze });
  });

  app.get('/api/v1/health-intelligence', aiRateLimiter, (req: Request, res: Response) => {
    res.status(200).json({ success: true, route: '/api/v1/health-intelligence', refresh: req.query.refresh });
  });

  app.post('/api/v1/reports/:id/analyze', aiRateLimiter, (_req: Request, res: Response) => {
    res.status(200).json({ success: true, route: '/api/v1/reports/:id/analyze' });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await test('Authenticated user can make exactly 15 requests and 16th is blocked with 429', async () => {
      const userId = 'user_quota_test_1';

      // 15 requests should all succeed with HTTP 200
      for (let i = 1; i <= 15; i++) {
        const res = await fetch(`${baseUrl}/api/v1/ai/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-user-id': userId
          },
          body: JSON.stringify({ reportId: 'dummy_id' })
        });
        assert.strictEqual(res.status, 200, `Request ${i} must succeed (200)`);
      }

      // 16th request must be blocked with HTTP 429
      const blockedRes = await fetch(`${baseUrl}/api/v1/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-user-id': userId
        },
        body: JSON.stringify({ reportId: 'dummy_id' })
      });
      assert.strictEqual(blockedRes.status, 429, '16th request must be rate limited with HTTP 429');
      const data = (await blockedRes.json()) as { success: boolean; message: string };
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.message, 'AI Health Intelligence rate limit exceeded. Please try again after 15 minutes.');
    });

    // ---------------------------------------------------------------------------
    // TEST GROUP 2: SHARED QUOTA ACROSS DIFFERENT AI ROUTES
    // ---------------------------------------------------------------------------
    console.log('\n--- GROUP 2: Shared Quota Across Multiple AI Routes ---');

    await test('Multiple AI routes share the same user quota pool', async () => {
      const userId = 'user_shared_routes_test';

      // Make 8 requests to /api/v1/ai/analyze
      for (let i = 1; i <= 8; i++) {
        const res = await fetch(`${baseUrl}/api/v1/ai/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-test-user-id': userId },
          body: JSON.stringify({ reportId: 'dummy_id' })
        });
        assert.strictEqual(res.status, 200);
      }

      // Make 7 requests to /api/v1/health-intelligence (bringing total to 15)
      for (let i = 1; i <= 7; i++) {
        const res = await fetch(`${baseUrl}/api/v1/health-intelligence`, {
          headers: { 'x-test-user-id': userId }
        });
        assert.strictEqual(res.status, 200);
      }

      // 16th request across ANY AI route (e.g., /api/v1/reports/:id/analyze) must be blocked
      const blockedRes = await fetch(`${baseUrl}/api/v1/reports/123/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-user-id': userId }
      });
      assert.strictEqual(blockedRes.status, 429, 'Must be blocked because shared pool is exhausted');
    });

    // ---------------------------------------------------------------------------
    // TEST GROUP 3: INDEPENDENT USER QUOTAS ON SAME SHARED IP
    // ---------------------------------------------------------------------------
    console.log('\n--- GROUP 3: User-Keyed Quota Isolation on Same IP ---');

    await test('Two authenticated users on the same IP receive independent AI quotas', async () => {
      const userAlpha = 'user_alpha_same_ip';
      const userBeta = 'user_beta_same_ip';
      const sharedIp = '198.51.100.77';

      // Exhaust quota for userAlpha (15 requests)
      for (let i = 1; i <= 15; i++) {
        const res = await fetch(`${baseUrl}/api/v1/ai/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': sharedIp,
            'x-test-user-id': userAlpha
          },
          body: JSON.stringify({ reportId: 'dummy_id' })
        });
        assert.strictEqual(res.status, 200);
      }

      // User Alpha request 16 is blocked
      const blockedAlpha = await fetch(`${baseUrl}/api/v1/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': sharedIp,
          'x-test-user-id': userAlpha
        },
        body: JSON.stringify({ reportId: 'dummy_id' })
      });
      assert.strictEqual(blockedAlpha.status, 429, 'User Alpha must be blocked');

      // User Beta on the EXACT SAME IP must SUCCEED with HTTP 200
      const resBeta = await fetch(`${baseUrl}/api/v1/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': sharedIp,
          'x-test-user-id': userBeta
        },
        body: JSON.stringify({ reportId: 'dummy_id' })
      });
      assert.strictEqual(resBeta.status, 200, 'User Beta must not be blocked by User Alpha quota on same IP');
    });

    // ---------------------------------------------------------------------------
    // TEST GROUP 4: CACHE BYPASS REQUESTS COUNT AGAINST RATE LIMIT
    // ---------------------------------------------------------------------------
    console.log('\n--- GROUP 4: Cache-Bypass Parameter Handling Under Rate Limiter ---');

    await test('Requests with forceReanalyze: true consume rate-limit quota and are blocked at limit', async () => {
      const userId = 'user_cache_bypass_test';

      // Send 15 requests with forceReanalyze: true
      for (let i = 1; i <= 15; i++) {
        const res = await fetch(`${baseUrl}/api/v1/ai/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-test-user-id': userId },
          body: JSON.stringify({ reportId: 'dummy_id', forceReanalyze: true })
        });
        assert.strictEqual(res.status, 200);
      }

      // 16th request with forceReanalyze: true must be blocked with 429
      const blockedRes = await fetch(`${baseUrl}/api/v1/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-user-id': userId },
        body: JSON.stringify({ reportId: 'dummy_id', forceReanalyze: true })
      });
      assert.strictEqual(blockedRes.status, 429, 'Bypass request must be blocked when quota is exhausted');
    });

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // ---------------------------------------------------------------------------
  // TEST GROUP 5: CONCURRENT IN-FLIGHT REPORT PROCESSING GUARD
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 5: Concurrent Processing Guard in AIHealthAnalysisService ---');

  const testUserId = new Types.ObjectId().toString();
  const testReportId = new Types.ObjectId().toString();

  await test('forceReanalyze: true cannot bypass guard when report is actively PROCESSING', async () => {
    const originalFindOne = MedicalReport.findOne;

    try {
      // Mock MedicalReport.findOne to return a document currently in PROCESSING state within 60s
      MedicalReport.findOne = ((_query: any) => {
        return Promise.resolve({
          _id: new Types.ObjectId(testReportId),
          ownerUserId: new Types.ObjectId(testUserId),
          userId: new Types.ObjectId(testUserId),
          processingStatus: ProcessingStatus.PROCESSING,
          updatedAt: new Date(Date.now() - 5000), // Updated 5 seconds ago (active in-flight)
          isDeleted: false,
          save: () => Promise.resolve()
        });
      }) as any;

      // Invoking analyzeReport with forceReanalyze: true must NOT bypass in-flight guard
      let threw409 = false;
      try {
        await aiHealthAnalysisService.analyzeReport(testUserId, testReportId, { forceReanalyze: true });
      } catch (err: any) {
        if (err instanceof AppError && err.statusCode === 409) {
          threw409 = true;
          assert.strictEqual(err.message, 'Medical report analysis is currently in progress. Please try again shortly.');
        } else {
          throw err;
        }
      }

      assert.strictEqual(threw409, true, 'Must reject concurrent analysis with HTTP 409 even when forceReanalyze: true');
    } finally {
      MedicalReport.findOne = originalFindOne;
    }
  });

  await test('Standard reanalysis works normally when report is COMPLETED and not in-flight', async () => {
    const originalFindOne = MedicalReport.findOne;

    try {
      const dummyAnalysis = {
        sourceFacts: {
          extractedValues: [{ testName: 'Hemoglobin', value: '14.2', isAbnormal: false }],
          documentedDiagnoses: [],
          documentedMedications: []
        },
        aiInsights: { summary: 'Normal blood count parameters.' }
      };

      // Mock MedicalReport.findOne to return COMPLETED report
      MedicalReport.findOne = ((_query: any) => {
        return Promise.resolve({
          _id: new Types.ObjectId(testReportId),
          ownerUserId: new Types.ObjectId(testUserId),
          userId: new Types.ObjectId(testUserId),
          processingStatus: ProcessingStatus.COMPLETED,
          analysisResult: dummyAnalysis,
          aiSummary: 'Normal blood count parameters.',
          updatedAt: new Date(Date.now() - 120000),
          isDeleted: false,
          save: () => Promise.resolve()
        });
      }) as any;

      // 1. Without forceReanalyze -> returns cached result
      const cachedResult = await aiHealthAnalysisService.analyzeReport(testUserId, testReportId, { forceReanalyze: false });
      assert.strictEqual(cachedResult.isCached, true);
      assert.strictEqual(cachedResult.processingStatus, ProcessingStatus.COMPLETED);

    } finally {
      MedicalReport.findOne = originalFindOne;
    }
  });

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${testsPassed} / ${testsTotal} TESTS PASSED`);
  console.log('===============================================================\n');
}

runTestSuite().catch((err) => {
  console.error('AI rate limiter & concurrency test suite failed:', err);
  process.exit(1);
});
