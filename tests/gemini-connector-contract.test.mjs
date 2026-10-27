import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Gemini is server-side and restricted to OS Owner/Admin", () => {
  const route = file("app/api/crm/ai/route.ts");
  const page = file("app/dashboard/ai/page.tsx");
  assert.match(route, /await requireCrmUser\(\["OWNER", "ADMIN"\]\)/);
  assert.match(page, /user\.role !== "OWNER" && user\.role !== "ADMIN"/);
  assert.match(route, /process\.env\.GEMINI_API_KEY/);
  assert.match(route, /"x-goog-api-key": key/);
  assert.doesNotMatch(page, /NEXT_PUBLIC_GEMINI/);
});

test("Interactions API avoids provider storage and handles response model_output", () => {
  const route = file("app/api/crm/ai/route.ts");
  assert.match(route, /generativelanguage\.googleapis\.com\/v1beta\/interactions/);
  assert.match(route, /store:\s*false/);
  assert.match(route, /step\.type === "model_output"/);
  assert.match(route, /AbortSignal\.timeout\(45_000\)/);
});

test("Gemini errors distinguish quota, key restrictions and unsupported model", () => {
  const route = file("app/api/crm/ai/route.ts");
  for (const code of ["GEMINI_AUTH", "GEMINI_MODEL", "GEMINI_QUOTA", "GEMINI_PROVIDER", "GEMINI_EMPTY"]) {
    assert.ok(route.includes(code), "Missing code " + code);
  }
  assert.doesNotMatch(route, /console\.log\([^)]*(?:prompt|key)/);
});
