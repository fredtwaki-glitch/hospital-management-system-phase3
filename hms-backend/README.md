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

## Platform admin API (managing tenants as the reseller)

A **fourth, entirely separate auth realm** from staff/patient/AI above -
this is for *you*, operating across every hospital/clinic/pharmacy
client, not any single tenant's staff. Answers the "how easy is it to
rename a hospital / migrate a tenant" question directly:

| Action | Endpoint | What actually happens |
|---|---|---|
| Rename a tenant | `PATCH /platform/tenants/:id/profile` | One row update in the control DB. No schema touched, no data migration, existing sessions unaffected. |
| Change subdomain | `PATCH /platform/tenants/:id/slug` | Also just a row update - the underlying schema name never changes, and existing JWTs check `tenantId` not slug, so live sessions survive. The *old* subdomain does stop resolving, though - that's an operational cutover to communicate, not a technical risk. |
| Suspend / reactivate | `PATCH /platform/tenants/:id/status` | Sets `TenantStatus` - `TenantResolverMiddleware` already blocks `suspended` tenants at the request level (this was true even before this addition). |
| Change licensed modules | `PATCH /platform/tenants/:id/modules` | Updates `licensedModules` (validated against a known list: `hms`, `payroll`, `automation`). |
| Onboard a new tenant | `POST /platform/tenants` | Same `provisionTenantSchema` function the CLI script uses - registers the tenant row and creates+migrates their isolated schema in one call. |
| View history | `GET /platform/tenants/:id/audit-log` | Every action above is recorded in a control-plane-only `platform_audit_logs` table - who changed what, when. |

**Auth:** `POST /platform/auth/login` only - there is deliberately no
registration endpoint. Platform admin accounts (cross-tenant access to
every client) are created solely via `npm run seed:platform-admin`, run
by whoever controls the deployment.

**Isolation:** platform admin tokens use their own secret
(`PLATFORM_JWT_SECRET`), separate from staff (`JWT_SECRET`) and patient
(`PATIENT_JWT_SECRET`) tokens, and platform routes are excluded from
`TenantResolverMiddleware` entirely - there's no "current tenant" for
an endpoint that manages all of them.

**What this does NOT do yet:** the `dataResidencyRegion` field is
informational only - actually migrating a tenant's live data to a
different host/region isn't implemented (that's a real data-migration
project of its own, not a config flip). Also worth adding before this
is customer-facing: your own team likely needs more than one
undifferentiated "platform admin" role eventually (e.g. read-only
support access vs. full admin) - flagged as a follow-up, not built yet.

```bash
# One-time: create your own platform admin account
npm run seed:platform-admin -- --email=admin@acehospital.com --password=changeme123456 --name="admin"

# Log in
curl -X POST http://localhost:3000/platform/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acehospital.com","password":"changeme123456"}'
# -> save accessToken as $PLATFORM_TOKEN

# Rename a tenant
curl -X PATCH http://localhost:3000/platform/tenants/<tenant-id>/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -d '{"name":"Acme Medical Center"}'
```

## Insurance & billing

Answers "are patients with insurance cover considered, and is cover
personal or organizational" directly - **both, and a patient can hold
more than one at once**:

- **`Payer`** (`/payers`) - the insurer or scheme itself (e.g. SHA, Jubilee, AAR). `payerType` distinguishes `national_scheme` from `private_insurer`.
- **`PatientInsuranceCover`** (`/insurance-covers`) - a specific patient's policy under a payer. `coverCategory` is `personal` / `corporate` / `national`; when `corporate`, `organizationName` records the employer that holds the policy. A patient can have multiple covers, each with a `priority` of `primary` or `secondary` (e.g. SHA as primary, a corporate top-up as secondary) - the service enforces there's never more than one *active* cover at the same priority for one patient, so billing always knows which to bill first.

**Billing now reflects this** (`Invoice`):
- `primaryCoverId` / `secondaryCoverId` - which cover(s) this invoice was billed against (both null = plain self-pay)
- `claimStatus` - `not_applicable` → `pending_submission` → `submitted` → `approved`/`partially_approved`/`rejected` → `paid`, updated via `PATCH /invoices/:id/claim`
- `payerCoveredAmount` / `patientResponsibility` - the co-pay split; `patientResponsibility` is `totalAmount - payerCoveredAmount`, recalculated whenever the covered amount is updated
- `amountReceivedFromPayer` - actual disbursement from the insurer, tracked separately from `amountPaid` (direct patient payment) since they're two different money flows settling the same invoice
- Overall invoice status (`issued`/`partially_paid`/`paid`) is now based on **patient payments + payer disbursements combined** against the total, not patient payments alone

