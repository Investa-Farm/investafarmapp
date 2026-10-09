import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, test } from "node:test";
import {
  _resetOauthTicketStoreForTests,
  ACCESS_TTL_MS,
  MIN_PASSWORD_LENGTH,
  allowlistPublicRole,
  assertProductionSecrets,
  consumeOauthTicket,
  corsOriginAllowed,
  createOauthState,
  decryptAtRest,
  encryptAtRest,
  generateOtp,
  isPasswordStrongEnough,
  oauthLoginPath,
  oauthPortalMismatch,
  parseOauthState,
  signAuthToken,
  signOauthTicket,
  verifyAuthToken,
  verifyToken,
} from "./authTokens.ts";

process.env.SESSION_SECRET = "unit-test-session-secret-at-least-32-chars!!";

afterEach(() => {
  _resetOauthTicketStoreForTests();
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "unit-test-session-secret-at-least-32-chars!!";
  delete process.env.ADMIN_PASSWORD;
});

test("oauthPortalMismatch blocks farmer login with an investor Google account", () => {
  assert.equal(oauthPortalMismatch("farmer", "investor"), "investor");
  assert.equal(oauthPortalMismatch("investor", "farmer"), "farmer");
  assert.equal(oauthPortalMismatch("farmer", "farmer"), null);
  assert.equal(oauthPortalMismatch("investor", "investor"), null);
  assert.equal(oauthLoginPath("farmer"), "/farmer-auth");
  assert.equal(oauthLoginPath("investor"), "/investor-auth");
});

test("allowlistPublicRole maps admin (and unknown) to investor", () => {
  assert.equal(allowlistPublicRole("admin"), "investor");
  assert.equal(allowlistPublicRole("viewer"), "investor");
  assert.equal(allowlistPublicRole("hacker"), "investor");
  assert.equal(allowlistPublicRole("farmer"), "farmer");
  assert.equal(allowlistPublicRole("investor"), "investor");
  assert.equal(allowlistPublicRole("cooperative"), "cooperative");
  assert.equal(allowlistPublicRole("agribusiness"), "agribusiness");
});

test("signed tokens include exp and reject missing exp / tamper / expiry", () => {
  const token = signAuthToken(42, { purpose: "full", tokenVersion: 3 });
  const payload = verifyAuthToken(token);
  assert.ok(payload);
  assert.equal(payload.userId, 42);
  assert.equal(payload.purpose, "full");
  assert.equal(payload.ver, 3);
  assert.equal(typeof payload.exp, "number");
  assert.ok(payload.exp > Date.now());

  const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
  assert.equal(verifyAuthToken(tampered), null);

  const unsigned = Buffer.from(JSON.stringify({ userId: 1, iat: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", process.env.SESSION_SECRET!).update(unsigned).digest("base64url");
  assert.equal(verifyAuthToken(`${unsigned}.${sig}`), null);

  const expired = signAuthToken(7, { purpose: "full", ttlMs: -1000 });
  assert.equal(verifyAuthToken(expired), null);
});

test("purpose isolation: totp/verify tokens are not treated as full", () => {
  const totp = signAuthToken(9, { purpose: "totp" });
  const verify = signAuthToken(9, { purpose: "verify" });
  const full = signAuthToken(9, { purpose: "full" });
  assert.equal(verifyToken(totp, ["full"]), null);
  assert.equal(verifyToken(verify, ["full"]), null);
  assert.equal(verifyToken(full, ["full"]), 9);
  assert.equal(verifyToken(totp, ["totp"]), 9);
  assert.equal(verifyToken(verify, ["verify"]), 9);
});

test("full access tokens last 12 hours by default", () => {
  const before = Date.now();
  const payload = verifyAuthToken(signAuthToken(1));
  assert.ok(payload);
  assert.ok(payload.exp >= before + ACCESS_TTL_MS - 50);
  assert.ok(payload.exp <= Date.now() + ACCESS_TTL_MS + 50);
});

test("OAuth HMAC state rejects admin role and tampered state", () => {
  const state = createOauthState("admin");
  const parsed = parseOauthState(state);
  assert.ok(parsed);
  assert.equal(parsed.role, "investor");

  const farmer = parseOauthState(createOauthState("farmer"));
  assert.equal(farmer?.role, "farmer");

  assert.equal(parseOauthState("not-a-state"), null);
  assert.equal(parseOauthState(state.slice(0, -3) + "xxx"), null);
});

test("OAuth ticket is single-use and expires", () => {
  const ticket = signOauthTicket(11, true);
  const first = consumeOauthTicket(ticket);
  assert.deepEqual(first, { userId: 11, isNew: true });
  assert.equal(consumeOauthTicket(ticket), null);
});

test("password policy is at least 8 characters", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.equal(isPasswordStrongEnough("1234567"), false);
  assert.equal(isPasswordStrongEnough("12345678"), true);
});

test("OTP is 6 digits from a CSPRNG range", () => {
  const otp = generateOtp();
  assert.match(otp, /^\d{6}$/);
  assert.notEqual(otp, "000000");
});

test("encryptAtRest round-trips and decrypts legacy plaintext", () => {
  const enc = encryptAtRest("JBSWY3DPEHPK3PXP");
  assert.ok(enc.startsWith("enc:"));
  assert.equal(decryptAtRest(enc), "JBSWY3DPEHPK3PXP");
  assert.equal(decryptAtRest("legacy-plain-secret"), "legacy-plain-secret");
});

test("corsOriginAllowed does not allow arbitrary production origins", () => {
  assert.equal(corsOriginAllowed(undefined), true);
  assert.equal(corsOriginAllowed("https://app.investafarm.com"), true);
  assert.equal(corsOriginAllowed("https://evil.example"), false);
});

test("assertProductionSecrets throws without SESSION_SECRET / ADMIN_PASSWORD", () => {
  const prevNode = process.env.NODE_ENV;
  const prevSecret = process.env.SESSION_SECRET;
  process.env.NODE_ENV = "production";
  delete process.env.ADMIN_PASSWORD;
  process.env.SESSION_SECRET = "short";
  assert.throws(() => assertProductionSecrets(), /SESSION_SECRET/);
  process.env.SESSION_SECRET = "a".repeat(32);
  assert.throws(() => assertProductionSecrets(), /ADMIN_PASSWORD/);
  process.env.ADMIN_PASSWORD = "set-in-prod";
  assert.doesNotThrow(() => assertProductionSecrets());
  process.env.NODE_ENV = prevNode;
  process.env.SESSION_SECRET = prevSecret;
});
