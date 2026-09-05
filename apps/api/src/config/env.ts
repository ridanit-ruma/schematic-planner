import { z } from 'zod';

/** Accepts the spellings people actually put in a .env file. */
/** The `15m` / `30d` spellings, typed so `@nestjs/jwt` accepts them directly. */
export type Duration = `${number}${'s' | 'm' | 'h' | 'd'}`;

/**
 * Environment variables arrive as strings and are frequently present but empty,
 * which is not the same as absent to a schema library. Both are treated as
 * "unset" here so a blank line in .env behaves the way a reader expects.
 */
const blank = (value: string | undefined): boolean => value === undefined || value.trim() === '';

const boolish = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((value) =>
      blank(value) ? fallback : ['1', 'true', 'yes', 'on'].includes(value!.trim().toLowerCase()),
    );

const duration = (fallback: Duration) =>
  z
    .string()
    .optional()
    .transform((value) => (blank(value) ? fallback : value!.trim()))
    .refine((value) => /^\d+[smhd]$/.test(value), 'expected a duration such as 15m or 30d')
    .transform((value) => value as Duration);

const text = (fallback: string) =>
  z
    .string()
    .optional()
    .transform((value) => (blank(value) ? fallback : value!.trim()));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  API_HOST: text('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_PUBLIC_URL: text('http://localhost:3001'),
  APP_PUBLIC_URL: text('http://localhost:5173'),
  CORS_ORIGINS: text('http://localhost:5173'),
  TRUST_PROXY: boolish(false),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: text(''),
  JWT_REFRESH_SECRET: text(''),
  ACCESS_TOKEN_TTL: duration('15m'),
  REFRESH_TOKEN_TTL: duration('30d'),
  COOKIE_DOMAIN: text(''),
  COOKIE_SECURE: boolish(false),
  ALLOW_REGISTRATION: boolish(true),

  GITHUB_CLIENT_ID: text(''),
  GITHUB_CLIENT_SECRET: text(''),
  GOOGLE_CLIENT_ID: text(''),
  GOOGLE_CLIENT_SECRET: text(''),

  COLLAB_PERSIST_DEBOUNCE_MS: z.coerce.number().int().min(0).default(2000),
  COLLAB_PERSIST_MAX_WAIT_MS: z.coerce.number().int().min(0).default(10_000),
});

export type RawEnv = z.infer<typeof envSchema>;

export interface AppConfig {
  readonly nodeEnv: RawEnv['NODE_ENV'];
  readonly isProduction: boolean;
  readonly host: string;
  readonly port: number;
  readonly apiPublicUrl: string;
  readonly appPublicUrl: string;
  readonly corsOrigins: readonly string[];
  readonly trustProxy: boolean;
  readonly databaseUrl: string;
  readonly accessSecret: string;
  readonly refreshSecret: string;
  readonly accessTokenTtl: Duration;
  readonly refreshTokenTtl: Duration;
  readonly cookieDomain: string | undefined;
  readonly cookieSecure: boolean;
  readonly allowRegistration: boolean;
  readonly oauth: {
    readonly github: { id: string; secret: string } | null;
    readonly google: { id: string; secret: string } | null;
  };
  readonly collab: { readonly debounceMs: number; readonly maxWaitMs: number };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

const MIN_SECRET_LENGTH = 32;
/** Only ever used outside production, and only after a warning. */
const DEV_SECRET = 'development-only-secret-do-not-use-in-production';

function resolveSecret(value: string, name: string, isProduction: boolean): string {
  if (value.length >= MIN_SECRET_LENGTH) return value;

  if (isProduction) {
    throw new Error(
      `${name} must be set to at least ${MIN_SECRET_LENGTH} characters in production. ` +
        'Generate one with: openssl rand -base64 48',
    );
  }
  console.warn(
    `[config] ${name} is unset or too short; using a development fallback. ` +
      'Sessions will be valid on any machine using the same fallback.',
  );
  return DEV_SECRET;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ');
    throw new Error(`Invalid environment:\n  ${detail}`);
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  const oauthPair = (id: string, secret: string) =>
    id !== '' && secret !== '' ? { id, secret } : null;

  return {
    nodeEnv: env.NODE_ENV,
    isProduction,
    host: env.API_HOST,
    port: env.API_PORT,
    apiPublicUrl: env.API_PUBLIC_URL.replace(/\/+$/, ''),
    appPublicUrl: env.APP_PUBLIC_URL.replace(/\/+$/, ''),
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter((origin) => origin !== ''),
    trustProxy: env.TRUST_PROXY,
    databaseUrl: env.DATABASE_URL,
    accessSecret: resolveSecret(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', isProduction),
    refreshSecret: resolveSecret(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', isProduction),
    accessTokenTtl: env.ACCESS_TOKEN_TTL,
    refreshTokenTtl: env.REFRESH_TOKEN_TTL,
    cookieDomain: env.COOKIE_DOMAIN === '' ? undefined : env.COOKIE_DOMAIN,
    cookieSecure: env.COOKIE_SECURE,
    allowRegistration: env.ALLOW_REGISTRATION,
    oauth: {
      github: oauthPair(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
      google: oauthPair(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
    },
    collab: {
      debounceMs: env.COLLAB_PERSIST_DEBOUNCE_MS,
      maxWaitMs: env.COLLAB_PERSIST_MAX_WAIT_MS,
    },
  };
}
