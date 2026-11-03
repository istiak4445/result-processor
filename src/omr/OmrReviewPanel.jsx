import React,{useState} from 'react';
import {validateOmrCorrection} from './omrReview.js';
import './omr-review.css';
export function OmrCorrectionAction({issue,correction,onApply,onUndo}){
 const [open,setOpen]=useState(false),[roll,setRoll]=useState(correction?.roll||issue.roll||''),[name,setName]=useState(correction?.name||''),[error,setError]=useState('');
 return <div className="omr-correction">{!open?<button type="button" onClick={()=>setOpen(true)}>রোল / নাম ঠিক করে যোগ করুন</button>:<form onSubmit={e=>{e.preventDefault();try{onApply(issue.rowNumber,validateOmrCorrection(roll,name));setOpen(false);setError('');}catch(e){setError(e.message);}}}>
 <label>সঠিক রোল<input aria-label={'Correct roll for row '+issue.rowNumber} value={roll} onChange={e=>setRoll(e.target.value)} inputMode="numeric"/></label><label>শিক্ষার্থীর নাম<input aria-label={'Student name for row '+issue.rowNumber} value={name} onChange={e=>setName(e.target.value)}/></label><div><button type="submit">Apply & recalculate</button><button type="button" onClick={()=>setOpen(false)}>Cancel</button></div>{error&&<p role="alert">{error}</p>}</form>}</div>;
}
export default function OmrReviewPanel({groups=[],pending=0,log=[],onSelect,onUndo}){
 return <section className="omr-review-panel" aria-label="Manual OMR review"><div className="omr-review-title"><h3>Entry review & duplicate decisions</h3><span>{pending?pending+' decision pending':'Review controls'}</span></div><p>বাদ পড়া এন্ট্রির পাশে রোল ও নাম ঠিক করুন। Duplicate হলে প্রতিটি row-এর marks ও answers দেখে একটি বেছে নিন।</p>
 {pending>0&&<p className="omr-review-warning" role="status">সিদ্ধান্ত না হওয়া duplicate রোলগুলো final result থেকে সাময়িক বাদ আছে। সিদ্ধান্ত শেষ হলে export করা যাবে।</p>}
 {groups.map(group=><div className="omr-duplicate-group" key={group.roll}><div className="omr-review-title"><b>Roll {group.roll} · {group.entries.length} entries</b><span>{group.resolved?'Decided':'কোন entry রাখবেন?'}</span></div><div className="omr-duplicate-options">{group.entries.map(entry=><button type="button" className={group.selected===entry.rowNumber?'chosen':''} key={entry.rowNumber} aria-pressed={group.selected===entry.rowNumber} onClick={()=>onSelect(group.roll,entry.rowNumber)}><span>Source row {entry.rowNumber}</span><b>{entry.name}</b><strong>Marks: {entry.score}</strong><small>{entry.answers||'No question answers in source'}</small><em>{group.selected===entry.rowNumber?'✓ Keeping this entry':'এই entry রাখুন'}</em></button>)}</div>{group.resolved&&<button className="omr-review-reset" type="button" onClick={()=>onSelect(group.roll,null)}>Reset decision</button>}</div>)}
 {log.length>0&&<div className="omr-review-log"><b>Manual corrections ({log.length})</b>{log.map(item=><div key={item.rowNumber}><span>Row {item.rowNumber} → {item.roll} · {item.name}</span><button type="button" onClick={()=>onUndo(item.rowNumber)}>Undo</button></div>)}</div>}
 </section>;
}
