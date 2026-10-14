import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { generateAccessToken, verifyAccessToken } from '../utils/token.util';
import { config, validateAndBuildConfig, ConfigValidationError } from '../config';
import { UserRole } from '../types';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('LIFELEDGER BACKEND: JWT ALGORITHM & SECRET VALIDATION SUITE');
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

  const samplePayload = {
    sub: '507f1f77bcf86cd799439011',
    email: 'patient@lifeledger.health',
    role: UserRole.PATIENT,
    isVerified: true
  };

  // Base production environment mock for testing config validation
  const baseProdEnv: Record<string, string> = {
    NODE_ENV: 'production',
    PORT: '5000',
    CLIENT_URL: 'https://app.lifeledger.health',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/lifeledger',
    JWT_ACCESS_SECRET: 'prod_synthetic_access_key_32_chars_long!',
    JWT_REFRESH_SECRET: 'prod_synthetic_refresh_key_32_chars_long!',
    CLOUDINARY_CLOUD_NAME: 'test_cloud',
    CLOUDINARY_API_KEY: 'test_key',
    CLOUDINARY_API_SECRET: 'test_secret',
    GEMINI_API_KEY: 'test_gemini_key',
    BREVO_API_KEY: 'test_brevo_key'
  };

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: TOKEN LIFECYCLE & CLAIMS PRESERVATION
  // ---------------------------------------------------------------------------
  console.log('--- GROUP 1: Token Lifecycle & Claims Preservation ---');

  await test('generateAccessToken creates valid HS256 JWT and verifyAccessToken preserves all claims', () => {
    const token = generateAccessToken(samplePayload);
    assert.strictEqual(typeof token, 'string', 'Token must be a string');

    // Decode header to verify algorithm
    const decodedHeader = jwt.decode(token, { complete: true });
    assert.strictEqual(decodedHeader?.header.alg, 'HS256', 'Header alg must be HS256');

    // Verify token with verifyAccessToken
    const verified = verifyAccessToken(token);
    assert.strictEqual(verified.sub, samplePayload.sub, 'sub claim must match');
    assert.strictEqual(verified.email, samplePayload.email, 'email claim must match');
    assert.strictEqual(verified.role, samplePayload.role, 'role claim must match');
    assert.strictEqual(verified.isVerified, samplePayload.isVerified, 'isVerified claim must match');
  });

  await test('verifyAccessToken rejects expired tokens with TokenExpiredError', () => {
    const expiredToken = jwt.sign(samplePayload, config.jwtAccessSecret, {
      algorithm: 'HS256',
      expiresIn: '-1s'
    });

    assert.throws(
      () => verifyAccessToken(expiredToken),
      (err: any) => {
        assert.strictEqual(err.name, 'TokenExpiredError');
        return true;
      },
      'Expired token must throw TokenExpiredError'
    );
  });

  await test('verifyAccessToken rejects tampered token signatures with JsonWebTokenError', () => {
    const validToken = generateAccessToken(samplePayload);
    const parts = validToken.split('.');
    assert.strictEqual(parts.length, 3, 'JWT must contain 3 dot-separated parts');

    // Tamper with signature
    const signature = parts[2] || '';
    const tamperedSignature = signature.slice(0, -4) + 'zzzz';
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

    assert.throws(
      () => verifyAccessToken(tamperedToken),
      (err: any) => {
        assert.strictEqual(err.name, 'JsonWebTokenError');
        assert.strictEqual(err.message, 'invalid signature');
        return true;
      },
      'Tampered signature must throw invalid signature error'
    );
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: ALGORITHM WHITELIST RESTRICTION (HS256 ONLY)
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 2: Algorithm Whitelist Restriction (HS256 Only) ---');

  await test('verifyAccessToken rejects unsigned tokens with alg: "none"', () => {
    const unsignedToken = jwt.sign(samplePayload, '', {
      algorithm: 'none'
    });

    assert.throws(
      () => verifyAccessToken(unsignedToken),
      (err: any) => {
        assert.strictEqual(err.name, 'JsonWebTokenError');
        return true;
      },
      'Unsigned token with alg: none must be rejected'
    );
  });

  await test('verifyAccessToken rejects tokens signed with HS384 algorithm', () => {
    const hs384Token = jwt.sign(samplePayload, config.jwtAccessSecret, {
      algorithm: 'HS384'
    });

    assert.throws(
      () => verifyAccessToken(hs384Token),
      (err: any) => {
        assert.strictEqual(err.name, 'JsonWebTokenError');
        assert.strictEqual(err.message, 'invalid algorithm');
        return true;
      },
      'Token signed with HS384 must be rejected by HS256 whitelist'
    );
  });

  await test('verifyAccessToken rejects tokens signed with HS512 algorithm', () => {
    const hs512Token = jwt.sign(samplePayload, config.jwtAccessSecret, {
      algorithm: 'HS512'
    });

    assert.throws(
      () => verifyAccessToken(hs512Token),
      (err: any) => {
        assert.strictEqual(err.name, 'JsonWebTokenError');
        assert.strictEqual(err.message, 'invalid algorithm');
        return true;
      },
      'Token signed with HS512 must be rejected by HS256 whitelist'
    );
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: PRODUCTION SECRET VALIDATION & MINIMUM ENTROPY
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 3: Production Secret Validation & Minimum Entropy ---');

  await test('Production startup rejects missing JWT_ACCESS_SECRET', () => {
    const env = { ...baseProdEnv, JWT_ACCESS_SECRET: '' };
    assert.throws(
      () => validateAndBuildConfig(env),
      (err: any) => {
        assert.ok(err instanceof ConfigValidationError);
        assert.ok(err.errors.some((e: string) => e.includes('JWT_ACCESS_SECRET is required')));
        return true;
      },
      'Missing JWT_ACCESS_SECRET in production must throw ConfigValidationError'
    );
  });

  await test('Production startup rejects missing JWT_REFRESH_SECRET', () => {
    const env = { ...baseProdEnv, JWT_REFRESH_SECRET: '' };
    assert.throws(
      () => validateAndBuildConfig(env),
      (err: any) => {
        assert.ok(err instanceof ConfigValidationError);
        assert.ok(err.errors.some((e: string) => e.includes('JWT_REFRESH_SECRET is required')));
        return true;
      },
      'Missing JWT_REFRESH_SECRET in production must throw ConfigValidationError'
    );
  });

  await test('Production startup rejects JWT_ACCESS_SECRET shorter than 32 characters', () => {
    const shortSecret = 'short_secret_only_24_chars';
    assert.ok(shortSecret.length < 32);

    const env = { ...baseProdEnv, JWT_ACCESS_SECRET: shortSecret };
    assert.throws(
      () => validateAndBuildConfig(env),
      (err: any) => {
        assert.ok(err instanceof ConfigValidationError);
        assert.ok(
          err.errors.some((e: string) => e.includes('JWT_ACCESS_SECRET must be at least 32 characters in production'))
        );
        return true;
      },
      'Short JWT_ACCESS_SECRET in production must throw ConfigValidationError'
    );
  });

  await test('Production startup rejects JWT_REFRESH_SECRET shorter than 32 characters', () => {
    const shortSecret = 'short_refresh_key_16';
    assert.ok(shortSecret.length < 32);

    const env = { ...baseProdEnv, JWT_REFRESH_SECRET: shortSecret };
    assert.throws(
      () => validateAndBuildConfig(env),
      (err: any) => {
        assert.ok(err instanceof ConfigValidationError);
        assert.ok(
          err.errors.some((e: string) => e.includes('JWT_REFRESH_SECRET must be at least 32 characters in production'))
        );
        return true;
      },
      'Short JWT_REFRESH_SECRET in production must throw ConfigValidationError'
    );
  });

  await test('Production startup accepts JWT secrets with 32 or more characters', () => {
    const exact32Secret = '12345678901234567890123456789012';
    assert.strictEqual(exact32Secret.length, 32);

    const env = {
      ...baseProdEnv,
      JWT_ACCESS_SECRET: exact32Secret,
      JWT_REFRESH_SECRET: exact32Secret
    };

    const built = validateAndBuildConfig(env);
    assert.strictEqual(built.jwtAccessSecret, exact32Secret);
    assert.strictEqual(built.jwtRefreshSecret, exact32Secret);
  });

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: DEVELOPMENT DEFAULT FALLBACK INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n--- GROUP 4: Development Default Fallback Integrity ---');

  await test('Development mode safely defaults to built-in development secrets when unconfigured', () => {
    const devEnv: Record<string, string> = {
      NODE_ENV: 'development',
      MONGODB_URI: 'mongodb://localhost:27017/lifeledger'
    };

    const built = validateAndBuildConfig(devEnv);
    assert.strictEqual(built.jwtAccessSecret, 'dev_jwt_access_secret_key_32_bytes_minimum_length');
    assert.strictEqual(built.jwtRefreshSecret, 'dev_jwt_refresh_secret_key_32_bytes_minimum_length');
    assert.ok(built.jwtAccessSecret.length >= 32, 'Default dev secret exceeds 32 characters');
    assert.ok(built.jwtRefreshSecret.length >= 32, 'Default dev secret exceeds 32 characters');
  });

  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${testsPassed} / ${testsTotal} TESTS PASSED`);
  console.log('===============================================================\n');
}

runTestSuite().catch((err) => {
  console.error('JWT test suite failed:', err);
  process.exit(1);
});
