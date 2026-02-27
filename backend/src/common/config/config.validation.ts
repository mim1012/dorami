import * as Joi from 'joi';

/**
 * Environment variable validation schema
 * Ensures all required environment variables are present and valid at startup
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
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),

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
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  // CORS
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),

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

  // Streaming (Optional)
  RTMP_SERVER_URL: Joi.string().optional(),
  HLS_SERVER_URL: Joi.string().optional(),
  RTMP_INTERNAL_URL: Joi.string().optional().default('rtmp://srs:1935/live'),
  SRS_API_URL: Joi.string().uri().optional().default('http://localhost:1985'),

  // Web Push (VAPID) - Optional
  VAPID_PUBLIC_KEY: Joi.string().optional(),
  VAPID_PRIVATE_KEY: Joi.string().optional(),
  VAPID_SUBJECT: Joi.string().optional(),

  // Feature flags
  ENABLE_DEV_AUTH: Joi.string().valid('true', 'false').default('false'),
  CSRF_ENABLED: Joi.string().valid('true', 'false').required().default('true').messages({
    'any.required': 'CSRF_ENABLED is required (set to true or false)',
  }),
  COOKIE_SECURE: Joi.string().valid('true', 'false').optional(),
  DISABLE_CSRF: Joi.string().valid('true', 'false').optional().allow(''),
});
