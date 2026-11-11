# Phase 3 — Integration Layer

## What is included

1. **Event contracts** — versioned envelope with `eventId`, `tenantId`, `type`, `version`, `occurredAt`, and `data`.
2. **Durable outbox** — tenant-schema `event_outbox` table, polling dispatcher, row locking with `SKIP LOCKED`, retry with exponential backoff, stale-lock recovery, and terminal `failed` status after 10 delivery failures.
3. **Payroll hand-off** — staff can start and complete their own shift; tenant admins can view all shifts. Completion emits `staff.shift.completed` with the stable `staffNumber`, shift ID, start/end timestamps, break minutes, and net minutes worked.
4. **Automation hand-off** — HMS domain events can be delivered to the Business Automation Suite webhook.
5. **Security** — all shift routes require tenant-scoped JWT authentication; tenant administrators alone can list all staff shifts. Webhooks use HMAC-SHA256 signatures and idempotency keys. Integrations are only called for tenants whose `licensedModules` contains `payroll` or `automation`.

## Event envelope

```json
{
  "eventId": "stable-uuid-for-idempotency",
  "tenantId": "tenant-uuid",
  "type": "staff.shift.completed",
  "version": 1,
  "occurredAt": "2026-11-10T10:00:00.000Z",
  "data": {
    "shiftId": "shift-uuid",
    "staffId": "user-uuid",
    "staffNumber": "STAFF-001",
    "startedAt": "2026-11-10T07:00:00.000Z",
    "endedAt": "2026-11-10T16:00:00.000Z",
    "breakMinutes": 60,
    "minutesWorked": 480
  }
}
```

## Payroll webhook contract

Set `PAYROLL_WEBHOOK_URL` and `PAYROLL_WEBHOOK_SECRET`. Only `staff.shift.completed` events are sent. Headers:

- `X-HMS-Event-Id`: event UUID
- `X-HMS-Event-Type`: event name
- `X-HMS-Signature`: `sha256=<hex HMAC-SHA256 of the exact raw request body>`
- `Idempotency-Key`: same event UUID

The receiving Payroll service must verify the HMAC using the raw body and persist the event ID before processing. It must deduplicate by event ID and return a successful 2xx response for an event already processed (or return the prior result). HMS retries deliveries; the receiver must therefore be idempotent.

## Business Automation webhook contract

Set `AUTOMATION_WEBHOOK_URL` and `AUTOMATION_WEBHOOK_SECRET`. The Automation Suite receives the same envelope and signature headers for all persisted HMS domain events. It should route workflows by `type`, check tenant/module authorization, verify signatures, and deduplicate by `eventId`.

## Event delivery status & replay API (tenant admin only)

- `GET /integrations/events/status` — counts by outbox status plus the 20 most recent terminal failures (`eventId`, `eventType`, `attemptCount`, `lastError`, timestamps). **Event payloads are never returned.**
- `POST /integrations/events/:eventId/replay` — re-queues an event whose status is `failed` (resets attempts, status → `pending`). Replaying a non-failed event returns `409`; a malformed id returns `400`. Every replay is written to the tenant audit log (`integration.event.replayed`). Safe to use even if the first delivery actually landed, because consumers deduplicate by `eventId`.

The staff console exposes both under **Integrations** in the sidebar (admins only).

## Staff shift API

All endpoints require the normal tenant header/subdomain and staff JWT.

- `POST /staff-shifts/start` — starts a shift for the authenticated staff member.
- `PATCH /staff-shifts/:id/complete` — completes own shift (tenant admin may complete on behalf); optional JSON: `{"breakMinutes": 30, "notes": "..."}`.
- `GET /staff-shifts/me` — authenticated staff member's recent shifts.
- `GET /staff-shifts` — tenant admin only; recent shifts across the tenant.

Example PowerShell / curl flow (use a valid staff JWT and tenant slug):

