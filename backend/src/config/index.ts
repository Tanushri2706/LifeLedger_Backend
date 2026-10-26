import dotenv from 'dotenv';

dotenv.config();

export type Environment = 'development' | 'production' | 'test';
export type CookieSameSite = 'lax' | 'strict' | 'none';

export interface Config {
  port: number;
  nodeEnv: Environment;
  clientUrl: string;
  mongodbUri: string;
  dnsServers: string[];
  apiPrefix: string;
  jwtAccessSecret: string;
  jwtAccessExpiry: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiry: string;
  bcryptSaltRounds: number;
  otpExpiryMinutes: number;
  cookieDomain?: string;
  cookieSameSite: CookieSameSite;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  aiProvider: 'gemini' | 'mock';
  geminiApiKey?: string;
  aiModel: string;
  mapsProvider: 'osm' | 'google' | 'mock';
  googleMapsApiKey?: string;
  osmOverpassUrl: string;
  osmNominatimUrl: string;
  emailProvider: 'brevo' | 'mock';
  brevoApiKey?: string;
  brevoSenderEmail: string;
  brevoSenderName: string;
}

export class ConfigValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid Environment Configuration:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    this.name = 'ConfigValidationError';
  }
}

export const validateAndBuildConfig = (
  envSource: Record<string, string | undefined> = process.env
): Readonly<Config> => {
  const errors: string[] = [];

  // 1. Validate NODE_ENV
  const rawNodeEnv = envSource.NODE_ENV || 'development';
  const validEnvironments: Environment[] = ['development', 'production', 'test'];
  if (!validEnvironments.includes(rawNodeEnv as Environment)) {
    errors.push(`NODE_ENV must be one of: ${validEnvironments.join(', ')} (received: "${rawNodeEnv}")`);
  }
  const nodeEnv = (validEnvironments.includes(rawNodeEnv as Environment)
    ? rawNodeEnv
    : 'development') as Environment;

  const isProduction = nodeEnv === 'production';

  // 2. Validate PORT
  const rawPort = envSource.PORT || '5000';
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`PORT must be a valid port number between 1 and 65535 (received: "${rawPort}")`);
  }

  // 3. Validate CLIENT_URL / CORS_ORIGIN
  const rawClientUrl =
    envSource.CLIENT_URL || envSource.CORS_ORIGIN || (isProduction ? '' : 'http://localhost:3000');
  const clientUrl = rawClientUrl.trim();
  if (!clientUrl) {
    errors.push('CLIENT_URL is required and cannot be empty');
  } else if (clientUrl === '*' || clientUrl.includes('*')) {
    errors.push('CLIENT_URL cannot be wildcard ("*") when credentials are enabled');
  } else if (isProduction && !clientUrl.startsWith('https://') && !clientUrl.startsWith('http://localhost')) {
    errors.push('CLIENT_URL must use HTTPS protocol in production');
  }

  // 4. Validate MONGODB_URI
  const mongodbUri = (envSource.MONGODB_URI || '').trim();
  if (!mongodbUri) {
    errors.push('MONGODB_URI is required and cannot be empty');
  } else if (!mongodbUri.startsWith('mongodb://') && !mongodbUri.startsWith('mongodb+srv://')) {
    errors.push('MONGODB_URI must start with "mongodb://" or "mongodb+srv://"');
  }

  // 4b. Parse DNS Servers (fallback to Cloudflare 1.1.1.1 and Google 8.8.8.8 for Windows SRV resolution)
  const rawDnsServers = envSource.DNS_SERVERS;
  const defaultDnsServers = ['1.1.1.1', '8.8.8.8'];
  let dnsServers: string[] = defaultDnsServers;
  if (rawDnsServers !== undefined && rawDnsServers.trim() !== '') {
    const parsed = rawDnsServers
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter((s) => s.length > 0);
    if (parsed.length > 0) {
      dnsServers = parsed;
    }
  }

  // 5. Validate JWT secrets
  const jwtAccessSecret = (
    envSource.JWT_ACCESS_SECRET ||
    (isProduction ? '' : 'dev_jwt_access_secret_key_32_bytes_minimum_length')
  ).trim();
  if (!jwtAccessSecret) {
    errors.push('JWT_ACCESS_SECRET is required and cannot be empty');
  } else if (isProduction && jwtAccessSecret.length < 32) {
    errors.push('JWT_ACCESS_SECRET must be at least 32 characters in production');
  }

  const jwtRefreshSecret = (
    envSource.JWT_REFRESH_SECRET ||
    (isProduction ? '' : 'dev_jwt_refresh_secret_key_32_bytes_minimum_length')
  ).trim();
  if (!jwtRefreshSecret) {
    errors.push('JWT_REFRESH_SECRET is required and cannot be empty');
  } else if (isProduction && jwtRefreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters in production');
  }

  const jwtAccessExpiry = (envSource.JWT_ACCESS_EXPIRY || '15m').trim();
  const jwtRefreshExpiry = (envSource.JWT_REFRESH_EXPIRY || '7d').trim();

  // 6. Validate BCRYPT_SALT_ROUNDS
  const rawSaltRounds = envSource.BCRYPT_SALT_ROUNDS || '10';
  const bcryptSaltRounds = parseInt(rawSaltRounds, 10);
  if (isNaN(bcryptSaltRounds) || bcryptSaltRounds < 4 || bcryptSaltRounds > 15) {
    errors.push(`BCRYPT_SALT_ROUNDS must be a number between 4 and 15 (received: "${rawSaltRounds}")`);
  }

  // 7. Validate OTP_EXPIRY_MINUTES
  const rawOtpExpiry = envSource.OTP_EXPIRY_MINUTES || '10';
  const otpExpiryMinutes = parseInt(rawOtpExpiry, 10);
  if (isNaN(otpExpiryMinutes) || otpExpiryMinutes < 1 || otpExpiryMinutes > 60) {
    errors.push(`OTP_EXPIRY_MINUTES must be a number between 1 and 60 (received: "${rawOtpExpiry}")`);
  }

  // 8. Validate Cookie Options
  const rawSameSite = envSource.COOKIE_SAME_SITE?.trim().toLowerCase();
  const validSameSites: CookieSameSite[] = ['lax', 'strict', 'none'];
  let cookieSameSite: CookieSameSite = 'lax';

  if (rawSameSite) {
    if (!validSameSites.includes(rawSameSite as CookieSameSite)) {
      errors.push(`COOKIE_SAME_SITE must be one of: ${validSameSites.join(', ')} (received: "${rawSameSite}")`);
    } else {
      cookieSameSite = rawSameSite as CookieSameSite;
    }
  }

  const cookieDomain = envSource.COOKIE_DOMAIN?.trim().replace(/^["']|["']$/g, '') || undefined;

  // 9. Cloudinary settings (environment-driven, fail-closed in production)
  let cloudinaryCloudName = envSource.CLOUDINARY_CLOUD_NAME?.trim().replace(/^["']|["']$/g, '');
  let cloudinaryApiKey = envSource.CLOUDINARY_API_KEY?.trim().replace(/^["']|["']$/g, '');
  let cloudinaryApiSecret = envSource.CLOUDINARY_API_SECRET?.trim().replace(/^["']|["']$/g, '');

  if (envSource.CLOUDINARY_URL) {
    try {
      const parsed = new URL(envSource.CLOUDINARY_URL.trim().replace(/^["']|["']$/g, ''));
      if (parsed.protocol === 'cloudinary:') {
        cloudinaryApiKey = cloudinaryApiKey || parsed.username;
        cloudinaryApiSecret = cloudinaryApiSecret || parsed.password;
        cloudinaryCloudName = cloudinaryCloudName || parsed.hostname;
      }
    } catch {
      // Ignore malformed URL here, presence check follows
    }
  }

  const hasCloudinary = !!(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret);
  if (isProduction && !hasCloudinary) {
    errors.push(
      'Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are required in production'
    );
  }

  // 10. AI Intelligence settings (fail-closed in production)
  const geminiApiKey =
    envSource.GEMINI_API_KEY?.trim().replace(/^["']|["']$/g, '') ||
    envSource.AI_API_KEY?.trim().replace(/^["']|["']$/g, '');
  const rawAiProvider = envSource.AI_PROVIDER?.trim().toLowerCase().replace(/^["']|["']$/g, '');
  const aiModel =
    envSource.GEMINI_MODEL?.trim().replace(/^["']|["']$/g, '') ||
    envSource.AI_MODEL?.trim().replace(/^["']|["']$/g, '') ||
    'gemini-3.1-flash-lite';

  let aiProvider: 'gemini' | 'mock';
  if (isProduction) {
    if (rawAiProvider === 'mock') {
      errors.push('Mock AI provider is not permitted in production');
    }
    if (!geminiApiKey) {
      errors.push('GEMINI_API_KEY is required in production');
    }
    aiProvider = 'gemini';
  } else {
    if (rawAiProvider === 'gemini') {
      if (!geminiApiKey) {
        errors.push('GEMINI_API_KEY is required when AI_PROVIDER is set to "gemini"');
      }
      aiProvider = 'gemini';
    } else if (rawAiProvider === 'mock') {
      aiProvider = 'mock';
    } else {
      aiProvider = geminiApiKey ? 'gemini' : 'mock';
    }
  }

  // 11. Maps & Location Discovery settings (production-conscious Free OSM / Google Maps)
  const googleMapsApiKey =
    envSource.GOOGLE_MAPS_API_KEY?.trim().replace(/^["']|["']$/g, '') ||
    envSource.MAPS_API_KEY?.trim().replace(/^["']|["']$/g, '');
  const rawMapsProvider = envSource.MAPS_PROVIDER?.trim().toLowerCase().replace(/^["']|["']$/g, '');

  const osmOverpassUrl = (
    envSource.OSM_OVERPASS_URL?.trim().replace(/^["']|["']$/g, '') || 'https://overpass-api.de/api/interpreter'
  ).trim();
  const osmNominatimUrl = (
    envSource.OSM_NOMINATIM_URL?.trim().replace(/^["']|["']$/g, '') || 'https://nominatim.openstreetmap.org'
  ).trim();

  try {
    const parsedOverpass = new URL(osmOverpassUrl);
    if (parsedOverpass.protocol !== 'http:' && parsedOverpass.protocol !== 'https:') {
      errors.push('OSM_OVERPASS_URL must use http or https protocol');
    }
  } catch {
    errors.push(`OSM_OVERPASS_URL is not a valid URL: "${osmOverpassUrl}"`);
  }

  try {
    const parsedNominatim = new URL(osmNominatimUrl);
    if (parsedNominatim.protocol !== 'http:' && parsedNominatim.protocol !== 'https:') {
      errors.push('OSM_NOMINATIM_URL must use http or https protocol');
    }
  } catch {
    errors.push(`OSM_NOMINATIM_URL is not a valid URL: "${osmNominatimUrl}"`);
  }

  let mapsProvider: 'osm' | 'google' | 'mock' = 'osm';
  if (isProduction) {
    if (rawMapsProvider === 'mock') {
      errors.push('Mock maps provider is not permitted in production');
    }
    if (rawMapsProvider === 'google') {
      if (!googleMapsApiKey) {
        errors.push('GOOGLE_MAPS_API_KEY is required when MAPS_PROVIDER is set to "google"');
      }
      mapsProvider = 'google';
    } else if (rawMapsProvider === 'osm') {
      mapsProvider = 'osm';
    } else if (!rawMapsProvider) {
      mapsProvider = googleMapsApiKey ? 'google' : 'osm';
    } else {
      errors.push(`MAPS_PROVIDER must be one of: "osm", "google" (received: "${rawMapsProvider}")`);
    }
  } else {
    if (rawMapsProvider === 'osm') {
      mapsProvider = 'osm';
    } else if (rawMapsProvider === 'google') {
      if (!googleMapsApiKey) {
        errors.push('GOOGLE_MAPS_API_KEY is required when MAPS_PROVIDER is set to "google"');
      }
      mapsProvider = 'google';
    } else if (rawMapsProvider === 'mock') {
      mapsProvider = 'mock';
    } else if (!rawMapsProvider) {
      mapsProvider = 'osm';
    } else {
      errors.push(`MAPS_PROVIDER must be one of: "osm", "google", "mock" (received: "${rawMapsProvider}")`);
    }
  }

  // 12. Brevo Transactional Email settings (fail-closed in production)
  const brevoApiKey = envSource.BREVO_API_KEY?.trim().replace(/^["']|["']$/g, '');
  const brevoSenderEmail = envSource.BREVO_SENDER_EMAIL?.trim() || 'notifications@lifeledger.health';
  const brevoSenderName = envSource.BREVO_SENDER_NAME?.trim() || 'LifeLedger';
  const rawEmailProvider = envSource.EMAIL_PROVIDER?.trim().toLowerCase().replace(/^["']|["']$/g, '');

  let emailProvider: 'brevo' | 'mock';
  if (isProduction) {
    if (rawEmailProvider === 'mock') {
      errors.push('Mock email provider is not permitted in production');
    }
    if (!brevoApiKey) {
      errors.push('BREVO_API_KEY is required in production');
    }
    emailProvider = 'brevo';
  } else {
    if (rawEmailProvider === 'mock') {
      emailProvider = 'mock';
    } else {
      emailProvider = brevoApiKey ? 'brevo' : 'mock';
    }
  }

  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }

  return Object.freeze({
    port: isNaN(port) ? 5000 : port,
    nodeEnv,
    clientUrl: clientUrl.trim(),
    mongodbUri: mongodbUri.trim(),
    dnsServers,
    apiPrefix: '/api/v1',
    jwtAccessSecret: jwtAccessSecret.trim(),
    jwtAccessExpiry: jwtAccessExpiry.trim(),
    jwtRefreshSecret: jwtRefreshSecret.trim(),
    jwtRefreshExpiry: jwtRefreshExpiry.trim(),
    bcryptSaltRounds: isNaN(bcryptSaltRounds) ? 10 : bcryptSaltRounds,
    otpExpiryMinutes: isNaN(otpExpiryMinutes) ? 10 : otpExpiryMinutes,
    cookieDomain,
    cookieSameSite,
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    aiProvider,
    geminiApiKey,
    aiModel,
    mapsProvider,
    googleMapsApiKey,
    osmOverpassUrl,
    osmNominatimUrl,
    emailProvider,
    brevoApiKey,
    brevoSenderEmail,
    brevoSenderName
  });
};

export const config: Readonly<Config> = validateAndBuildConfig();
export * from './database';

import { configureDnsServers } from './database';
configureDnsServers(config.dnsServers);


