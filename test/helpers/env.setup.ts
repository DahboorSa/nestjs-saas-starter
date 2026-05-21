// Runs before any module is imported — overrides .env values for e2e tests.
process.env.DB_NAME = 'saas_test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_SYNC = 'true';
process.env.DB_LOGGING = 'false';
process.env.NODE_ENV = 'test';
