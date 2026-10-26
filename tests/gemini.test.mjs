import assert from "node:assert/strict";
import test from "node:test";
import { completed, fixture, isolatedPost, origin, send, testKey } from "./gemini-fixture.mjs";

test("missing database blocks Gemini before authentication or provider calls", async (context) => {
  const state = fixture(context);
  delete process.env.DATABASE_URL;
  const result = await send();
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(state.authCalls, 0);
  assert.equal(state.calls.length, 0);
});

test("an unsigned user cannot call Gemini and the refusal is private", async (context) => {
  const state = fixture(context);
  state.auth = null;
  const result = await send();
  assert.equal(result.status, 401);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(state.calls.length, 0);
});

test("failed session lookup returns a sanitized 503 without a provider call", async (context) => {
  const state = fixture(context);
  state.authError = new Error("Synthetic sensitive session failure");
  const result = await send();
  assert.equal(result.status, 503);
  assert.doesNotMatch(JSON.stringify(result.body), /sensitive/);
  assert.equal(state.calls.length, 0);
});

test("a missing server key blocks an authenticated request", async (context) => {
  const state = fixture(context);
  delete process.env.GEMINI_API_KEY;
  const result = await send();
  assert.equal(result.status, 503);
  assert.equal(state.calls.length, 0);
});

test("a foreign browser origin is rejected before authentication", async (context) => {
  const state = fixture(context);
  const result = await send(undefined, { headers: { Origin: "https://foreign.example.test", "x-forwarded-host": "foreign.example.test" } });
  assert.equal(result.status, 403);
  assert.equal(state.authCalls, 0);
  assert.equal(state.calls.length, 0);
});

test("a null browser origin is rejected", async (context) => {
  const state = fixture(context);
  const result = await send(undefined, { headers: { Origin: "null" } });
  assert.equal(result.status, 403);
  assert.equal(state.calls.length, 0);
});

for (const [label, body] of [
  ["missing prompt", {}],
  ["whitespace prompt", { prompt: "     " }],
  ["short prompt", { prompt: "x" }],
  ["long prompt", { prompt: "x".repeat(4001) }],
  ["non-text prompt", { prompt: ["test"] }],
  ["null request", null],
]) test(`${label} is rejected before provider use`, async (context) => {
  const state = fixture(context);
  const result = await send(undefined, { raw: JSON.stringify(body) });
  assert.equal(result.status, 400);
  assert.equal(state.calls.length, 0);
});

test("malformed JSON is rejected before provider use", async (context) => {
  const state = fixture(context);
  const result = await send(undefined, { raw: '{"prompt":' });
  assert.equal(result.status, 400);
  assert.equal(state.calls.length, 0);
});

test("only the trimmed prompt is sent and the key remains in the provider header", async (context) => {
  const state = fixture(context);
  const result = await send(undefined, { body: { prompt: "  Propuesta de prueba  ", customerRecords: ["never forward"], store: true } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { answer: "Respuesta de prueba", model: "gemini-3.8-flash" });
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(state.calls.length, 1);
  const { url, options } = state.calls[0];
  assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(options.method, "POST");
  assert.equal(options.headers["x-goog-api-key"], testKey);
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(options.body), {
    model: "gemini-3.8-flash", input: "Propuesta de prueba", store: false,
    generation_config: { max_output_tokens: 2048 },
  });
  assert.equal(options.cache, "no-store");
  assert.ok(options.signal instanceof AbortSignal);
  assert.doesNotMatch(JSON.stringify(result.body), new RegExp(testKey));
  assert.doesNotMatch(options.body, /never forward/);
});

test("the configured model is used without accepting a client model override", async (context) => {
  const state = fixture(context);
  process.env.GEMINI_MODEL = "server-model-for-test";
  const result = await send(undefined, { body: { prompt: "Prueba modelo", model: "client-model" } });
  assert.equal(result.status, 200);
  assert.equal(result.body.model, "server-model-for-test");
  assert.equal(JSON.parse(state.calls[0].options.body).model, "server-model-for-test");
});

