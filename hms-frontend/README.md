# HMS Staff Console — Frontend

The full staff-facing web app: patients, appointments, billing (with
M-Pesa collection), clinical notes, lab orders, prescriptions, insurance
covers, pharmacy inventory, payers, and the communications inbox
(public inquiries / patient chat / supplier drafts flagged by the AI).

## Coverage

| Area | Screen(s) |
|---|---|
| Patients | List/search, register, detail (tabbed: Overview / Notes / Labs / Prescriptions / Insurance) |
| Appointments | Schedule (from a patient record) |
| Billing | Create invoice, invoice detail (claim status, M-Pesa STK push, manual cash/other payment) |
| Pharmacy | Inventory list, add item, receive/dispense stock |
| Payers | List/add insurers and national schemes |
| Communications | Staff inbox across all three AI-handled channels |

**Security note:** every screen calls the backend directly, and the
backend's own RBAC (see `hms-backend` README) is the real enforcement -
a `billing_staff` account attempting a clinical-notes write gets a 403
from the API regardless of what this UI shows. **What's not yet done:**
the UI itself doesn't hide actions a role can't perform (e.g. a billing
staff member still sees the Notes tab, they just get a rejected request
if they try to write one) - that's a UX polish gap, not a security one,
flagged here rather than left as an inaccurate claim.

## Design

- **Signature element**: the "ledger card" - patient/appointment/invoice
  records render as a stamped index-card tab, echoing real hospital
  paper-file culture rather than a generic dashboard card.
- **Type**: IBM Plex Sans/Serif/Mono - one family across UI, headings, and
  data (MRNs, amounts), so the pairing feels deliberate.
- **Color**: a teal-green ("Baraka") primary instead of the generic
  sterile-hospital-blue or AI-cliché cream/terracotta, with marigold used
  *only* for primary actions.

## Backend change required

`GET /users` (a staff directory, for picking a provider when
scheduling) - the backend had no way to list staff before this frontend
needed it. See `src/users/users.controller.ts` in the backend project.

## Setup

```bash
npm install
cp .env.example .env   # point VITE_API_BASE_URL at your running backend
npm run dev
```

Requires the backend (`hms-backend`) running, with M-Pesa configured
(sandbox is fine for testing) if you want the "Send M-Pesa prompt"
button on an invoice to do anything real.

## Offline support (patient registration + appointments only)

Matches the backend's own scoping (see its README's "Offline sync
support" section) - **not** every module, deliberately. Billing stays
online-only, per the original scoping doc's own reasoning that it
should require connectivity anyway.

**How it works:** `PatientRegisterPage` and `AppointmentCreatePage` try
the write live first. If it fails because there's genuinely no
connection (not a validation error, not a real conflict from the
server - see `api.ts`'s `isNetworkError` distinction), the write is
queued in IndexedDB with a client-generated ID instead of failing.
`OfflineQueueContext` auto-flushes the queue the moment the browser
reports it's back online (plus a 30-second safety-net retry, in case
that event doesn't fire reliably on every device). A sidebar badge
shows connectivity + queue status at all times; a **Sync queue** page
(`/sync-queue`) lists what's pending.

**The genuine conflict case is not silently resolved.** If two devices
register different patients with the same MRN while both offline, the
backend rejects the second sync with a 409 - that item moves from "will
auto-retry" into "needs attention" on the sync queue page, where staff
either discard it (to re-enter manually with a corrected MRN) - there's
no automatic merge, because there shouldn't be one; a human needs to
look at it.

**Patient search also works offline** - the patient list caches itself
locally on every successful fetch and falls back to that cache when
offline, so front desk can still find/reference existing patients, not
just register new ones, without a connection.

**What this does NOT do:** sync anything besides these two entities;
work if the *very first* login/data load never happened while online
(there's nothing to fall back to yet); or handle a browser tab closing
mid-queue gracefully beyond IndexedDB's own persistence (which does
survive a tab close/reopen, just not clearing browser storage).

## What's NOT built here (by design, not oversight)

- Offline support beyond patients + appointments (see above) - clinical notes, lab orders, prescriptions, pharmacy, and billing all still require a live connection.
- SHA eClaims - the claim status UI on an invoice works against the
  generic `Payer`/claim model already built; it does not talk to SHA's
  actual API yet (scoped separately, gated on your SHA certification).

The patient portal app and platform admin console are separate projects
(`hms-patient-portal`, `hms-platform-admin`) - both now built alongside
this one, each with their own README.

