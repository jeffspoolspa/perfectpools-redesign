// Customer-creation receipt token. Issued by /api/customers/check-or-create
// after a successful create-or-link, required by /api/leads/create to prove
// the caller just created/linked the customer they're about to attach a lead
// to.
//
// Why: without it, anyone could POST to /api/leads/create with any
// customer_id they guess and spam junk leads under random customers. Rate
// limiting helps but isn't tight enough on its own.
//
// Format: <customer_id>.<exp_unix_seconds>.<hex_hmac>
// Algorithm: HMAC-SHA256 of "<customer_id>.<exp>" with CUSTOMER_TOKEN_SECRET
// TTL: 10 minutes from issuance
// Stateless: no DB writes, no cookies. Just sign-and-verify.
//
// Required env var:
//   CUSTOMER_TOKEN_SECRET — random 32-byte hex string (generate with
//                           `openssl rand -hex 32`). Set on Vercel.

import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 10 * 60; // 10 minutes

function secret(): string {
  const s = process.env.CUSTOMER_TOKEN_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "Missing or too-short CUSTOMER_TOKEN_SECRET env var (need >=32 chars)",
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/**
 * Issue a fresh token for the given customer id. Expires in 10 minutes.
 */
export function issueCustomerToken(customerId: number): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${customerId}.${exp}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

/**
 * Validate a token. Returns { ok: true } if it's well-formed, the signature
 * matches, hasn't expired, and the embedded customer_id equals the expected
 * customer_id. Returns { ok: false, reason } otherwise.
 *
 * Always returns the reason for failure — these endpoints are authenticated
 * by the token alone, so callers benefit from a clear error code.
 */
export function verifyCustomerToken(
  token: string,
  expectedCustomerId: number,
): { ok: true } | { ok: false; reason: string } {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed_token" };
  }
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed_token" };
  const [idStr, expStr, sig] = parts;
  const id = Number(idStr);
  const exp = Number(expStr);
  if (!Number.isInteger(id) || !Number.isInteger(exp)) {
    return { ok: false, reason: "malformed_token" };
  }
  if (id !== expectedCustomerId) {
    return { ok: false, reason: "customer_id_mismatch" };
  }
  if (Math.floor(Date.now() / 1000) >= exp) {
    return { ok: false, reason: "expired" };
  }
  const expected = sign(`${idStr}.${expStr}`);
  // timingSafeEqual prevents timing attacks on the signature comparison
  let sigBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig, "hex");
    expectedBuf = Buffer.from(expected, "hex");
  } catch {
    return { ok: false, reason: "malformed_signature" };
  }
  if (sigBuf.length !== expectedBuf.length) {
    return { ok: false, reason: "signature_mismatch" };
  }
  if (!timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}
