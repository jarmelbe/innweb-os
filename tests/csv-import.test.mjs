import assert from "node:assert/strict";
import test from "node:test";
import { account, csv, databaseError, fixture, GET, importCountry, legacyCustomerHeaders, legacyProspectHeaders, parseCsv, send, sheetHeaders } from "./import-fixture.mjs";

test("preview reports new and existing rows without any writes", async () => {
  const db = fixture({ account: [account()] });
  const result = await send([{ ID: "new-1", Empresa: "Nueva empresa", País: "México" }, { ID: "external-a", Empresa: "Empresa existente", País: "Perú" }], { commit: false });
  assert.equal(result.status, 200);
  assert.equal(result.body.mode, "preview");
  assert.equal(result.body.created, 1);
  assert.equal(result.body.updated, 1);
  assert.equal(result.body.validRows, 2);
  assert.deepEqual(db.writes, []);
  assert.equal(db.state.account.length, 1);
});

test("LATAM countries, sector, website and unnamed contact details are retained", async () => {
  const db = fixture();
  const result = await send(["México", "Colombia", "Panamá", "Perú", "Brasil", "Argentina"].map((country, i) => ({
    ID: `latam-${i}`, Empresa: `Empresa ${i}`, País: country,
    Industria: "Turismo", "Sitio web": `https://example.test/${i}`,
    Email: `ventas${i}@example.test`, "Teléfono/WhatsApp": `+${5070000000 + i}`, Notas: "Fuente verificada",
  })));
  assert.equal(result.status, 200);
  assert.deepEqual(db.state.account.map((row) => row.country), ["MX", "CO", "PA", "PE", "BR", "AR"]);
  assert.equal(db.state.contact.length, 6);
  assert.equal(db.state.contact[0].email, "ventas0@example.test");
  assert.equal(db.state.contact[0].whatsapp, "+5070000000");
  assert.equal(db.state.account[0].industry, "Turismo");
  assert.equal(db.state.account[0].website, "https://example.test/0");
  assert.equal(db.state.account[0].notes, "Fuente verificada");
  assert.equal(db.writes.filter((write) => write.model === "account").length, 6);
  assert.equal(db.state.auditEvent.length, 1);
});

test("legacy CSV without País creates an unknown country, never Colombia", async () => {
  const db = fixture();
  const result = await send([{ ID: "old-new", Empresa: "Legado" }], { headers: legacyProspectHeaders });
  assert.equal(result.status, 200);
  assert.equal(db.state.account[0].country, "");
});

test("legacy and blank-country reimports preserve the stored country", async () => {
  const db = fixture({ account: [account()] });
  for (const headers of [legacyProspectHeaders, sheetHeaders.Prospectos]) {
    const result = await send([{ ID: "external-a", Empresa: "Empresa existente", País: "" }], { headers });
    assert.equal(result.status, 200);
    assert.equal(db.state.account[0].country, "PE");
  }
});

test("reimport updates one account and one primary contact, preserving the external ID", async () => {
  const db = fixture();
  const source = { ID: "repeatable", Empresa: "Repetible", País: "México", "Contacto principal": "Ana Pérez", Email: "ana@example.test" };
  assert.equal((await send([source])).status, 200);
  const id = db.state.account[0].id;
  const repeated = await send([{ ...source, ID: id }]);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.created, 0);
  assert.equal(repeated.body.updated, 1);
  assert.equal(db.state.account[0].externalId, "repeatable");
  assert.equal((await send([source])).status, 200);
  assert.equal(db.state.account.length, 1);
  assert.equal(db.state.contact.length, 1);
});

for (const [label, rows] of [
  ["duplicate CSV IDs", [{ ID: "same", Empresa: "Uno", País: "MX" }, { ID: "same", Empresa: "Dos", País: "PE" }]],
  ["equivalent company names in the same country", [{ ID: "one", Empresa: "ÁCME S.A.", País: "México" }, { ID: "two", Empresa: " acme sa ", País: "MX" }]],
  ["same company with an unknown country", [{ ID: "one", Empresa: "Compañía", País: "MX" }, { ID: "two", Empresa: "Compañía", País: "" }]],
]) test(`${label} rejects the whole import without writes`, async () => {
  const db = fixture();
  const result = await send(rows);
  assert.equal(result.status, 422);
  assert.ok(result.body.errors.length > 0);
  assert.deepEqual(db.writes, []);
  assert.equal(db.state.account.length, 0);
});

test("same company name in distinct known countries is allowed", async () => {
  const db = fixture();
  const result = await send([{ ID: "one", Empresa: "Empresa regional", País: "MX" }, { ID: "two", Empresa: "Empresa regional", País: "PE" }]);
  assert.equal(result.status, 200);
  assert.equal(db.state.account.length, 2);
});

test("company already registered with another ID is not silently duplicated", async () => {
  const db = fixture({ account: [account()] });
  const result = await send([{ ID: "different", Empresa: "Empresa existente", País: "PE" }]);
  assert.equal(result.status, 422);
  assert.deepEqual(db.writes, []);
});

