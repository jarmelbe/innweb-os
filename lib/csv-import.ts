function normalizedText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const countryAliases: Record<string, string> = Object.create(null);
// ISO 3166-1 alpha-2 codes. Localized names also accept countries outside LATAM
// so a CSV exported from an existing international account remains importable.
const countryCodes = (`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA
RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ
VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`).split(/\s+/);
for (const language of ["es", "en"]) {
  const names = new Intl.DisplayNames([language], { type: "region" });
  for (const code of countryCodes) {
    countryAliases[normalizedText(code)] = code;
    countryAliases[normalizedText(names.of(code)!)] = code;
  }
}
for (const [code, names] of Object.entries({
  AR: ["Argentina"], BO: ["Bolivia", "Estado Plurinacional de Bolivia"],
  BR: ["Brasil", "Brazil"], BZ: ["Belice", "Belize"],
  CL: ["Chile"], CO: ["Colombia"], CR: ["Costa Rica"], CU: ["Cuba"],
  DO: ["República Dominicana", "Dominican Republic", "Rep. Dominicana", "RD"],
  EC: ["Ecuador"], SV: ["El Salvador"], GT: ["Guatemala"],
  GY: ["Guyana"], GF: ["Guayana Francesa", "French Guiana"],
  HT: ["Haití", "Haiti"], HN: ["Honduras"], JM: ["Jamaica"],
  MX: ["México", "Mexico"], NI: ["Nicaragua"], PA: ["Panamá", "Panama"],
  PY: ["Paraguay"], PE: ["Perú", "Peru"], PR: ["Puerto Rico"],
  SR: ["Surinam", "Suriname"], UY: ["Uruguay"],
  VE: ["Venezuela", "República Bolivariana de Venezuela"],
  TT: ["Trinidad y Tobago", "Trinidad and Tobago"],
  US: ["Estados Unidos", "United States", "USA", "EEUU"],
  CA: ["Canadá", "Canada"], ES: ["España", "Spain"],
})) {
  for (const name of [code, ...names]) countryAliases[normalizedText(name)] = code;
}

/** A missing country remains unknown; it must never acquire a default country. */
export function importCountry(raw: string): string | undefined {
  if (!raw.trim()) return undefined;
  const country = countryAliases[normalizedText(raw)];
  if (!country) throw new Error("País must be a supported country name or ISO code (for example México/MX or Perú/PE).");
  return country;
}

export function accountImportIdentity(name: string, country: string | null | undefined) {
  const company = normalizedText(name).replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ");
  const countryKey = countryAliases[normalizedText(country || "")] || normalizedText(country || "");
  return JSON.stringify([company, countryKey]);
}

function sameCompany(left: string, right: string) {
  const [leftName, leftCountry] = JSON.parse(left) as [string, string];
  const [rightName, rightCountry] = JSON.parse(right) as [string, string];
  // Missing country is not evidence that two same-name companies are distinct.
  return leftName === rightName && (!leftCountry || !rightCountry || leftCountry === rightCountry);
}

type ImportAccount = { id: string; externalId: string | null; name: string; country: string | null };

export function accountImportIssues(
  rows: Array<Record<string, string>>,
  accounts: ImportAccount[],
  nameHeader: "Empresa" | "Razón social",
) {
  const issues = new Map<number, string>();
  const targets = new Set<string>();
  const companies: string[] = [];
  rows.forEach((row, index) => {
    const id = (row.ID || "").trim();
    if (!id) return;
    const matches = accounts.filter((account) => account.id === id || account.externalId === id);
    if (matches.length > 1) {
      issues.set(index, "ID is ambiguous: it matches different internal and external account IDs.");
      return;
    }
    const existing = matches[0];
    const target = existing?.id || `new:${id}`;
    if (targets.has(target)) {
      issues.set(index, "Duplicate account in this CSV: multiple IDs resolve to the same record.");
      return;
    }
    targets.add(target);
    let country: string | undefined;
    try {
      country = importCountry(row["País"] || "");
    } catch (error) {
      issues.set(index, error instanceof Error ? error.message : "Invalid country.");
      return;
    }
    const name = (row[nameHeader] || "").trim();
    if (name.length < 2 || name.length > 200) return;
    const identity = accountImportIdentity(name, country ?? existing?.country ?? "");
    if (companies.some((company) => sameCompany(company, identity))) {
      issues.set(index, "Duplicate company and country in this CSV; reconcile its IDs before importing.");
      return;
    }
    companies.push(identity);
    if (accounts.some((account) => account.id !== existing?.id && sameCompany(accountImportIdentity(account.name, account.country), identity))) {
      issues.set(index, "A company with this name and country already exists under another ID; use its existing ID.");
    }
  });
  return issues;
}
