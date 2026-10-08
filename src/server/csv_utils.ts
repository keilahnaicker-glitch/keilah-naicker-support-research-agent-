/**
 * Robust CSV parser and serializer utility.
 * Supports quoted strings, commas inside quotes, escaped quotes, and newlines.
 */

export function parseCsv<T = Record<string, string>>(content: string): T[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < lines.length; i++) {
    const char = lines[i];
    const nextChar = lines[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 0 && !(currentRow.length === 1 && currentRow[0] === '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map(h => h.trim());
  const data: T[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0] === '') continue;
    const item: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      item[headers[j]] = row[j] !== undefined ? row[j].trim() : '';
    }
    data.push(item as unknown as T);
  }

  return data;
}

export function stringifyCsv<T extends Record<string, any>>(records: T[], headers?: (keyof T)[]): string {
  if (records.length === 0 && !headers) return '';

  const cols = (headers || Object.keys(records[0])) as string[];
  const escapeField = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [cols.join(',')];
  for (const record of records) {
    const row = cols.map(c => escapeField(record[c]));
    lines.push(row.join(','));
  }

  return lines.join('\n');
}
