import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as XLSX from 'xlsx';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {AlertTriangle, ArrowRight, CheckCircle2, Cloud, Download, FileSpreadsheet, Link2, RefreshCw, ShieldCheck, Upload, XCircle} from 'lucide-react';
import './styles.css';
import './overrides.css';
import './image-maker.css';
import ImageMaker from './ImageMaker.jsx';

const TYPES = {
  students:{label:'Students sheet', hint:'Roster / registration export', color:'violet'},
  web:{label:'Web roll sheet', hint:'Authoritative name & institution', color:'blue'},
  mcq:{label:'MCQ result', hint:'Objective marks', color:'amber'},
  cq:{label:'CQ result', hint:'Creative marks', color:'green'},
};
const SYN = {
  roll:['roll','roll number','roll no','web roll','web roll*','roll/phone','student roll'],
  name:['student name','name','full name'],
  college:['college','institution','school','college / institution name'],
  mark:['marks','mark','score','mcq','cq','total score'],
};
const OUTPUT_FIELDS=[
  ['rank','Rank'],['roll','Roll'],['name','Student Name'],['college','Institution'],['mcq','MCQ'],['cq','CQ'],['total','Total']
];
const key = v => String(v ?? '').trim().toLowerCase().replace(/[\n_*]+/g,' ').replace(/\s+/g,' ');
export function normalizeRoll(value){
  const original=String(value ?? '').trim();
  const cleaned=original.replace(/-/g,'').trim();
  if(!/^\d+$/.test(cleaned)) return {original,normalized:'',valid:false,reason:'Contains letters or invalid symbols'};
  if(cleaned.length===6) return {original,normalized:`00${cleaned}`,valid:true,reason:''};
  if(cleaned.length===8) return {original,normalized:cleaned,valid:true,reason:''};
  return {original,normalized:'',valid:false,reason:`Expected 6 or 8 digits; found ${cleaned.length}`};
}
function detectHeader(rows){
  let best={index:0,score:-1};
  rows.slice(0,20).forEach((row,index)=>{
    const cells=row.map(key); let score=0;
    Object.values(SYN).flat().forEach(s=>{if(cells.includes(s)) score+=1});
    score += cells.filter(Boolean).length*.01;
    if(score>best.score) best={index,score};
  });
  return best.index;
}
function detectColumn(headers, field, type){
  const normalized=headers.map(key);
  if(type==='web'&&field==='roll'){
    const authoritative=['web roll','web roll number','website roll','web roll no'];
    const preferred=authoritative.map(s=>normalized.indexOf(s)).find(i=>i>=0);
    if(preferred!==undefined) return preferred;
    const partial=normalized.findIndex(h=>h.includes('web')&&h.includes('roll'));
    if(partial>=0) return partial;
  }
  const exact=SYN[field].map(s=>normalized.indexOf(s)).find(i=>i>=0);
  if(exact!==undefined) return exact;
  return normalized.findIndex(h=>SYN[field].some(s=>h.includes(s)));
}
export function parseRows(matrix, type, fileName){
  const headerIndex=detectHeader(matrix); const headers=(matrix[headerIndex]||[]).map(v=>String(v??'').trim());
  const rows=matrix.slice(headerIndex+1).filter(r=>r.some(v=>String(v??'').trim()!==''));
  return {type,fileName,headerIndex,headers,rows,mapping:{roll:detectColumn(headers,'roll',type),name:detectColumn(headers,'name',type),college:detectColumn(headers,'college',type),mark:detectColumn(headers,'mark',type)}};
}
async function readFile(file,type){
  const bytes=await file.arrayBuffer(); const book=XLSX.read(bytes,{type:'array',raw:false});
  const name=book.SheetNames[0]; const matrix=XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false});
  return {...parseRows(matrix,type,file.name),sheetName:name};
}
function googleWorkbookUrl(url){
  const id=url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if(!id) throw new Error('Paste a valid Google Sheets link.');
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
}
function googleSheetId(url){return url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1]||''}
function workbookTitle(response,book,url){
  const disposition=response.headers.get('content-disposition')||'';
  const encoded=disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain=disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const fileName=encoded?decodeURIComponent(encoded):plain;
  return String(fileName||book.Props?.Title||'').replace(/\.xlsx$/i,'').trim()||`Google Sheet · ${googleSheetId(url).slice(0,8)}`;
}
function defaultWebTab(book,matrices){
  const ranked=book.SheetNames.map(name=>{
    const parsed=parseRows(matrices[name],'web',name); const indexed=makeMap(parsed);
    const hasWebHeader=parsed.headers.some(cell=>/web\s*roll/i.test(String(cell??'').replace(/[\n_*]+/g,' ')));
    return {name,valid:indexed.map.size,score:indexed.map.size+(hasWebHeader?100000:0)};
  }).sort((a,b)=>b.score-a.score);
  if(ranked[0]?.valid>0)return ranked[0].name;
  return book.SheetNames.find(name=>/web\s*roll|web\s*sheet/i.test(name))||ranked[0]?.name||book.SheetNames[0];
}
export function makeMap(src){
  const map=new Map(), duplicates=new Set(), invalid=[];
  if(!src) return {map,duplicates,invalid,records:[]};
  const records=src.rows.map((row,i)=>{const n=normalizeRoll(row[src.mapping.roll]); return {row,rowNumber:i+src.headerIndex+2,...n}})
    .filter(r=>!(src.type==='web'&&r.original===''));
  records.forEach(r=>{if(!r.valid){invalid.push(r);return} if(map.has(r.normalized)) duplicates.add(r.normalized); else map.set(r.normalized,r)});
  return {map,duplicates,invalid,records};
}
function sourceValue(record, source, field){const i=source?.mapping[field]; return i>=0 ? String(record?.row?.[i]??'').trim():''}
export function processSources(sources){
  const s=makeMap(sources.students), w=makeMap(sources.web), m=makeMap(sources.mcq), c=makeMap(sources.cq), manual=makeMap(sources.manual);
  const label=(src,fallback)=>src?.fileName||fallback;
  const examRolls=new Set([...m.map.keys(),...c.map.keys(),...manual.map.keys()]);
  const results=[], audit=[];
  [...examRolls].forEach((roll,index)=>{
    const student=s.map.get(roll), web=w.map.get(roll), mcq=m.map.get(roll), cq=c.map.get(roll), manualRow=manual.map.get(roll);
    audit.push({roll,students:student?'Matched':'NOT FOUND',web:web?'Matched':'Not used',mcq:sources.mcq?(mcq?'Matched':'Missing'):'Not supplied',cq:sources.cq?(cq?'Matched':'Missing'):'Not supplied'});
    if(!student&&!web&&!manualRow)return;
    const mcqRaw=sourceValue(mcq,sources.mcq,'mark'), cqRaw=sourceValue(cq,sources.cq,'mark');
    const mv=Number(mcqRaw), cv=Number(cqRaw);
    const mcqOk=!!mcq && mcqRaw!=='' && Number.isFinite(mv), cqOk=!!cq && cqRaw!=='' && Number.isFinite(cv);
    const manualRaw=sourceValue(manualRow,sources.manual,'mark'), manualValue=Number(manualRaw), manualOk=manualRaw!==''&&Number.isFinite(manualValue);
    const name=sourceValue(web,sources.web,'name')||sourceValue(student,sources.students,'name')||sourceValue(manualRow,sources.manual,'name');
    const college=sourceValue(web,sources.web,'college')||sourceValue(student,sources.students,'college')||sourceValue(manualRow,sources.manual,'college');
    const total=mcqOk&&cqOk?mv+cv:mcqOk?mv:cqOk?cv:manualOk?manualValue:null;
    results.push({_id:index,roll,name,college,mcq:mcqOk?mv:null,cq:cqOk?cv:null,total,rank:null});
  });
  const sorted=[...results].sort((a,b)=>(b.total??-Infinity)-(a.total??-Infinity)||a.roll.localeCompare(b.roll));
  let rank=0,last=null; sorted.forEach(r=>{if(r.total===null)return; if(r.total!==last){rank++;last=r.total}r.rank=rank});
  const issueRows=[
    ...m.invalid.map(r=>({type:'Invalid MCQ roll',roll:r.original,detail:`Row ${r.rowNumber}: ${r.reason.replace('Expected ','').replace('; found ','; got ')}`})),
    ...c.invalid.map(r=>({type:'Invalid CQ roll',roll:r.original,detail:`Row ${r.rowNumber}: ${r.reason.replace('Expected ','').replace('; found ','; got ')}`})),
    ...manual.invalid.map(r=>({type:'Invalid manual roll',roll:r.original,detail:`Manual row ${r.rowNumber}: ${r.reason.replace('Expected ','').replace('; found ','; got ')}`})),
    ...[...s.duplicates].filter(roll=>examRolls.has(roll)).map(roll=>({type:'Duplicate roll',roll,detail:'Repeated exam roll in Students',source:label(sources.students,'Students')})),
    ...[...w.duplicates].filter(roll=>examRolls.has(roll)).map(roll=>({type:'Duplicate roll',roll,detail:'Repeated exam roll in Web Roll',source:label(sources.web,'Web Roll')})),
    ...[...m.duplicates].map(roll=>({type:'Duplicate roll',roll,detail:'Repeated in MCQ',source:label(sources.mcq,'MCQ')})),
    ...[...c.duplicates].map(roll=>({type:'Duplicate roll',roll,detail:'Repeated in CQ',source:label(sources.cq,'CQ')})),
    ...[...manual.duplicates].map(roll=>({type:'Duplicate manual roll',roll,detail:'Repeated in manual roll list'})),
    ...[...examRolls].filter(roll=>!s.map.has(roll)&&!w.map.has(roll)).map(roll=>({type:'Not in Students',roll,detail:'Marks roll not found in Students sheet or valid Web Roll'})),
    ...(sources.mcq&&(sources.manual||sources.cq)?results.filter(r=>r.mcq===null&&sourceValue(manual.map.get(r.roll),sources.manual,'mark')==='').map(r=>({type:'MCQ missing',roll:r.roll,detail:sources.manual?'Manual roll not found in MCQ':'Present in CQ only'})):[]),
    ...(sources.cq&&(sources.manual||sources.mcq)?results.filter(r=>r.cq===null&&sourceValue(manual.map.get(r.roll),sources.manual,'mark')==='').map(r=>({type:'CQ missing',roll:r.roll,detail:sources.manual?'Manual roll not found in CQ':'Present in MCQ only'})):[]),
    ...results.filter(r=>!r.name).map(r=>({type:'Name missing',roll:r.roll,detail:'Name blank in Students and Web'})),
  ];
  return {results:sorted,audit,issues:issueRows.map(({type,roll,detail})=>({type,roll,'Manual Mark':sourceValue(manual.map.get(roll),sources.manual,'mark'),'Manual Status':manual.map.has(roll)?'✓ Edited':'',description:detail}))};
}
function SourceCard({type,source,onFile}){const t=TYPES[type];return <label className={`source-card ${source?'ready':''}`}>
  <input type="file" accept=".xlsx,.xls,.csv" onChange={e=>e.target.files[0]&&onFile(e.target.files[0],type)}/>
  <span className={`source-icon ${t.color}`}><FileSpreadsheet size={21}/></span><span className="grow"><b>{t.label}</b><small>{source?source.fileName:t.hint}</small></span>
  {source?<CheckCircle2 className="ok" size={20}/>:<Upload size={18}/>}<em>{['mcq','cq'].includes(type)?'Optional · Read-only':'Read-only'}</em>
 </label>}
