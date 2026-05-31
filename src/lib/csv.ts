// A minimal RFC-4180-ish CSV parser shared by every bulk-import flow (users,
// courses, …). Kept here, dependency-free, so each importer's browser preview
// and its server-side re-validation parse text the exact same way.
//
// Handles: quoted fields, commas and newlines inside quotes, and escaped
// double-quotes (""). Returns rows of string cells. A real CSV (names like
// "Doe, Jane") parses correctly without pulling in a library.
//
// Must stay client-safe: a pure function, no Node APIs, no "use server".
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  // Flush the final field/row when the file doesn't end in a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
