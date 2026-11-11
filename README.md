# HMS Backend — Phase 1 + Phase 2 (+ Clinical Depth + External Communications/AI)

This scaffold covers **Phase 1** (multi-tenant + auth), **Phase 2** (HMS
core modules), and two significant additions beyond the original build
order: **full clinical depth** (clinical notes, lab orders, prescriptions)
and **external-world communications with AI** (public inquiries, patient
portal chat, supplier restock drafting).

## Clinical depth + access control

Added on top of the original Phase 2 patients/appointments/billing/pharmacy:

- **Clinical notes** (`/clinical-notes`) — progress/consultation/discharge/nursing notes per patient.
- **Lab orders** (`/lab-orders`) — order → specimen_collected → in_progress → completed/cancelled, with result storage.
- **Prescriptions** (`/prescriptions`) — the doctor's *order*, distinct from pharmacy *dispensing* (which now optionally links back via `prescriptionId`).

**Access control, as requested:** `BILLING_STAFF` and `FRONT_DESK` are
absent from every `@Roles()` list on all three controllers above - not
by oversight, it's the explicit boundary. `PHARMACIST` is granted
read-only access to `/prescriptions` only (they need to see what to
fulfill), never to clinical notes or lab orders. See the comments in
`clinical-notes.controller.ts` for the reasoning.

## External communications + AI

Three channels, one shared `Conversation`/`Message` model
(`src/communications/conversation.entity.ts`), three very different AI
personas underneath (`ai-responder.service.ts`):

| Channel | Endpoint | Auth | AI access |
|---|---|---|---|
| **Public inquiries** | `POST /public/inquiries` | None (deliberately open) | Zero patient data. Grounded only in `OrgProfile` (hours/insurance/address). Escalates anything clinical/urgent/unverifiable. |
| **Patient portal chat** | `POST /patient-portal/chat` | Separate patient JWT (OTP login via `/patient-portal/auth/*`) | Read-only tool access to *that one patient's own* appointments/prescriptions/lab orders. No medical advice - reads facts back only. |
| **Supplier restock** | Triggered by `inventory.low_stock` event | N/A (internal) | Only ever *drafts*. Never sends. Staff must call `/supplier-comms/:id/approve-and-send`. |

Anything any persona flags (`needsHuman: true`) shows up in the unified
staff view: `GET /staff/conversations` (filterable by channel/status),
`POST /staff/conversations/:id/reply`.

### What's explicitly NOT handled

**Emergency/crisis messages are out of scope in this iteration** - by
design, not oversight. None of the three AI personas are built to
triage or handle emergencies; the public and patient personas are
instructed to escalate anything urgent-sounding to a human rather than
engage with it. If/when this is scoped, it should be treated as its own
workstream, not an extension of the chat AI - the right default is
"route to a human/phone line immediately," and that's a product/clinical
policy decision, not just an engineering one.

### Security/production follow-ups flagged in code

- **Patient portal login is OTP-over-a-stub** (`patient-auth.service.ts` just logs the code instead of sending SMS/email). Wire real delivery before this reaches real patients, and consider whether a stronger identity check is warranted before granting portal access at all.
- **No rate limiting on `/public/inquiries`** - it's unauthenticated and calls a paid LLM API per message. Add rate limiting at the gateway/infra layer before exposing this publicly.
- **Supplier "send" is a stub** - approval records final text but doesn't actually email/SMS the supplier yet; `SupplierContact` entity exists for when that's wired up.
- **Patient and staff JWTs use separate secrets** (`JWT_SECRET` vs `PATIENT_JWT_SECRET`) so a leak of one doesn't compromise the other.

### Event bus and Phase 3 integration layer

`DomainEventBus` now writes versioned events to each tenant's PostgreSQL
`event_outbox`. A polling dispatcher claims rows with `SKIP LOCKED`, retries
failures with exponential backoff, and invokes internal subscribers. The
Payroll and Business Automation Suite adapters deliver signed webhooks only
when the tenant has licensed the corresponding module. See
`PHASE3_INTEGRATIONS.md` for the event envelope, HMAC headers, consumer
idempotency requirements, and rollout steps.

## Setup (additions)

```bash
# In addition to the Phase 1 .env vars, also set:
ANTHROPIC_API_KEY=sk-ant-...     # required for any AI persona to respond for real
PATIENT_JWT_SECRET=...            # separate from JWT_SECRET
```

Migrations now run in this order automatically via `npm run seed:tenant`:
1. `users`, `audit_logs`
2. `patients`, `appointments`, `invoices`, `invoice_line_items`, `pharmacy_items`, `stock_movements`
3. `clinical_notes`, `lab_orders`, `prescriptions` (+ `prescriptionId` link on `stock_movements`)
4. `conversations`, `messages`, `org_profile`, `patient_portal_otps`, `supplier_contacts`
5. `event_outbox`, `staff_shifts` (Phase 3 integration layer)

## What's implemented (Phase 1)

- **Two-tier database model**
  - A **control-plane** Postgres database holding the `tenants` registry (one row per hospital/clinic/pharmacy client).
  - **Schema-per-tenant** isolation: each client gets their own Postgres schema (`tenant_acme_hospital`, etc.) holding their `users` and `audit_logs` tables (and later, patients/appointments/billing/pharmacy).
