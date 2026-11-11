# HMS Platform Admin Console

The third and last of the three frontends — this one's for *you*, not any
hospital's staff. Manages every tenant on the platform: rename, change
subdomain, suspend/reactivate, adjust licensed modules, and view the
audit trail of who changed what.

Answers the earlier "how easy is it to rename a hospital" question
directly, with an actual UI now instead of just curl examples: open the
tenant, edit the name, save. Same for suspension and module changes.

## Auth

Logs in against `POST /platform/auth/login` - **not** the staff or
patient login. Platform admin accounts have no self-registration
endpoint (see backend `platform-admin` module) - create one first via
the backend's `npm run seed:platform-admin` CLI script before you can
log into this app.

## Setup

```bash
npm install
cp .env.example .env   # point VITE_API_BASE_URL at your running backend
npm run dev
```

## What's here

- **Tenants list** (`/tenants`) - every client on the platform, plus onboarding a new one.
- **Tenant detail** (`/tenants/:id`) - rename, change subdomain (with a confirmation step, since it breaks old links), suspend/reactivate/mark-offboarding, toggle licensed modules, and the full audit trail for that tenant.

## What's NOT here

- No way to create additional platform admin accounts from the UI (matches the backend - CLI-only, deliberately, since these accounts have cross-tenant access to every client).
- No cross-tenant search/reporting beyond the flat tenant list - fine at a handful of clients, will want pagination/search once there are many.
