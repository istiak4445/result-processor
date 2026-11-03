import React, {useState} from 'react';
import * as XLSX from 'xlsx';
import {parseCustomRoster} from './customRoster.js';
export default function CustomRosterInput({source,onChange,onRemove}) {
 const [error,setError]=useState('');
 async function upload(file){try{setError('');const book=XLSX.read(await file.arrayBuffer(),{type:'array'});const matrix=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false});onChange(parseCustomRoster(matrix,file.name));}catch(e){setError(e.message);}}
 return <div className="mapping"><b>Custom students · optional</b><p>নতুন ব্যাচের Roll ও Name sheet। কলেজ ফাঁকা থাকবে। Students/Web-এর পাশাপাশি ব্যবহার হবে।</p><input type="file" accept=".xlsx,.xls,.csv" onChange={e=>{const file=e.target.files?.[0];if(file)upload(file);e.target.value='';}}/>{error&&<p role="alert">{error}</p>}{source&&<p>{source.fileName} · {source.rows.length} students <button type="button" onClick={onRemove}>Remove</button></p>}</div>;
}
