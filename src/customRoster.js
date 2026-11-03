// Optional custom-roster boundary. Existing parsers/processors remain unchanged.
const canonical = value => {
  const text = String(value ?? '').trim().replace(/-/g, '');
  return /^\d{6}$/.test(text) ? '00' + text : text;
};
export function parseCustomRoster(matrix, fileName) {
  const header = matrix.findIndex(row => row.some(v => /^roll(?: number| no\.?)?$/i.test(String(v).trim())) && row.some(v => /^(?:student |full )?name$/i.test(String(v).trim())));
  if (header < 0) throw new Error('Custom sheet needs Roll and Name columns.');
  const cols = matrix[header].map(v => String(v).trim());
  const rollCol = cols.findIndex(v => /^roll(?: number| no\.?)?$/i.test(v));
  const nameCol = cols.findIndex(v => /^(?:student |full )?name$/i.test(v));
  const seen = new Set();
  const rows = matrix.slice(header + 1).filter(row => row.some(v => String(v ?? '').trim())).map((row, i) => {
    const roll = String(row[rollCol] ?? '').trim();
    const name = String(row[nameCol] ?? '').trim();
    if (!/^\d+$/.test(roll) || !name) throw new Error('Custom sheet row ' + (header+i+2) + ': numeric Roll and Name required.');
    const id = canonical(roll);
    if (seen.has(id)) throw new Error('Duplicate custom roll: ' + roll);
    seen.add(id);
    return [roll, name, ''];
  });
  if (!rows.length) throw new Error('Custom sheet has no students.');
  return {type:'custom', fileName, headers:['Roll','Name','College'], mapping:{roll:0,name:1,college:2,mark:-1}, headerIndex:0, rows};
}
export function withCustomRoster(processor, sources, options, omrData) {
  if (!sources.custom?.rows?.length) return omrData === undefined ? processor(sources, options) : processor({...options, sources, omrData});
  const used = new Set();
  for (const src of Object.values(sources)) if (src?.rows && src.mapping) for (const row of src.rows) used.add(canonical(row[src.mapping.roll]));
  if (omrData) for (const row of omrData.rows) used.add(canonical(row['Roll Number'] || row.Roll || row.roll));
  const aliases = new Map(), originals = new Map();
  let next = 99999999;
  for (const row of sources.custom.rows) {
    const id = canonical(row[0]);
    if (!/^\d{8}$/.test(id)) {
      while (used.has(String(next))) next--;
      const alias = String(next--); used.add(alias); aliases.set(id,alias); originals.set(alias,String(row[0]));
    }
  }
  const convert = value => aliases.get(canonical(value)) || value;
  const mapped = {...sources};
  for (const [kind,src] of Object.entries(sources)) if (kind !== 'custom' && src?.rows && src.mapping) mapped[kind] = {...src, rows:src.rows.map(row => {const copy=[...row]; if(src.mapping.roll>=0)copy[src.mapping.roll]=convert(copy[src.mapping.roll]); return copy;})};
  const base = mapped.students;
  const roster = base ? base.rows.map(row => [row[base.mapping.roll],base.mapping.name>=0?row[base.mapping.name]:'',base.mapping.college>=0?row[base.mapping.college]:'']) : [];
  const existing = new Set(roster.map(row => canonical(row[0])));
  for (const row of sources.custom.rows) {const id=convert(row[0]);if(!existing.has(canonical(id))){roster.push([id,row[1],'']);existing.add(canonical(id));}}
  mapped.students={type:'students',fileName:base?.fileName || sources.custom.fileName,headers:['Roll','Name','College'],mapping:{roll:0,name:1,college:2,mark:-1},headerIndex:0,rows:roster};
  let result;
  if (omrData !== undefined) {
    const rows=omrData.rows.map(row=>{const copy={...row};for(const key of ['Roll Number','Roll','roll'])if(copy[key]!=null)copy[key]=convert(copy[key]);return copy;});
    result=processor({...options,sources:mapped,omrData:{...omrData,rows}});
  } else {
    const decisions=options?.mcqDecisions || options || {};
    result=processor(mapped,{mcqDecisions:Object.fromEntries(Object.entries(decisions).map(([roll,v])=>[convert(roll),v]))});
  }
  const restore=value=>{
    if(typeof value==='string'){for(const [alias,roll] of originals)value=value.replace(new RegExp('(?<![0-9])'+alias+'(?![0-9])','g'),roll);return value;}
    if(Array.isArray(value))return value.map(restore);
    if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,restore(v)]));
    return value;
  };
  return restore(result);
}