**What this deliberately does NOT do:** calculate coverage automatically
from a percentage or plan rules - `payerCoveredAmount` is entered by
staff as the claim is adjudicated (starts at 0/undetermined), since
actual coverage determination lives with the insurer, not this system.
Full claims submission/EDI integration with specific payers also isn't
built - `claimsSubmissionNotes` on `Payer` is a free-text placeholder
for that process today.

```bash
# Register a payer
curl -X POST http://localhost:3000/payers \
  -H "Content-Type: application/json" -H "X-Tenant-Slug: acme-hospital" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"SHA","payerType":"national_scheme"}'

# Give a patient a primary (national) and secondary (corporate) cover
curl -X POST http://localhost:3000/insurance-covers \
  -H "Content-Type: application/json" -H "X-Tenant-Slug: acme-hospital" -H "Authorization: Bearer $TOKEN" \
  -d '{"patientId":"<id>","payerId":"<sha-payer-id>","coverCategory":"national","memberNumber":"SHA-12345","priority":"primary"}'

curl -X POST http://localhost:3000/insurance-covers \
  -H "Content-Type: application/json" -H "X-Tenant-Slug: acme-hospital" -H "Authorization: Bearer $TOKEN" \
  -d '{"patientId":"<id>","payerId":"<jubilee-payer-id>","coverCategory":"corporate","organizationName":"Acme Corp Ltd","memberNumber":"JUB-98765","priority":"secondary"}'

# Bill an invoice against the primary cover, then progress the claim
curl -X POST http://localhost:3000/invoices \
  -H "Content-Type: application/json" -H "X-Tenant-Slug: acme-hospital" -H "Authorization: Bearer $TOKEN" \
  -d '{"patientId":"<id>","primaryCoverId":"<cover-id>","lineItems":[{"description":"Consultation","unitPrice":2000}]}'

curl -X PATCH http://localhost:3000/invoices/<invoice-id>/claim \
  -H "Content-Type: application/json" -H "X-Tenant-Slug: acme-hospital" -H "Authorization: Bearer $TOKEN" \
  -d '{"claimStatus":"approved","payerCoveredAmount":1500}'
```

## Patient demographics: citizenship, students, and minors

Answers "do we capture citizens, non-citizens, students, and children"
directly - yes, and each has real business logic behind it, not just
extra form fields:

- **Citizenship/identification** - `citizenshipStatus` (`citizen`/`non_citizen`), `nationality`, and `idType` (`national_id` / `passport` / `alien_id` / `refugee_id` / `birth_certificate` / `none`) with `idNumber`. `none` is a valid, common case - young children often don't have their own ID document yet.
- **Student status** - `isStudent`, `institutionName`, `studentIdNumber` - separate from insurance (a student may or may not have their own cover).
- **Minors** - a `guardianFullName`/`guardianRelationship`/`guardianPhone`/`guardianEmail`/`guardianIdNumber` set, distinct from `emergencyContactName/Phone`. These aren't the same role: a guardian has legal authority to consent on the patient's behalf; an emergency contact is just who to call. **`PatientsService` enforces that a patient under 18 cannot be registered or updated without guardian name + phone on file** - this isn't optional metadata, it's a blocked operation (`BadRequestException`) if missing.

**Patient portal implication, handled deliberately, not overlooked:**
a minor can't meaningfully consent to their own care or hold an
unsupervised login. `PatientAuthService.requestCode` now silently
declines to issue an OTP for a minor patient - the response looks
identical to "no matching patient" (consistent with the existing
anti-enumeration design, so the response doesn't leak a patient's age
status either). **Guardian-mediated portal access (a parent logging in
on behalf of their child) is not yet built** - right now a minor simply
has no self-service portal path, which is the safe default, but isn't
a complete solution if guardians need one. Flagged, not built, pending
a decision on how that should actually work (e.g. guardian's own
account with linked dependents, vs. something else).

```bash
# Registering a minor without guardian info is rejected
curl -X POST http://localhost:3000/patients \
  -H "Content-Type: application/json" -H "X-Tenant-Slug: acme-hospital" -H "Authorization: Bearer $TOKEN" \
  -d '{"mrn":"MRN-0002","firstName":"Baby","lastName":"Kamau","dateOfBirth":"2020-01-01"}'
# -> 400 Bad Request: guardianFullName and guardianPhone are required

# With guardian info, it succeeds
curl -X POST http://localhost:3000/patients \
  -H "Content-Type: application/json" -H "X-Tenant-Slug: acme-hospital" -H "Authorization: Bearer $TOKEN" \
  -d '{"mrn":"MRN-0002","firstName":"Baby","lastName":"Kamau","dateOfBirth":"2020-01-01","guardianFullName":"Jane Kamau","guardianRelationship":"parent","guardianPhone":"+254700000000","citizenshipStatus":"citizen","nationality":"Kenyan","idType":"birth_certificate","idNumber":"BC-00123"}'
```

