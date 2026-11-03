import {withCustomRoster} from '../customRoster.js';
import {processOmrData} from './omrProcessor.js';
const rollKey = value => {
 const text = String(value ?? '').trim().replace(/-/g, '');
 return /^\d{6}$/.test(text) ? '00' + text : text;
};
const rawRoll = row => row['Roll Number'] || row.Roll || row.roll || '';

export function makeOmrDecision(groups, roll, rowNumber) {
 const group = groups.find(item => item.roll === roll);
 return group && rowNumber != null ? {rowNumber, signature: group.signature} : null;
}

export function processReviewedOmr({omrData, sources = {}, answerKeyMap = {}, totalMcq = 0, corrections = {}, decisions = {}}) {
 if (!omrData) return withCustomRoster(processOmrData, sources, {answerKeyMap, totalMcq}, omrData);
 const rows = omrData.rows.map((row, index) => {
  const id = row._rowIndex || index + 1, fix = corrections[id];
  return {...row, _rowIndex: id, ...(fix ? {'Roll Number': fix.roll, 'Student Name': fix.name} : {})};
 });
 const grouped = new Map();
 for (const row of rows) {
  const roll = rollKey(rawRoll(row));
  if (!roll) continue;
  if (!grouped.has(roll)) grouped.set(roll, []);
  grouped.get(roll).push(row);
 }
 const groups = [...grouped].filter(([, items]) => items.length > 1).map(([roll, items]) => {
  const signature = JSON.stringify(items.map(row => [row._rowIndex, rollKey(rawRoll(row)), corrections[row._rowIndex]?.name || '']));
  const decision = decisions[roll];
  const selected = typeof decision === 'number' ? decision : decision?.rowNumber;
  const resolved = items.some(row => row._rowIndex === selected) && (typeof decision === 'number' || decision?.signature === signature);
  return {roll, signature, resolved, selected: resolved ? selected : null, rows: items};
 });
 const groupMap = new Map(groups.map(group => [group.roll, group]));
 // A correction's roster name applies only to the chosen source row when rolls collide.
 const customRows = [...(sources.custom?.rows || [])];
 for (const [rowNumber, fix] of Object.entries(corrections)) {
  const group = groupMap.get(rollKey(fix.roll));
  if (group && (!group.resolved || group.selected !== Number(rowNumber))) continue;
  const index = customRows.findIndex(row => rollKey(row[0]) === rollKey(fix.roll));
  const entry = [fix.roll, fix.name, ''];
  if (index >= 0) customRows[index] = entry; else customRows.push(entry);
 }
 // With no supplied roster, registering one corrected row must not exclude other valid exam rows.
 if (customRows.length && !sources.students && !sources.web && !sources.custom?.rows?.length) {
  const existing = new Set(customRows.map(row => rollKey(row[0])));
  for (const row of rows) {
   const roll = rollKey(rawRoll(row));
   if (/^\d{8}$/.test(roll) && !existing.has(roll)) {
    customRows.push([roll, row['Student Name'] || row.Name || row.name || '—', '']); existing.add(roll);
   }
  }
 }
 const combinedSources = customRows.length ? {...sources, custom: {type: 'custom', fileName: sources.custom?.fileName || 'Manual OMR entries', headers: ['Roll', 'Name', 'College'], mapping: {roll: 0, name: 1, college: 2, mark: -1}, rows: customRows}} : sources;
 const run = inputRows => withCustomRoster(processOmrData, combinedSources, {answerKeyMap, totalMcq}, {...omrData, rows: inputRows});
 const preview = run(rows);
 const reviewGroups = groups.map(group => ({...group, entries: group.rows.map(row => {
  const graded = preview.results.find(result => result.rowNumber === row._rowIndex) || processOmrData({omrData: {...omrData, rows: [row]}, answerKeyMap, totalMcq, sources: {}}).results[0];
  const original = omrData.rows.find((original, index) => (original._rowIndex || index + 1) === row._rowIndex);
  return {rowNumber: row._rowIndex, roll: rawRoll(row), originalRoll: rawRoll(original), corrected: !!corrections[row._rowIndex], name: corrections[row._rowIndex]?.name || graded?.name || row['Student Name'] || row.Name || '—', score: graded?.score ?? row.Score ?? '—', answers: Object.entries(row).filter(([key]) => /^Q\d+$/i.test(key)).map(([key, value]) => key + ': ' + value).join(' · ')};
 })}));
 const retained = rows.filter(row => {
  const group = groupMap.get(rollKey(rawRoll(row)));
  return !group || (group.resolved && group.selected === row._rowIndex);
 });
 const final = run(retained);
 const pending = groups.filter(group => !group.resolved);
 const pendingIssues = pending.flatMap(group => group.rows.map(row => ({type: 'Duplicate Roll', roll: group.roll, rowNumber: row._rowIndex, detail: 'Roll ' + group.roll + ' appears in source rows ' + group.rows.map(item => item._rowIndex).join(', ') + '. Choose one entry in Duplicate decisions.'})));
 const issues = [...final.issues, ...pendingIssues];
 const retainedIds = new Set(final.results.map(row => row.rowNumber));
 const issueGroups = new Map();
 for (const issue of issues) {
  if (!issueGroups.has(issue.rowNumber)) issueGroups.set(issue.rowNumber, {roll: issue.roll, rowNumber: issue.rowNumber, excluded: !retainedIds.has(issue.rowNumber), reasons: []});
  issueGroups.get(issue.rowNumber).reasons.push(issue);
 }
 const flaggedRows = [...issueGroups.values()].map(row => ({...row, type: [...new Set(row.reasons.map(reason => reason.type))].join(' + '), detail: row.reasons.map(reason => reason.detail).join('; ')}));
 const reviewLog = Object.entries(corrections).map(([rowNumber, fix]) => {
  const id = Number(rowNumber), group = groupMap.get(rollKey(fix.roll));
  const original = omrData.rows.find((row, index) => (row._rowIndex || index + 1) === id);
  const problems = flaggedRows.find(row => row.rowNumber === id);
  const status = group && !group.resolved ? 'duplicate-pending' : group && group.selected !== id ? 'discarded' : problems ? 'needs-review' : retainedIds.has(id) ? 'resolved' : 'needs-review';
  return {rowNumber: id, originalRoll: rawRoll(original), ...fix, status, conflictingRows: group ? group.rows.filter(row => row._rowIndex !== id).map(row => row._rowIndex) : [], reason: problems?.detail || ''};
 });
 return {...final, issues, flaggedRows, reviewGroups, pendingDuplicates: pending.length, reviewLog, stats: {...final.stats, total: rows.length, excluded: rows.length - final.results.length, flagged: flaggedRows.length, flaggedExcluded: flaggedRows.filter(row => row.excluded).length, discardedDuplicates: groups.filter(group => group.resolved).reduce((count, group) => count + group.rows.length - 1, 0), issueCount: issues.length, reviewInResults: flaggedRows.filter(row => !row.excluded).length}};
}

export function validateOmrCorrection(roll, name) {
 const clean = String(roll ?? '').trim();
 if (!/^\d+$/.test(clean)) throw Error('সংখ্যা দিয়ে সঠিক রোল লিখুন।');
 if (!String(name ?? '').trim()) throw Error('শিক্ষার্থীর নাম লিখুন।');
 return {roll: clean, name: String(name).trim()};
}
