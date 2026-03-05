import * as Joi from 'joi';

/**
 * Environment variable validation schema
 * Ensures all required environment variables are present and valid at startup
 *
 * APP_ENV-conditional rules:
 * - production/staging: CORS_ORIGINS, FRONTEND_URL, REDIS_URL are REQUIRED (no localhost defaults)
 * - development/test:   safe localhost defaults are used
 */
export const configValidationSchema = Joi.object({
  // Node Environment
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  APP_ENV: Joi.string()
    .valid('development', 'staging', 'production', 'test')
    .default('development'),

  // Server
  PORT: Joi.number().default(3001),

  // Database
  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is required for database connection',
  }),

  // Redis
  REDIS_HOST: Joi.when('APP_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.string().required().messages({
      'any.required': 'REDIS_HOST is required in production/staging',
    }),
    otherwise: Joi.string().default('localhost'),
  }),
  REDIS_PORT: Joi.when('APP_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.number().required().messages({
      'any.required': 'REDIS_PORT is required in production/staging',
    }),
    otherwise: Joi.number().default(6379),
  }),
  REDIS_PASSWORD: Joi.string().optional().allow(''),
  REDIS_URL: Joi.when('APP_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.string()
      .uri({ scheme: ['redis', 'rediss'] })
      .required()
      .messages({
        'any.required': 'REDIS_URL is required in production/staging',
        'string.uri': 'REDIS_URL must be a valid redis:// or rediss:// URL',
      }),
    otherwise: Joi.string().default('redis://localhost:6379'),
  }),

  // JWT - Required in all environments
  JWT_SECRET: Joi.string().min(32).required().messages({
    'string.min': 'JWT_SECRET must be at least 32 characters',
    'any.required': 'JWT_SECRET is required',
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Kakao OAuth
  KAKAO_CLIENT_ID: Joi.string().required().messages({
    'any.required': 'KAKAO_CLIENT_ID is required for Kakao OAuth',
  }),
  KAKAO_CLIENT_SECRET: Joi.string().required().messages({
    'any.required': 'KAKAO_CLIENT_SECRET is required for Kakao OAuth',
  }),
  KAKAO_CALLBACK_URL: Joi.string().uri().required(),

  // Frontend
  FRONTEND_URL: Joi.when('APP_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.string().uri().required().messages({
      'any.required': 'FRONTEND_URL is required in production/staging',
    }),
    otherwise: Joi.string().uri().default('http://localhost:3000'),
  }),

  // CORS - Required in production/staging to prevent localhost leaking into prod
  CORS_ORIGINS: Joi.when('APP_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.string().required().messages({
      'any.required': 'CORS_ORIGINS is required in production/staging',
    }),
    otherwise: Joi.string().default('http://localhost:3000,http://localhost:3002'),
  }),

  // Bank Transfer (Optional)
  BANK_NAME: Joi.string().optional(),
  BANK_ACCOUNT_NUMBER: Joi.string().optional(),
  BANK_ACCOUNT_HOLDER: Joi.string().optional(),

  // Admin
  ADMIN_EMAILS: Joi.string().optional().allow(''),

  // Encryption - Required in all environments
  PROFILE_ENCRYPTION_KEY: Joi.string().length(64).required().messages({
    'string.length': 'PROFILE_ENCRYPTION_KEY must be exactly 64 characters (32 bytes hex)',
    'any.required': 'PROFILE_ENCRYPTION_KEY is required',
  }),

  // Cart/Order Settings
  CART_TIMER_MINUTES: Joi.number().default(10),
  ORDER_EXPIRATION_MINUTES: Joi.number().default(10),

  // Streaming — required in production/staging, dev-friendly defaults otherwise
  RTMP_SERVER_URL: Joi.when('APP_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.string().required().messages({
      'any.required': 'RTMP_SERVER_URL is required in production/staging',
    }),
    otherwise: Joi.string().default('rtmp://localhost:1935/live'),
  }),
  HLS_SERVER_URL: Joi.when('APP_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.string().required().messages({
      'any.required': 'HLS_SERVER_URL is required in production/staging',
    }),
    otherwise: Joi.string().default('http://localhost:8080/hls'),
  }),
  RTMP_INTERNAL_URL: Joi.string().optional().default('rtmp://srs:1935/live'),
  SRS_API_URL: Joi.when('APP_ENV', {
    is: Joi.valid('production', 'staging'),
    then: Joi.string().uri().required().messages({
      'any.required': 'SRS_API_URL is required in production/staging',
    }),
    otherwise: Joi.string().uri().default('http://localhost:1985'),
  }),
  RTMP_PORT: Joi.number().default(1935),

  // AlimTalk / Solapi
  SOLAPI_API_URL: Joi.string().uri().default('https://api.solapi.com/messages/v4/send-many'),

  // Web Push (VAPID) - Optional
  VAPID_PUBLIC_KEY: Joi.string().optional(),
  VAPID_PRIVATE_KEY: Joi.string().optional(),
  VAPID_SUBJECT: Joi.string().optional(),

  // WebSocket / Redis Timeouts
  REDIS_CONNECTION_TIMEOUT_MS: Joi.number().default(10000),
  WS_PING_TIMEOUT_MS: Joi.number().default(60000),
  WS_PING_INTERVAL_MS: Joi.number().default(25000),
  WS_CONNECT_TIMEOUT_MS: Joi.number().default(45000),

  // Rate Limiting (Throttler)
  THROTTLE_SHORT_LIMIT: Joi.number().default(10),
  THROTTLE_MEDIUM_LIMIT: Joi.number().default(20),
  THROTTLE_LONG_LIMIT: Joi.number().default(100),
  AUTH_THROTTLE_LIMIT: Joi.number().default(5),
  AUTH_THROTTLE_WINDOW_MS: Joi.number().default(60000),

  // Operational Tuning
  PAGINATION_DEFAULT_LIMIT: Joi.number().default(24),
  PAGINATION_MAX_LIMIT: Joi.number().default(100),
  PRISMA_CONNECTION_LIMIT: Joi.number().default(30),
  PRISMA_POOL_TIMEOUT_SECONDS: Joi.number().default(30),
  PRISMA_TRANSACTION_TIMEOUT_MS: Joi.number().default(10000),
  VERY_SLOW_REQUEST_THRESHOLD_MS: Joi.number().default(3000),
  CSRF_MAX_AGE_HOURS: Joi.number().default(24),
  ADMIN_MAX_EXPORT_ROWS: Joi.number().default(10000),

  // Feature flags
  ENABLE_DEV_AUTH: Joi.string().valid('true', 'false').default('false'),
  CSRF_ENABLED: Joi.string().valid('true', 'false').required().default('true').messages({
    'any.required': 'CSRF_ENABLED is required (set to true or false)',
  }),
  COOKIE_SECURE: Joi.string().valid('true', 'false').optional(),
  DISABLE_CSRF: Joi.string().valid('true', 'false').optional().allow(''),
});
