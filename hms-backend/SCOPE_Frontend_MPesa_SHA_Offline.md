# Path to Market-Ready: Frontend, M-Pesa, SHA eClaims, Offline Support

**Context:** comparing the current backend scaffold against an established Kenyan
market leader (e.g. Hanmak's MedicentreV3 - 250+ hospitals, real SHA/M-Pesa/KRA
integration, years of production hardening). This document scopes the four
gaps identified, honestly separating what's pure engineering from what
requires external business/regulatory relationships no amount of code can
substitute for.

---

## 0. The honest starting point

A 9/10 "ready to sell" rating rests on four different kinds of readiness,
only some of which are engineering:

| Type of readiness | Can I build/close this? |
|---|---|
| Code exists and works | Yes - this document scopes it |
| Real regulatory/business credentials (SHA certification, Safaricom merchant account) | **No** - only you can obtain these; I can build against them once you have them |
| Field-proven reliability (real hospitals, real bug reports, real edge cases) | **No** - this only comes from actual deployment and time |
| Market trust/references | **No** - same as above |

Everything below gets the *engineering* as close to done as possible. The
other three columns are a business roadmap, not a coding task - flagged
honestly at each relevant point rather than glossed over.

---

## 1. Frontend (the most blocking gap)

**Why this is #1:** none of the previous seven "phases" of backend work are
usable by an actual hospital today. There is no screen for a receptionist to
register a patient, no screen for a doctor to write a note. This is the one
gap that's pure engineering with no external dependency - the fastest path
to something demoable.

### Scope
- **Staff web app** (the primary surface): login, patient registration/search, appointments calendar, clinical notes/lab orders/prescriptions (role-gated to match the backend RBAC already built), billing/invoicing screens with the insurance coordination-of-benefits flow, pharmacy inventory, the staff communications inbox (public inquiries/patient chat/supplier drafts), and - for you - the platform admin console (tenant management, rename/suspend/modules).
- **Patient portal web app**: OTP login, view appointments/prescriptions/lab results, chat with the AI assistant.
- **Tech choice:** React + TypeScript, calling the existing REST API directly (every endpoint needed already exists from Phases 1-2.5). No backend changes required to start this - it's additive.
- **Realistic sizing:** this is the single largest piece of the four. A functional staff app covering the core workflows (not every edge case) is itself a multi-week build even moving efficiently; a polished, field-ready version is larger still.

### What I'd need from you to start
Nothing external - this can start immediately. The only real decision point is **scope of first version**: every module at once (slow to first demo) vs. a thin vertical slice (e.g. patient registration → appointment → billing, working end to end) first.

---

## 2. M-Pesa integration

**Why it matters:** M-Pesa is the dominant payment method for patient
co-pays in Kenya; a billing system without it is a hard sell regardless of
everything else it does well.

### Scope (engineering side - buildable now)
- **STK Push (Lipa na M-Pesa Online)** for patient co-pay collection at time of billing: initiate a push to the patient's phone, receive Safaricom's callback, reconcile against the invoice's `amountPaid`.
- **C2B (Paybill)** for patients paying independently (e.g. before arriving): register a confirmation/validation URL, match incoming payments to an invoice (likely via account number = invoice ID or MRN).
- **Reconciliation service**: a background job or webhook handler recording M-Pesa transaction IDs against `Invoice.amountPaid`, extending the payment logic already built in `BillingService`.
- **New entity**: `MpesaTransaction` (checkout request ID, M-Pesa receipt number, phone number, amount, status, linked invoice) - for audit trail and reconciliation disputes.

### What requires you, specifically
- A **registered Safaricom Daraja API developer account**, then a **production shortcode/paybill number** (requires business KYC with Safaricom - not something done via API).
- Safaricom's sandbox is open and free to build/test against once you register - so the code can be built and tested in sandbox *before* you have production approval, meaning this doesn't have to block on the business step.

---

## 3. SHA eClaims integration

