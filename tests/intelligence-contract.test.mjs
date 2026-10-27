import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("InnWeb Intelligence catalog has nine uniquely named modules", () => {
  const registry = read("lib/innweb-intelligence.ts");
  const ids = [...registry.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, 9);
  assert.equal(new Set(ids).size, 9);
  for (const id of ["rankpulse", "brandia", "sales", "knowledge", "workspace", "social", "video", "voice", "gateway"]) {
    assert.ok(ids.includes(id), "Missing module: " + id);
  }
});

test("visitor lab is noindex and brand exercise has no network submission", () => {
  const publicPage = read("app/intelligence/page.tsx");
  const exercise = read("app/intelligence/brand-express.tsx");
  assert.match(publicPage, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.doesNotMatch(exercise, /\bfetch\s*\(|XMLHttpRequest|sendBeacon/);
  assert.match(exercise, /preventDefault\(\)/);
  assert.match(exercise, /navigator\.clipboard\.writeText/);
});

test("private intelligence page enforces CRM identity and administrator access", () => {
  const page = read("app/dashboard/intelligence/page.tsx");
  assert.match(page, /getAuthContext/);
  assert.match(page, /user\.role\s*!==\s*"OWNER"\s*&&\s*user\.role\s*!==\s*"ADMIN"/);
  assert.match(page, /redirect\("\/login"\)/);
});

test("legacy RankPulse scoring remains separate from optional intelligence modules", () => {
  const api = read("app/api/v1/opportunity-finder/audit/route.ts");
  assert.match(api, /scores:\s*\{\s*overall,\s*\.\.\.scores\s*\}/);
  assert.match(api, /opportunityScore:\s*opportunity/);
  // Preserve the historical six-axis scoring weights until there is a
  // deliberately versioned migration with comparable old/new scores.
  for (const formula of [
    /scores\\.performance\\s*\\*\\s*0\\.2/,
    /scores\\.seo\\s*\\*\\s*0\\.2/,
    /scores\\.security\\s*\\*\\s*0\\.15/,
    /scores\\.accessibility\\s*\\*\\s*0\\.1/,
    /scores\\.conversion\\s*\\*\\s*0\\.15/,
    /scores\\.infrastructure\\s*\\*\\s*0\\.2/,
    /clamp\\(100\\s*-\\s*overall\\s*\\+\\s*20\\)/,
  ]) {
    assert.match(api, formula);
  }

  assert.doesNotMatch(api, /innweb-intelligence|intelligenceModules/);
  const registry = read("lib/innweb-intelligence.ts");
  assert.match(registry, /puntuación técnica actual se conserva/);
});
