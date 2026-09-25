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
import {automaticExportName,safeExportName} from './exportName.js';

const TYPES = {
  students:{label:'Students sheet', hint:'Roster / registration export', color:'violet'},
  web:{label:'Web roll sheet', hint:'Authoritative name & institution', color:'blue'},
  mcq:{label:'MCQ result', hint:'Objective marks', color:'amber'},
  cq:{label:'CQ result', hint:'Creative marks', color:'green'},
};
const SYN = {
  roll:['roll','roll number','roll no','roll no.','web roll','web roll*','web roll number','roll/phone','student roll','candidate roll','exam roll','board roll','class roll','student id','candidate id','id','reg','registration','reg no','reg number'],
  name:['student name','name','full name','candidate name','examinee name','student','name of student','name of candidate'],
  college:['college','institution','school','college / institution name','college name','school name','institute','institution name','institution/school','college/school'],
  mark:['marks','mark','score','mcq','cq','total score','cq mark','cq marks','written','written mark','written marks','obtained mark','obtained marks','total marks'],
};
const OUTPUT_FIELDS=[
  ['rank','Rank'],['roll','Roll'],['name','Student Name'],['college','Institution'],['mcq','MCQ'],['cq','CQ'],['total','Total']
];
const key = v => String(v ?? '').trim().toLowerCase().replace(/[\n_*]+/g,' ').replace(/\s+/g,' ');
export function normalizeRoll(value){
  const original=String(value ?? '').trim();
  if(!original)return {original,normalized:'',valid:false,reason:'Roll missing'};
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
  const partial=normalized.findIndex(h=>SYN[field].some(s=>h===s||h.includes(s)));
  if(partial>=0) return partial;
  return -1;
}
export function parseRows(matrix, type, fileName){
  const headerIndex=detectHeader(matrix); const headers=(matrix[headerIndex]||[]).map(v=>String(v??'').trim());
  const entries=matrix.slice(headerIndex+1).map((row,i)=>({row,rowNumber:headerIndex+i+2})).filter(({row})=>row.some(v=>String(v??'').trim()!==''));
  const rows=entries.map(x=>x.row),rowNumbers=entries.map(x=>x.rowNumber);
  const mapping={roll:detectColumn(headers,'roll',type),name:detectColumn(headers,'name',type),college:detectColumn(headers,'college',type),mark:detectColumn(headers,'mark',type)};
  if(rows.length>0){
    const sample=rows.slice(0,10);
    const colCount=Math.max(...sample.map(r=>r.length),0);
    for(let col=0;col<colCount;col++){
      const vals=sample.map(r=>String(r[col]??'').trim()).filter(Boolean);
      if(!vals.length)continue;
      if(mapping.roll<0&&vals.every(v=>/^\d{6,8}$/.test(v.replace(/-/g,'')))) mapping.roll=col;
      else if(mapping.mark<0&&vals.every(v=>/^\d+(\.\d+)?$/.test(v)&&Number(v)<=100)) mapping.mark=col;
      else if(mapping.college<0&&vals.some(v=>/college|school|institution|madrasha|university/i.test(v))) mapping.college=col;
      else if(mapping.name<0&&vals.some(v=>/^[a-zA-Z\s.]+$/.test(v)&&v.split(/\s+/).length>=2&&!/college|school|institution/i.test(v))) mapping.name=col;
    }
  }
  return {type,fileName,headerIndex,headers,rows,rowNumbers,mapping};
}
export function combineCqSources(files=[]){
  const headers=['Roll','Student Name','College','Marks'];
  const rows=[],rowNumbers=[],rowFiles=[];
  files.forEach(source=>source.rows.forEach((row,index)=>{
    rows.push(['roll','name','college','mark'].map(field=>source.mapping[field]>=0?row[source.mapping[field]]:''));
    rowNumbers.push(source.rowNumbers?.[index]??source.headerIndex+index+2);
    rowFiles.push(source.fileName);
  }));
  return {type:'cq',fileName:files.length===1?files[0].fileName:`${files.length} CQ files`,headers,rows,rowNumbers,rowFiles,mapping:{roll:0,name:1,college:2,mark:3}};
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
  const records=src.rows.map((row,i)=>{const n=normalizeRoll(row[src.mapping.roll]); return {row,rowNumber:src.rowNumbers?.[i]??i+src.headerIndex+2,sourceFile:src.rowFiles?.[i]||src.fileName,...n}})
    .filter(r=>!(src.type==='web'&&r.original===''));
  records.forEach(r=>{if(!r.valid){invalid.push(r);return} if(map.has(r.normalized)) duplicates.add(r.normalized); else map.set(r.normalized,r)});
  return {map,duplicates,invalid,records};
}
function sourceValue(record, source, field){const i=source?.mapping[field]; return i>=0 ? String(record?.row?.[i]??'').trim():''}
function normalizeText(value){return String(value??'').toLowerCase().replace(/\b(md|mohammad|muhammad|mohammed)\b/g,'mohammad').replace(/\b(clg|coll)\b/g,'college').replace(/&/g,' and ').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function levenshtein(a,b){const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const hold=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=hold}}return row[b.length]}
function acronym(value){return normalizeText(value).split(' ').filter(x=>x&&!['and','of','the'].includes(x)).map(x=>x[0]).join('')}
export function textSimilarity(left,right){const a=normalizeText(left),b=normalizeText(right);if(!a||!b)return 0;if(a===b)return 1;const at=new Set(a.split(' ')),bt=new Set(b.split(' '));const intersection=[...at].filter(x=>bt.has(x)).length;const tokenScore=(2*intersection)/(at.size+bt.size);const charScore=1-levenshtein(a,b)/Math.max(a.length,b.length);const containment=(a.includes(b)||b.includes(a))?0.88:0;return Math.max(tokenScore,charScore,containment)}
function collegeSimilarity(left,right){const score=textSimilarity(left,right),a=normalizeText(left),b=normalizeText(right),aa=acronym(a),bb=acronym(b);return Math.max(score,(aa.length>1&&(aa===b||bb===a||aa===bb))?0.96:0)}
function rollDistance(a,b){if(!a||!b)return 99;return levenshtein(a,b)}
export function resolveCqRows(sources,indexes={}){
  const s=indexes.students||makeMap(sources.students),w=indexes.web||makeMap(sources.web),m=indexes.mcq||makeMap(sources.mcq),c=indexes.cq||makeMap(sources.cq);
  const resolved=new Map(),report=[],used=new Set();
  if(!sources.cq)return {map:resolved,report};
  const rollCounts=new Map();c.records.forEach(r=>{if(r.valid)rollCounts.set(r.normalized,(rollCounts.get(r.normalized)||0)+1)});

  const getCandidate=(roll)=>{
    const web=w.map.get(roll),student=s.map.get(roll),mcq=m.map.get(roll);
    return {
      roll,
      mcq,
      name:sourceValue(web,sources.web,'name')||sourceValue(student,sources.students,'name')||sourceValue(mcq,sources.mcq,'name'),
      college:sourceValue(web,sources.web,'college')||sourceValue(student,sources.students,'college')||sourceValue(mcq,sources.mcq,'college')
    };
  };

  const candidateRolls=[...m.map.keys()].filter(roll=>!m.duplicates.has(roll)&&(s.map.has(roll)||w.map.has(roll)||!sources.students));
  const unmatchedCq=[];

  // Pass 1: Exact roll matches
  c.records.forEach(record=>{
    const originalRoll=record.original;const cqName=sourceValue(record,sources.cq,'name');const cqCollege=sourceValue(record,sources.cq,'college');const markRaw=sourceValue(record,sources.cq,'mark');const mark=Number(markRaw);
    const base={Source:record.sourceFile||sources.cq.fileName,row:record.rowNumber,'Original CQ Roll':originalRoll,'CQ Name':cqName,'CQ College':cqCollege,'CQ Mark':markRaw};
    if(markRaw===''||!Number.isFinite(mark)){report.push({...base,Status:'Skipped','Resolved Roll':'',Confidence:'','Reason':'CQ mark is blank or invalid'});return}
    if(!sources.mcq){report.push({...base,Status:'Skipped','Resolved Roll':'',Confidence:'','Reason':'MCQ sheet is required before CQ can be applied'});return}
    if(record.valid&&m.duplicates.has(record.normalized)){report.push({...base,Status:'Duplicate','Resolved Roll':'',Confidence:'','Reason':'Matching MCQ roll is duplicated'});return}
    if(record.valid&&(rollCounts.get(record.normalized)||0)>1){report.push({...base,Status:'Duplicate','Resolved Roll':'',Confidence:'','Reason':'Duplicate roll in CQ sheet'});return}
    if(record.valid&&m.map.has(record.normalized)&&!used.has(record.normalized)){
      resolved.set(record.normalized,record);
      used.add(record.normalized);
      // Clean audit: exact clean matches are merged directly and not cluttered in issues
      return;
    }
    unmatchedCq.push({record,base,cqName,cqCollege,markRaw,mark});
  });

  // Pass 2: Name-based recovery for students who took MCQ but are missing CQ marks
  const missingCandidates=candidateRolls.filter(roll=>!used.has(roll)).map(getCandidate).filter(cand=>cand.name);

  unmatchedCq.forEach(({record,base,cqName,cqCollege})=>{
    if(!cqName){
      report.push({...base,Status:'Needs review','Resolved Roll':'',Confidence:'',Reason:record.original?`CQ roll ${record.original} not found in MCQ and name is blank`:'Both CQ roll and name are missing'});
      return;
    }
    const normCqName=normalizeText(cqName);
    if(!normCqName){
      report.push({...base,Status:'Needs review','Resolved Roll':'',Confidence:'',Reason:'CQ name contains no valid text'});
      return;
    }
    const available=missingCandidates.filter(cand=>!used.has(cand.roll));
    if(!available.length){
      report.push({...base,Status:'Needs review','Resolved Roll':'',Confidence:'',Reason:record.original?`Roll ${record.original} not in MCQ; no candidate missing CQ`:'No candidate student missing CQ marks'});
      return;
    }

    // 1. Exact normalized name match
    const exactNameMatches=available.filter(cand=>normalizeText(cand.name)===normCqName);
    if(exactNameMatches.length===1){
      const best=exactNameMatches[0];
      resolved.set(best.roll,record);
      used.add(best.roll);
      report.push({...base,Status:'Auto-recovered','Resolved Roll':best.roll,Confidence:'100%',Reason:`Exact name match with ${best.name}${best.college?` (${best.college})`:''}`});
      return;
    } else if(exactNameMatches.length>1){
      const withCollege=cqCollege?exactNameMatches.filter(cand=>cand.college&&collegeSimilarity(cqCollege,cand.college)>=.7):[];
      if(withCollege.length===1){
        const best=withCollege[0];
        resolved.set(best.roll,record);
        used.add(best.roll);
        report.push({...base,Status:'Auto-recovered','Resolved Roll':best.roll,Confidence:'98%',Reason:`Name exact match & college confirmed (${best.college})`});
        return;
      }
      report.push({...base,Status:'Needs review','Resolved Roll':'',Confidence:'',Reason:`Multiple students with identical name "${cqName}" missing CQ`});
      return;
    }

    // 2. Fuzzy name matching
    const scored=available.map(cand=>{
      const nameScore=textSimilarity(cqName,cand.name);
      const colScore=(cqCollege&&cand.college)?collegeSimilarity(cqCollege,cand.college):null;
      const distance=record.valid?rollDistance(record.normalized,cand.roll):99;
      const rollScore=distance===1?12:distance===2?6:0;
      const totalScore=colScore!==null?(nameScore*65+colScore*25+rollScore):(nameScore*90+rollScore);
      return {cand,nameScore,colScore,distance,totalScore};
    }).sort((a,b)=>b.totalScore-a.totalScore);

    const best=scored[0],second=scored[1];
    const gap=best?best.totalScore-(second?.totalScore||0):0;
    const safe=best&&best.nameScore>=.88&&best.totalScore>=78&&(gap>=12||available.length===1);

    if(safe){
      resolved.set(best.cand.roll,record);
      used.add(best.cand.roll);
      const reasons=[`Name: ${Math.round(best.nameScore*100)}% ("${best.cand.name}")`];
      if(best.colScore!==null)reasons.push(`College: ${Math.round(best.colScore*100)}%`);
      if(record.valid&&best.distance<=2)reasons.push(`Roll distance: ${best.distance}`);
      report.push({...base,Status:'Auto-recovered','Resolved Roll':best.cand.roll,Confidence:`${Math.round(best.totalScore)}%`,Reason:reasons.join(' · ')});
    }else{
      report.push({...base,Status:'Needs review','Resolved Roll':best?.cand.roll||'',Confidence:best?`${Math.round(best.totalScore)}%`:'',Reason:best?`Ambiguous candidate ${best.cand.name} (confidence ${Math.round(best.totalScore)}%, gap ${Math.round(gap)})`:'No matching MCQ student found for this name'});
    }
  });

  return {map:resolved,report};
}
export function processSources(sources){
  const s=makeMap(sources.students), w=makeMap(sources.web), m=makeMap(sources.mcq), c=makeMap(sources.cq), manual=makeMap(sources.manual);
  const cqResolution=resolveCqRows(sources,{students:s,web:w,mcq:m,cq:c});
  const label=(src,fallback)=>src?.fileName||fallback;
  const examRolls=new Set([...m.map.keys(),...manual.map.keys()]);
  const results=[], audit=[];
  [...examRolls].forEach((roll,index)=>{
    const student=s.map.get(roll), web=w.map.get(roll), mcq=m.map.get(roll), cq=cqResolution.map.get(roll), manualRow=manual.map.get(roll);
    audit.push({roll,students:student?'Matched':'NOT FOUND',web:web?'Matched':'Not used',mcq:sources.mcq?(mcq?'Matched':'Missing'):'Not supplied',cq:sources.cq?(cq?'Matched':'Missing'):'Not supplied'});
    if(!student&&!web&&!manualRow)return;
    const mcqRaw=sourceValue(mcq,sources.mcq,'mark'), cqRaw=sourceValue(cq,sources.cq,'mark');
    const mv=Number(mcqRaw), cv=Number(cqRaw);
    const mcqOk=!!mcq && mcqRaw!=='' && Number.isFinite(mv), cqOk=!!cq && cqRaw!=='' && Number.isFinite(cv);
    const manualRaw=sourceValue(manualRow,sources.manual,'mark'), manualValue=Number(manualRaw), manualOk=manualRaw!==''&&Number.isFinite(manualValue);
    const name=sourceValue(web,sources.web,'name')||sourceValue(student,sources.students,'name')||(cq?sourceValue(cq,sources.cq,'name'):'')||sourceValue(manualRow,sources.manual,'name');
    const college=sourceValue(web,sources.web,'college')||sourceValue(student,sources.students,'college')||(cq?sourceValue(cq,sources.cq,'college'):'')||sourceValue(manualRow,sources.manual,'college');
    const total=mcqOk&&cqOk?mv+cv:mcqOk?mv:cqOk?cv:manualOk?manualValue:null;
    results.push({_id:index,roll,name,college,mcq:mcqOk?mv:null,cq:cqOk?cv:null,total,rank:null});
  });
  const sorted=[...results].sort((a,b)=>(b.total??-Infinity)-(a.total??-Infinity)||a.roll.localeCompare(b.roll));
  let rank=0,last=null; sorted.forEach(r=>{if(r.total===null)return; if(r.total!==last){rank++;last=r.total}r.rank=rank});
  const issueRows=[
    ...m.invalid.map(r=>({type:r.original?'Invalid MCQ roll':'MCQ roll missing',roll:r.original,detail:`MCQ · ${sources.mcq.fileName} · Row ${r.rowNumber}${sourceValue(r,sources.mcq,'name')?` · ${sourceValue(r,sources.mcq,'name')}`:''}: ${sources.mcq.mapping.roll<0?'Roll column not selected':r.reason}`})),
    ...manual.invalid.map(r=>({type:'Invalid manual roll',roll:r.original,detail:`Manual row ${r.rowNumber}: ${r.reason.replace('Expected ','').replace('; found ','; got ')}`})),
    ...[...s.duplicates].filter(roll=>examRolls.has(roll)).map(roll=>({type:'Duplicate roll',roll,detail:'Repeated exam roll in Students',source:label(sources.students,'Students')})),
    ...[...w.duplicates].filter(roll=>examRolls.has(roll)).map(roll=>({type:'Duplicate roll',roll,detail:'Repeated exam roll in Web Roll',source:label(sources.web,'Web Roll')})),
    ...[...m.duplicates].map(roll=>({type:'Duplicate roll',roll,detail:'Repeated in MCQ',source:label(sources.mcq,'MCQ')})),
    ...[...manual.duplicates].map(roll=>({type:'Duplicate manual roll',roll,detail:'Repeated in manual roll list'})),
    ...[...examRolls].filter(roll=>!s.map.has(roll)&&!w.map.has(roll)).map(roll=>({type:'Not in Students',roll,detail:`${[['MCQ',m,sources.mcq],['CQ',c,sources.cq]].flatMap(([kind,indexed,src])=>indexed.records.filter(r=>r.valid&&r.normalized===roll).map(r=>`${kind} · ${src.fileName} · Row ${r.rowNumber} · original ${r.original}`)).join('; ')||'Manual entry'}: No match in Students${sources.web?' or valid Web Roll':' (Web sheet not loaded)'}`})),
    ...(sources.mcq&&(sources.manual||sources.cq)?results.filter(r=>r.mcq===null&&sourceValue(manual.map.get(r.roll),sources.manual,'mark')==='').map(r=>({type:'MCQ missing',roll:r.roll,detail:sources.manual?'Manual roll not found in MCQ':'Present in CQ only'})):[]),
    ...results.filter(r=>!r.name).map(r=>({type:'Name missing',roll:r.roll,detail:'Name blank in Students and Web'})),
  ];
  return {results:sorted,audit,cqRecovery:cqResolution.report,issues:issueRows.map(({type,roll,detail})=>({type,roll,'Marks source':type.includes('MCQ')?'MCQ':m.map.has(roll)?'MCQ':manual.map.has(roll)?'Manual':'—','Manual Mark':sourceValue(manual.map.get(roll),sources.manual,'mark'),'Manual Status':manual.map.has(roll)?'✓ Edited':'',description:detail}))};
}
function SourceCard({type,source,onFile,count=0}){const t=TYPES[type],multiple=type==='cq';return <label className={`source-card ${source?'ready':''}`}>
  <input type="file" accept=".xlsx,.xls,.csv" multiple={multiple} onChange={e=>{const files=[...e.target.files];if(files.length)onFile(multiple?files:files[0],type);e.target.value=''}}/>
  <span className={`source-icon ${t.color}`}><FileSpreadsheet size={21}/></span><span className="grow"><b>{t.label}</b><small>{multiple&&count?`${count} file${count===1?'':'s'} loaded · add more`:source?source.fileName:t.hint}</small></span>
  {source?<CheckCircle2 className="ok" size={20}/>:<Upload size={18}/>}<em>{['mcq','cq'].includes(type)?'Optional · Read-only':'Read-only'}</em>
 </label>}
