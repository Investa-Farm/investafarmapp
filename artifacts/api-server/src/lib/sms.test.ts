import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { sendInvestmentSms, sendSms } from "./sms.ts";

const originalFetch = globalThis.fetch;
const originalWarn = console.warn;
const originalToken = process.env.TALKSASA_API_TOKEN;
const originalKey = process.env.TALKSASA_API_KEY;
const originalSenderId = process.env.TALKSASA_SENDER_ID;

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
  if (originalToken === undefined) delete process.env.TALKSASA_API_TOKEN;
  else process.env.TALKSASA_API_TOKEN = originalToken;
  if (originalKey === undefined) delete process.env.TALKSASA_API_KEY;
  else process.env.TALKSASA_API_KEY = originalKey;
  if (originalSenderId === undefined) delete process.env.TALKSASA_SENDER_ID;
  else process.env.TALKSASA_SENDER_ID = originalSenderId;
});

test("SMS reports missing provider configuration without making a request", async () => {
  delete process.env.TALKSASA_API_TOKEN;
  delete process.env.TALKSASA_API_KEY;
  globalThis.fetch = async () => {
    throw new Error("fetch must not run without provider configuration");
  };

  assert.deepEqual(await sendSms("0712345678", "test"), { status: "not_configured" });
});

test("investment SMS uses TalkSasa's single-recipient payload", async () => {
  delete process.env.TALKSASA_API_TOKEN;
  process.env.TALKSASA_API_KEY = "test-token";
  process.env.TALKSASA_SENDER_ID = "InvestaFarm";

  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await sendInvestmentSms("0712345678", "Kiamaina Coffee Estate", 3, 12_000);
  assert.deepEqual(result, { status: "accepted" });
  assert.equal(requestUrl, "https://bulksms.talksasa.com/api/v3/sms/send");
  assert.equal(new Headers(requestInit?.headers).get("Authorization"), "Bearer test-token");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    recipient: "254712345678",
    sender_id: "InvestaFarm",
    type: "plain",
    message: "InvestaFarm: You bought 3 shares in Kiamaina Coffee Estate for KES 12,000. Track your investment at app.investafarm.com",
  });
});

test("SMS uses TalkSasa's generic sender when no approved sender is configured", async () => {
  process.env.TALKSASA_API_TOKEN = "test-token";
  delete process.env.TALKSASA_SENDER_ID;
  let payload: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  assert.deepEqual(await sendSms("0712345678", "test"), { status: "accepted" });
  assert.equal(payload?.sender_id, "TALKSASA");
});

test("SMS distinguishes invalid numbers and provider-reported failures", async () => {
  process.env.TALKSASA_API_TOKEN = "test-token";
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount++;
    return new Response(JSON.stringify({ success: false, status: "failed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  assert.deepEqual(await sendSms("not a phone number", "test"), { status: "invalid_phone" });
  assert.deepEqual(await sendSms("+254712345678", "test"), { status: "provider_error" });
  assert.equal(fetchCount, 1);
});

test("SMS logs a safe provider reason for HTTP errors", async () => {
  process.env.TALKSASA_API_TOKEN = "test-token";
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => warnings.push(args.join(" "));
  globalThis.fetch = async () => new Response(
    JSON.stringify({ message: "Invalid recipient 254712345678 for test-token" }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );

  assert.deepEqual(await sendSms("0712345678", "test"), { status: "provider_error" });
  assert.match(warnings.join(" "), /HTTP 401/);
  assert.doesNotMatch(warnings.join(" "), /254712345678|test-token/);
});

test("SMS turns network exceptions into a status instead of throwing", async () => {
  process.env.TALKSASA_API_TOKEN = "test-token";
  globalThis.fetch = async () => { throw new Error("simulated network failure"); };

  assert.deepEqual(await sendSms("0712345678", "test"), { status: "network_error" });
});