**Why this replaces the generic `Payer` abstraction:** right now, insurance
claims are staff-entered manually (`payerCoveredAmount` typed in by billing
staff). Real competitiveness means submitting claims electronically to SHA
(Kenya's national scheme) and getting adjudication back programmatically,
the way Hanmak's product does via SHA HIE.

### Scope (engineering side)
- **Beneficiary verification**: look up a patient's SHA membership status/eligibility before treatment, rather than trusting a manually-entered `memberNumber` on `PatientInsuranceCover`.
- **eClaims submission**: structure and submit a claim from an `Invoice` + its line items to SHA's claims API when `claimStatus` moves to `submitted`, instead of that being a manual status flip.
- **Adjudication webhook/poll**: receive SHA's approval/rejection/partial-approval response and update `Invoice.claimStatus` + `payerCoveredAmount` automatically instead of staff typing it in.
- **Preauthorization** flow for services that need it before being rendered.

### What requires you, specifically
- **SHA vendor/integration registration** - this is a formal certification process with Kenya's Social Health Authority, not a self-serve API signup. This is very likely the single longest lead-time item of all four, and it's entirely outside what I can do for you.
- Realistically: build against SHA's published API spec/sandbox (if one exists publicly) now, but treat production go-live as gated on your certification timeline, not the code's readiness.

---

## 4. Offline support — ✅ built (highest-value subset)

**Why it matters:** connectivity outside major towns is unreliable; a system
that hard-fails without internet is a real disqualifier for facilities
outside Nairobi/Mombasa/Kisumu, and competitors already advertise this.

### What was actually built
Per the "scope decision needed" below, went with the highest-value
subset rather than every module:
- **Patient registration + appointment scheduling** work offline in the
  staff console (`hms-frontend`) - IndexedDB-backed local queue, auto-sync
  on reconnect, a visible connectivity/queue-status indicator, and a
  dedicated sync-queue page for anything that needs human attention.
- **Idempotent writes on the backend** (`hms-backend`) - both
  `POST /patients` and `POST /appointments` accept a client-generated
  `clientRequestId`; a replayed write with the same key returns the
  original record instead of duplicating it.
- **Conflict resolution for the exact scenario named below** (two
  devices registering the same MRN while both offline) - surfaced as a
  clear, human-resolvable conflict, not silently merged or dropped.
- Patient search/lookup also works offline via a local cache of the
  last-fetched patient list.

### What's still deferred (see each project's README for the reasoning)
- Billing/invoicing - still online-only, deliberately (per the original
  reasoning below: it arguably should require connectivity anyway).
- Clinical notes, lab orders, prescriptions, pharmacy - not yet offline-capable.
- Patient portal and platform admin frontends - no offline support built for either.

### Original scope (for reference)
This is the most architecturally invasive of the four - it's not a bolt-on,
it changes how the frontend and backend interact:
- **Local-first data layer** in the frontend (e.g. IndexedDB) so staff can register patients, record vitals, log a visit, etc. while offline.
- **Sync/reconciliation layer**: queued writes replay against the backend once connectivity returns; needs conflict resolution (e.g. two front-desk devices registering against the same MRN while both offline).
- **Backend support for idempotent writes** (so a replayed offline action doesn't create a duplicate patient/invoice/appointment) - this touches nearly every existing `create` endpoint.
- **Scope decision made**: highest-value subset first (patient registration + appointment scheduling), deferring billing/insurance claims - which arguably *should* require connectivity anyway - to online-only. Full offline support for every module remains future work.

### What requires you, specifically
Nothing external - this was pure engineering, and it's done for the
subset above. Extending it to more modules is more of the same pattern,
not a new architecture.

---

## Realistic sequencing

Given the dependencies above, this is the order that actually works:

1. **Frontend (thin vertical slice)** - nothing else can be demoed or sold without this, and it has zero external dependency.
2. **M-Pesa (sandbox)** - build and test against Safaricom's sandbox in parallel with the frontend; doesn't block on your business registration.
3. **SHA eClaims (against published spec/sandbox, if available)** - start this in parallel too, but treat it as gated on your certification timeline for production use.
4. **Offline support** - starts once the frontend has real shape, since it's architecturally about how the frontend and backend talk to each other.

---

## Decision needed

Building all four in full right now, in one pass, would mean shallow progress
on all four rather than a working result on any one. Given the frontend is
the only piece with zero external blocker and the one nothing else can be
demoed without, that's the natural starting point - but this is your call.
