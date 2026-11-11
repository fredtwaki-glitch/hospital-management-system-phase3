# Hospital Management System (HMS)
## Architecture, Integration & Build-Order Reference

**Prepared for:** Multi-tenant HMS product, resold to hospitals, clinics, and pharmaceutical clients
**Integrates with:** Payroll Solution, Business Automation Suite
**Future scope:** Conversational/chatbot layer

---

## 1. Product Context

| Factor | Decision |
|---|---|
| Deployment model | Multi-tenant SaaS — resold to multiple hospitals/clinics/pharma orgs |
| Tech stack | Fresh build (no legacy constraints) |
| Priority integrations | Payroll Solution **and** Business Automation Suite (both, from the start) |
| Future addition | Chatbot / conversational layer (patient-facing and staff-facing) |

Because this is a resold, multi-tenant product rather than a single internal system, **tenant isolation, licensing, and compliance are first-class architectural concerns from day one** — not something to retrofit later.

---

## 2. High-Level Architecture

```
┌───────────────────────────────────────────────────────┐
│                 API Gateway / Auth Layer                │
│         (tenant-aware auth, RBAC, rate limiting)         │
├────────────────┬────────────────┬────────────────────────┤
│   HMS Core       │   Payroll        │   Business Automation │
│   - Patients     │   Solution       │   Suite                │
│   - Appointments │   (existing)     │   (existing)           │
│   - Billing      │                  │                        │
│   - Pharmacy Inv.│                  │                        │
├────────────────┴────────────────┴────────────────────────┤
│              Event Bus (integration layer)                │
│   e.g. staff.shift.completed, patient.admitted,            │
│   invoice.generated, inventory.low_stock                   │
├───────────────────────────────────────────────────────────┤
│   Shared Services: tenant management, notifications,       │
│   audit log, file storage, identity/SSO                    │
├───────────────────────────────────────────────────────────┤
│           Chatbot / Conversational Layer (Phase 2)         │
│   Consumes the same APIs/events as everything above         │
└───────────────────────────────────────────────────────────┘
```

**Core design principle:** HMS core logic lives in services/APIs, never directly in frontend code. Every consumer — web app, Payroll, Automation Suite, and eventually the chatbot — talks to the same backend through the same contracts. This is what keeps the system extensible instead of needing rework each time a new integration is added.

---

## 3. Why an Event Bus (Not Direct API-to-API Calls)

