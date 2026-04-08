# NestJS SaaS Starter

![CI](https://github.com/dahboorSa/nestjs-saas-starter/actions/workflows/ci.yml/badge.svg)

A production-ready, multi-tenant SaaS backend built with NestJS. Includes authentication, RBAC, organizations, API keys, webhooks, usage tracking, audit logging, and job queues out of the box.

---

## Tech Stack

- **Framework**: NestJS (Node.js / TypeScript)
- **Database**: PostgreSQL via TypeORM
- **Cache / Queue**: Redis (ioredis) + BullMQ
- **Auth**: JWT (access + refresh tokens) + API Key (passport-custom)
- **Email**: Mailtrap / Nodemailer
- **Scheduling**: @nestjs/schedule (cron jobs)
- **Rate Limiting**: @nestjs/throttler
- **Password Hashing**: Argon2
- **Containerization**: Docker + Docker Compose

---

## Getting Started

### Prerequisites

- Node.js 22+
- Docker & Docker Compose
- Yarn

### With Docker (recommended)

```bash
docker-compose up
```

This starts the NestJS app, PostgreSQL, and Redis together.

### Without Docker

1. Start PostgreSQL and Redis locally
2. Copy and configure your environment:

```bash
cp .env.example .env
```

3. Install dependencies:

```bash
yarn install
```

4. Run migrations and seed plans:

```bash
yarn migration:run
yarn seed:run
```

5. Start in development mode:

```bash
yarn start:dev
```

---

## Environment Variables

| Variable                 | Description                             | Example                 |
| ------------------------ | --------------------------------------- | ----------------------- |
| `DB_HOST`                | Postgres host                           | `localhost`             |
| `DB_PORT`                | Postgres port                           | `5432`                  |
| `DB_USER`                | Postgres user                           | `saas_user`             |
| `DB_PASSWORD`            | Postgres password                       | `saas_password`         |
| `DB_NAME`                | Postgres database                       | `saas_dev`              |
| `DB_SYNC`                | Auto-sync entities (never true in prod) | `false`                 |
| `DB_LOGGING`             | Enable query logging                    | `false`                 |
| `REDIS_HOST`             | Redis host                              | `localhost`             |
| `REDIS_PORT`             | Redis port                              | `6379`                  |
| `JWT_SECRET`             | Access token secret                     | `your_secret`           |
| `JWT_EXPIRES_IN`         | Access token TTL                        | `15m`                   |
| `JWT_REFRESH_SECRET`     | Refresh token secret                    | `your_refresh_secret`   |
| `JWT_REFRESH_EXPIRY`     | Refresh token TTL                       | `7d`                    |
| `REFRESH_TOKEN_TTL`      | Refresh token Redis TTL (seconds)       | `604800`                |
| `API_KEY_PREFIX`         | API key prefix                          | `sk_live_`              |
| `API_KEY_TTL`            | API key cache TTL (seconds)             | `300`                   |
| `INVITE_TOKEN_TTL`       | Invitation token TTL (seconds)          | `172800`                |
| `TTL_EXPIRATION`         | General token TTL (seconds)             | `86400`                 |
| `THROTTLER_TTL`          | Rate limit window (ms)                  | `60000`                 |
| `THROTTLER_LIMIT`        | Max requests per window                 | `600`                   |
| `THROTTLER_AUTH_LIMIT`   | Max auth requests per window            | `100`                   |
| `MAILTRAP_API_KEY`       | Mailtrap API key                        | `your_key`              |
| `MAILTRAP_TEST_INBOX_ID` | Mailtrap inbox ID                       | `123456`                |
| `MAILTRAP_FROM_EMAIL`    | Sender email                            | `noreply@example.com`   |
| `MAILTRAP_FROM_NAME`     | Sender name                             | `SaaS App`              |
| `URL_PATH`               | Base URL for email links                | `http://localhost:3000` |
| `ORIGIN`                 | CORS allowed origins (comma-separated)  | `http://localhost:3000` |
| `STRIPE_SECRET_KEY`      | Stripe secret key                       | `sk_test_...`           |
| `STRIPE_WEBHOOK_SECRET`  | Stripe webhook signing secret           | `whsec_...`             |

> **Important**: Always set `DB_SYNC=false` before running migrations. Never use `DB_SYNC=true` in production.

---

## Commands

```bash
# Development
yarn start:dev          # Watch mode
yarn build              # Compile to dist/
yarn start:prod         # Run compiled output

# Testing
yarn test               # Unit tests
yarn test:watch         # Watch mode
yarn test:cov           # Coverage report
yarn test:e2e           # E2E tests
yarn test -- --testPathPattern=auth.service  # Single file

# Linting / Formatting
yarn lint               # ESLint with auto-fix
yarn format             # Prettier

# Database
yarn migration:generate src/database/migrations/<Name>
yarn migration:run
yarn migration:revert
yarn migration:show
yarn seed:run           # Populate plans table

# Circular dependency check
npx madge --circular src/main.ts
```

---

## API Endpoints

### Auth — `/auth`

| Method | Endpoint                    | Access   | Description                    |
| ------ | --------------------------- | -------- | ------------------------------ |
| POST   | `/auth/register`            | Public   | Register new org + owner user  |
| POST   | `/auth/login`               | Public   | Login, returns token pair      |
| POST   | `/auth/verify-email`        | Public   | Verify email with token        |
| POST   | `/auth/resend-verification` | Public   | Resend verification email      |
| POST   | `/auth/refresh-token`       | Public   | Rotate access + refresh tokens |
| POST   | `/auth/forgot-password`     | Public   | Send password reset email      |
| POST   | `/auth/reset-password`      | Public   | Reset password with token      |
| POST   | `/auth/change-password`     | JWT only | Change password                |
| POST   | `/auth/logout`              | JWT only | Logout and blacklist token     |

### Users — `/users`

| Method | Endpoint                  | Access   | Description                               |
| ------ | ------------------------- | -------- | ----------------------------------------- |
| GET    | `/users/me`               | JWT only | Get current user profile                  |
| PATCH  | `/users/me`               | JWT only | Update profile (firstName, lastName)      |
| POST   | `/users/me/email`         | JWT only | Request email change (sends verification) |
| POST   | `/users/me/email/confirm` | Public   | Confirm email change with token           |

### Organizations — `/organizations`

| Method | Endpoint                              | Access                | Description        |
| ------ | ------------------------------------- | --------------------- | ------------------ |
| GET    | `/organizations/me`                   | Authenticated         | Get org details    |
| GET    | `/organizations/members`              | Authenticated         | List org members   |
| PUT    | `/organizations/me`                   | JWT only, Owner/Admin | Update org name    |
| PUT    | `/organizations/members/:userId/role` | JWT only, Owner       | Update member role |
| DELETE | `/organizations/members/:userId`      | JWT only, Owner/Admin | Remove member      |

### Plans — `/plans`

| Method | Endpoint | Access | Description              |
| ------ | -------- | ------ | ------------------------ |
| GET    | `/plans` | Public | List all available plans |

### Invitations — `/invitations`

| Method | Endpoint              | Access                | Description                                            |
| ------ | --------------------- | --------------------- | ------------------------------------------------------ |
| GET    | `/invitations`        | Authenticated         | List invitations (query: `status`, default: `pending`) |
| POST   | `/invitations`        | JWT only, Owner/Admin | Send invitation                                        |
| POST   | `/invitations/accept` | Public                | Accept invitation with token                           |

### API Keys — `/api-keys`

| Method | Endpoint        | Access                | Description    |
| ------ | --------------- | --------------------- | -------------- |
| GET    | `/api-keys`     | Owner/Admin           | List API keys  |
| POST   | `/api-keys`     | JWT only, Owner/Admin | Create API key |
| DELETE | `/api-keys/:id` | JWT only, Owner/Admin | Revoke API key |

### Webhooks — `/webhooks`

| Method | Endpoint                    | Access                | Description                        |
| ------ | --------------------------- | --------------------- | ---------------------------------- |
| GET    | `/webhooks`                 | Authenticated         | List webhook endpoints             |
| POST   | `/webhooks`                 | JWT only, Owner/Admin | Create webhook endpoint            |
| DELETE | `/webhooks/:id`             | JWT only, Owner/Admin | Delete webhook endpoint            |
| GET    | `/webhooks/:id/deliveries`  | JWT only, Owner/Admin | List delivery history for endpoint |

### Usage — `/usage`

| Method | Endpoint  | Access        | Description                                    |
| ------ | --------- | ------------- | ---------------------------------------------- |
| GET    | `/usage`  | Authenticated | Get current API call usage, limit, and period  |

### Payments — `/payments`

| Method | Endpoint                  | Access          | Description                        |
| ------ | ------------------------- | --------------- | ---------------------------------- |
| POST   | `/payments/subscription`  | JWT only, Owner | Create Stripe subscription         |
| GET    | `/payments/subscription`  | JWT only, Owner | Get current subscription status    |

---

## Authentication

Two parallel strategies:

- **JWT** (`Authorization: Bearer <jwt>`) — Standard access token auth
- **API Key** (`Authorization: Bearer <api-key>`) — Org-scoped API key auth

### Decorators

| Decorator                | Effect                          |
| ------------------------ | ------------------------------- |
| `@Public()`              | Bypass authentication entirely  |
| `@JwtOnly()`             | Block API key auth, require JWT |
| `@Roles(UserRole.OWNER)` | Enforce role RBAC               |

### Token Flow

1. Register → email verification token sent
2. Verify email → account activated
3. Login → `accessToken` (15m) + `refreshToken` (7d) issued
4. Refresh → token pair rotated, old refresh token deleted from Redis
5. Logout → refresh token deleted, access token blacklisted in Redis

### Cache Key Conventions

| Key                     | Purpose                          |
| ----------------------- | -------------------------------- |
| `auth:refresh:<userId>` | Stored refresh token             |
| `auth:blacklist:<jti>`  | Blacklisted access tokens        |
| `verify:email:<token>`  | Email verification tokens        |
| `invite:<token>`        | Invitation tokens                |
| `change:email:<token>`  | Email change confirmation tokens |
| `apikey:valid:<hash>`   | API key lookup cache             |
| `usage:*:api_calls:*`   | Usage metrics                    |

---

## Role Hierarchy

`OWNER > ADMIN > MEMBER`

Key rules:

- Only OWNER can change roles (cannot assign OWNER, cannot update another OWNER)
- OWNER and ADMIN can remove members (cannot remove themselves; ADMIN cannot remove ADMIN/OWNER)
- API key create/delete requires JWT (no API key auth)

---

## Webhook Events

Webhooks are delivered via HMAC-SHA256 signed HTTP POST with headers:

- `X-Webhook-Signature`
- `X-Webhook-Timestamp`
- `X-Webhook-Delivery`
- `X-Webhook-Event`

Available events:

| Event                    | Trigger                 |
| ------------------------ | ----------------------- |
| `member.invited`         | Invitation sent         |
| `member.invite_accepted` | Invitation accepted     |
| `member.role_updated`    | Member role changed     |
| `member.updated`         | Member profile updated  |
| `member.removed`         | Member removed from org |
| `member.email_updated`   | Member email changed    |
| `org.updated`            | Organization updated    |
| `apikey.created`         | API key created         |
| `apikey.revoked`         | API key revoked         |
| `plan.limit_exceeded`    | Usage limit hit         |

---

## Background Jobs

### Email Queue

Handles: welcome emails, verification, invite emails, password reset, email change confirmation.

### Webhook Queue

Delivers webhooks to registered endpoints with:

- HMAC-SHA256 signing
- 5s timeout per request
- 3 retry attempts with exponential backoff
- Delivery records saved per attempt

### Schedulers

| Cron                     | Job                                         |
| ------------------------ | ------------------------------------------- |
| Every 5 minutes          | Sync usage metrics from Redis → PostgreSQL  |
| 1st of month at midnight | Reset monthly usage counters in Redis       |
| Every day at midnight    | Expire pending invitations past `expiresAt` |

---

## Project Structure

```
src/
  app.module.ts              # Root module
  main.ts                    # Bootstrap
  config/                    # database.config.ts, jwt.config.ts
  database/
    database.module.ts       # TypeORM setup
    data-source.ts           # CLI DataSource (migrations/seeds)
    migrations/              # TypeORM migration files
    seeds/                   # Plan seeders
  cache/                     # Redis wrapper
  jobs/
    queues/                  # Email + webhook queue producers
    processors/              # BullMQ workers
    schedulers/              # Cron jobs
  common/
    decorators/              # All shared decorators (@Public, @JwtOnly, @Roles, @CurrentUser, @AuditContext, @SkipUsageTracking)
    dto/                     # Shared DTOs
    interceptors/            # Usage tracker interceptor
    utils/                   # JWT utility, slug utility
  enums/                     # All enums
  modules/
    auth/                    # Auth flows
    users/                   # User profile
    organizations/           # Org + member management
    plans/                   # Plan listing
    invitations/             # Invitation lifecycle
    api-keys/                # API key management
    webhook/                 # Webhook endpoints
    webhook-dispatchers/     # Webhook dispatch service
    webhook-deliveries/      # Delivery records
    usage/                   # Usage tracking + GET /usage endpoint
    usage-records/           # Usage persistence
    audit-logs/              # Audit log service
    stripe/                  # Stripe SDK wrapper (StripeService)
    payments/                # Subscription management (POST/GET /payments/subscription)
```

---

## Roadmap

### Done

- [x] Auth — register, login, logout, JWT + refresh token rotation
- [x] Email verification + resend verification
- [x] Forgot password / reset password / change password
- [x] Multi-tenant organizations with slug
- [x] Role-based access control (OWNER / ADMIN / MEMBER)
- [x] Member management — list, update role, remove
- [x] User profile — GET + PATCH
- [x] Email change flow with verification + token rotation
- [x] Plan listing (`GET /plans`, public)
- [x] Plan selection on registration
- [x] Invitations — send, accept, list by status
- [x] Invitation expiry via daily cron job
- [x] API keys — create, list, revoke (JWT only)
- [x] Webhooks — create, list, delete
- [x] Webhook delivery with HMAC-SHA256 signing + retries
- [x] Webhook delivery records
- [x] Audit logging on all significant actions
- [x] Usage tracking (API calls) via interceptor
- [x] Usage sync scheduler (Redis → PostgreSQL)
- [x] Usage reset scheduler (monthly)
- [x] Rate limiting (global + stricter auth limits)
- [x] Redis caching for API keys and tokens
- [x] Docker Compose setup (app + Postgres + Redis)

### In Progress / Planned

#### Payment Integration

- [x] `StripeModule` + `StripeService` setup
- [x] `POST /payments/subscription` — create Stripe subscription
- [x] `GET /payments/subscription` — get current subscription status
- [x] `paymentStatus` field on org (`FREE`, `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`)
- [x] `stripePriceId` on `PlanEntity`, `stripeCustomerId` + `stripeSubscriptionId` on `OrganizationEntity`
- [ ] `POST /stripe/webhook` — handle Stripe events (payment success, failure, cancellation)
- [ ] Trial expiry scheduler → transition org to `SUSPENDED`

#### Plans & Upgrades

- [ ] `PATCH /organizations/plan` — upgrade/downgrade endpoint
- [ ] `pendingPlan` field on org for scheduled downgrades
- [ ] Enforce plan limits (`maxWebhooks`, `maxMembers`)

#### API Keys

- [x] `lastUsedAt` tracking on key usage

#### Webhooks

- [x] `GET /webhooks/:id/deliveries` — delivery history endpoint
- [ ] Missing events: `plan.upgraded`, `plan.downgraded`, `api.limit_exceeded`

#### Usage & Observability

- [x] `GET /usage` — endpoint for orgs to query current usage and limits
- [ ] Usage limit warning notifications (80%, 95%)

#### Organization

- [ ] Organization deletion endpoint
- [ ] Transfer ownership endpoint

#### AI Integration

- [ ] **AI Usage Insights** — `GET /usage/insights` — analyzes org API usage patterns and returns actionable recommendations (e.g. approaching limits, peak usage times, upgrade suggestions)
- [ ] **Audit Log Anomaly Detection** — monitors audit logs for suspicious activity; if failed login attempts from a specific IP exceed a configurable threshold, the IP is automatically blacklisted in Redis
- [ ] **Smart Onboarding Assistant** — `POST /onboarding/ask` — new orgs can ask natural language questions about the API, answered based on their current plan, usage, and configuration

#### AWS Integration

- [ ] **SES** — Replace Mailtrap with AWS SES for production email delivery
- [ ] **RDS** — Replace local PostgreSQL with RDS (db.t3.micro)
- [ ] **ElastiCache** — Replace local Redis with ElastiCache
- [ ] **ECR + ECS** — Containerize and deploy via ECS Fargate using existing `Dockerfile`
- [ ] **S3** — File uploads (org logo, user avatar)

#### Developer Experience

- [ ] Swagger / OpenAPI docs (`@nestjs/swagger`)
- [ ] Pagination + filtering on list endpoints
- [x] Unit tests for all services and controllers
- [x] SOLID principles applied (SRP, OCP, DIP refactoring)
- [ ] E2E tests for all API endpoints

---

## ⭐ Support

If this project helped you, please give it a **star on GitHub** —
it helps other developers find it and motivates me to keep improving it!

[![GitHub stars](https://img.shields.io/github/stars/dahboorSa/NestJS-SaaS-Starter?style=social)](https://github.com/dahboorSa/NestJS-SaaS-Starter)

---

## 👩‍💻 Author

Made with 🌸 by **Sebaa Dahboor**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Sebaa%20Dahboor-0077B5?style=flat&logo=linkedin)](https://www.linkedin.com/in/saba-dahboor/)

---

## License

MIT
