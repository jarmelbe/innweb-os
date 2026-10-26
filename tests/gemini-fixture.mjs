import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const authMock = `data:text/javascript,${encodeURIComponent(`
  export async function requireCrmUser() {
    const fixture = globalThis.__innwebGeminiFixture;
    fixture.authCalls++;
    if (fixture.authError) throw fixture.authError;
    if (!fixture.auth) return {
      auth: null,
      response: Response.json({ error: "Authentication required." }, { status: 401 }),
    };
    return { auth: fixture.auth, response: null };
  }
`)}`;

// Execute the real route. Session lookup and provider fetch are replaced so no
// database, network, production credentials or customer records are involved.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/crm") return { url: authMock, shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: pathToFileURL(resolve(root, `${specifier.slice(2)}.ts`)).href, shortCircuit: true };
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(pathToFileURL(root).href) && new URL(url).pathname.endsWith(".ts")) {
      return { format: "module", source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8")), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

export const { POST } = await import(pathToFileURL(resolve(root, "app/api/crm/ai/route.ts")));
export const testKey = "test-only-not-a-credential";
export const origin = "https://innweb-preview.example.test";

export const completed = (text = "Respuesta de prueba") => ({
  id: "synthetic-interaction",
  status: "completed",
  steps: [{ type: "model_output", content: [{ type: "text", text }] }],
});

let sequence = 0;
export async function isolatedPost() {
  const url = pathToFileURL(resolve(root, "app/api/crm/ai/route.ts"));
  url.searchParams.set("fixture", String(++sequence));
  return (await import(url.href)).POST;
}

export function fixture(context) {
  const state = {
    auth: { agencyId: "agency-a", userId: `synthetic-user-${++sequence}`, role: "OWNER" },
    authError: null,
    authCalls: 0,
    calls: [],
    reply: () => Response.json(completed()),
  };
  globalThis.__innwebGeminiFixture = state;
  const previous = Object.fromEntries(["DATABASE_URL", "GEMINI_API_KEY", "GEMINI_MODEL"].map((key) => [key, process.env[key]]));
  context.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete globalThis.__innwebGeminiFixture;
  });
  process.env.DATABASE_URL = "postgresql://unused.invalid/gemini-fixture";
  process.env.GEMINI_API_KEY = testKey;
  delete process.env.GEMINI_MODEL;
  context.mock.method(globalThis, "fetch", async (url, options) => {
    state.calls.push({ url, options });
    return state.reply(url, options);
  });
  return state;
}

export async function send(prompt = "Propuesta de prueba", options = {}) {
  const request = new Request(`${origin}/api/crm/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, ...options.headers },
    body: options.raw ?? JSON.stringify(options.body ?? { prompt }),
  });
  const response = await (options.post ?? POST)(request);
  return { status: response.status, headers: response.headers, body: await response.json() };
}
