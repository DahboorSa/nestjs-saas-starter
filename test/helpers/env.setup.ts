// Runs before any module is imported — sets fixed values for e2e tests.
// All values are hardcoded to guarantee test isolation regardless of local
// .env or GitHub Secrets. Tests always hit the test containers, never prod/dev.

// Database — always points to docker-compose.test.yml containers
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5433';
process.env.DB_NAME = 'saas_test';
process.env.DB_USER = 'saas_user';
process.env.DB_PASSWORD = 'saas_password';
process.env.DB_SYNC = 'true';
process.env.DB_LOGGING = 'false';

// Redis — always points to docker-compose.test.yml containers
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6380';

// JWT — test-only secrets, never used in production
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.REFRESH_TOKEN_TTL = '604800';

// Tokens
process.env.TTL_EXPIRATION = '86400';
process.env.INVITE_TOKEN_TTL = '172800';

// API Keys
process.env.API_KEY_PREFIX = 'sk_test_';
process.env.API_KEY_EXPIRATION = '300';

// Throttling — high limits to avoid flakiness in tests
process.env.THROTTLER_TTL = '60000';
process.env.THROTTLER_LIMIT = '10000';
process.env.THROTTLER_AUTH_LIMIT = '10000';

// App
process.env.NODE_ENV = 'test';
process.env.URL_PATH = 'http://localhost:5173';
process.env.ORIGIN = 'http://localhost:3000';

// Stripe — StripeService is fully mocked in app.setup.ts, these satisfy
// ConfigModule initialization before the mock is applied
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';

// Email — EmailQueueService is fully mocked in app.setup.ts, never actually used
process.env.MAILTRAP_API_KEY = 'fake';
process.env.MAILTRAP_TEST_INBOX_ID = '0';
process.env.MAILTRAP_FROM_EMAIL = 'noreply@test.com';
process.env.MAILTRAP_FROM_NAME = 'Test';

// AI Provider
process.env.AI_PROVIDER = 'groq';
process.env.GROQ_API_KEY = 'gsk_fake_key';
process.env.ANTHROPIC_API_KEY = 'claude_fake_key';
