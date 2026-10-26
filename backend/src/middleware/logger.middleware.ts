import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

const SENSITIVE_QUERY_PARAMS = new Set([
  'token',
  'sessiontoken',
  'session',
  'code',
  'otp',
  'secret',
  'apikey',
  'key',
  'password'
]);

// Path patterns matching token segments in verified routes
const PUBLIC_SHARE_PATH_REGEX =
  /^(\/(?:api\/v1\/)?(?:public\/medical-shares|medical-shares\/public))\/(?!session(?:$|\/|\?))([^\/?#]+)(\/access)?/i;
const EMERGENCY_INFO_PATH_REGEX =
  /^(\/(?:api\/v1\/)?emergency\/info)\/([^\/?#]+)/i;

/**
 * Sanitizes request URLs before logging by redacting sensitive query parameters
 * and known path token segments while preserving ordinary route IDs and safe parameters.
 */
export const sanitizeUrlForLogging = (rawUrl: string): string => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '/';
  }

  try {
    const qIndex = rawUrl.indexOf('?');
    const pathname = qIndex >= 0 ? rawUrl.substring(0, qIndex) : rawUrl;
    const search = qIndex >= 0 ? rawUrl.substring(qIndex + 1) : '';

    let cleanPath = pathname || '/';

    // 1. Redact public medical share path tokens
    if (PUBLIC_SHARE_PATH_REGEX.test(cleanPath)) {
      cleanPath = cleanPath.replace(
        PUBLIC_SHARE_PATH_REGEX,
        (_match, prefix, _token, accessSuffix) => `${prefix}/[REDACTED]${accessSuffix || ''}`
      );
    }

    // 2. Redact emergency info path tokens
    if (EMERGENCY_INFO_PATH_REGEX.test(cleanPath)) {
      cleanPath = cleanPath.replace(
        EMERGENCY_INFO_PATH_REGEX,
        (_match, prefix) => `${prefix}/[REDACTED]`
      );
    }

    if (!search) {
      return cleanPath;
    }

    // 3. Redact sensitive query parameters (case-insensitive)
    const searchParams = new URLSearchParams(search);
    const pairs: string[] = [];

    searchParams.forEach((value, key) => {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        pairs.push(`${key}=[REDACTED]`);
      } else {
        pairs.push(`${key}=${value}`);
      }
    });

    const cleanQuery = pairs.join('&');
    return cleanQuery ? `${cleanPath}?${cleanQuery}` : cleanPath;
  } catch {
    // Fail-safe: In case of parsing exception, strip query string and mask path if matching
    try {
      const safeFallbackPath = (rawUrl.split('?')[0] || '/').split('#')[0] || '/';
      return safeFallbackPath
        .replace(PUBLIC_SHARE_PATH_REGEX, '$1/[REDACTED]$3')
        .replace(EMERGENCY_INFO_PATH_REGEX, '$1/[REDACTED]');
    } catch {
      return '/[SANITIZATION_ERROR]';
    }
  }
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  if (config.nodeEnv === 'test') {
    return next();
  }

  const startTime = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const durationMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);
    const statusCode = res.statusCode;
    const method = req.method;
    const rawUrl = req.originalUrl || req.url;
    const sanitizedUrl = sanitizeUrlForLogging(rawUrl);

    // Output strictly sanitized HTTP metadata (no body, headers, cookies, credentials, or PHI)
    console.log(`[HTTP] ${method} ${sanitizedUrl} ${statusCode} - ${durationMs}ms`);
  });

  next();
};