test("completed responses include model text while excluding thoughts and other content", async (context) => {
  const state = fixture(context);
  state.reply = () => Response.json({
    status: "completed",
    steps: [
      { type: "thought", content: [{ type: "text", text: "Internal reasoning" }] },
      { type: "model_output", content: [{ type: "text", text: " Primera " }, { type: "image", text: "Not text" }, { type: "text", text: "Segunda" }] },
      { type: "model_output", content: [{ type: "text", text: "Tercera " }] },
    ],
  });
  const result = await send();
  assert.equal(result.status, 200);
  assert.equal(result.body.answer, "Primera \nSegunda\nTercera");
});

test("requests are limited to five provider calls per user and agency in a minute", async (context) => {
  const state = fixture(context);
  for (let i = 0; i < 5; i++) assert.equal((await send()).status, 200);
  const sixth = await send();
  assert.equal(sixth.status, 429);
  assert.equal(state.calls.length, 5);
  state.auth.userId = "different-synthetic-user";
  assert.equal((await send()).status, 200);
  state.auth.agencyId = "different-synthetic-agency";
  assert.equal((await send()).status, 200);
});

test("the rate limit resets after its one-minute window", async (context) => {
  fixture(context);
  let now = 2_000_000;
  context.mock.method(Date, "now", () => now);
  for (let i = 0; i < 5; i++) assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 429);
  now += 60_001;
  assert.equal((await send()).status, 200);
});

test("invalid requests do not consume provider quota", async (context) => {
  const state = fixture(context);
  for (let i = 0; i < 6; i++) assert.equal((await send("x")).status, 400);
  assert.equal((await send()).status, 200);
  assert.equal(state.calls.length, 1);
});

test("full limiter capacity preserves active users and recovers space after expiry", async (context) => {
  const state = fixture(context);
  const post = await isolatedPost();
  let now = 3_000_000;
  context.mock.method(Date, "now", () => now);
  for (let i = 0; i < 5000; i++) {
    state.auth.userId = `capacity-user-${i}`;
    assert.equal((await send(undefined, { post })).status, 200);
  }
  state.auth.userId = "capacity-overflow";
  assert.equal((await send(undefined, { post })).status, 429);
  assert.equal(state.calls.length, 5000);
  state.auth.userId = "capacity-user-0";
  assert.equal((await send(undefined, { post })).status, 200);
  now += 60_001;
  state.auth.userId = "capacity-new-after-expiry";
  assert.equal((await send(undefined, { post })).status, 200);
  assert.equal(state.calls.length, 5002);
});

for (const status of [400, 401, 403, 429, 500]) test(`provider HTTP ${status} is sanitized`, async (context) => {
  const state = fixture(context);
  const logged = [];
  context.mock.method(console, "error", (...args) => logged.push(args));
  state.reply = () => Response.json({ error: { message: `Sensitive account details ${testKey}` } }, { status });
  const result = await send();
  assert.equal(result.status, 502);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.doesNotMatch(JSON.stringify(result.body), /Sensitive|account|test-only/);
  assert.ok(logged.every((entry) => !JSON.stringify(entry).includes(testKey)));
});

test("a provider timeout becomes 504 without exposing request details", async (context) => {
  const state = fixture(context);
  state.reply = () => { throw new DOMException(`Synthetic ${testKey}`, "TimeoutError"); };
  const result = await send();
  assert.equal(result.status, 504);
  assert.deepEqual(result.body, { error: "Gemini timed out." });
});

test("a provider network failure becomes a sanitized 502", async (context) => {
  const state = fixture(context);
  state.reply = () => { throw new Error(`Synthetic ${testKey}`); };
  const result = await send();
  assert.equal(result.status, 502);
  assert.deepEqual(result.body, { error: "Gemini connection failed." });
});

