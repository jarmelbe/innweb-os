export type CsvTable = { headers: string[]; rows: Record<string, string>[] };

export function parseCsv(input: string, maxRows = 500): CsvTable {
  const source = input.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        field += char;
      }
      continue;
    }
    if (afterQuote && char !== "," && char !== "\n" && char !== "\r" && char !== " " && char !== "\t") {
      throw new Error("CSV contains unexpected characters after a quoted field.");
    }
    if (afterQuote && (char === " " || char === "\t")) {
      continue;
    }
    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === '"') {
      throw new Error("CSV contains an unexpected quote in an unquoted field.");
    } else if (char === ",") {
      record.push(field);
      field = "";
      afterQuote = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some((value) => value.length > 0)) records.push(record);
      record = [];
      field = "";
      afterQuote = false;
      if (records.length > maxRows + 1) throw new Error(`CSV exceeds the ${maxRows} row limit.`);
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  record.push(field);
  if (record.some((value) => value.length > 0)) records.push(record);
  if (records.length < 1) throw new Error("CSV is empty.");
  if (records.length - 1 > maxRows) throw new Error(`CSV exceeds the ${maxRows} row limit.`);

  const headers = records[0].map((value) => value.trim());
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new Error("CSV headers must be non-empty and unique.");
  }
  const rows = records.slice(1).map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index + 2} has ${values.length} columns; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
  return { headers, rows };
}

function safeCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const formulaPrefix = /^[\u0000-\u0020]*[=+@]/.test(text)
    || (/^[\u0000-\u0020]*-/.test(text) && !Number.isFinite(Number(text)));
  return formulaPrefix ? `'${text}` : text;
}

export function serializeCsv(headers: readonly string[], rows: Array<Record<string, unknown>>): string {
  const cell = (value: unknown) => `"${safeCell(value).replace(/"/g, '""')}"`;
  return [headers, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((record) => record.map(cell).join(","))
    .join("\r\n");
}
