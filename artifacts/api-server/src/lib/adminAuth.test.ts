import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { signAdminToken, verifyAdminToken, adminRoleFromRequest } from "./adminAuth.ts";
import { getTokenSecret } from "./authTokens.ts";

process.env.SESSION_SECRET = "unit-test-session-secret-at-least-32-chars!!";

test("admin tokens include exp and round-trip roles", () => {
  for (const role of ["master", "sub", "kyc", "viewer"] as const) {
    const token = signAdminToken(role);
    assert.equal(verifyAdminToken(token), role);
  }
});

test("admin tokens without exp are rejected", () => {
  const payload = Buffer.from(JSON.stringify({ role: "master", iat: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", getTokenSecret()).update(`admin:${payload}`).digest("base64url");
  assert.equal(verifyAdminToken(`${payload}.${sig}`), null);
});

test("expired and tampered admin tokens are rejected", () => {
  const expired = signAdminToken("master", -1000);
  assert.equal(verifyAdminToken(expired), null);
  const live = signAdminToken("kyc");
  assert.equal(verifyAdminToken(live.slice(0, -2) + "zz"), null);
});

test("adminRoleFromRequest reads Bearer admin tokens only", () => {
  const token = signAdminToken("master");
  assert.equal(adminRoleFromRequest({ headers: { authorization: `Bearer ${token}` } }), "master");
  assert.equal(adminRoleFromRequest({ headers: { authorization: "Bearer not-a-token" } }), null);
  assert.equal(adminRoleFromRequest({ headers: {} }), null);
  const forged = Buffer.from("admin-session:true").toString("base64");
  assert.equal(adminRoleFromRequest({ headers: { authorization: `Bearer ${forged}` } }), null);
});
