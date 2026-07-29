# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
yarn start:dev          # Watch mode
yarn build              # Compile to dist/
yarn start:prod         # Run compiled output

# Testing
yarn test               # Unit tests (jest, rootDir: src, *.spec.ts)
yarn test:watch         # Watch mode
yarn test:cov           # Coverage
yarn test:e2e           # E2E tests (./test/jest-e2e.json)

# Run a single test file
yarn test -- --testPathPattern=auth.service

# Linting / formatting
yarn lint               # ESLint with auto-fix
yarn format             # Prettier

# Database
yarn migration:generate src/database/migrations/<Name>   # Generate migration (DB_SYNC must be false)
yarn migration:run       # Apply pending migrations
yarn migration:revert    # Revert last migration
yarn migration:show      # Show migration status
yarn seed:run            # Run seeders (populates plans)

# Circular dependency check
npx madge --circular src/main.ts
```

> **Important**: Always set `DB_SYNC=false` in `.env` before running migrations. Never use `DB_SYNC=true` in production — it bypasses migrations.

> **Setup**: See README for prerequisites, local dev setup (Docker + non-Docker), environment variables, and Stripe webhook local testing.

## E2E Testing

E2E tests run against **separate** Postgres and Redis instances to avoid wiping dev data.

### Start test infrastructure

```bash
docker-compose -f docker-compose.test.yml up -d
```

This starts:
- Postgres on port **5433**, database `saas_test`
- Redis on port **6380**

### Run e2e tests

```bash
yarn test:e2e
```

`test/helpers/env.setup.ts` overrides env vars before tests run (`DB_PORT=5433`, `DB_NAME=saas_test`, `REDIS_PORT=6380`, `DB_SYNC=true`). `DB_SYNC=true` is intentional here — it auto-creates the schema on first run without needing to run migrations manually.

### Test helpers

| File | Purpose |
|------|---------|
| `test/helpers/env.setup.ts` | Overrides env vars before the test suite |
| `test/helpers/app.setup.ts` | Creates the NestJS test app, mocks email queue, seeds plans |
| `test/helpers/fixtures.ts` | Shared test data (user/org/plan fixtures) |

### Run a single e2e file

```bash
yarn test:e2e -- --testPathPattern=auth
```

### E2E test suites

`app`, `auth`, `users`, `organizations`, `plans`, `api-keys`, `invitations`, `webhooks`, `usage`, `payments`, `audit-logs`, `onboarding`

## Bootstrap Configuration (`main.ts`)

Key middleware applied at startup — affects all requests:

| Setting | Value | Why |
|---------|-------|-----|
| `helmet()` | default options | Basic security headers |
| `cookieParser()` | enabled | Parses `Cookie` header into `req.cookies` — required for refresh token cookie |
| CORS `origin` | `ORIGIN` env var or `'*'` | `'*'` is intentional for dev only — fix before prod |
| CORS `credentials` | `true` | Required for browsers to send HTTP-only cookies cross-origin |
| `rawBody: true` | enabled | Required for Stripe webhook signature verification |
| `whitelist: true` | ValidationPipe | Strips unknown fields from DTOs |
| `forbidNonWhitelisted: true` | ValidationPipe | Rejects requests with unknown fields (400) |
| `transform: true` | ValidationPipe | Auto-casts request data to DTO types |

## Architecture

### Module Structure

`AppModule` is the root. It imports feature modules; each feature module is self-contained with its own entity, service, controller, and DTOs.

```
src/
  app.module.ts              # Root — imports all feature modules
  main.ts                    # Bootstrap
  config/                    # database.config.ts, jwt.config.ts (loaded via ConfigModule)
  database/
    database.module.ts       # TypeORM setup (DB_SYNC env controls synchronize)
    data-source.ts           # Standalone DataSource for CLI (migrations/seeds)
    migrations/              # TypeORM migration files
    seeds/                   # typeorm-extension seeders (plan.seeder.ts)
  cache/
    cache.service.ts         # Redis wrapper (ioredis, reads REDIS_HOST/REDIS_PORT from env via ConfigService)
    cache.module.ts
  jobs/
    job.module.ts            # BullMQ setup
    queues/email.queue.ts    # Enqueues welcome/invite emails
    processors/email.processor.ts   # Processes email jobs (Mailtrap/Nodemailer)
  common/
    utils/
      utility.service.ts         # generateSlug()
      jwt-utility.service.ts     # generateToken(), verifyRefreshToken() — sync, no async
      utility.module.ts
      jwt-utility.module.ts      # Imports JwtModule.register({})
    interceptors/
      usage-tracker.interceptor.ts  # Global interceptor, tracks API usage
  enums/                     # UserRole, InvitationStatus, AuditAction, UsageMetric, etc.
  modules/
    auth/                    # Login, register, verify email, refresh, logout
    organizations/           # CRUD + org details
    users/                   # List, update role, remove
    invitations/             # Send invite, accept invite
    plans/                   # Plan listing, default plan
    api-keys/                # Create, list, delete API keys
    usage/                   # Usage records
    onboarding/              # AI assistant (POST /onboarding/ask)
      dto/ask.dto.ts         # { question: string } — max 2000 chars
      providers/             # IAiProvider interface + ClaudeProvider + GroqProvider
      onboarding.service.ts  # Gathers org context, calls AI provider
      onboarding.module.ts   # Selects provider via AI_PROVIDER env var