- **Tenant resolution middleware** — every request is resolved to a tenant via the `X-Tenant-Slug` header (or subdomain), before any route logic runs. Downstream code reads `req.tenant` and `req.tenantDataSource` rather than re-resolving tenancy itself.
- **JWT auth, scoped per tenant** — tokens carry `tenantId`; `JwtAuthGuard` rejects a token if it doesn't match the tenant resolved from the request. This is what stops a token issued for one hospital being replayed against another.
- **RBAC** — `@Roles(...)` decorator + `RolesGuard`, with a starter role set (`admin`, `doctor`, `nurse`, `pharmacist`, `billing_staff`, `front_desk`) matching what the architecture doc flagged for field-level access control later.
- **Audit log table** — created per tenant, ready for interceptors to write to as HMS modules are added (not yet wired to specific actions — that happens once there's something to audit, i.e. patient records).
- **Tenant onboarding script** (`npm run seed:tenant`) — registers a new client and provisions their isolated schema + tables in one step.

## What's intentionally NOT here yet

- **External delivery setup** — Phase 3 webhook adapters are implemented, but production Payroll/Automation URLs, HMAC secrets, tenant module licensing, and end-to-end receiver tests must still be configured.
- **Emergency/crisis handling** — explicitly out of scope this round; see "External communications + AI" above.
- **Real message delivery** — patient OTP codes, supplier "sends", and any future SMS/email integration are all stubbed (logged, not actually delivered).
- **Rate limiting on `/public/inquiries`** — it's unauthenticated and calls a paid LLM API per message; add this at the gateway/infra layer before exposing it publicly.

The registration endpoint bootstrap problem (who creates the *first*
admin user for a new tenant) is flagged in `auth.controller.ts` as a
follow-up — right now `/auth/register` is open, which is fine for
initial setup but should be locked down (invite-token or admin-only)
before this goes to real clients.

## Setup

```bash
npm install
copy .env.example .env   # fill in real DB credentials, JWT secrets, and ANTHROPIC_API_KEY

# 1. Create the control-plane database and run its migration
createdb hms_control
npm run migration:run

# 2. Create the shared tenant database (schemas live inside it)
createdb hms_tenants

# 3. Onboard your first client
#    (runs all tenant-schema migrations: Phase 1 foundation, Phase 2 HMS
#    modules, and Phase 3 event outbox + staff shifts)
npm run seed:tenant -- --slug=acme-hospital --name="Acme Hospital" --type=hospital

# 4. Start the API
npm run start:dev
```

## Trying it out

```bash
# Register the first user for Acme Hospital
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: acme-hospital" \
  -d '{"email":"admin@acme-hospital.com","password":"changeme123","firstName":"Jane","lastName":"Doe","role":"admin"}'

# Log in
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: acme-hospital" \
  -d '{"email":"admin@acme-hospital.com","password":"changeme123"}'
# -> save the returned accessToken as $TOKEN below

# Register a patient
curl -X POST http://localhost:3000/patients \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: acme-hospital" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"mrn":"MRN-0001","firstName":"John","lastName":"Kamau","dateOfBirth":"1990-04-12","email":"john.kamau@example.com"}'

# Add a pharmacy item and receive stock
curl -X POST http://localhost:3000/pharmacy/items \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: acme-hospital" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sku":"PARA-500","name":"Paracetamol 500mg","unitPrice":5,"reorderThreshold":50,"supplier":"MedSupply Kenya Ltd"}'

# Ask the public-inquiry AI something (no auth needed)
curl -X POST http://localhost:3000/public/inquiries \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: acme-hospital" \
  -d '{"message":"What are your opening hours?"}'

# Patient portal: request a login code, then verify it
curl -X POST http://localhost:3000/patient-portal/auth/request-code \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: acme-hospital" \
  -d '{"email":"john.kamau@example.com","mrn":"MRN-0001"}'
# -> check server logs for the OTP (stubbed, not actually emailed yet)
```

Every staff route needs both `X-Tenant-Slug` and `Authorization: Bearer <staff-token>`.
Patient portal routes need `X-Tenant-Slug` and, once logged in, `Authorization: Bearer <patient-token>` (a different token type - see `patient-jwt-payload.interface.ts`).

## Phase 3 integration layer

The backend now includes a durable PostgreSQL event outbox, versioned event
contracts, retrying webhook delivery, staff shift tracking, and outbound
integration adapters for Payroll and the Business Automation Suite. See
[`hms-backend/PHASE3_INTEGRATIONS.md`](hms-backend/PHASE3_INTEGRATIONS.md)
for webhook signing, tenant licensing, API routes, migration, and production
readiness requirements. Existing tenant schemas must receive the new tenant
migration before deploying this backend:

```bash
cd hms-backend
npm run migration:run:tenant -- --schema=tenant_acme_hospital
```

Payroll and Automation webhooks remain disabled until their URLs and HMAC
secrets are configured and each tenant has the corresponding licensed module.
Phase 4 chatbot work remains future scope.
