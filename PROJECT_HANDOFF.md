# Hospital System — verified handoff

## What is ready

All four applications were built successfully on 9 November 2026:

- `hms-backend` — NestJS API
- `hms-frontend` — staff console
- `hms-patient-portal` — patient-facing portal
- `hms-platform-admin` — cross-tenant administration console

The delivered source copy intentionally excludes the supplied local `.env`
file and other machine-specific artifacts. Copy each `.env.example` file to
`.env` and use unique secrets for the three JWT settings before running.

## Start locally

Docker was not installed on the verification machine, so the database could
not be started here. With Docker Desktop installed, run the commands below in
four terminals after opening the project folder.

```powershell
# Terminal 1 — database and API
cd hms-backend
docker compose up -d
Copy-Item .env.example .env
# Set JWT_SECRET, PATIENT_JWT_SECRET, and PLATFORM_JWT_SECRET in .env.
npm run migration:run
npm run seed:platform-admin -- --email=admin@example.com --password=changeme12345 --name="System Admin"
npm run seed:tenant -- --slug=acme-hospital --name="Acme Hospital" --type=hospital
npm run start:dev
```

```powershell
# Terminals 2–4 — user interfaces
cd hms-frontend; npm run dev          # http://localhost:5173
cd hms-patient-portal; npm run dev    # http://localhost:5174
cd hms-platform-admin; npm run dev    # http://localhost:5175
```

After onboarding the tenant, create the first staff account using the request
in `RUNNING_THE_SYSTEM.md`, then log into the staff console with organization
slug `acme-hospital`.

## Phase 3 integration layer (source implementation added 10 November 2026)

The backend now contains a tenant-scoped PostgreSQL event outbox, versioned
event contracts, retrying HMAC-signed webhook delivery, staff shift start and
completion, and an admin-only event delivery status endpoint. The new migration
is `1700000000010-CreateIntegrationOutboxAndStaffShifts.ts`. See
`hms-backend/PHASE3_INTEGRATIONS.md` for API and receiver contracts.

**Verification status (11 November 2026).** Verified in a clean environment with PostgreSQL 16:

- backend `npm run build` and all three frontend builds (`tsc` strict + Vite) pass;
- control-plane and tenant migrations apply from scratch, and a second tenant provisioned afterwards receives `event_outbox` and `staff_shifts` automatically;
- shift start → complete → `staff.shift.completed` outbox row → HMAC-signed delivery to separate Payroll and Automation receivers, including a simulated first-attempt failure that was retried and then delivered;
- tampered signatures rejected by the receiver; duplicate event IDs handled idempotently;
- role enforcement (non-admin blocked from admin endpoints and from completing another person's shift), cross-tenant token rejection (403), and missing/unknown tenant (404);
- failed-event replay (including audit log entry) and the status endpoint returning no payloads.

**Not verified:** a manual browser click-through of the UI, any real Payroll / Business Automation Suite service (neither is in this repository — only the contract and a reference receiver), HTTPS webhook delivery, and load/soak behaviour. Treat the remaining items under "Before production" as open.

**Known 409 on shift completion:** completing a shift less than a minute after starting it used to return `409 Conflict`. It now returns `400` with an explicit message. A real 409 on this route means the shift was already completed.

## Before production

- install backend dependencies and run `npm run build`;
- back up each tenant schema, then run
  `npm run migration:run:tenant -- --schema=tenant_schema_name` for every
  existing tenant before deploying the new backend;
- configure and test Payroll/Automation HTTPS webhook URLs, 32+ character
  HMAC secrets, and matching tenant `licensedModules` values;
- verify receiver HMAC validation and idempotent handling of duplicate event IDs;
- run end-to-end tests for shift completion, outbox retries, tenant isolation,
  and external webhook delivery;
- configure a real SMS/email provider for patient OTP and supplier delivery;
- add rate limiting before exposing public inquiries;
- obtain Safaricom Daraja credentials and a public HTTPS callback URL for
  M-Pesa; integrate with SHA eClaims;
- add password-reset, monitoring, retention, and deployment workflows.