```

### Authentication

> See README for auth strategies, token flow, cache key conventions, and role hierarchy.

Three global `APP_GUARD`s applied in order: `JwtGuard` → `RolesGuard` → `JwtOnlyGuard`. API key auth reads `X-API-Key` header, SHA256-hashes it, checks Redis cache (`apikey:valid:<hash>`), falls back to DB.

### Decorators

| Decorator | Effect |
|-----------|--------|
| `@Public()` | Bypass authentication entirely |
| `@JwtOnly()` | Block API key auth, require JWT |
| `@Roles(UserRole.X)` | Enforce role RBAC |
| `@CurrentUser()` | Inject current user from request |
| `@AuditContext()` | Inject audit context (userId, orgId, email) |
| `@SkipUsageTracking()` | Skip usage tracking interceptor for the route |

### Interceptors

| Interceptor | Effect |
|-------------|--------|
| `UsageTrackerInterceptor` | Tracks API calls per org, enforces plan limits — global |
| `WebhookTrackerInterceptor` | Dispatches webhook events after successful mutations |
| `MemberInviteTrackerInterceptor` | Fires `member.invited` webhook event on invitation send |

### Webhook Events

Delivered via HMAC-SHA256 signed HTTP POST. Available events:

| Event | Trigger |
|-------|---------|
| `member.invited` | Invitation sent |
| `member.invite_accepted` | Invitation accepted |
| `member.role_updated` | Member role changed |
| `member.updated` | Member profile updated |
| `member.removed` | Member removed from org |
| `member.email_updated` | Member email changed |
| `org.updated` | Organization updated |
| `apikey.created` | API key created |
| `apikey.revoked` | API key revoked |
| `plan.limit_exceeded` | Usage limit hit |

### Database

- PostgreSQL via TypeORM.
- Migrations live in `src/database/migrations/`. The `data-source.ts` is used exclusively by the CLI.
- Seeders via `typeorm-extension` — run `seed:run` to populate the `plans` table before first use.
- Soft-delete pattern throughout: `isActive: false` instead of hard deletes (users, API keys).

### Key Dependencies

| Package                            | Purpose                        |
| ---------------------------------- | ------------------------------ |
| `argon2`                           | Password hashing               |
| `passport-jwt` + `passport-custom` | Auth strategies                |
| `ioredis`                          | Redis client                   |
| `bullmq` + `@nestjs/bullmq`        | Job queues for emails/webhooks |
| `@nestjs/axios`                    | HTTP client for webhook delivery |
| `typeorm-extension`                | Seeders                        |
| `mailtrap` / `nodemailer`          | Email delivery                 |
| `@anthropic-ai/sdk`                | Anthropic Claude AI provider   |
| `groq-sdk`                         | Groq AI provider               |

### Modules

These modules are imported in `app.module.ts`:

| Module | Path | Purpose |
|--------|------|---------|
| `AuditLogModule` | `src/modules/audit-logs/` | Records user/org actions; exposes `GET /audit-logs` (org-scoped, date-filterable, excludes auth actions) |
| `WebhookDispatcherModule` | `src/modules/webhook-dispatcher/` | Dispatches events to registered webhook endpoints |
| `WebhookDeliveriesModule` | `src/modules/webhook-deliveries/` | Tracks delivery attempts and status |
| `UsageRecordsModule` | `src/modules/usage-records/` | DB persistence layer for usage counts |
| `StripeCoreModule` | `src/modules/stripe/` | Just `StripeService`, no other deps — lets `OrganizationModule` use Stripe without a circular import |
| `StripeModule` | `src/modules/stripe/` | Stripe webhook handler; imports `StripeCoreModule` + `OrganizationModule`, re-exports `StripeCoreModule` for `PaymentModule` |
| `PaymentModule` | `src/modules/payments/` | Subscription create/get endpoints |
| `OnboardingModule` | `src/modules/onboarding/` | AI-powered onboarding assistant (`POST /onboarding/ask`) — pluggable provider (Groq or Claude) selected via `AI_PROVIDER` env var |

### Schedulers

Four cron jobs registered in `src/jobs/schedulers/` via `SchedulerModule`:

| File | Schedule | Purpose |
|------|----------|---------|
| `trial-expiry.scheduler.ts` | Daily midnight | Suspend/cancel orgs past trial + 5-day grace period |
| `usage-reset.scheduler.ts` | 1st of month midnight | Reset monthly usage counters in Redis |
| `usage-sync.scheduler.ts` | Every 5 minutes | Flush Redis usage counts to `usage_records` DB table |
| `invitation-expiry.scheduler.ts` | Daily midnight | Expire pending invitations past `expiresAt` |

### Migration History

| Migration | What it adds |
|-----------|-------------|
| `1774364856062-InitialSchema` | Full base schema (users, orgs, plans, api-keys, invitations, webhooks, audit-logs, usage-records) |
| `1775615418200-AddStripeFields` | `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId` on org |
| `1775699843509-AddTrialDays` | `trialEndsAt` on org; `trialDays` on plan |
| `1776510471436-addMissingEventKey` | Adds missing `eventKey` field to webhook endpoints |
| `1780000000000-SnakeCaseColumns` | Renames all camelCase DB columns to snake_case across all 9 tables |

### Seeders

`yarn seed:run` runs `src/database/seeds/plan.seeder.ts`, which inserts Free, Pro, and Enterprise plans. Each plan record includes a `stripePriceId` — set these to your Stripe test price IDs in the seeder before running in a new environment, otherwise they will be `null`.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

1. Checkout + install Node via `.nvmrc`
2. Cache Yarn dependencies
3. `yarn lint`
4. `yarn test` (unit)
5. `yarn test:e2e` (spins up `docker-compose.test.yml` inline)

All three steps must pass for the check to go green.

## Known Issues / Pending Work

### High

- **Duplicate webhook delivery records on retry** — `webhook.processor.ts` saves a delivery record on every attempt including retries. Should save once with PENDING status before delivery, then update status after.

### Medium

- **`main.ts:11`** — CORS defaults to `'*'` when `ORIGIN` env var is not set. Should fail hard if `ORIGIN` is missing in production.
- **Magic numbers** — `86400` hardcoded in `usage.service.ts:65`. `apiKey.slice(0, 12)` unexplained in `api-key.service.ts`. Extract to named constants.
- **Dead enum values** — `UsageMetric` has `WEBHOOK_CALLS`, `DATA_STORAGE`, `ACTIVE_USERS` defined but never tracked. Only `API_CALLS` is used.

### Low

- **Missing test coverage** — No tests for: webhook processor, email processor, usage sync/reset schedulers, usage-tracker interceptor, webhook-tracker interceptor, member-invite-tracker interceptor.

## Future Features

### Payment Integration
- **Recommended: Stripe Test Mode** — Free forever, no real charges. Use test card `4242 4242 4242 4242`. Anyone cloning the repo uses their own free Stripe test keys via `.env`. Install with `yarn add stripe`. Required env vars: `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`.
  - Use **Stripe Products + Prices** for plan definitions (Free, Pro, Enterprise)
  - Use **Stripe Subscriptions** for plan lifecycle management
  - Use **Stripe CLI** (`stripe listen --forward-to localhost:3000/stripe/webhook`) for local webhook testing
  - Use **Stripe Customer Portal** for billing history / self-serve plan changes
  - Alternative for zero external dependency: `stripe-mock` Docker container (`docker run --rm -it -p 12111:12111 stripe/stripe-mock`)
- **Payment endpoints** — Three endpoints needed:
  - `POST /payments/subscription` — create Stripe subscription when org selects a paid plan
  - `GET /payments/subscription` — get current subscription status (plan, status, next billing date, pendingPlan if downgrade scheduled)
  - `POST /stripe/webhook` — receives Stripe events (`customer.subscription.updated`, `invoice.payment_failed`, `subscription.deleted`) and updates org `status` + `plan`

### Registration & Plans
- **Plan upgrade/downgrade endpoint** — `PATCH /organizations/plan` (`organization.controller.ts`) is implemented: validates an active subscription, ends any active Stripe trial immediately (`trial_end: 'now'`) and switches the price with proration, then syncs `paymentStatus`/`trialEndsAt` on the org. Still missing: a Stripe idempotency key on the update call (double-click could double-charge) and a `pendingPlan` field for scheduled downgrades (currently upgrades/downgrades both take effect immediately).
- **Enforce plan limits** — `maxWebhooks`, `maxMembers` are defined in `PlanEntity.limits` but never enforced. Creating a webhook on a free plan (`maxWebhooks: 0`) succeeds silently.
- **Trial period management** — `trial-expiry.scheduler.ts` suspends/cancels orgs whose free trial (no `stripeSubscriptionId`) has expired. Not yet handled: a warning email before the trial ends.

### API Keys
- **API key expiration enforcement** — `ApiKeyEntity.expiresAt` field exists but is never checked during authentication. Expired keys work indefinitely.
- **API key last used tracking** — `lastUsedAt` field exists but is never updated when a key is used.
- **API key scope enforcement** — `ApiKeyStrategy` returns `scopes` in the user payload but they are not enforced. Currently all mutating endpoints (`POST`, `PATCH`, `DELETE`) are restricted to JWT via `@JwtOnly()`, making API keys read-only by design. Fine-grained scope validation per endpoint is a future enhancement.
- **API key cache invalidation on scope change** — `apikey:valid:<hash>` TTL-based cache is not invalidated when scopes change. Relevant once scope enforcement is implemented.

### Webhooks
- **Webhook delivery history endpoint** — No `GET /webhooks/:id/deliveries` to view past delivery attempts and their status.
- **Webhook test/replay** — No way to manually trigger a test event or replay a failed delivery.
- **Missing webhook events** — `WebhookEvent` enum is missing: `plan.upgraded`, `plan.downgraded`, `member.invited`, `api.limit_exceeded`.
- **Duplicate delivery records on retry** — `webhook.processor.ts` saves a new record on every retry attempt. Should save once with `PENDING` before delivery and update status after.

### Usage & Observability
- **Usage GET endpoint** — No endpoint for users to query their current usage stats and limits.
- **Usage limit warnings** — No email or webhook notification when approaching plan limits (e.g. 80%, 95%).
- **Track additional metrics** — `UsageMetric` enum has `WEBHOOK_CALLS`, `DATA_STORAGE`, `ACTIVE_USERS` defined but never tracked.

### Organization
- **Organization deletion** — No endpoint to delete an organization.
- **Transfer ownership** — No endpoint to transfer `OWNER` role to another member.

### Developer Experience
- **Swagger / OpenAPI docs** — No `@ApiProperty` decorators or Swagger setup. Add `@nestjs/swagger` for auto-generated API docs.
- **Pagination & filtering** — List endpoints (members, webhooks, api-keys) return all records with no pagination or filtering support.

### AWS Integration

**Recommended deployment order** (all in the same VPC so services talk to each other internally):
1. RDS (PostgreSQL) — replace local DB
2. ElastiCache (Valkey) — replace local Redis + BullMQ
3. SES — replace Mailtrap
4. ECR — push Docker image
5. ECS — deploy app, connects to RDS + ElastiCache internally

Final VPC layout:
```
Your VPC
├── ECS (NestJS app)     ← public-facing via Load Balancer
├── RDS (PostgreSQL)     ← private subnet, accessible by ECS only
└── ElastiCache (Valkey) ← private subnet, accessible by ECS only
```

- **AWS SES** — Replace Mailtrap with SES for production email delivery. Swap transport in `email.processor.ts`. Required env vars: `AWS_SES_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
- **AWS RDS** — Replace local PostgreSQL with RDS (db.t3.micro). Same TypeORM config, just update `DB_HOST`/credentials in `.env`.
- **AWS ElastiCache (Valkey)** — Replace local Redis with ElastiCache. Choose **Valkey** (not Redis OSS or Memcached). Use **non-cluster mode** (BullMQ requires it — cluster mode breaks Lua scripts). Same ioredis client, just update `REDIS_HOST` in `.env`.
- **AWS ECR + ECS** — Containerize and deploy via ECS using the existing `Dockerfile`. Push image to ECR, run on ECS Fargate.
- **AWS S3** — Future feature: file uploads (org logo, user avatar) stored in S3.

