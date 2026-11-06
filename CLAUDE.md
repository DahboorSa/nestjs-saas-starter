# CLAUDE.md

Guidance for Claude Code in this repository.

**The README is the source of truth** for setup, environment variables, commands, endpoints, auth, security behavior, plans and billing, webhooks, jobs, testing, project structure, and the roadmap and known issues. Read it instead of expecting those facts here, and never copy them into this file. This file holds only the rules and gotchas that keep a change safe.

## Definition of done

1. `yarn lint`, `yarn test`, and `yarn test:e2e` all pass (e2e needs Docker running). Note that `yarn lint` runs with `--fix`, so review the diff it produces.
2. Add or update unit tests; add e2e coverage when an endpoint changes.
3. Update the README for behavior and facts, and this file for rules. Each fact lives in one place.
4. Do not commit or push unless asked.

## TypeScript rules

- `strictNullChecks` and `noImplicitAny` are on. `strict` and `strictPropertyInitialization` are deliberately **off and pinned in `tsconfig.json`**: entities and DTOs are populated by TypeORM and class-validator, and editors on newer TypeScript default to strict if it is not pinned.
- **No `any` in production code** (ESLint error). Use a specific type, or `unknown` when the shape is genuinely open. Specs and `test/` may use `any` for mocks.
- Shared types, so reuse them instead of redefining:
  - `src/modules/stripe/stripe.types.ts` — Stripe resource and event types, derived from `StripeService` because the v22 entry point does not export them
  - `src/modules/billing/billing.types.ts` — billing response shapes
  - `src/jobs/job-data.types.ts` — queue payloads
- Read required configuration with `configService.getOrThrow` so a missing value fails at startup. Any unit-test `ConfigService` mock must provide `getOrThrow` as well as `get`.
- A nullable column typed `X | null` needs an explicit `type` in `@Column(...)`; otherwise TypeORM cannot infer it and the app crashes at startup.
- Comments explain _why_ only: no banners, nothing that restates the code. **Do not delete JSDoc on DTOs and controllers**: `introspectComments` turns it into the Swagger descriptions.
- DTOs: no manual `@ApiProperty()`. Add `?` to genuinely optional properties (with `@IsOptional()`) so the generated schema does not mark them required.
- Resolve circular imports with a dedicated leaf module, not `forwardRef()`.

## Security rules

- **Never pass a raw error or job data to a logger.** Nest prints an object's own properties, and an `AxiosError` carries `config` with URLs, signature headers, and bodies. Use `logError(this.logger, 'context', error)`. Opaque IDs (`orgId`, `userId`) are fine to log.
- **Never put a raw token in a Redis key or value.** Use `hashToken(token)`. When you add a token flow, add its key to the README's Redis keys table.
- **Do not reveal whether an email is registered** on unauthenticated paths: register, forgot-password, resend-verification, and change-email answer identically, and login does a dummy verification for unknown emails. Accepted exceptions are in the README (invitations message, residual timing). The constraint behind them is that one email maps to one organization.
- **Failed logins** go through `auditLoginFailed` (`auth.login_failed`). Never store the submitted email: it is attacker-controlled and people paste passwords into that field. The `AUTH_` prefix is what keeps these rows out of `GET /audit-logs`.
- Every `POST`, `PATCH`, and `DELETE` endpoint is `@JwtOnly()`. API keys are read-only by design, and their scopes are stored but not enforced.
- A new HTML-serving route needs its own CSP in `src/config/helmet.config.ts`; the API default is `default-src 'none'`.
- `rawBody: true` in `main.ts` is required for Stripe signature verification. Do not add a body parser that consumes it.

## Architecture gotchas

- Audit-log writes and webhook dispatches are fire-and-forget: attach `.catch((error) => logError(...))` and never let them fail the request.
- Enqueue jobs only **after** the database transaction commits, because workers pick them up immediately (`AuthService.register()` does this).
- `StripeCoreModule` contains only `StripeService`, so `OrganizationModule` can use Stripe without a circular import. `StripeModule` imports it plus `OrganizationModule` and re-exports the core for `BillingModule`. Do not merge them.
- Every plan needs a `stripePriceId`; `BillingService` and `OrganizationService.updatePlan()` throw without one. A plan limit of `-1` means unlimited.
- Webhook delivery writes one row per event: `createPending()` once, then `recordAttempt()` on each attempt, with the row id stored on the job via `updateData`.
- The trial-expiry scheduler cancels before it suspends, so an org suspended in the same run keeps its grace period. Each phase is idempotent and wrapped in try/catch, so the next run retries failures.
- Revoking an API key deletes `apikey:valid:<hash>`. The strategy refills that entry on a database hit and trusts it until `API_KEY_EXPIRATION` lapses (only `expiresAt` is re-checked), so any future scope or expiry update path must delete it too.

## Database and migrations

- Follow the README's Database section (`DB_SYNC=false`, `yarn build` before `migration:generate`).
- Deployed services set `DB_MIGRATIONS_RUN=true`, so a migration runs on the next start (the glob in `database.module.ts` picks up compiled `dist/` migrations). Write each one to be safe against the previous release still running during a deploy.
- Postgres cannot drop one enum value. A migration that adds a value uses `ADD VALUE IF NOT EXISTS`, and its `down()` rebuilds the type from the full list of values at that point.
- `audit_logs` is indexed on `(organization_id, created_at)` only. `user_id` and `api_key_id` are deliberately not indexed: nothing queries by them and audit is write-heavy. `webhook_endpoints.events` has no GIN index because the dispatcher query is already narrowed by the org foreign key.

## Testing notes

The README's Testing & CI section covers how to run things. The e2e harness has gotchas worth knowing:

- `test/helpers/env.setup.ts` hardcodes the environment. `DB_SYNC=true` is intentional there, so no migrations run for e2e.
- `test/helpers/app.setup.ts` stubs the email queue (it records jobs in `queuedEmails`), the AI provider, and Stripe, and seeds plans with fake `stripePriceId`s.
- Tests read raw tokens from the recorded email jobs (`getEmailToken` in `fixtures.ts`), never from Redis, because Redis only holds hashes.
- `@nestjs/observe` is ESM-only, which Jest cannot load, so `test/jest-e2e.json` maps it to `test/helpers/observe.stub.ts`. Any other ESM-only dependency needs the same treatment.
- `POST /auth/register` returns no IDs, so tests look the new user up by email.
- Arguments after `yarn test:e2e` are not forwarded to jest; use the single-file recipe in the README.