## Staff credentials

Answers "do staff have credentials like staff numbers" - now yes,
`User` (staff) has:

- **`staffNumber`** - required on every new registration, unique per tenant. This is the actual HR/payroll join key - the Phase 3 Payroll webhook uses this stable HR join key, not the internal UUID.
- **`licenseNumber`** - professional registration/license number (medical board, nursing council, pharmacy board, etc.), nullable since it's not meaningful for every role (front desk/billing don't have one). Kept as free text since licensing formats vary by country/body.
- **`department`** and **`hireDate`** - basic HR context, both optional.

`staffNumber` is now included in the staff JWT payload alongside role/email, so it's available anywhere a token is already being read (e.g. for display in audit trails) without an extra DB lookup.

**Migration note if upgrading an existing deployment** (not relevant for
a brand-new tenant): `staffNumber` is added as a nullable column with a
partial unique index, not `NOT NULL`, specifically so the migration
doesn't fail against a tenant that already has staff rows on file. The
application layer already requires it for every new registration
regardless - see the migration file's comments for the backfill path if
you have existing staff to retrofit.

## Staff directory (added for the frontend)

`GET /users` (optionally `?role=doctor`) - a minimal staff directory,
added specifically because the first frontend (see the separate
`hms-frontend` project) needed a way to list providers when scheduling
an appointment, and no such endpoint existed. Returns a deliberately
narrow projection (name, role, staff number, department) - never
`passwordHash`, `email`, or `licenseNumber` - since this is a pick-list
for staff, not an account export. Any active staff role can read it.

## M-Pesa (Safaricom Daraja)

Two payment paths, both settling invoices through the exact same
`BillingService.recordPayment` a manual cash entry uses - M-Pesa and
manual payments are never a separate ledger:

- **STK Push** (`POST /invoices/:id/mpesa/stk-push`) - staff-initiated, for a patient paying at the till. Sends a payment prompt to the patient's phone for the invoice's outstanding balance; Safaricom's result arrives later, asynchronously, at `POST /mpesa/callback/:tenantSlug`.
- **C2B** (`POST /mpesa/c2b/:tenantSlug/confirmation`) - for a patient paying independently via Paybill, before or without staff involvement. Matched to an invoice by account number (invoice id, falling back to patient MRN); **if it can't be matched, the payment is still recorded** (money already moved - there's no "reject" option after the fact) and surfaces at `GET /mpesa/unmatched` for staff to link manually via `POST /mpesa/transactions/:id/link-invoice`.

**Why the callback routes look different from everything else:** Safaricom's
servers call `/mpesa/callback/:tenantSlug` and `/mpesa/c2b/:tenantSlug/*`
directly - they cannot send our `X-Tenant-Slug` header the way our own
frontend does. So these routes are excluded from `TenantResolverMiddleware`
entirely, and the tenant is resolved from the slug embedded in the URL
path instead (which we control, since we generate that URL when
registering with Safaricom).

**Every M-Pesa payment attempt is recorded** in `mpesa_transactions`
(including failed/cancelled ones and Safaricom's full raw callback
payload) - this is the audit trail for "the patient says they paid but
the invoice doesn't show it" disputes.

### What requires you, specifically (same as flagged in the scoping doc)
Sandbox works today with a free Safaricom developer account
(`MPESA_ENV=sandbox` in `.env`). **Production requires your own
registered paybill/shortcode and Safaricom business KYC** - that's a
business relationship only you can establish; the code is ready the
moment you have it, just switch `MPESA_ENV=production` and the real
credentials.

```bash
# Send an STK push for an invoice's outstanding balance
curl -X POST http://localhost:3000/invoices/<invoice-id>/mpesa/stk-push \
  -H "Content-Type: application/json" -H "X-Tenant-Slug: acme-hospital" -H "Authorization: Bearer $TOKEN" \
  -d '{"phoneNumber":"254712345678"}'

# Check for C2B payments that couldn't be auto-matched
curl http://localhost:3000/mpesa/unmatched \
  -H "X-Tenant-Slug: acme-hospital" -H "Authorization: Bearer $TOKEN"
```

**Local development note:** Safaricom cannot reach `localhost` for
callbacks - use `ngrok` (or similar) to get a public HTTPS URL, and set
`MPESA_CALLBACK_BASE_URL` to it.

## What's implemented (Phase 1)

- **Two-tier database model**
  - A **control-plane** Postgres database holding the `tenants` registry (one row per hospital/clinic/pharmacy client).
  - **Schema-per-tenant** isolation: each client gets their own Postgres schema (`tenant_acme_hospital`, etc.) holding their `users` and `audit_logs` tables (and later, patients/appointments/billing/pharmacy).