function Mapping({source,onChange,onRemove,index}){if(!source)return null;return <div className="mapping"><div className="mapping-head"><b>Detected columns · {source.fileName}</b>{onRemove&&<button type="button" onClick={()=>onRemove(index)}>Remove</button>}</div><div>{['roll','name','college','mark'].filter(f=>f==='roll'||(source.type==='web'&&['name','college'].includes(f))||(source.type==='mcq'&&f==='mark')||(source.type==='cq'&&['name','college','mark'].includes(f))||(source.type==='students'&&['name','college'].includes(f))).map(f=><label key={f}><span>{f}</span><select value={source.mapping[f]} onChange={e=>onChange(source.type,f,+e.target.value,index)}><option value={-1}>Not found</option>{source.headers.map((h,i)=><option key={i} value={i}>{h||`Column ${i+1}`}</option>)}</select></label>)}</div></div>}
function App(){
 const [customExportName,setCustomExportName]=useState('');
 const initialLibrary=useMemo(()=>{try{const list=JSON.parse(localStorage.getItem('resultflow.savedSheets')||'[]');if(list.length)return list;const old=JSON.parse(localStorage.getItem('resultflow.webRollConfig')||'null');return old?.url?[{id:googleSheetId(old.url),url:old.url,title:'Saved Google Sheet',webTab:old.sheetName||''}]:[]}catch{return []}},[]);
 const [savedSheets,setSavedSheets]=useState(initialLibrary); const [activeSavedId,setActiveSavedId]=useState(initialLibrary[0]?.id||'');
 const [savedSessions,setSavedSessions]=useState([]);const [activeSessionId,setActiveSessionId]=useState('');const [sessionStartedAt,setSessionStartedAt]=useState(()=>new Date().toISOString());const [sessionCustomName,setSessionCustomName]=useState('');const [sessionStatus,setSessionStatus]=useState('');
 const [sources,setSources]=useState({}); const [link,setLink]=useState(''); const [sheetNames,setSheetNames]=useState([]); const [selectedSheet,setSelectedSheet]=useState(''); const [linkedMatrices,setLinkedMatrices]=useState({}); const [manualRows,setManualRows]=useState([{roll:'',name:'',college:'',mark:'',added:false}]); const [outputFields,setOutputFields]=useState(()=>OUTPUT_FIELDS.map(([id])=>id)); const [busy,setBusy]=useState(''); const [tab,setTab]=useState('results'); const [workspaceTab,setWorkspaceTab]=useState('processor'); const [showIssueDetails,setShowIssueDetails]=useState(false); const [issueFilter,setIssueFilter]=useState(''); const [issueSearch,setIssueSearch]=useState(''); const [error,setError]=useState('');
 const processed=useMemo(()=>processSources(sources),[sources]); const complete=!!sources.students&&!!(sources.mcq||sources.manual);
 const autoExportName=automaticExportName(sources.mcq?.fileName||sources.cqFiles?.[0]?.fileName||sources.cq?.fileName,{mcq:!!sources.mcq,cq:!!sources.cq});
 const exportBaseName=customExportName.trim()?safeExportName(customExportName):autoExportName;
 const sessionTitle=`${sessionCustomName.trim()?`${sessionCustomName.trim()} · `:''}${autoExportName} · Started ${new Date(sessionStartedAt).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}`;
 async function onFile(input,type){try{setBusy(type);setError('');if(type==='cq'){
   const parsed=await Promise.all(input.map(file=>readFile(file,'cq')));
   setSources(current=>{const files=[...(current.cqFiles||(current.cq?[current.cq]:[])),...parsed];return {...current,cqFiles:files,cq:combineCqSources(files)}});
  }else{const src=await readFile(input,type);setSources(s=>({...s,[type]:src}))}}catch(e){setError(e.message)}finally{setBusy('')}}
 const [storageStatus,setStorageStatus]=useState('Connecting permanent storage…');
 function cacheLibrary(list){setSavedSheets(list);try{localStorage.setItem('resultflow.savedSheets',JSON.stringify(list))}catch{}}
 async function storageRequest(method='GET',item){const res=await fetch(`/api/sheets${method==='DELETE'?`?id=${encodeURIComponent(item.id)}`:''}`,{method,headers:method==='POST'?{'Content-Type':'application/json'}:{},body:method==='POST'?JSON.stringify(item):undefined});let data;try{data=await res.json()}catch{throw new Error('Permanent storage is unavailable on this server.')}if(!res.ok)throw new Error(data.error||'Permanent save failed');setStorageStatus('✓ Saved in permanent shared storage');return data.sheets}
 async function persistLibrary(list){const changed=list.filter(item=>JSON.stringify(item)!==JSON.stringify(savedSheets.find(x=>x.id===item.id)));const removed=savedSheets.filter(item=>!list.some(x=>x.id===item.id));let latest=list;for(const item of changed)latest=await storageRequest('POST',item);for(const item of removed)latest=await storageRequest('DELETE',item);cacheLibrary(latest)}
 async function sessionRequest(path='',options={}){const res=await fetch(`/api/sessions${path}`,options);let data;try{data=await res.json()}catch{throw new Error('Saved-session service is unavailable.')}if(!res.ok)throw new Error(data.error||'Session request failed');return data}
 async function refreshSessions(){try{const data=await sessionRequest();setSavedSessions(data.sessions);setSessionStatus(data.sessions.length?`${data.sessions.length} saved session${data.sessions.length===1?'':'s'} · automatic 20-day expiry`:'No saved sessions yet')}catch(e){setSessionStatus(e.message)}}
 async function saveSession(){if(!Object.keys(sources).length){setError('Upload at least one source before saving a session.');return}try{setBusy('session');const id=activeSessionId||crypto.randomUUID();const savedSources=Object.fromEntries(Object.entries(sources).filter(([type,source])=>(type!=='web'||!source.linked)&&!(type==='cq'&&sources.cqFiles?.length)));const payload={sources:savedSources,manualRows,outputFields,customExportName,sessionCustomName,activeSavedId};await sessionRequest('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,title:sessionTitle,createdAt:sessionStartedAt,payload})});setActiveSessionId(id);setSessionStatus('✓ Uploaded files and settings saved for 20 days');await refreshSessions()}catch(e){setError(e.message)}finally{setBusy('')}}
 async function loadSession(id){if(!id)return;try{setBusy('session');setError('');const {session}=await sessionRequest(`?id=${encodeURIComponent(id)}`);const payload=session.payload;const restored={...(payload.sources||{})};if(restored.cqFiles?.length)restored.cq=combineCqSources(restored.cqFiles);setSources(restored);setManualRows(payload.manualRows?.length?payload.manualRows:[{roll:'',name:'',college:'',mark:'',added:false}]);setOutputFields(payload.outputFields?.length?payload.outputFields:OUTPUT_FIELDS.map(([field])=>field));setCustomExportName(payload.customExportName||'');setSessionCustomName(payload.sessionCustomName||'');setActiveSessionId(session.id);setSessionStartedAt(session.createdAt);setTab('results');if(payload.activeSavedId){setActiveSavedId(payload.activeSavedId);const item=savedSheets.find(x=>x.id===payload.activeSavedId);if(item)await loadGoogleSheet(item.url,{preferredTab:item.webTab,knownTitle:item.title})}setSessionStatus(`✓ Loaded · expires ${new Date(session.expiresAt).toLocaleDateString('en-GB')}`)}catch(e){setError(e.message)}finally{setBusy('')}}
 function startNewSession(){setSources(s=>s.web?.linked?{web:s.web}:{});setManualRows([{roll:'',name:'',college:'',mark:'',added:false}]);setOutputFields(OUTPUT_FIELDS.map(([field])=>field));setCustomExportName('');setSessionCustomName('');setActiveSessionId('');setSessionStartedAt(new Date().toISOString());setTab('results');setError('');setSessionStatus('New unsaved session started')}
 async function deleteSession(){if(!activeSessionId)return;try{setBusy('session');await sessionRequest(`?id=${encodeURIComponent(activeSessionId)}`,{method:'DELETE'});setActiveSessionId('');setSessionStartedAt(new Date().toISOString());setSessionStatus('Session removed');await refreshSessions()}catch(e){setError(e.message)}finally{setBusy('')}}
 function activateSheet(name,matrices=linkedMatrices,url=sources.web?.link||link,title=sources.web?.workbookTitle||'Google Sheet'){const matrix=matrices[name];if(!matrix)return;setSelectedSheet(name);setSources(s=>({...s,web:{...parseRows(matrix,'web',`${title} · ${name}`),linked:true,link:url,sheetName:name,workbookTitle:title}}))}
async function loadGoogleSheet(url,{save=false,preferredTab='',knownTitle=''}={}){try{setBusy('web');setError('');googleWorkbookUrl(url);const res=await fetch(googleWorkbookUrl(url),{cache:'no-store'});if(!res.ok)throw new Error('Could not read this sheet. Allow link access, then try again.');const book=XLSX.read(await res.arrayBuffer(),{type:'array',raw:false});const matrices=Object.fromEntries(book.SheetNames.map(name=>[name,XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false})]));const title=knownTitle||workbookTitle(res,book,url);const target=(preferredTab&&matrices[preferredTab]?preferredTab:defaultWebTab(book,matrices));setLinkedMatrices(matrices);setSheetNames(book.SheetNames);activateSheet(target,matrices,url,title);if(save){const id=googleSheetId(url);const next=[...savedSheets.filter(x=>x.id!==id),{id,url,title,webTab:target}];await persistLibrary(next);setActiveSavedId(id);setLink('')}}catch(e){setError(e.message)}finally{setBusy('')}}
 function saveLink(){if(link)loadGoogleSheet(link,{save:true})}
 function selectSaved(id){setActiveSavedId(id);const item=savedSheets.find(x=>x.id===id);if(item)loadGoogleSheet(item.url,{preferredTab:item.webTab,knownTitle:item.title})}
 async function forgetLink(){try{const next=savedSheets.filter(x=>x.id!==activeSavedId);await persistLibrary(next);setActiveSavedId(next[0]?.id||'');setSheetNames([]);setSelectedSheet('');setLinkedMatrices({});if(sources.web?.linked)setSources(s=>{const {web,...rest}=s;return rest});if(next[0])selectSaved(next[0].id)}catch(e){setError(e.message)}}
 async function chooseTab(name){activateSheet(name);if(activeSavedId){try{const next=savedSheets.map(x=>x.id===activeSavedId?{...x,webTab:name}:x);await persistLibrary(next)}catch(e){setError(e.message)}}}
 function mapping(type,field,value,fileIndex){setSources(current=>{if(type==='cq'&&Number.isInteger(fileIndex)){const files=current.cqFiles.map((source,index)=>index===fileIndex?{...source,mapping:{...source.mapping,[field]:value}}:source);return {...current,cqFiles:files,cq:combineCqSources(files)}}return {...current,[type]:{...current[type],mapping:{...current[type].mapping,[field]:value}}}})}
 function removeCqFile(fileIndex){setSources(current=>{const files=(current.cqFiles||[]).filter((_,index)=>index!==fileIndex);if(!files.length){const {cq,cqFiles,...rest}=current;return rest}return {...current,cqFiles:files,cq:combineCqSources(files)}})}
 function updateManualRow(index,field,value){setManualRows(rows=>rows.map((row,i)=>i===index?{...row,[field]:value,added:false}:row))}
 function applyManualRolls(){const mcqMap=makeMap(sources.mcq),cqMap=makeMap(sources.cq);const resolved=manualRows.map(row=>{if(!row.roll.trim())return {...row,added:false};const n=normalizeRoll(row.roll);if(!n.valid)return {...row,added:false};const mr=mcqMap.map.get(n.normalized),cr=cqMap.map.get(n.normalized);const mv=sourceValue(mr,sources.mcq,'mark'),cv=sourceValue(cr,sources.cq,'mark');const hasM=mv!==''&&Number.isFinite(Number(mv)),hasC=cv!==''&&Number.isFinite(Number(cv));const found=hasM&&hasC?Number(mv)+Number(cv):hasM?Number(mv):hasC?Number(cv):null;return {...row,mark:found!==null?String(found):row.mark,added:true}});const rows=resolved.filter(row=>row.roll.trim()).map(row=>[row.roll,row.name,row.college,row.mark]);if(!rows.length){setError('Enter at least one roll number.');return}const src=parseRows([['Roll','Name','College','Marks'],...rows],'manual','Manual entries');setManualRows(resolved);setSources(s=>({...s,manual:src}));setError('');setTab('results')}
 function clearManualRolls(){setManualRows([{roll:'',name:'',college:'',mark:'',added:false}]);setSources(s=>{const {manual,...rest}=s;return rest})}
 function toggleOutput(id){setOutputFields(fields=>fields.includes(id)?(fields.length>1?fields.filter(x=>x!==id):fields):[...fields,id])}
 function dataset(){return processed.results.map(r=>Object.fromEntries(OUTPUT_FIELDS.filter(([id])=>outputFields.includes(id)).map(([id,label])=>[label,r[id]??''])))}
 const imageSource=useMemo(()=>{const data=dataset();return {headers:Object.keys(data[0]||{}),rows:data.map(row=>Object.values(row).map(value=>String(value??''))) }},[processed.results,outputFields]);
 function exportXlsx(){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(dataset()),'Final Result');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(processed.issues),'Validation Issues');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(processed.cqRecovery),'CQ Recovery');XLSX.writeFile(wb,`${exportBaseName}.xlsx`)}
 function exportCsv(){const csv=XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(dataset()));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`${exportBaseName}.csv`;a.click();URL.revokeObjectURL(a.href)}
 function exportPdf(){const doc=new jsPDF({orientation:'landscape'});doc.setFontSize(18);doc.text('Final Examination Result',14,16);doc.setFontSize(9);doc.text(`Generated ${new Date().toLocaleString()}`,14,22);autoTable(doc,{startY:27,head:[Object.keys(dataset()[0]||{})],body:dataset().map(Object.values),styles:{fontSize:8},headStyles:{fillColor:[41,38,74]}});doc.save(`${exportBaseName}.pdf`)}
 useEffect(()=>{refreshSessions()},[]);
 useEffect(()=>{let cancelled=false;(async()=>{try{let list=await storageRequest();let migrated=false;try{migrated=localStorage.getItem('resultflow.cloudMigrated')==='yes'}catch{}if(!migrated){for(const item of initialLibrary.filter(x=>!list.some(y=>y.id===x.id)))list=await storageRequest('POST',item);try{localStorage.setItem('resultflow.cloudMigrated','yes')}catch{}}if(cancelled)return;cacheLibrary(list);setActiveSavedId(list[0]?.id||'');const first=list[0];if(first)loadGoogleSheet(first.url,{preferredTab:first.webTab,knownTitle:first.title})}catch(e){if(!cancelled){setStorageStatus('Permanent storage unavailable · browser cache only');setError(e.message);const first=initialLibrary[0];if(first)loadGoogleSheet(first.url,{preferredTab:first.webTab,knownTitle:first.title})}}})();return()=>{cancelled=true}},[]);
 const issueCounts=processed.issues.reduce((a,x)=>(a[x.type]=(a[x.type]||0)+1,a),{});
 const filteredIssues=processed.issues.filter(issue=>(!issueFilter||issue.type===issueFilter)&&(!issueSearch||Object.values(issue).some(value=>String(value??'').toLowerCase().includes(issueSearch.toLowerCase()))));
 return <><header><div className="brand"><span>RF</span><div><b>ResultFlow</b><small>Exam processing workspace</small></div></div><nav className="workspace-tabs" aria-label="Workspace"><button className={workspaceTab==='processor'?'active':''} onClick={()=>setWorkspaceTab('processor')}>Result Processor</button><button className={workspaceTab==='image'?'active':''} onClick={()=>setWorkspaceTab('image')}>Image Maker{processed.results.length>0&&<em>{processed.results.length}</em>}</button></nav><div className="security"><ShieldCheck size={17}/> Original files are never edited</div></header>
 <main className={workspaceTab==='image'?'image-workspace-active':''}><div className={workspaceTab==='processor'?'processor-workspace':'workspace-hidden'}><section className="hero"><div><span className="eyebrow">NEW PROCESSING SESSION</span><h1>Turn raw exam sheets into a<br/><i>clean, ranked result.</i></h1><p>Upload each source, verify the detected columns, inspect mismatches, then export. Rolls are normalized automatically whenever matching needs it.</p></div><div className="pipeline"><b>Processing pipeline</b>{['Normalize rolls','Exact-match web data','Merge MCQ + CQ','Dense rank'].map((x,i)=><span key={x}><em>{i+1}</em>{x}{i<3&&<ArrowRight size={14}/>}</span>)}</div></section>
 {error&&<div className="error"><XCircle size={18}/>{error}</div>}
 <section className="panel sources"><div className="section-title"><div><span>01</span><h2>Connect your sources</h2></div><p>Each file is read in the background and kept unchanged.</p></div>
 <div className="source-grid"><SourceCard type="students" source={sources.students} onFile={onFile}/><SourceCard type="mcq" source={sources.mcq} onFile={onFile}/><SourceCard type="cq" source={sources.cq} count={sources.cqFiles?.length||(sources.cq?1:0)} onFile={onFile}/><SourceCard type="web" source={sources.web&&!sources.web.linked?sources.web:null} onFile={onFile}/></div>
 {sources.cq&&<p className="cq-upload-note"><b>Multiple CQ files supported.</b> Select several files together or click the CQ card again to append more. Every file keeps its own detected column mapping.</p>}
 <div className="manual-form"><div className="manual-head"><div><b>Saved processing sessions</b><small>Save uploaded Students/MCQ/CQ data whether or not you export. Reopen later, add a missing file, and recalculate. Each save remains for 20 days.</small></div><button onClick={saveSession} disabled={busy==='session'||!Object.keys(sources).length}><Cloud size={15}/>{activeSessionId?'Update session':'Save session'}</button></div><div className="database-picker"><label><span>Session name (optional)</span><input value={sessionCustomName} onChange={e=>setSessionCustomName(e.target.value)} placeholder="e.g. HSC 28 Weekly Exam"/></label><label><span>Resume session</span><select value={activeSessionId} onChange={e=>loadSession(e.target.value)} disabled={busy==='session'}><option value="">Choose by exam and start time…</option>{savedSessions.map(session=><option key={session.id} value={session.id}>{session.title}</option>)}</select></label><button onClick={startNewSession} disabled={busy==='session'}>+ New</button><button onClick={()=>loadSession(activeSessionId)} disabled={!activeSessionId||busy==='session'}><RefreshCw size={15}/> Load</button><button className="forget" onClick={deleteSession} disabled={!activeSessionId||busy==='session'}>Remove</button></div><small>Will save as: {sessionTitle}</small>{activeSessionId&&(()=>{const current=savedSessions.find(s=>s.id===activeSessionId);return current?<small>{Object.entries(current.sourceFiles||{}).filter(([,name])=>name).map(([type,name])=>`${type.toUpperCase()}: ${name}`).join(' · ')} · Expires {new Date(current.expiresAt).toLocaleString('en-GB')}</small>:null})()}<p role="status">{sessionStatus}</p></div>
 <div className="manual-form"><div className="manual-head"><div><b>Manual entries {sources.manual&&<em>Active</em>}</b><small>Marks are read from MCQ/CQ first. Manual Marks is used only when no sheet mark is found.</small></div><button onClick={()=>setManualRows(rows=>[...rows,{roll:'',name:'',college:'',mark:'',added:false}])}>+ Add row</button></div><div className="manual-table"><div className="manual-labels"><span>Roll *</span><span>Name</span><span>College / School</span><span>Marks (optional)</span><span>Status</span></div>{manualRows.map((row,i)=><div className="manual-row" key={i}><input value={row.roll} onChange={e=>updateManualRow(i,'roll',e.target.value)} placeholder="28280011"/><input value={row.name} onChange={e=>updateManualRow(i,'name',e.target.value)} placeholder="Student name"/><input value={row.college} onChange={e=>updateManualRow(i,'college',e.target.value)} placeholder="Institution"/><input value={row.mark} onChange={e=>updateManualRow(i,'mark',e.target.value)} placeholder="Auto"/><span className="manual-status">{row.added&&<CheckCircle2 size={20}/>}<button disabled={manualRows.length===1} onClick={()=>setManualRows(rows=>rows.filter((_,x)=>x!==i))}>×</button></span></div>)}</div><div className="manual-actions"><button onClick={applyManualRolls}>Find marks & auto-rank</button><button className="clear-manual" onClick={clearManualRolls}>Clear</button></div></div>
 <div className="or"><span>SAVED GOOGLE SHEET DATABASES</span></div><p role="status">{storageStatus}</p>
 {savedSheets.length>0&&<div className="database-picker"><label><span>Choose database</span><select value={activeSavedId} onChange={e=>selectSaved(e.target.value)}><option value="" disabled>Select a saved Google Sheet</option>{savedSheets.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><button onClick={()=>{const item=savedSheets.find(x=>x.id===activeSavedId);if(item)loadGoogleSheet(item.url,{preferredTab:item.webTab,knownTitle:item.title})}} disabled={!activeSavedId||busy==='web'}><RefreshCw className={busy==='web'?'spin':''} size={16}/> Refresh latest data</button><button className="forget" onClick={forgetLink} disabled={!activeSavedId}>Remove</button></div>}
 <div className="link-row"><Link2 size={20}/><input value={link} onChange={e=>setLink(e.target.value)} placeholder="Paste a new Google Sheets link once…"/><button onClick={saveLink} disabled={!link||busy==='web'}><Cloud size={17}/> Save to database list</button></div>
 {sheetNames.length>0&&<label className="sheet-picker secondary"><span>Detected Web Roll tab</span><select value={selectedSheet} onChange={e=>chooseTab(e.target.value)}>{sheetNames.map(name=><option key={name} value={name}>{name}</option>)}</select><small>Automatically selected from the tab containing the WEB Roll header. Change only if needed.</small></label>}
 {sources.web?.linked&&<div className="active"><CheckCircle2 size={16}/> Active database: <b>{sources.web.workbookTitle}</b> · {sources.web.sheetName}<a href={sources.web.link} target="_blank">Open source</a></div>}
 </section>
 <section className="panel"><div className="section-title"><div><span>02</span><h2>Verify detected columns</h2></div><p>Headers are auto-detected even when they are not on row 1. CQ files may use different formats.</p></div>{Object.values(sources).length?<div className="mapping-grid">{Object.entries(sources).filter(([type])=>!['cq','cqFiles'].includes(type)).map(([type,source])=><Mapping key={type} source={source} onChange={mapping}/>)}{(sources.cqFiles||(sources.cq?[sources.cq]:[])).map((source,index)=><Mapping key={`cq-${index}-${source.fileName}`} source={source} index={index} onChange={mapping} onRemove={removeCqFile}/>)}</div>:<div className="empty">Upload a source to see its detected headers.</div>}</section>
 <section className="panel"><div className="section-title"><div><span>03</span><h2>Validation & result preview</h2></div><p>{complete?'Processing is ready. Review every warning before export.':'Students and MCQ sheets are required for uploaded results. CQ is optional enrichment.'}</p></div>
 {complete&&<div className="processing-banner"><CheckCircle2 size={22}/><div><b>Result preview is ready</b><small>{processed.results.length} exam rolls processed · {processed.results.filter(r=>r.rank!==null).length} ranked · {processed.issues.length} issues</small></div><button onClick={()=>setTab('results')}>View final result</button></div>}
 <div className="metrics"><div><b>{processed.results.length}</b><span>Exam rolls processed</span></div><div><b>{processed.issues.length}</b><span>Issues to review</span></div><div><b>{processed.results.filter(r=>r.total!==null).length}</b><span>Scores available</span></div><div><b>{processed.results.filter(r=>r.rank!==null).length}</b><span>Ranked rows</span></div></div>
 <div className="tabs"><button className={tab==='results'?'on':''} onClick={()=>setTab('results')}>Final result</button><button className={tab==='cq'?'on':''} onClick={()=>setTab('cq')}>CQ Issues & Recovery <em>{processed.cqRecovery.length}</em></button><button className={tab==='issues'?'on':''} onClick={()=>setTab('issues')}>Issues <em>{processed.issues.length}</em></button><button className={tab==='audit'?'on':''} onClick={()=>setTab('audit')}>Audit log</button></div>
 {tab==='cq'&&<div className="cq-note"><b>Clean CQ audit.</b><span>Showing only auto-recovered matches and items needing review. Clean exact matches are merged directly into Final Result.</span></div>}
 {tab==='issues'&&Object.keys(issueCounts).length>0&&<><div className="chips concise"><button className={!issueFilter?'selected':''} onClick={()=>{setIssueFilter('');setShowIssueDetails(true)}}><b>{processed.issues.length}</b>All issues</button>{Object.entries(issueCounts).map(([k,v])=><button className={`${issueFilter===k?'selected ':''}${k==='Manual edited'?'manual-chip':''}`} key={k} onClick={()=>{setIssueFilter(k);setShowIssueDetails(true)}}>{k==='Manual edited'?<CheckCircle2 size={13}/>:<AlertTriangle size={13}/>}<b>{v}</b>{k}</button>)}</div><div className="issue-tools"><input value={issueSearch} onChange={e=>{setIssueSearch(e.target.value);setShowIssueDetails(true)}} placeholder="Search roll or issue description…"/><span>{filteredIssues.length} of {processed.issues.length}</span>{(issueFilter||issueSearch)&&<button onClick={()=>{setIssueFilter('');setIssueSearch('')}}>Clear filters</button>}<button className="details-toggle" onClick={()=>setShowIssueDetails(v=>!v)}>{showIssueDetails?'Hide rows':'Show rows'}</button></div></>}
 {(tab!=='issues'||showIssueDetails||processed.issues.length===0)&&<Table tab={tab} data={tab==='results'?dataset():tab==='cq'?processed.cqRecovery:tab==='issues'?filteredIssues:processed.audit}/>}
 <div className="field-options"><div><b>Final output fields</b><small>Choose what appears in preview and every export.</small></div>{OUTPUT_FIELDS.map(([id,label])=><label key={id}><input type="checkbox" checked={outputFields.includes(id)} onChange={()=>toggleOutput(id)}/><span>{label}</span></label>)}</div>
 <label className="sheet-picker"><span>Export filename · automatic</span><input value={customExportName} placeholder={autoExportName} onChange={e=>setCustomExportName(e.target.value)}/><small>{exportBaseName} · Leave blank for automatic naming from MCQ/CQ.</small></label>
 <div className="export"><div><b>Ready when you are</b><small>Exports contain clean result fields only. Paid Amount and helpers are excluded.</small></div><button onClick={exportCsv} disabled={!processed.results.length}><Download size={16}/> CSV</button><button onClick={exportPdf} disabled={!processed.results.length}><Download size={16}/> PDF</button><button className="primary" onClick={exportXlsx} disabled={!processed.results.length}><Download size={16}/> Excel</button></div>
 </section></div>
 <div className={workspaceTab==='image'?'image-workspace':'workspace-hidden'}><ImageMaker sourceData={imageSource} exportBaseName={exportBaseName} customExportName={customExportName} onExportNameChange={setCustomExportName}/></div>
 </main><footer>ResultFlow · process, edit, design, and export in one workspace</footer></>
}
function Table({data,tab}){const rows=data.slice(0,100), headers=Object.keys(rows[0]||{});if(!rows.length){if(tab==='cq')return <div className="empty"><CheckCircle2 className="ok" size={27}/> All CQ entries matched cleanly with zero issues.</div>;return <div className="empty"><FileSpreadsheet size={27}/> No rows to preview yet.</div>;}return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{headers.map(h=>{const value=String(r[h]??'');return <td className={value.startsWith('✓')?'edited-cell':''} key={h}>{value}</td>})}</tr>)}</tbody></table>{data.length>100&&<p className="more">Showing 100 of {data.length} rows</p>}</div>}
if(typeof document!=='undefined') createRoot(document.getElementById('root')).render(<App/>);