test("internal and external IDs resolving to different accounts are rejected", async () => {
  const db = fixture({ account: [account({ id: "ambiguous", externalId: "old" }), account({ id: "other", externalId: "ambiguous", name: "Otra empresa" })] });
  const result = await send([{ ID: "ambiguous", Empresa: "Empresa existente", País: "PE" }]);
  assert.equal(result.status, 422);
  assert.match(result.body.errors[0].message, /ambiguous/i);
  assert.deepEqual(db.writes, []);
});

test("two different CSV IDs resolving to one existing account are rejected", async () => {
  const db = fixture({ account: [account()] });
  const result = await send([{ ID: "internal-a", Empresa: "Primera", País: "PE" }, { ID: "external-a", Empresa: "Segunda", País: "PE" }]);
  assert.equal(result.status, 422);
  assert.deepEqual(db.writes, []);
});

test("a later invalid row causes zero writes, even for an earlier valid row", async () => {
  const db = fixture({ account: [account({ notes: "Original" })] });
  const result = await send([{ ID: "external-a", Empresa: "Empresa modificada", País: "PE", Notas: "Cambio" }, { ID: "bad", Empresa: "X", País: "MX" }]);
  assert.equal(result.status, 422);
  assert.deepEqual(db.writes, []);
  assert.equal(db.state.account[0].name, "Empresa existente");
  assert.equal(db.state.account[0].notes, "Original");
  assert.equal(db.state.auditEvent.length, 0);
});

test("runtime failure after a successful write rolls the entire batch back", async () => {
  const db = fixture();
  db.injectWrite = (model, operation, data) => model === "account" && data.name === "Fallar" ? new Error("Injected storage failure") : null;
  const result = await send([{ ID: "first", Empresa: "Correcta", País: "MX", Email: "ok@example.test" }, { ID: "second", Empresa: "Fallar", País: "PE" }]);
  assert.equal(result.status, 503);
  assert.ok(db.writes.some((write) => write.model === "contact"));
  assert.equal(db.state.account.length, 0);
  assert.equal(db.state.contact.length, 0);
  assert.equal(db.state.auditEvent.length, 0);
});

test("audit failure also rolls back all business records", async () => {
  const db = fixture();
  db.injectWrite = (model) => model === "auditEvent" ? new Error("Injected audit failure") : null;
  const result = await send([{ ID: "first", Empresa: "Correcta", País: "MX" }]);
  assert.equal(result.status, 503);
  assert.equal(db.state.account.length, 0);
});

test("concurrent transaction conflict returns retryable 409 with zero persisted changes", async () => {
  const db = fixture();
  db.conflict = true;
  const result = await send([{ ID: "first", Empresa: "Correcta", País: "MX" }]);
  assert.equal(result.status, 409);
  assert.equal(db.transactions[0].isolationLevel, "Serializable");
  assert.equal(db.state.account.length, 0);
  assert.equal(db.state.auditEvent.length, 0);
});

test("database uniqueness conflict returns 409 and rolls back the entire import", async () => {
  const db = fixture();
  db.injectWrite = (model, operation, data) => model === "account" && data.name === "Conflicto" ? databaseError("P2002") : null;
  const result = await send([{ ID: "one", Empresa: "Correcta", País: "MX" }, { ID: "two", Empresa: "Conflicto", País: "PE" }]);
  assert.equal(result.status, 409);
  assert.equal(db.state.account.length, 0);
});

test("accounts in another agency neither collide nor get updated", async () => {
  const db = fixture({ account: [account({ agencyId: "agency-b" })] });
  const result = await send([{ ID: "external-a", Empresa: "Empresa existente", País: "PE" }]);
  assert.equal(result.status, 200);
  assert.equal(db.state.account.length, 2);
  assert.equal(db.state.account[0].agencyId, "agency-b");
  assert.equal(db.state.account[1].agencyId, "agency-a");
  assert.ok(db.reads.filter((read) => read.model === "account").every((read) => read.where.agencyId === "agency-a"));
});

test("customer legacy CSV preserves fields that its headers do not contain", async () => {
  const before = account({ type: "CUSTOMER", notes: "No borrar", ownerId: "owner-a", priority: "HIGH", source: "Referido", nextFollowUpAt: new Date("2026-12-01"), lastContactAt: new Date("2026-10-01") });
  const db = fixture({ account: [before] });
  const result = await send([{ ID: "external-a", "Razón social": "Empresa existente", "Sitio web": "https://example.test", NIT: "123" }], { sheet: "Clientes", headers: legacyCustomerHeaders });
  assert.equal(result.status, 200);
  for (const key of ["country", "notes", "ownerId", "priority", "source", "nextFollowUpAt", "lastContactAt"]) assert.deepEqual(db.state.account[0][key], before[key], key);
});