for (const [label, reply] of [
  ["invalid JSON", () => new Response("not-json")],
  ["null payload", () => Response.json(null)],
  ["non-array steps", () => Response.json({ status: "completed", steps: {} })],
  ["missing status", () => Response.json({ steps: completed().steps })],
  ["unknown status", () => Response.json({ ...completed(), status: "unknown-status" })],
  ["null step", () => Response.json({ status: "completed", steps: [null] })],
  ["null content part", () => Response.json({ status: "completed", steps: [{ type: "model_output", content: [null] }] })],
  ["non-array content", () => Response.json({ status: "completed", steps: [{ type: "model_output", content: {} }] })],
  ["numeric text", () => Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: 123 }] }] })],
  ["array text", () => Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: ["text"] }] }] })],
  ["empty steps", () => Response.json({ status: "completed", steps: [] })],
  ["empty text", () => Response.json(completed("   "))],
  ["no text", () => Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "image" }] }] })],
]) test(`provider ${label} is rejected`, async (context) => {
  const state = fixture(context);
  state.reply = reply;
  const result = await send();
  assert.equal(result.status, 502);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(result.body.answer, undefined);
});

for (const status of ["failed", "in_progress", "requires_action", "cancelled", "incomplete"]) test(`provider ${status} cannot be reported as a completed answer`, async (context) => {
  const state = fixture(context);
  state.reply = () => Response.json({ ...completed("Partial answer"), status });
  const result = await send();
  assert.equal(result.status, 502);
  assert.equal(result.body.answer, undefined);
});

test("the same origin is accepted without trusting forwarded-host overrides", async (context) => {
  const state = fixture(context);
  const result = await send(undefined, { headers: { Origin: origin, "x-forwarded-host": "foreign.example.test" } });
  assert.equal(result.status, 200);
  assert.equal(state.calls.length, 1);
});

test("Next's internal hostname does not reject the external Host and matching Origin", async (context) => {
  const state = fixture(context);
  state.auth = null;
  const result = await send(undefined, {
    url: "http://localhost:3105/api/crm/ai",
    headers: { Host: "127.0.0.1:3105", Origin: "http://127.0.0.1:3105" },
  });
  assert.equal(result.status, 401);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(state.authCalls, 1);
  assert.equal(state.calls.length, 0);
});

test("an Origin matching only Next's internal hostname is rejected", async (context) => {
  const state = fixture(context);
  const result = await send(undefined, {
    url: "http://localhost:3105/api/crm/ai",
    headers: { Host: "127.0.0.1:3105", Origin: "http://localhost:3105" },
  });
  assert.equal(result.status, 403);
  assert.equal(state.authCalls, 0);
  assert.equal(state.calls.length, 0);
});

test("forwarded headers cannot substitute the router-preserved Host", async (context) => {
  const state = fixture(context);
  const result = await send(undefined, {
    url: "http://localhost:3105/api/crm/ai",
    headers: {
      Host: "127.0.0.1:3105", Origin: "https://foreign.example.test",
      "x-forwarded-host": "foreign.example.test", "x-forwarded-proto": "https",
    },
  });
  assert.equal(result.status, 403);
  assert.equal(state.authCalls, 0);
  assert.equal(state.calls.length, 0);
});

for (const host of [
  "username@safe.example.test",
  "username:password@safe.example.test",
  "safe.example.test/path",
  "safe.example.test?query=value",
  "safe.example.test#fragment",
  "safe.example.test:invalid-port",
]) test(`malformed Host ${host} is rejected before session lookup`, async (context) => {
  const state = fixture(context);
  const result = await send(undefined, { headers: { Host: host, Origin: "https://safe.example.test" } });
  assert.equal(result.status, 403);
  assert.equal(state.authCalls, 0);
  assert.equal(state.calls.length, 0);
});

test("foreign origins remain rejected when the database is missing", async (context) => {
  const state = fixture(context);
  delete process.env.DATABASE_URL;
  const result = await send(undefined, { headers: { Origin: "https://foreign.example.test" } });
  assert.equal(result.status, 403);
  assert.equal(state.authCalls, 0);
  assert.equal(state.calls.length, 0);
});