- **Tenant resolution middleware** — every request is resolved to a tenant via the `X-Tenant-Slug` header (or subdomain), before any route logic runs. Downstream code reads `req.tenant` and `req.tenantDataSource` rather than re-resolving tenancy itself.
- **JWT auth, scoped per tenant** — tokens carry `tenantId`; `JwtAuthGuard` rejects a token if it doesn't match the tenant resolved from the request. This is what stops a token issued for one hospital being replayed against another.
- **RBAC** — `@Roles(...)` decorator + `RolesGuard`, with a starter role set (`admin`, `doctor`, `nurse`, `pharmacist`, `billing_staff`, `front_desk`) matching what the architecture doc flagged for field-level access control later.
- **Audit log table** — created per tenant, ready for interceptors to write to as HMS modules are added (not yet wired to specific actions — that happens once there's something to audit, i.e. patient records).
- **Tenant onboarding script** (`npm run seed:tenant`) — registers a new client and provisions their isolated schema + tables in one step.

## Offline sync support (patient registration + appointments only)

Per the scoping doc's own reasoning, offline support only covers the
highest-value subset - **patient registration and appointment
scheduling**, not billing, which should require connectivity anyway.

Both `POST /patients` and `POST /appointments` now accept an optional
`clientRequestId` (any client-generated string, e.g. a UUID). This is
what makes it safe for the offline frontend to *replay* a queued write
after reconnecting, without knowing whether the first attempt actually
reached the server before the connection dropped:

- **Same `clientRequestId` seen twice** → the second call returns the
  original record instead of creating a duplicate. No new audit log
  entry or domain event is published for the replay - nothing new
  happened, so nothing new is recorded.
- **Two different offline devices register different patients with the
  same MRN** (the genuine conflict the scoping doc called out) → this
  is NOT silently resolved. It surfaces as a `409 Conflict` with a
  message pointing at the actual problem, so the offline queue can flag
  it for a human to sort out rather than losing a registration or
  crashing with a raw database error.

This is backend-only - it makes offline-capable frontends *possible*
without data-integrity risk, but doesn't make any current frontend
actually work offline (that's the frontend project's own scope - see
its README for what's built there).

## What's intentionally NOT here yet

- **External delivery setup** — Phase 3 webhook adapters are implemented, but production Payroll/Automation URLs, HMAC secrets, tenant module licensing, and end-to-end receiver tests must still be configured.
- **Emergency/crisis handling** — explicitly out of scope this round; see "External communications + AI" above.
- **Real message delivery** — patient OTP codes, supplier "sends", and any future SMS/email integration are all stubbed (logged, not actually delivered).
- **Rate limiting on `/public/inquiries`** — it's unauthenticated and calls a paid LLM API per message; add this at the gateway/infra layer before exposing it publicly.
- **Platform admin role granularity** — currently one flat role; add read-only vs. full-admin distinction once your own ops team grows.
- **Actual cross-region data migration** — `dataResidencyRegion` is stored but changing it doesn't move any data; that's real infrastructure work, not implemented here.
- **Password reset / forgot-password** — none of the three password-based auth realms (staff, platform admin) have a recovery flow yet; explicitly deferred, not forgotten.
- **Automatic coverage calculation / payer EDI integration** — `payerCoveredAmount` is staff-entered, not calculated from plan rules; no direct integration with any specific insurer's claims system.
- **Guardian-mediated patient portal access** — minors correctly can't self-login (see "Patient demographics" above), but there's no alternative path yet for a guardian to access their child's portal on the child's behalf.

The registration endpoint bootstrap problem (who creates the *first*
admin user for a new tenant) is flagged in `auth.controller.ts` as a
follow-up — right now `/auth/register` is open, which is fine for
initial setup but should be locked down (invite-token or admin-only)
before this goes to real clients.

## Setup

```bash
npm install
copy .env.example .env   # fill in real DB credentials, JWT secrets, and ANTHROPIC_API_KEYcopy .env.example .env

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
  -d '{"email":"admin@acme-hospital.com","password":"changeme123","firstName":"Jane","lastName":"Doe","role":"admin","staffNumber":"STAFF-0001"}'

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
[`PHASE3_INTEGRATIONS.md`](PHASE3_INTEGRATIONS.md)
for webhook signing, tenant licensing, API routes, migration, and production
readiness requirements. Existing tenant schemas must receive the new tenant
migration before deploying this backend:

```bash
npm run migration:run:tenant -- --schema=tenant_acme_hospital
```

Payroll and Automation webhooks remain disabled until their URLs and HMAC
secrets are configured and each tenant has the corresponding licensed module.
Phase 4 chatbot work remains future scope.
