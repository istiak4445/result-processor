// Core roll normalization and table mapping logic
// Bridged across ResultFlow processor and OMR cleaner

export const SYN = {
  roll: ['roll', 'roll number', 'roll no', 'web roll', 'web roll*', 'roll/phone', 'student roll'],
  name: ['student name', 'name', 'full name'],
  college: ['college', 'institution', 'school', 'college / institution name'],
  mark: ['marks', 'mark', 'score', 'mcq', 'cq', 'total score'],
};

export const key = v => String(v ?? '').trim().toLowerCase().replace(/[\n_*]+/g, ' ').replace(/\s+/g, ' ');

export function normalizeRoll(value) {
  const original = String(value ?? '').trim();
  if (!original) return { original, normalized: '', valid: false, reason: 'Roll missing' };
  const cleaned = original.replace(/-/g, '').trim();
  if (!/^\d+$/.test(cleaned)) return { original, normalized: '', valid: false, reason: 'Contains letters or invalid symbols' };
  if (cleaned.length === 6) return { original, normalized: `00${cleaned}`, valid: true, reason: '' };
  if (cleaned.length === 8) return { original, normalized: cleaned, valid: true, reason: '' };
  return { original, normalized: '', valid: false, reason: `Expected 6 or 8 digits; found ${cleaned.length}` };
}

export function detectHeader(rows) {
  let best = { index: 0, score: -1 };
  rows.slice(0, 20).forEach((row, index) => {
    const cells = row.map(key);
    let score = 0;
    Object.values(SYN).flat().forEach(s => {
      if (cells.includes(s)) score += 1;
    });
    score += cells.filter(Boolean).length * 0.01;
    if (score > best.score) best = { index, score };
  });
  return best.index;
}

export function detectColumn(headers, field, type) {
  const normalized = headers.map(key);
  if (type === 'web' && field === 'roll') {
    const authoritative = ['web roll', 'web roll number', 'website roll', 'web roll no'];
    const preferred = authoritative.map(s => normalized.indexOf(s)).find(i => i >= 0);
    if (preferred !== undefined) return preferred;
    const partial = normalized.findIndex(h => h.includes('web') && h.includes('roll'));
    if (partial >= 0) return partial;
  }
  const exact = SYN[field].map(s => normalized.indexOf(s)).find(i => i >= 0);
  if (exact !== undefined) return exact;
  return normalized.findIndex(h => SYN[field].some(s => h.includes(s)));
}

export function parseRows(matrix, type, fileName) {
  const headerIndex = detectHeader(matrix);
  const headers = (matrix[headerIndex] || []).map(v => String(v ?? '').trim());
  const entries = matrix
    .slice(headerIndex + 1)
    .map((row, i) => ({ row, rowNumber: headerIndex + i + 2 }))
    .filter(({ row }) => row.some(v => String(v ?? '').trim() !== ''));
  const rows = entries.map(x => x.row);
  const rowNumbers = entries.map(x => x.rowNumber);
  return {
    type,
    fileName,
    headerIndex,
    headers,
    rows,
    rowNumbers,
    mapping: {
      roll: detectColumn(headers, 'roll', type),
      name: detectColumn(headers, 'name', type),
      college: detectColumn(headers, 'college', type),
      mark: detectColumn(headers, 'mark', type),
    },
  };
}

export function makeMap(src) {
  const map = new Map(), duplicates = new Set(), invalid = [];
  if (!src) return { map, duplicates, invalid, records: [] };
  const records = src.rows
    .map((row, i) => {
      const n = normalizeRoll(row[src.mapping.roll]);
      return { row, rowNumber: src.rowNumbers?.[i] ?? i + src.headerIndex + 2, ...n };
    })
    .filter(r => !(src.type === 'web' && r.original === ''));
  records.forEach(r => {
    if (!r.valid) {
      invalid.push(r);
      return;
    }
    if (map.has(r.normalized)) duplicates.add(r.normalized);
    else map.set(r.normalized, r);
  });
  return { map, duplicates, invalid, records };
}

export function sourceValue(record, source, field) {
  const i = source?.mapping?.[field];
  return i >= 0 ? String(record?.row?.[i] ?? '').trim() : '';
}
