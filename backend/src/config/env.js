'use strict';

const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });
const required = (key, fallback) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: parseInt(process.env.PORT || '5000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  appName: process.env.APP_NAME || 'Guest Management System',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  db: {
uri: required('MONGO_URI'),
    testUri: process.env.MONGODB_TEST_URI || '',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'cgms_access_secret_stable_2024_do_not_change',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'cgms_refresh_secret_stable_2024_do_not_change',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Guest Management',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@example.com',
  },

  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
  },

  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@platform.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe@123',
    name: process.env.SUPER_ADMIN_NAME || 'Platform Owner',
  },

  referral: {
    rewardType: process.env.REFERRAL_REWARD_TYPE || 'DISCOUNT',
    rewardValue: parseInt(process.env.REFERRAL_REWARD_VALUE || '10', 10),
    expiryDays: parseInt(process.env.REFERRAL_EXPIRY_DAYS || '90', 10),
  },

  webhook: {
    secret: process.env.WEBHOOK_SECRET || 'gms_webhook_secret_2024',
    timeoutMs: parseInt(process.env.WEBHOOK_TIMEOUT_MS || '10000', 10),
  },
};

module.exports = env;