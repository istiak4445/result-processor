import React, {useState} from 'react';
import * as XLSX from 'xlsx';
import {Users, Upload, CheckCircle2, X, AlertCircle} from 'lucide-react';
import {parseCustomRoster} from './customRoster.js';
import './custom-roster.css';
export default function CustomRosterInput({source,onChange,onRemove}) {
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 async function upload(file){try{setBusy(true);setError('');const book=XLSX.read(await file.arrayBuffer(),{type:'array'});const matrix=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false});onChange(parseCustomRoster(matrix,file.name));}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className={'custom-roster-card'+(source?' custom-roster-card--ready':'')} aria-label="Custom students roster">
  <div className="custom-roster-heading"><span className="custom-roster-icon"><Users size={21}/></span><div><h3>Custom students</h3><span>নতুন ব্যাচের অস্থায়ী রোল ও নাম</span></div><span className="custom-roster-badge">{source?'Connected':'Optional'}</span></div>
  <p className="custom-roster-description">Students বা Web sheet-এ রোল নেই? এখানে Roll ও Name sheet যোগ করো।</p>
  <label className="custom-roster-upload"><Upload size={19}/><span>{busy?'Reading sheet…':source?'Change Custom Students':'Upload Custom Students'}<small>Excel / CSV · Roll + Name</small></span><input aria-label="Upload Custom Students" type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)upload(file);e.target.value='';}}/></label>
  {source&&<div className="custom-roster-connected" role="status"><CheckCircle2 size={17}/><div><b>{source.fileName}</b><span>{source.rows.length} students · Result Processor ও OMR-এ সক্রিয়</span></div><button type="button" aria-label="Remove custom students" onClick={()=>{setError('');onRemove();}}><X size={16}/></button></div>}
  {error&&<p className="custom-roster-error" role="alert"><AlertCircle size={16}/>{error}</p>}
  <div className="custom-roster-footnote">ঐচ্ছিক · কলেজ ফাঁকা থাকবে · একই sheet দুই tab-এ ব্যবহার হবে</div>
 </section>;
}