#### Using ElastiCache locally via SSH tunnel (before ECS deployment)

ElastiCache is VPC-only — no public endpoint. To use it locally during dev:

**Step 1 — Create EC2 instance** (same VPC as ElastiCache)
- Type: `t2.micro` (free tier), Amazon Linux 2023, enable public IP, save `.pem` key

**Step 2 — Configure Security Groups**
- EC2: inbound SSH port `22` from your IP
- ElastiCache: inbound port `6379` from the EC2 security group

**Step 3 — Get ElastiCache Primary Endpoint**
- ElastiCache console → cluster → copy Primary Endpoint (e.g. `saas-cache.xxxxx.0001.euw1.cache.amazonaws.com`)

**Step 4 — Open SSH tunnel**
```bash
ssh -i /path/to/your-key.pem \
    -L 6379:<PRIMARY_ENDPOINT>:6379 \
    -N ec2-user@<EC2_PUBLIC_IP>
```
Keep this terminal open while developing.

**Step 5 — Update `.env`**
```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

**Step 6 — Start the app**
```bash
yarn start:dev
```

## Refactoring Opportunities (Pending)

### High
- **Audit + Webhook dispatch pattern** — same fire-and-forget `.catch()` pattern copy-pasted across 6 services (`user.service`, `invitation.service`, `api-key.service`, `auth.service`, `webhook.service`, `webhook-delivery.service`). Extract into a shared helper or service.
- **Token generation + caching** — `randomBytes(32).toString('hex')` + `cacheService.set()` pattern repeated 4 times across `auth.service`, `user.service`, `invitation.service`. Extract into a `TokenService`.

### Medium
- **Cache key strings** — keys like `auth:refresh:${userId}`, `verify:email:${token}`, `invite:${token}` hardcoded across 5+ services. Create a `CacheKeys` constants class to prevent typos and centralize changes.
- **Password validation decorator** — `@IsStrongPassword()` with identical options/message copy-pasted in `register.dto`, `change-password.dto`, `reset-password.dto`. Create one `@StrongPassword()` custom decorator.
- **Queue options** — `EmailQueueService` and `WebhookQueueService` both hardcode the same BullMQ options (`attempts: 3`, `backoff`, `removeOnComplete`). Share via base class or constants.
- **Limit check in interceptors** — `MemberInviteTrackerInterceptor` and `WebhookTrackerInterceptor` both have the same `if (limit !== -1 && count >= limit) throw ForbiddenException` pattern. Extract into a base interceptor.

### Low
- **`getActiveOrThrow()`** — org not-found + not-active check repeated in 3 places (`api-key.service`, `payment.service`). Add one method to `OrganizationService`.
- **Entity map/format methods** — each service has its own response-shaping logic with no shared pattern.

## Performance Issues (Pending Fix)

### High
- **N+1 in `trial-expiry.scheduler.ts`** — Fetches expired orgs then loops with a separate `UPDATE` per org. Should be a single bulk `UPDATE WHERE` using TypeORM `.update()`.
- **`getAll()` in `stripe-webhook.service.ts` (lines ~45, 88, 112)** — Loads an array just to take `orgs[0]`. Add a `getOneBy()` method to `OrganizationService` and use it instead.
- **Unbounded query in `user.service.ts` `findAll()`** — `GET /organizations/members` loads ALL members with no limit. Needs pagination (`take`/`skip`).

### Medium
- **Missing transaction in `payment.service.ts` `createSubscription()`** — 4 separate DB writes with no transaction. Crash between steps leaves org with `stripeCustomerId` but no subscription.
- **Missing transaction in `invitation.service.ts` accept flow** — User creation + invitation status update are separate writes. Partial failure leaves orphaned data.
- **No GIN index on webhook `events` JSONB column** — `webhook-dispatcher` queries `events @> :events::jsonb` on every dispatch — full table scan. Add: `CREATE INDEX idx_webhook_events ON webhook_endpoints USING gin(events)`.
- **Missing `@Index()` on audit log foreign keys** — `userId` and `apiKeyId` in `audit-log.entity.ts` have no index. Future audit queries = full table scans.
- **`getPlanLimit()` called on every request** — Usage tracker interceptor hits DB on cache miss for every authenticated request. Increase TTL or cache at a higher level.
- **Email processor creates new Nodemailer transport per job** — Should instantiate transport once in constructor and reuse.

### Low
- **`updateLastUsed()` on API key — fire and forget** — No retry if it fails silently.
- **Audit log creation — no retry** — Failed audit writes are silently swallowed.

## Security Issues (Pending Fix)

### Critical
- **CORS wildcard default** — `main.ts:10` uses `origin: '*'` when `ORIGIN` env var is missing. Should hard-fail in production if `ORIGIN` is not set.

### High
- **API key cache stale on deactivation** — Revoked API keys remain valid until Redis TTL expires. Cache is not invalidated on deactivation.
- **No rate limiting on API key creation** — Unlimited keys can be generated, bypassing plan `maxApiKeys` limits.

### Medium
- **Slug race condition** — Two concurrent org rename requests can produce duplicate slugs. The DB unique constraint throws a raw TypeORM error instead of a graceful 409.
- **Error messages in logs** — Org names, user IDs, and internal paths appear in log output. Helps attackers with log access enumerate data.

### Low
- **No CSP configured in Helmet** — `helmet()` called with no options in `main.ts`. Configure Content-Security-Policy explicitly.
- **Failed login attempts not logged** — No audit trail of auth failures, making brute force detection harder.
- **Refresh/verification tokens in plaintext Redis** — If Redis is exposed, all active tokens are readable. No encryption at rest.

