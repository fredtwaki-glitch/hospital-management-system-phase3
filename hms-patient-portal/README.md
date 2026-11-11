# Patient Portal (Thin Slice)

Mobile-first patient-facing app: OTP login, view visits/prescriptions/lab
results, chat with the AI assistant. Reuses the same design tokens as the
staff console (`hms-frontend`) for brand consistency across the product
suite, with a warmer, simpler mobile shell instead of the staff sidebar.

## Backend dependency

Needs the `GET /patient-portal/me/*` endpoints added to the backend
alongside this (see `patient-self-service.controller.ts` in the backend
project) - these didn't exist before; only the AI chat endpoint did.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Log in with the email + MRN on file for a patient already registered via
the staff console, and check the backend server logs for the OTP (SMS/email
delivery is still stubbed - see the backend README).

## Known gaps

- No guardian-mediated access for minors (a minor cannot log in at all -
  see the backend README's "Patient demographics" section for why, and
  what's still undecided).
- No offline support.
- OTP delivery is logged, not actually sent.
