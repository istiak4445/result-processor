import React, {useState} from 'react';
import {validateOmrCorrection} from './omrReview.js';
import './omr-review.css';
const groupId = roll => 'omr-duplicate-' + encodeURIComponent(roll);
export function OmrCorrectionAction({issue, correction, onApply, lookupName}) {
 const [open, setOpen] = useState(false), [roll, setRoll] = useState(''), [name, setName] = useState(''), [error, setError] = useState('');
 const matchedName = lookupName?.(roll);
 const effectiveName = matchedName?.name || name;
 const duplicate = issue.type === 'Duplicate Roll';
 const edit = () => {setRoll(correction?.roll || issue.roll || ''); setName(correction?.name || ''); setError(''); setOpen(true);};
 return <div className="omr-correction">
  {duplicate && <a className="omr-choose-link" href={'#' + groupId(issue.roll)}>কোন entry রাখবেন বেছে নিন ↑</a>}
  {!open ? <button type="button" onClick={edit}>{duplicate ? 'আলাদা শিক্ষার্থী? রোল ঠিক করুন' : 'রোল / নাম ঠিক করুন'}</button> :
   <form onSubmit={event => {event.preventDefault(); try {onApply(issue.rowNumber, validateOmrCorrection(roll, effectiveName)); setOpen(false); setError('');} catch (error) {setError(error.message);}}}>
    <b>Source row {issue.rowNumber} ঠিক করছেন</b>
    <label>সঠিক রোল<input aria-label={'Correct roll for row ' + issue.rowNumber} value={roll} onChange={event => {setRoll(event.target.value);setName('');setError('');}} inputMode="numeric"/></label>
    <label>শিক্ষার্থীর নাম<input aria-label={'Student name for row ' + issue.rowNumber} value={effectiveName} readOnly={!!matchedName} onChange={event => {setName(event.target.value);setError('');}}/></label>
    <small className={matchedName?'omr-name-match':'omr-name-unmatched'} role="status">{matchedName?'✓ '+matchedName.source+' থেকে নাম পাওয়া গেছে':roll?'এই রোলে কোনো নাম পাওয়া যায়নি। হাতে নাম লিখুন।':'রোল লিখলে সংযুক্ত sheet থেকে নাম আসবে।'}</small>
    <small>এই row-এর marks ও answers অপরিবর্তিত থাকবে।</small>
    <div><button type="submit">Save correction</button><button type="button" onClick={() => setOpen(false)}>Cancel</button></div>
    {error && <p role="alert">{error}</p>}
   </form>}
 </div>;
}
function DuplicateGroup({group, onSelect}) {
 const corrected = group.entries.filter(entry => entry.corrected);
 return <div className="omr-duplicate-group" id={groupId(group.roll)}>
  <div className="omr-review-title"><b>Roll {group.roll} · Source rows {group.entries.map(entry => entry.rowNumber).join(', ')}</b><span>{group.resolved ? '✓ সিদ্ধান্ত হয়েছে' : 'একটি entry বেছে নিন'}</span></div>
  {!group.resolved && <p className="omr-collision-explanation">{corrected.length ? 'রোল সংশোধনের পর একই রোল একাধিক source row-তে পাওয়া গেছে। আগের রোলের সমস্যা ঠিক হয়েছে, এখন duplicate সিদ্ধান্ত বাকি।' : 'একই রোলের একাধিক entry আছে। Marks ও answers তুলনা করে একটি রাখুন।'} একটি বেছে নিলে অন্যগুলো result থেকে বাদ যাবে।</p>}
  {group.resolved && <p className="omr-resolution-success">Source row {group.selected} রাখা হয়েছে। Row {group.entries.filter(entry => entry.rowNumber !== group.selected).map(entry => entry.rowNumber).join(', ')} বাদ দেওয়া হয়েছে। Rank ও result নতুন করে হিসাব হয়েছে।</p>}
  <div className="omr-duplicate-options">{group.entries.map(entry => <button type="button" className={group.selected === entry.rowNumber ? 'chosen' : ''} key={entry.rowNumber} aria-pressed={group.selected === entry.rowNumber} onClick={() => onSelect(group.roll, entry.rowNumber)}>
   <span>Source row {entry.rowNumber}</span><b>{entry.name}</b>
   {entry.corrected && <span className="omr-entry-change">সংশোধিত: {entry.originalRoll || '(blank)'} → {entry.roll}</span>}
   <strong>Marks: {entry.score}</strong><small>{entry.answers || 'No question answers in source'}</small>
   <em>{group.selected === entry.rowNumber ? '✓ এই entry রাখা হয়েছে' : group.resolved ? 'এই entry দিয়ে বদলান' : 'এই entry রাখুন'}</em>
  </button>)}</div>
  {group.resolved && <button className="omr-review-reset" type="button" onClick={() => onSelect(group.roll, null)}>সিদ্ধান্ত বাতিল করুন</button>}
 </div>;
}
const statusText = {
 resolved: '✓ ঠিক হয়েছে · Final result-এ আছে',
 'duplicate-pending': 'রোল ঠিক হয়েছে · Duplicate সিদ্ধান্ত বাকি',
 discarded: 'সিদ্ধান্ত অনুযায়ী এই entry রাখা হয়নি',
 'needs-review': 'আরও যাচাই প্রয়োজন'
};
export default function OmrReviewPanel({groups = [], pending = 0, log = [], onSelect, onUndo}) {
 const unresolved = groups.filter(group => !group.resolved), resolved = groups.filter(group => group.resolved);
 return <section className="omr-review-panel" aria-label="Manual OMR review">
  <div className="omr-review-title"><h3>বাকি সিদ্ধান্ত ও সংশোধনের অবস্থা</h3><span>{pending ? pending + ' duplicate decision বাকি' : 'Duplicate সিদ্ধান্ত বাকি নেই'}</span></div>
  <p>শুধু বাকি সমস্যাগুলো নিচের issue list-এ থাকবে। ঠিক হয়ে যাওয়া entry এখানে history-তে দেখা যাবে।</p>
  {pending > 0 && <p className="omr-review-warning" role="status">Duplicate সিদ্ধান্ত না হওয়া পর্যন্ত ওই রোলগুলোর result ও export অপেক্ষায় আছে। অন্য entry-এর আগের সিদ্ধান্ত ঠিক থাকবে।</p>}
  {log.length > 0 && <div className="omr-review-log"><b>সংশোধনের ইতিহাস ({log.length})</b>{log.map(item => <div className={'omr-correction-log-item omr-correction-log-item--' + item.status} key={item.rowNumber}>
   <div><b>Source row {item.rowNumber}: {item.originalRoll || '(blank)'} → {item.roll}</b><span>{item.name}</span><strong>{statusText[item.status]}</strong>
   {item.status === 'duplicate-pending' && <a href={'#' + groupId(item.roll.length === 6 ? '00' + item.roll : item.roll)}>Source row {item.conflictingRows.join(', ')}-এর সঙ্গে একই রোল। নিচে entry বেছে নিন ↓</a>}
   {item.status === 'needs-review' && <small>{item.reason}</small>}</div>
   <button type="button" onClick={() => onUndo(item.rowNumber)}>Undo</button>
  </div>)}</div>}
  {unresolved.map(group => <DuplicateGroup key={group.roll} group={group} onSelect={onSelect}/>)}
  {resolved.length > 0 && <details className="omr-resolved-history"><summary>✓ মিটে যাওয়া duplicate ({resolved.length}) · সিদ্ধান্ত দেখুন / বদলান</summary>{resolved.map(group => <DuplicateGroup key={group.roll} group={group} onSelect={onSelect}/>)}</details>}
 </section>;
}
