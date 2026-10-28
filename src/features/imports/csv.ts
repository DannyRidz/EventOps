export const FILE_BYTES = 2 * 1024 * 1024;
export const BATCH_BYTES = 10 * 1024 * 1024;
export class CsvError extends Error {
  row: number;
  column: number;
  constructor(message: string, row = 1, column = 1) {
    super(`Row ${row}, column ${column}: ${message}`);
    this.row = row;
    this.column = column;
  }
}
export function decodeCsv(bytes: Uint8Array): string {
  if (bytes.length > FILE_BYTES)
    throw new CsvError("File exceeds 2 MiB. Split it before uploading.");
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\0"))
      throw new CsvError("NUL bytes are not allowed. Export a UTF 8 CSV.");
    return text;
  } catch (e) {
    if (e instanceof CsvError) throw e;
    throw new CsvError("Invalid UTF 8. Export a UTF 8 CSV.");
  }
}
// RFC style quoting, with bounded cells and records. No evaluation or dialect guessing.
export function parseCsv(input: string) {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false,
    line = 1,
    startLine = 1;
  const lines: number[] = [];
  function field() {
    if (cell.length > 4096 || row.length >= 32)
      throw new CsvError(
        "Too many columns or a field exceeds 4096 characters.",
        startLine,
        row.length + 1,
      );
    row.push(cell);
    cell = "";
    closed = false;
  }
  function record() {
    field();
    rows.push(row);
    lines.push(startLine);
    row = [];
    if (rows.length > 2002)
      throw new CsvError(
        "Too many rows. Split or correct this file.",
        startLine,
      );
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        cell += c;
        if (c === "\n") line++;
      }
    } else if (c === ",") field();
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] !== "\n")
        throw new CsvError(
          "Use LF or CRLF line endings.",
          line,
          row.length + 1,
        );
      if (c === "\r") i++;
      record();
      line++;
      startLine = line;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else {
      if (closed || c === '"')
        throw new CsvError(
          "Malformed quote. Quote the whole field and double embedded quotes.",
          line,
          row.length + 1,
        );
      cell += c;
    }
  }
  if (quoted)
    throw new CsvError("Unclosed quoted field.", startLine, row.length + 1);
  if (cell || row.length || closed) record();
  const headers = rows.shift();
  lines.shift();
  if (!headers?.length || headers.some((h) => !h.trim()))
    throw new CsvError("Provide nonempty column headers.");
  if (new Set(headers).size !== headers.length)
    throw new CsvError("Duplicate headers. Rename each column uniquely.");
  rows.forEach((r, i) => {
    if (r.length !== headers.length)
      throw new CsvError(
        `Expected ${headers.length} fields, found ${r.length}. Correct the delimiters.`,
        lines[i],
      );
  });
  return { headers, rows, lines };
}
