#!/usr/bin/env node
/**
 * Reference receiver for HMS outbound webhooks (Payroll / Business Automation).
 *
 * Dependency-free. Copy the verification + idempotency logic into the real
 * Payroll and Automation services; do not deploy this file as-is.
 *
 *   WEBHOOK_SECRET=<same 32+ char secret as HMS>  PORT=4000  node examples/webhook-receiver.js
 *
 * Optional, for testing HMS retry behaviour:
 *   FAIL_FIRST=2   -> respond 500 to the first 2 deliveries of each event
 *
 * What a real receiver MUST do (this file does all of it):
 *   1. Verify X-HMS-Signature = "sha256=" + HMAC-SHA256(secret, EXACT raw body),
 *      using a constant-time comparison. Never re-serialise the JSON first.
 *   2. Reject events for tenants/modules the receiver is not licensed for.
 *   3. Deduplicate by eventId. HMS delivery is at-least-once, so the same event
 *      can arrive more than once. A duplicate must return 2xx, not an error.
 *   4. Persist the eventId BEFORE (or atomically with) acting on it.
 *   5. Return 2xx only after the event is durably accepted.
 */
const http = require('http');
const crypto = require('crypto');

const SECRET = process.env.WEBHOOK_SECRET || '';
const PORT = Number(process.env.PORT || 4000);
const FAIL_FIRST = Number(process.env.FAIL_FIRST || 0);

if (SECRET.length < 32) {
  console.error('WEBHOOK_SECRET must be set and at least 32 characters (same value HMS uses).');
  process.exit(1);
}

// In production this is a database table with a UNIQUE constraint on event_id.
const processed = new Map(); // eventId -> result
const attempts = new Map();  // eventId -> delivery attempts seen (for FAIL_FIRST)

function verifySignature(rawBody, header) {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(rawBody).digest();
  let received;
  try { received = Buffer.from(header.slice(7), 'hex'); } catch { return false; }
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function handleEvent(envelope) {
  // Replace with real routing. Payroll: record attendance for envelope.data.staffNumber.
  // Automation: look up workflows registered for envelope.type.
  switch (envelope.type) {
    case 'staff.shift.completed': {
      const d = envelope.data;
      return `recorded ${d.minutesWorked} worked minutes for ${d.staffNumber} (shift ${d.shiftId})`;
    }
    default:
      return `accepted ${envelope.type}`;
  }
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') { res.writeHead(405).end(); return; }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    if (!verifySignature(raw, req.headers['x-hms-signature'])) {
      console.log('REJECT  bad signature');
      res.writeHead(401).end('invalid signature');
      return;
    }
    let envelope;
    try { envelope = JSON.parse(raw.toString('utf8')); } catch { res.writeHead(400).end('invalid json'); return; }

    const id = envelope.eventId;
    if (!id || id !== req.headers['idempotency-key']) { res.writeHead(400).end('eventId / Idempotency-Key mismatch'); return; }

    if (processed.has(id)) {
      console.log(`DUP     ${envelope.type} ${id} (already processed, returning 2xx)`);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ status: 'duplicate', result: processed.get(id) }));
      return;
    }

    const seen = (attempts.get(id) || 0) + 1;
    attempts.set(id, seen);
    if (seen <= FAIL_FIRST) {
      console.log(`FAIL    ${envelope.type} ${id} (simulated failure ${seen}/${FAIL_FIRST})`);
      res.writeHead(500).end('simulated failure');
      return;
    }

    const result = handleEvent(envelope);
    processed.set(id, result);
    console.log(`OK      ${envelope.type} ${id} tenant=${envelope.tenantId} -> ${result}`);
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ status: 'accepted', result }));
  });
});

server.listen(PORT, () => console.log(`Webhook receiver listening on :${PORT}`));
