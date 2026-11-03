// Read-only lookup for the correction form; existing parsing/matching stays unchanged.
const rollKey = value => {
 const roll = String(value ?? '').trim().replace(/-/g, '');
 if (!/^\d+$/.test(roll)) return '';
 return roll.length === 6 ? '00' + roll : roll;
};
export function createRosterNameLookup(sources = {}) {
 const names = new Map();
 for (const [kind, label] of [['web', 'Web sheet'], ['students', 'Students sheet'], ['custom', 'Custom sheet']]) {
  const source = sources[kind];
  if (!source?.rows || !source.mapping || source.mapping.roll < 0 || source.mapping.name < 0) continue;
  const seen = new Set();
  for (const row of source.rows) {
   const roll = rollKey(row[source.mapping.roll]);
   if (!roll || (kind !== 'custom' && roll.length !== 8) || seen.has(roll)) continue;
   seen.add(roll);
   const name = String(row[source.mapping.name] ?? '').trim();
   if (name && !names.has(roll)) names.set(roll, {name, source: label});
  }
 }
 return value => names.get(rollKey(value)) || null;
}