function Mapping({source,onChange}){if(!source)return null;return <div className="mapping"><b>Detected columns · {source.fileName}</b><div>{['roll','name','college','mark'].filter(f=>f==='roll'||(source.type==='web'&&['name','college'].includes(f))||(['mcq','cq'].includes(source.type)&&f==='mark')||(source.type==='students'&&['name','college'].includes(f))).map(f=><label key={f}><span>{f}</span><select value={source.mapping[f]} onChange={e=>onChange(source.type,f,+e.target.value)}><option value={-1}>Not found</option>{source.headers.map((h,i)=><option key={i} value={i}>{h||`Column ${i+1}`}</option>)}</select></label>)}</div></div>}
function App(){
 const initialLibrary=useMemo(()=>{try{const list=JSON.parse(localStorage.getItem('resultflow.savedSheets')||'[]');if(list.length)return list;const old=JSON.parse(localStorage.getItem('resultflow.webRollConfig')||'null');return old?.url?[{id:googleSheetId(old.url),url:old.url,title:'Saved Google Sheet',webTab:old.sheetName||''}]:[]}catch{return []}},[]);
 const [savedSheets,setSavedSheets]=useState(initialLibrary); const [activeSavedId,setActiveSavedId]=useState(initialLibrary[0]?.id||'');
 const [sources,setSources]=useState({}); const [link,setLink]=useState(''); const [sheetNames,setSheetNames]=useState([]); const [selectedSheet,setSelectedSheet]=useState(''); const [linkedMatrices,setLinkedMatrices]=useState({}); const [manualRows,setManualRows]=useState([{roll:'',name:'',college:'',mark:'',added:false}]); const [outputFields,setOutputFields]=useState(()=>OUTPUT_FIELDS.map(([id])=>id)); const [busy,setBusy]=useState(''); const [tab,setTab]=useState('results'); const [workspaceTab,setWorkspaceTab]=useState('processor'); const [showIssueDetails,setShowIssueDetails]=useState(false); const [issueFilter,setIssueFilter]=useState(''); const [issueSearch,setIssueSearch]=useState(''); const [error,setError]=useState('');
 const processed=useMemo(()=>processSources(sources),[sources]); const complete=!!sources.students&&!!(sources.mcq||sources.cq);
 async function onFile(file,type){try{setBusy(type);setError('');const src=await readFile(file,type);setSources(s=>({...s,[type]:src}));}catch(e){setError(e.message)}finally{setBusy('')}}
 const [storageStatus,setStorageStatus]=useState('Connecting permanent storage…');
 function cacheLibrary(list){setSavedSheets(list);try{localStorage.setItem('resultflow.savedSheets',JSON.stringify(list))}catch{}}
 async function storageRequest(method='GET',item){const res=await fetch(`/api/sheets${method==='DELETE'?`?id=${encodeURIComponent(item.id)}`:''}`,{method,headers:method==='POST'?{'Content-Type':'application/json'}:{},body:method==='POST'?JSON.stringify(item):undefined});let data;try{data=await res.json()}catch{throw new Error('Permanent storage is unavailable on this server.')}if(!res.ok)throw new Error(data.error||'Permanent save failed');setStorageStatus('✓ Saved in permanent shared storage');return data.sheets}
 async function persistLibrary(list){const changed=list.filter(item=>JSON.stringify(item)!==JSON.stringify(savedSheets.find(x=>x.id===item.id)));const removed=savedSheets.filter(item=>!list.some(x=>x.id===item.id));let latest=list;for(const item of changed)latest=await storageRequest('POST',item);for(const item of removed)latest=await storageRequest('DELETE',item);cacheLibrary(latest)}
 function activateSheet(name,matrices=linkedMatrices,url=sources.web?.link||link,title=sources.web?.workbookTitle||'Google Sheet'){const matrix=matrices[name];if(!matrix)return;setSelectedSheet(name);setSources(s=>({...s,web:{...parseRows(matrix,'web',`${title} · ${name}`),linked:true,link:url,sheetName:name,workbookTitle:title}}))}
async function loadGoogleSheet(url,{save=false,preferredTab='',knownTitle=''}={}){try{setBusy('web');setError('');googleWorkbookUrl(url);const res=await fetch(googleWorkbookUrl(url),{cache:'no-store'});if(!res.ok)throw new Error('Could not read this sheet. Allow link access, then try again.');const book=XLSX.read(await res.arrayBuffer(),{type:'array',raw:false});const matrices=Object.fromEntries(book.SheetNames.map(name=>[name,XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false})]));const title=knownTitle||workbookTitle(res,book,url);const target=(preferredTab&&matrices[preferredTab]?preferredTab:defaultWebTab(book,matrices));setLinkedMatrices(matrices);setSheetNames(book.SheetNames);activateSheet(target,matrices,url,title);if(save){const id=googleSheetId(url);const next=[...savedSheets.filter(x=>x.id!==id),{id,url,title,webTab:target}];await persistLibrary(next);setActiveSavedId(id);setLink('')}}catch(e){setError(e.message)}finally{setBusy('')}}
 function saveLink(){if(link)loadGoogleSheet(link,{save:true})}
 function selectSaved(id){setActiveSavedId(id);const item=savedSheets.find(x=>x.id===id);if(item)loadGoogleSheet(item.url,{preferredTab:item.webTab,knownTitle:item.title})}
 async function forgetLink(){try{const next=savedSheets.filter(x=>x.id!==activeSavedId);await persistLibrary(next);setActiveSavedId(next[0]?.id||'');setSheetNames([]);setSelectedSheet('');setLinkedMatrices({});if(sources.web?.linked)setSources(s=>{const {web,...rest}=s;return rest});if(next[0])selectSaved(next[0].id)}catch(e){setError(e.message)}}
 async function chooseTab(name){activateSheet(name);if(activeSavedId){try{const next=savedSheets.map(x=>x.id===activeSavedId?{...x,webTab:name}:x);await persistLibrary(next)}catch(e){setError(e.message)}}}
 function mapping(type,field,value){setSources(s=>({...s,[type]:{...s[type],mapping:{...s[type].mapping,[field]:value}}}))}
 function updateManualRow(index,field,value){setManualRows(rows=>rows.map((row,i)=>i===index?{...row,[field]:value,added:false}:row))}
 function applyManualRolls(){const mcqMap=makeMap(sources.mcq),cqMap=makeMap(sources.cq);const resolved=manualRows.map(row=>{if(!row.roll.trim())return {...row,added:false};const n=normalizeRoll(row.roll);if(!n.valid)return {...row,added:false};const mr=mcqMap.map.get(n.normalized),cr=cqMap.map.get(n.normalized);const mv=sourceValue(mr,sources.mcq,'mark'),cv=sourceValue(cr,sources.cq,'mark');const hasM=mv!==''&&Number.isFinite(Number(mv)),hasC=cv!==''&&Number.isFinite(Number(cv));const found=hasM&&hasC?Number(mv)+Number(cv):hasM?Number(mv):hasC?Number(cv):null;return {...row,mark:found!==null?String(found):row.mark,added:true}});const rows=resolved.filter(row=>row.roll.trim()).map(row=>[row.roll,row.name,row.college,row.mark]);if(!rows.length){setError('Enter at least one roll number.');return}const src=parseRows([['Roll','Name','College','Marks'],...rows],'manual','Manual entries');setManualRows(resolved);setSources(s=>({...s,manual:src}));setError('');setTab('results')}
 function clearManualRolls(){setManualRows([{roll:'',name:'',college:'',mark:'',added:false}]);setSources(s=>{const {manual,...rest}=s;return rest})}
 function toggleOutput(id){setOutputFields(fields=>fields.includes(id)?(fields.length>1?fields.filter(x=>x!==id):fields):[...fields,id])}
 function dataset(){return processed.results.map(r=>Object.fromEntries(OUTPUT_FIELDS.filter(([id])=>outputFields.includes(id)).map(([id,label])=>[label,r[id]??''])))}
 const imageSource=useMemo(()=>{const data=dataset();return {headers:Object.keys(data[0]||{}),rows:data.map(row=>Object.values(row).map(value=>String(value??''))) }},[processed.results,outputFields]);
 function exportXlsx(){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(dataset()),'Final Result');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(processed.issues),'Validation Issues');XLSX.writeFile(wb,'processed-result.xlsx')}
 function exportCsv(){const csv=XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(dataset()));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='processed-result.csv';a.click();URL.revokeObjectURL(a.href)}
 function exportPdf(){const doc=new jsPDF({orientation:'landscape'});doc.setFontSize(18);doc.text('Final Examination Result',14,16);doc.setFontSize(9);doc.text(`Generated ${new Date().toLocaleString()}`,14,22);autoTable(doc,{startY:27,head:[Object.keys(dataset()[0]||{})],body:dataset().map(Object.values),styles:{fontSize:8},headStyles:{fillColor:[41,38,74]}});doc.save('processed-result.pdf')}
 useEffect(()=>{let cancelled=false;(async()=>{try{let list=await storageRequest();let migrated=false;try{migrated=localStorage.getItem('resultflow.cloudMigrated')==='yes'}catch{}if(!migrated){for(const item of initialLibrary.filter(x=>!list.some(y=>y.id===x.id)))list=await storageRequest('POST',item);try{localStorage.setItem('resultflow.cloudMigrated','yes')}catch{}}if(cancelled)return;cacheLibrary(list);setActiveSavedId(list[0]?.id||'');const first=list[0];if(first)loadGoogleSheet(first.url,{preferredTab:first.webTab,knownTitle:first.title})}catch(e){if(!cancelled){setStorageStatus('Permanent storage unavailable · browser cache only');setError(e.message);const first=initialLibrary[0];if(first)loadGoogleSheet(first.url,{preferredTab:first.webTab,knownTitle:first.title})}}})();return()=>{cancelled=true}},[]);
 const issueCounts=processed.issues.reduce((a,x)=>(a[x.type]=(a[x.type]||0)+1,a),{});
 const filteredIssues=processed.issues.filter(issue=>(!issueFilter||issue.type===issueFilter)&&(!issueSearch||Object.values(issue).some(value=>String(value??'').toLowerCase().includes(issueSearch.toLowerCase()))));
 return <><header><div className="brand"><span>RF</span><div><b>ResultFlow</b><small>Exam processing workspace</small></div></div><nav className="workspace-tabs" aria-label="Workspace"><button className={workspaceTab==='processor'?'active':''} onClick={()=>setWorkspaceTab('processor')}>Result Processor</button><button className={workspaceTab==='image'?'active':''} onClick={()=>setWorkspaceTab('image')}>Image Maker{processed.results.length>0&&<em>{processed.results.length}</em>}</button></nav><div className="security"><ShieldCheck size={17}/> Original files are never edited</div></header>
 <main className={workspaceTab==='image'?'image-workspace-active':''}><div className={workspaceTab==='processor'?'processor-workspace':'workspace-hidden'}><section className="hero"><div><span className="eyebrow">NEW PROCESSING SESSION</span><h1>Turn raw exam sheets into a<br/><i>clean, ranked result.</i></h1><p>Upload each source, verify the detected columns, inspect mismatches, then export. Rolls are normalized automatically whenever matching needs it.</p></div><div className="pipeline"><b>Processing pipeline</b>{['Normalize rolls','Exact-match web data','Merge MCQ + CQ','Dense rank'].map((x,i)=><span key={x}><em>{i+1}</em>{x}{i<3&&<ArrowRight size={14}/>}</span>)}</div></section>
 {error&&<div className="error"><XCircle size={18}/>{error}</div>}
 <section className="panel sources"><div className="section-title"><div><span>01</span><h2>Connect your sources</h2></div><p>Each file is read in the background and kept unchanged.</p></div>
 <div className="source-grid"><SourceCard type="students" source={sources.students} onFile={onFile}/><SourceCard type="mcq" source={sources.mcq} onFile={onFile}/><SourceCard type="cq" source={sources.cq} onFile={onFile}/><SourceCard type="web" source={sources.web&&!sources.web.linked?sources.web:null} onFile={onFile}/></div>
 <div className="manual-form"><div className="manual-head"><div><b>Manual entries {sources.manual&&<em>Active</em>}</b><small>Marks are read from MCQ/CQ first. Manual Marks is used only when no sheet mark is found.</small></div><button onClick={()=>setManualRows(rows=>[...rows,{roll:'',name:'',college:'',mark:'',added:false}])}>+ Add row</button></div><div className="manual-table"><div className="manual-labels"><span>Roll *</span><span>Name</span><span>College / School</span><span>Marks (optional)</span><span>Status</span></div>{manualRows.map((row,i)=><div className="manual-row" key={i}><input value={row.roll} onChange={e=>updateManualRow(i,'roll',e.target.value)} placeholder="28280011"/><input value={row.name} onChange={e=>updateManualRow(i,'name',e.target.value)} placeholder="Student name"/><input value={row.college} onChange={e=>updateManualRow(i,'college',e.target.value)} placeholder="Institution"/><input value={row.mark} onChange={e=>updateManualRow(i,'mark',e.target.value)} placeholder="Auto"/><span className="manual-status">{row.added&&<CheckCircle2 size={20}/>}<button disabled={manualRows.length===1} onClick={()=>setManualRows(rows=>rows.filter((_,x)=>x!==i))}>×</button></span></div>)}</div><div className="manual-actions"><button onClick={applyManualRolls}>Find marks & auto-rank</button><button className="clear-manual" onClick={clearManualRolls}>Clear</button></div></div>
 <div className="or"><span>SAVED GOOGLE SHEET DATABASES</span></div><p role="status">{storageStatus}</p>
 {savedSheets.length>0&&<div className="database-picker"><label><span>Choose database</span><select value={activeSavedId} onChange={e=>selectSaved(e.target.value)}><option value="" disabled>Select a saved Google Sheet</option>{savedSheets.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button onClick={()=>{const item=savedSheets.find(x=>x.id===activeSavedId);if(item)loadGoogleSheet(item.url,{preferredTab:item.webTab,knownTitle:item.title})}} disabled={!activeSavedId||busy==='web'}><RefreshCw className={busy==='web'?'spin':''} size={16}/> Refresh latest data</button><button className="forget" onClick={forgetLink} disabled={!activeSavedId}>Remove</button></div>}
 <div className="link-row"><Link2 size={20}/><input value={link} onChange={e=>setLink(e.target.value)} placeholder="Paste a new Google Sheets link once…"/><button onClick={saveLink} disabled={!link||busy==='web'}><Cloud size={17}/> Save to database list</button></div>
 {sheetNames.length>0&&<label className="sheet-picker secondary"><span>Detected Web Roll tab</span><select value={selectedSheet} onChange={e=>chooseTab(e.target.value)}>{sheetNames.map(name=><option key={name} value={name}>{name}</option>)}</select><small>Automatically selected from the tab containing the WEB Roll header. Change only if needed.</small></label>}
 {sources.web?.linked&&<div className="active"><CheckCircle2 size={16}/> Active database: <b>{sources.web.workbookTitle}</b> · {sources.web.sheetName}<a href={sources.web.link} target="_blank">Open source</a></div>}
 </section>
 <section className="panel"><div className="section-title"><div><span>02</span><h2>Verify detected columns</h2></div><p>Headers are auto-detected even when they are not on row 1.</p></div>{Object.values(sources).length?<div className="mapping-grid">{Object.values(sources).map(s=><Mapping key={s.type} source={s} onChange={mapping}/>)}</div>:<div className="empty">Upload a source to see its detected headers.</div>}</section>
 <section className="panel"><div className="section-title"><div><span>03</span><h2>Validation & result preview</h2></div><p>{complete?'Processing is ready. Review every warning before export.':'Students and at least one marks file are required. Web Roll is optional enrichment.'}</p></div>
 {complete&&<div className="processing-banner"><CheckCircle2 size={22}/><div><b>Result preview is ready</b><small>{processed.results.length} exam rolls processed · {processed.results.filter(r=>r.rank!==null).length} ranked · {processed.issues.length} issues</small></div><button onClick={()=>setTab('results')}>View final result</button></div>}
 <div className="metrics"><div><b>{processed.results.length}</b><span>Exam rolls processed</span></div><div><b>{processed.issues.length}</b><span>Issues to review</span></div><div><b>{processed.results.filter(r=>r.total!==null).length}</b><span>Scores available</span></div><div><b>{processed.results.filter(r=>r.rank!==null).length}</b><span>Ranked rows</span></div></div>
 <div className="tabs"><button className={tab==='results'?'on':''} onClick={()=>setTab('results')}>Final result</button><button className={tab==='issues'?'on':''} onClick={()=>setTab('issues')}>Issues <em>{processed.issues.length}</em></button><button className={tab==='audit'?'on':''} onClick={()=>setTab('audit')}>Audit log</button></div>
 {tab==='issues'&&Object.keys(issueCounts).length>0&&<><div className="chips concise"><button className={!issueFilter?'selected':''} onClick={()=>{setIssueFilter('');setShowIssueDetails(true)}}><b>{processed.issues.length}</b>All issues</button>{Object.entries(issueCounts).map(([k,v])=><button className={`${issueFilter===k?'selected ':''}${k==='Manual edited'?'manual-chip':''}`} key={k} onClick={()=>{setIssueFilter(k);setShowIssueDetails(true)}}>{k==='Manual edited'?<CheckCircle2 size={13}/>:<AlertTriangle size={13}/>}<b>{v}</b>{k}</button>)}</div><div className="issue-tools"><input value={issueSearch} onChange={e=>{setIssueSearch(e.target.value);setShowIssueDetails(true)}} placeholder="Search roll or issue description…"/><span>{filteredIssues.length} of {processed.issues.length}</span>{(issueFilter||issueSearch)&&<button onClick={()=>{setIssueFilter('');setIssueSearch('')}}>Clear filters</button>}<button className="details-toggle" onClick={()=>setShowIssueDetails(v=>!v)}>{showIssueDetails?'Hide rows':'Show rows'}</button></div></>}
 {(tab!=='issues'||showIssueDetails||processed.issues.length===0)&&<Table tab={tab} data={tab==='results'?dataset():tab==='issues'?filteredIssues:processed.audit}/>} 
 <div className="field-options"><div><b>Final output fields</b><small>Choose what appears in preview and every export.</small></div>{OUTPUT_FIELDS.map(([id,label])=><label key={id}><input type="checkbox" checked={outputFields.includes(id)} onChange={()=>toggleOutput(id)}/><span>{label}</span></label>)}</div>
 <div className="export"><div><b>Ready when you are</b><small>Exports contain clean result fields only. Paid Amount and helpers are excluded.</small></div><button onClick={exportCsv} disabled={!processed.results.length}><Download size={16}/> CSV</button><button onClick={exportPdf} disabled={!processed.results.length}><Download size={16}/> PDF</button><button className="primary" onClick={exportXlsx} disabled={!processed.results.length}><Download size={16}/> Excel</button></div>
 </section></div>
 <div className={workspaceTab==='image'?'image-workspace':'workspace-hidden'}><ImageMaker sourceData={imageSource}/></div>
 </main><footer>ResultFlow · process, edit, design, and export in one workspace</footer></>
}
function Table({data}){const rows=data.slice(0,100), headers=Object.keys(rows[0]||{});if(!rows.length)return <div className="empty"><FileSpreadsheet size={27}/> No rows to preview yet.</div>;return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{headers.map(h=>{const value=String(r[h]??'');return <td className={value.startsWith('✓')?'edited-cell':''} key={h}>{value}</td>})}</tr>)}</tbody></table>{data.length>100&&<p className="more">Showing 100 of {data.length} rows</p>}</div>}
if(typeof document!=='undefined') createRoot(document.getElementById('root')).render(<App/>);