Direct point-to-point integration (HMS calling Payroll's API directly, and vice versa) creates tight coupling — every new integration means touching existing code.

Instead, HMS publishes **domain events**. Payroll and Automation Suite **subscribe** to the events relevant to them:

| Event | Published by | Consumed by |
|---|---|---|
| `staff.shift.completed` | HMS staff shifts | Payroll (attendance import / payroll calculation input) |
| `patient.checked_in` | HMS appointments | Automation Suite (visit preparation / notifications) |
| `appointment.scheduled` | HMS appointments | Automation Suite (reminders / preparation workflows) |
| `appointment.completed` | HMS appointments | Automation Suite (follow-up workflows) |
| `invoice.generated` | HMS billing | Automation Suite (approval workflow) |
| `invoice.paid` | HMS billing | Automation Suite (payment confirmation workflows) |
| `inventory.low_stock` | HMS pharmacy | Automation Suite (reorder workflow) |
| `lab_order.result_ready` | HMS laboratory | Automation Suite (result routing / notifications) |
| `prescription.created` / `prescription.dispensed` | HMS prescriptions / pharmacy | Automation Suite (dispensing workflow) |

This means a third integration (e.g. an insurance/claims product, or the chatbot) can be added later by consuming the versioned event envelope — no changes required to HMS core when the required event contract already exists.

---

## 4. Recommended Tech Stack

| Layer | Recommendation | Reasoning |
|---|---|---|
| Backend | Node.js (NestJS) or Python (Django/FastAPI) | Mature multi-tenancy and RBAC patterns; NestJS if the other two products are already JS/TS for team consistency |
| Database | PostgreSQL, schema-per-tenant | Easier data isolation, easier per-client export/purge at contract end — important for healthcare data |
| Event bus | Start with Postgres outbox pattern or Redis Streams; move to Kafka/RabbitMQ once tenant volume demands it | Avoids over-engineering early; upgrade path is clear |
| Auth / Identity | Centralized OAuth2/OIDC service (e.g. self-hosted Keycloak) | Enables single login across HMS + Payroll + Automation for bundled clients; supports data residency requirements |
| Frontend | React / Next.js | Standard, fast to hire for, good ecosystem |
| Hosting | Cloud provider with regional flexibility | Some hospital/pharma clients will require in-country data residency |

---

## 5. Compliance Considerations (Not Optional)

Because HMS handles patient records and is being resold across multiple organizations:

- **Data protection law alignment** — e.g. Kenya's Data Protection Act for local clients, HIPAA-equivalent controls if targeting US-linked clients.
- **Audit logging** on every patient record access (who viewed what, when).
- **Encryption at rest and in transit.**
- **Field-level RBAC** — e.g. billing staff should not see full clinical notes; pharmacy staff shouldn't see billing details unless explicitly granted.
- **Per-tenant data isolation and export/deletion** — needed for contract offboarding and regulatory requests.

These should be designed into the schema and auth model from Phase 1, not added later.

---

## 6. Build Order

### Phase 1 — Foundation
1. Tenant management + auth foundation (multi-tenant from day one)
2. Core RBAC and audit logging framework

### Phase 2 — HMS Core
3. Patient records module
4. Appointments module
5. Billing module
6. Pharmacy inventory module

### Phase 3 — Integration Layer
7. Event bus setup + define event contracts
8. Wire Payroll integration (e.g. `staff.shift.completed` → payroll run)
9. Wire Business Automation Suite integration (workflow triggers from HMS events)

**Implementation status (2026-11-10):** The HMS code now includes a PostgreSQL
outbox per tenant, versioned event envelopes/contracts, a retrying dispatcher,
HMAC-SHA256 signed webhook adapters, staff shift start/completion endpoints,
and an admin-only outbox status endpoint. `staff.shift.completed` is persisted
atomically with shift completion and sent to the Payroll webhook for tenants
licensed for `payroll`. HMS domain events are sent to the Automation webhook
for tenants licensed for `automation`. The external Payroll and Automation
receivers are separate deployments and still need to implement signature
verification + `eventId` idempotency, be configured in the environment, and pass
end-to-end tests. See `PHASE3_INTEGRATIONS.md` for the operational contract.

**Current event names** include `patient.registered`, `patient.deceased`,
`appointment.scheduled`, `patient.checked_in`, `appointment.completed`,
`invoice.generated`, `invoice.claim_pending`, `invoice.paid`,
`invoice.claim_status_changed`, `clinical_note.created`, `lab_order.created`,
`lab_order.result_ready`, `prescription.created`, `prescription.dispensed`,
`inventory.low_stock`, and `staff.shift.completed`.

### Phase 4 — Conversational Layer (Future)
10. Define patient-facing vs staff-facing chatbot scope and permission boundaries
11. Build chatbot as another API/event consumer (no special-case backend work required if Phases 1–3 are done correctly)
12. Options to evaluate at that time: rules/FAQ bot, LLM-powered assistant (e.g. via Claude API) wired into events and APIs for real actions, or a hybrid

---

## 7. Open Decisions to Revisit

- Target compliance regime(s) based on first client markets (local vs. international)
- Bundled vs. à la carte pricing/licensing model across HMS, Payroll, Automation Suite
- Hosting region strategy for data residency
- Chatbot scope: patient-facing first, staff-facing first, or both in parallel (recommend deciding once Phase 3 is underway)

---

*This document reflects architectural decisions discussed to date and is intended as a living reference — update as decisions are finalized.*