```bash
curl -X POST http://localhost:3000/staff-shifts/start \
  -H "X-Tenant-Slug: acme-hospital" \
  -H "Authorization: Bearer $TOKEN"

# Use the returned shift id after the staff member finishes the shift.
curl -X PATCH http://localhost:3000/staff-shifts/<shift-id>/complete \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: acme-hospital" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"breakMinutes": 30, "notes": "Day shift"}'

curl http://localhost:3000/integrations/events/status \
  -H "X-Tenant-Slug: acme-hospital" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Shift completion errors

| Status | Message | Meaning |
|---|---|---|
| 400 | `This shift was started less than a minute ago…` | Elapsed time is under one minute. Wait, then retry. |
| 400 | `Break (N min) must be shorter than the time elapsed…` | Break is not shorter than the elapsed shift time. |
| 403 | `You can only complete your own shift` | Non-admin acting on another staff member's shift. |
| 403 | `Token does not belong to this tenant` | JWT was issued for a different tenant than the request's `X-Tenant-Slug`. |
| 404 | `No tenant could be resolved…` / `Unknown tenant: <slug>` | Missing or wrong `X-Tenant-Slug` (tenant resolution failure). |
| 409 | `This shift has already been completed` | Shift was already closed (e.g. double-click / stale page). |

Tenant-resolution failures are **404** (or **403** for a token/tenant mismatch), never 409.

Net minutes are calculated server-side from timestamps less break minutes. Payroll should calculate pay, overtime, allowances, deductions, and statutory obligations in its own system; HMS only reports recorded attendance time. This integration does not itself execute a payroll run.

## Reference receiver

`hms-backend/examples/webhook-receiver.js` is a dependency-free reference implementation of the receiver side: raw-body HMAC verification (constant-time), `Idempotency-Key` / `eventId` cross-check, de-duplication that returns 2xx for already-processed events, and a `FAIL_FIRST=N` switch that simulates failures to exercise HMS retries. Copy its logic into the Payroll and Automation services.

```bash
WEBHOOK_SECRET=<32+ chars, same as HMS> PORT=4000 node examples/webhook-receiver.js
```

## Enabling a tenant for Payroll / Automation

1. Set `PAYROLL_WEBHOOK_URL` / `PAYROLL_WEBHOOK_SECRET` (and/or the `AUTOMATION_*` pair) in the backend environment and restart.
2. License the tenant (platform admin UI, or `PATCH /platform/tenants/:id/modules` with `{"licensedModules":["hms","payroll","automation"]}`).

**Limitation:** the webhook URL and secret are process-wide, not per tenant. Every payroll-licensed tenant posts to the same URL and is signed with the same secret; the receiver must use `envelope.tenantId` to separate tenants. Per-tenant endpoints/secrets would need a control-plane schema change and are not part of this phase.

## Environment configuration

Copy the new variables from `.env.example` into the deployment environment:

```dotenv
EVENT_DISPATCH_INTERVAL_MS=5000
PAYROLL_WEBHOOK_URL=
PAYROLL_WEBHOOK_SECRET=
AUTOMATION_WEBHOOK_URL=
AUTOMATION_WEBHOOK_SECRET=
```

Leave webhook URLs blank until the corresponding service is deployed and has implemented the contract. If a tenant has licensed a module but its webhook URL or secret is missing, matching events retry rather than being silently discarded; after 10 failed attempts they move to `failed` for operator review. Production webhook URLs must use HTTPS. Do not put secrets in source control.

## Tenant licensing

The dispatcher sends Payroll events only when the tenant's `licensedModules` includes `payroll`, and Automation events only when it includes `automation`. Configure this in the tenant registry / platform-admin tenant provisioning before enabling the matching webhook. Internal HMS subscribers continue to receive events regardless of external module licensing.

## Database migration

The new tenant migration is `1700000000010-CreateIntegrationOutboxAndStaffShifts.ts`. Apply tenant migrations to every existing tenant schema before deploying the new backend. New tenant provisioning will pick up the migration automatically through the shared migration list.

For each existing tenant, connect to the tenant database and run the project's tenant migration runner with that tenant schema selected as `search_path`; do not run a tenant migration against the control-plane database. Back up first and verify the `event_outbox` and `staff_shifts` tables exist in every tenant schema.

## Delivery guarantees and limitations

- Outbox writes made through an `EntityManager` passed from the same database transaction are atomic with the business write. The new shift-completion flow uses this pattern.
- Existing HMS publishers have been moved to durable outbox persistence, but their existing business writes and event inserts are still separate operations. A later hardening pass should wrap each publisher's business mutation and outbox insert in one transaction to eliminate the small crash window between them.
- Delivery is at-least-once, not exactly-once. Consumers must deduplicate by `eventId`.
- Events remain in each tenant schema; the dispatcher iterates active tenants and processes their own outboxes. Tenant schemas remain isolated.
- `failed` rows require operator review; admins can inspect and replay them from the Integrations page or the replay endpoint above.
- Configure webhook delivery, tenant licensing, database migrations, and one end-to-end test per integration before enabling live integrations.
- Event payloads can contain personal or operational identifiers. Use HTTPS, restrict recipient access, minimize retained payloads, and complete the applicable privacy/security review before production sharing.

## Phase 4 compatibility

The event envelope and outbox are intended to let future patient-facing or staff-facing assistants consume events through the same API/event contracts. This phase does not add chatbot routes, LLM access, or autonomous clinical decision-making.