test("prospect legacy CSV preserves legal identity and optional website/industry", async () => {
  const before = account({ legalName: "Empresa SAS", taxId: "123", industry: "Salud", website: "https://example.test" });
  const db = fixture({ account: [before] });
  assert.equal((await send([{ ID: "external-a", Empresa: "Empresa existente" }], { headers: legacyProspectHeaders })).status, 200);
  for (const key of ["legalName", "taxId", "industry", "website"]) assert.equal(db.state.account[0][key], before[key], key);
});

test("contact imports via internal ID retain the original external ID for future retries", async () => {
  const db = fixture({ contact: [{ id: "contact-internal", externalId: "contact-external", agencyId: "agency-a", firstName: "Ana", lastName: "Pérez", isPrimary: false }] });
  for (const ID of ["contact-internal", "contact-external"]) assert.equal((await send([{ ID, Nombre: "Ana Pérez" }], { sheet: "Contactos" })).status, 200);
  assert.equal(db.state.contact.length, 1);
  assert.equal(db.state.contact[0].externalId, "contact-external");
});

test("different contact aliases targeting the same record reject the batch", async () => {
  const db = fixture({ contact: [{ id: "contact-internal", externalId: "contact-external", agencyId: "agency-a", firstName: "Ana" }] });
  const result = await send([{ ID: "contact-internal", Nombre: "Ana Pérez" }, { ID: "contact-external", Nombre: "Ana López" }], { sheet: "Contactos" });
  assert.equal(result.status, 422);
  assert.deepEqual(db.writes, []);
});

test("unknown country rejects the batch instead of silently choosing Colombia", async () => {
  const db = fixture();
  const result = await send([{ ID: "invalid", Empresa: "Empresa", País: "Atlantis" }]);
  assert.equal(result.status, 422);
  assert.deepEqual(db.writes, []);
  assert.throws(() => importCountry("__proto__"));
  assert.throws(() => importCountry("constructor"));
});

test("valid international codes and LATAM territories survive import and export", async () => {
  const db = fixture();
  const codes = ["DE", "FR", "AW", "GP", "MQ", "MX", "PE"];
  assert.equal((await send(codes.map((País) => ({ ID: País, Empresa: `Empresa ${País}`, País })))).status, 200);
  const response = await GET(new Request("http://localhost/api/crm/csv/export?sheet=Prospectos"));
  assert.equal(response.status, 200);
  const table = parseCsv(await response.text());
  assert.deepEqual(table.rows.map((row) => row.País), codes);
  assert.ok(table.headers.includes("Sitio web"));
  assert.ok(table.headers.includes("Industria"));
  assert.equal(db.state.account.length, codes.length);
});

test("Pais and Sector aliases retain source country and commercial sector", async () => {
  const db = fixture();
  const headers = sheetHeaders.Prospectos.map((header) => ({ País: "Pais", Industria: "Sector" })[header] || header);
  const result = await send([{ ID: "aliases", Empresa: "Empresa", Pais: "Panamá", Sector: "Comercio" }], { headers });
  assert.equal(result.status, 200);
  assert.equal(db.state.account[0].country, "PA");
  assert.equal(db.state.account[0].industry, "Comercio");
});

test("ambiguous duplicate country headers are rejected without writes", async () => {
  const db = fixture();
  const result = await send([{ ID: "bad", Empresa: "Empresa", País: "MX", Pais: "PE" }], { headers: [...sheetHeaders.Prospectos, "Pais"] });
  assert.equal(result.status, 400);
  assert.deepEqual(db.writes, []);
});

test("a synthetic 121-row batch previews, commits once and reimports without duplicates", async () => {
  const db = fixture();
  const rows = Array.from({ length: 121 }, (_, i) => ({ ID: `SYNTHETIC-${i}`, Empresa: `Synthetic company ${i}`, País: ["MX", "CO", "PA", "PE"][i % 4] }));
  const preview = await send(rows, { commit: false });
  assert.equal(preview.body.created, 121);
  assert.deepEqual(db.writes, []);
  const committed = await send(rows);
  assert.equal(committed.status, 200);
  assert.equal(committed.body.created, 121);
  assert.equal(db.writes.filter((write) => write.model === "account").length, 121);
  const repeated = await send(rows);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.created, 0);
  assert.equal(repeated.body.updated, 121);
  assert.equal(db.state.account.length, 121);
});

test("malformed CSV and row limits are rejected before database writes", async () => {
  const db = fixture();
  assert.equal((await send([], { text: '"unterminated' })).status, 400);
  assert.equal((await send([], { text: csv("Prospectos", Array.from({ length: 501 }, (_, i) => ({ ID: `${i}`, Empresa: `Empresa ${i}` }))) })).status, 400);
  assert.deepEqual(db.writes, []);
});

test("an unauthorized sales user cannot import", async () => {
  const db = fixture();
  db.auth.role = "SALES";
  const result = await send([{ ID: "no", Empresa: "Empresa", País: "MX" }]);
  assert.equal(result.status, 403);
  assert.deepEqual(db.writes, []);
  assert.deepEqual(db.transactions, []);
});
