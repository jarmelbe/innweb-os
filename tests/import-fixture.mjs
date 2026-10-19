import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Prisma } from "@prisma/client";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const virtual = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const mocks = {
  "@/lib/prisma": virtual(`export const prisma = new Proxy({}, { get(_, key) { return globalThis.__innwebImportFixture.prisma[key]; } });`),
  "@/lib/crm": virtual(`
    export async function requireCrmUser(roles) {
      const fixture = globalThis.__innwebImportFixture;
      fixture.requiredRoles = roles;
      if (!fixture.auth) return { auth: null, response: Response.json({error: "Authentication required."}, {status: 401}) };
      if (roles && !roles.includes(fixture.auth.role)) return { auth: null, response: Response.json({error: "Insufficient agency permissions."}, {status: 403}) };
      return { auth: fixture.auth, response: null };
    }
    export function unavailable() { return Response.json({error: "CRM data is temporarily unavailable."}, {status: 503}); }
  `),
};

// Run the real route and helpers; only the signed-in context and database are
// replaced. No network, production credentials or live records are used.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: pathToFileURL(resolve(root, `${specifier.slice(2)}.ts`)).href, shortCircuit: true };
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(pathToFileURL(root).href) && url.endsWith(".ts")) {
      return { format: "module", source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8")), shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

export const { POST } = await import(pathToFileURL(process.env.INNWEB_TEST_ROUTE || resolve(root, "app/api/crm/csv/import/route.ts")));
export const { GET } = await import(pathToFileURL(resolve(root, "app/api/crm/csv/export/route.ts")));
export const { sheetHeaders } = await import(pathToFileURL(resolve(root, "lib/sheet-config.ts")));
export const { parseCsv } = await import(pathToFileURL(resolve(root, "lib/csv.ts")));
export const { importCountry } = await import(pathToFileURL(resolve(root, "lib/csv-import.ts")));

const models = ["account", "contact", "opportunity", "activity", "proposal", "project", "workItem", "timeEntry", "service", "user", "referralPartner", "auditEvent"];
const defined = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

function matches(record, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "OR") return expected.some((clause) => matches(record, clause));
    if (key === "AND") return (Array.isArray(expected) ? expected : [expected]).every((clause) => matches(record, clause));
    const actual = record[key];
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      if ("some" in expected) return (actual || []).some((item) => matches(item, expected.some));
      if ("in" in expected) return expected.in.includes(actual);
      if ("notIn" in expected) return !expected.notIn.includes(actual);
      if ("not" in expected) return actual !== expected.not;
      if ("equals" in expected) return expected.mode === "insensitive" ? String(actual).toLowerCase() === String(expected.equals).toLowerCase() : actual === expected.equals;
      throw new Error(`Unsupported test query for ${key}: ${JSON.stringify(expected)}`);
    }
    return actual === expected;
  });
}

export function databaseError(code) {
  return new Prisma.PrismaClientKnownRequestError("Injected database conflict", { code, clientVersion: Prisma.prismaVersion.client });
}

export function fixture(seed = {}) {
  const result = {
    state: Object.fromEntries(models.map((model) => [model, structuredClone(seed[model] || [])])),
    writes: [], reads: [], transactions: [], injectWrite: null, conflict: false,
    auth: { agencyId: "agency-a", userId: "owner-a", role: "OWNER" },
  };
  let sequence = 0;
  const delegates = (state) => Object.fromEntries(models.map((model) => {
    const select = (row, options) => {
      if (!row) return null;
      let selected = { ...row };
      if (model === "account" && options.include) selected = {
        ...selected,
        contacts: state.contact.filter((contact) => contact.agencyId === row.agencyId && contact.accountId === row.id && contact.isPrimary).slice(0, 1),
        referralPartner: null,
      };
      return options.select ? Object.fromEntries(Object.keys(options.select).map((key) => [key, selected[key]])) : selected;
    };
    const findMany = async (options = {}) => {
      result.reads.push({ model, ...options });
      return state[model].filter((row) => matches(row, options.where)).map((row) => select(row, options));
    };
    const write = (operation, data) => {
      result.writes.push({ model, operation, data });
      const error = result.injectWrite?.(model, operation, data);
      if (error) throw error;
    };
    const create = async ({ data }) => {
      write("create", data);
      if (data.externalId && state[model].some((row) => row.agencyId === data.agencyId && row.externalId === data.externalId)) throw databaseError("P2002");
      const row = {
        id: `${model}-${++sequence}`, createdAt: new Date("2026-01-01T00:00:00Z"), archivedAt: null,
        ...(model === "account" ? { country: "CO", externalId: null, type: "LEAD", priority: "NORMAL" } : {}),
        ...defined(data),
      };
      state[model].push(row);
      return { ...row };
    };
    const update = async ({ where, data }) => {
      write("update", data);
      const row = state[model].find((item) => matches(item, where));
      if (!row) throw databaseError("P2025");
      Object.assign(row, defined(data));
      return { ...row };
    };
    return [model, {
      findMany,
      findFirst: async (options) => (await findMany(options))[0] || null,
      create, update,
      upsert: async ({ where, create: data, update: changes }) => state[model].some((row) => matches(row, where))
        ? update({ where, data: changes }) : create({ data }),
    }];
  }));
  result.prisma = new Proxy({}, { get(_, key) {
    if (key === "$transaction") return async (callback, options) => {
      result.transactions.push(options);
      const pending = structuredClone(result.state);
      const response = await callback(delegates(pending));
      if (result.conflict) throw databaseError("P2034");
      result.state = pending;
      return response;
    };
    return delegates(result.state)[key];
  } });
  globalThis.__innwebImportFixture = result;
  process.env.DATABASE_URL = "postgresql://unused.invalid/test-fixture";
  return result;
}

export const legacyProspectHeaders = ["ID", "Fecha alta", "Empresa", "Contacto principal", "Email", "Teléfono/WhatsApp", "Ciudad", "Servicio solicitado", "Fuente", "Estado", "Prioridad", "Responsable", "Próximo contacto", "Última interacción", "Partner ID", "Notas"];
export const legacyCustomerHeaders = ["ID", "Fecha alta", "Razón social", "Contacto", "Email", "Teléfono", "NIT", "Sitio web", "Servicio", "Estado", "Prospecto origen ID", "Partner ID"];

export function csv(sheet, rows, headers = sheetHeaders[sheet]) {
  const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers, ...rows.map((row) => headers.map((header) => row[header]))].map((record) => record.map(cell).join(",")).join("\r\n");
}

export async function send(rows, { sheet = "Prospectos", commit = true, headers, text } = {}) {
  const response = await POST(new Request("http://localhost/api/crm/csv/import", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ sheet, csv: text ?? csv(sheet, rows, headers), commit }),
  }));
  return { status: response.status, body: await response.json() };
}

export function account(overrides = {}) {
  return { id: "internal-a", externalId: "external-a", agencyId: "agency-a", name: "Empresa existente", country: "PE", archivedAt: null, type: "LEAD", createdAt: new Date("2026-01-01T00:00:00Z"), ...overrides };
}
