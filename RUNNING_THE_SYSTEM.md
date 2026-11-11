# Running the Whole System

Four projects, run together: **hms-backend** (API), **hms-frontend** (staff
console), **hms-patient-portal**, **hms-platform-admin**. Extract all four
zips as sibling folders before starting.

```
your-project-folder/
  hms-backend/
  hms-frontend/
  hms-patient-portal/
  hms-platform-admin/
```

## Two things this guide fixed on the way here

Worth knowing about, since they'd have silently broken a "run it all"
attempt otherwise:

1. **All three frontends defaulted to port 5173.** Fixed - staff console
   stays on 5173, patient portal moved to 5174, platform admin to 5175.
2. **The backend had no CORS configuration at all.** A browser blocks
   cross-origin requests by default, and every frontend runs on a
   different port than the API (3000) - without this, none of the three
   frontends could have called the backend, at all, from a browser.
   Fixed in `main.ts` (`CORS_ORIGINS` env var, defaults to the three dev
   ports above if unset).

## 1. Database

```bash
cd hms-backend
docker compose up -d
```

This starts Postgres and creates both databases (`hms_control`,
`hms_tenants`) automatically on first run. No manual `createdb` needed.

*(No Docker? Run Postgres yourself and `createdb hms_control && createdb hms_tenants` instead - see the backend README.)*

## 2. Backend

```bash
# still in hms-backend/
npm install
cp .env.example .env
# Fill in JWT_SECRET, PATIENT_JWT_SECRET, PLATFORM_JWT_SECRET (any random strings for local dev)
# Leave MPESA_* and ANTHROPIC_API_KEY blank for now - both degrade gracefully:
#   - no ANTHROPIC_API_KEY: AI replies return a stub message instead of erroring
#   - no MPESA_* creds: the M-Pesa button will fail when clicked, everything else works

npm run migration:run          # control-plane tables
npm run seed:platform-admin -- --email=you@yourcompany.com --password=changeme12345 --name="Your Name"
npm run seed:tenant -- --slug=acme-hospital --name="Acme Hospital" --type=hospital

npm run start:dev              # http://localhost:3000
```

## 3. The three frontends (separate terminals)

```bash
cd hms-frontend        && npm install && cp .env.example .env && npm run dev   # :5173
cd hms-patient-portal   && npm install && cp .env.example .env && npm run dev   # :5174
cd hms-platform-admin   && npm install && cp .env.example .env && npm run dev   # :5175
```

All three `.env` files just need `VITE_API_BASE_URL=http://localhost:3000` - already the default if you skip the `cp`.

## 4. First walkthrough - do these in order

**a. Platform admin** (localhost:5175) - log in with the account from
`seed:platform-admin`. You'll see the `acme-hospital` tenant already
provisioned. This is where you'd rename/suspend/manage it going forward.

**b. Staff console** (localhost:5173) - the `seed:tenant` script doesn't
create a staff login itself, so register the first one:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" -H "X-Tenant-Slug: acme-hospital" \
  -d '{"email":"admin@acme-hospital.com","password":"changeme123","firstName":"Jane","lastName":"Doe","role":"admin","staffNumber":"STAFF-0001"}'
```

Then sign in at localhost:5173 with Organization = `acme-hospital` and
those credentials. Register a patient, schedule a visit, create an
invoice - the thin slice from earlier, now with a real UI.

**c. Patient portal** (localhost:5174) - register a patient in the staff
console first (with an email address). Then on the portal's login
screen, request a code with that patient's email + MRN. **The code
isn't actually emailed** (that's stubbed - see the backend README) - it
prints to the **backend's terminal log** instead. Copy it from there.

## 5. M-Pesa (optional, needs your own Safaricom sandbox account)

The STK push button on an invoice will error until `MPESA_*` is filled
in in the backend `.env`. Safaricom's sandbox is free to register for.
One extra requirement beyond the credentials: `MPESA_CALLBACK_BASE_URL`
must be a **publicly reachable HTTPS URL** - Safaricom's servers can't
reach `localhost`. Use `ngrok http 3000` (or similar) and put the
resulting URL there. See the backend README's M-Pesa section for the
full explanation of why the callback flow is designed this way.

## 6. What's still missing for a real deployment

Not a checklist to do right now - just so nothing here is mistaken for
"done, ship it." All of these are also called out in each project's own
README where relevant:

- No password reset for staff/platform admin logins
- Patient portal OTP and supplier "sends" are logged, not actually delivered (no SMS/email provider wired)
- No rate limiting on the public inquiry endpoint
- Offline support exists only for patient registration + appointment scheduling in the staff console (see its README) - not billing, not the other two frontends
- SHA eClaims isn't real - the claim/payer model is built, but it doesn't talk to SHA's actual API
- Phase 3 Payroll/Automation webhook receivers still need to be deployed, configured with HTTPS URLs and 32+ character HMAC secrets, licensed per tenant, and tested end-to-end. See `hms-backend/PHASE3_INTEGRATIONS.md`.
- Existing tenant schemas must run the Phase 3 tenant migration before deploying the updated backend: `cd hms-backend` then `npm run migration:run:tenant -- --schema=tenant_schema_name`.

## 7. Trying offline mode

In the staff console, open Chrome DevTools → **Network** tab → set
throttling to **Offline**. Register a patient or schedule an appointment -
it queues instead of failing (watch the sidebar badge turn amber). Set
throttling back to **Online** and it syncs automatically within a few
seconds - watch the badge, or check `/sync-queue`.
