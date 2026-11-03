import {withCustomRoster} from '../customRoster.js';
import {processOmrData} from './omrProcessor.js';
const rollKey=v=>{const text=String(v??'').trim().replace(/-/g,'');return /^\d{6}$/.test(text)?'00'+text:text;};
const rawRoll=row=>row['Roll Number']||row.Roll||row.roll||'';
export function processReviewedOmr({omrData,sources={},answerKeyMap={},totalMcq=0,corrections={},decisions={}}){
 if(!omrData)return withCustomRoster(processOmrData,sources,{answerKeyMap,totalMcq},omrData);
 const rows=omrData.rows.map((row,index)=>{const id=row._rowIndex||index+1;const fix=corrections[id];return {...row,_rowIndex:id,...(fix?{'Roll Number':fix.roll,'Student Name':fix.name}: {})};});
 // Manual roster records are an optional overlay; source files and old parsers stay intact.
 const customRows=[...(sources.custom?.rows||[])];
 for(const fix of Object.values(corrections)){const index=customRows.findIndex(row=>rollKey(row[0])===rollKey(fix.roll));const entry=[fix.roll,fix.name,''];if(index>=0)customRows[index]=entry;else customRows.push(entry);}
 const combinedSources=customRows.length?{...sources,custom:{type:'custom',fileName:sources.custom?.fileName||'Manual OMR entries',headers:['Roll','Name','College'],mapping:{roll:0,name:1,college:2,mark:-1},rows:customRows}}:sources;
 const run=inputRows=>withCustomRoster(processOmrData,combinedSources,{answerKeyMap,totalMcq},{...omrData,rows:inputRows});
 const preview=run(rows);
 const grouped=new Map();
 for(const row of rows){const roll=rollKey(rawRoll(row));if(!roll)continue;if(!grouped.has(roll))grouped.set(roll,[]);grouped.get(roll).push(row);}
 const groups=[...grouped].filter(([,items])=>items.length>1).map(([roll,items])=>{
   const selected=decisions[roll];const resolved=items.some(row=>row._rowIndex===selected);
   return {roll,resolved,selected:resolved?selected:null,entries:items.map(row=>{const graded=preview.results.find(r=>r.rowNumber===row._rowIndex);const fallback=graded||processOmrData({omrData:{...omrData,rows:[row]},answerKeyMap,totalMcq,sources:{}}).results[0];return {rowNumber:row._rowIndex,roll:rawRoll(row),name:fallback?.name||row['Student Name']||row.Name||'—',score:fallback?.score??row.Score??'—',answers:Object.entries(row).filter(([key])=>/^Q\d+$/i.test(key)).map(([key,value])=>key+': '+value).join(' · ')};})};
 });
 const groupMap=new Map(groups.map(group=>[group.roll,group]));
 // Pending duplicate groups are held out until a specific source row is selected.
 const retained=rows.filter(row=>{const group=groupMap.get(rollKey(rawRoll(row)));return !group||(group.resolved&&group.selected===row._rowIndex);});
 const final=run(retained);
 const pending=groups.filter(group=>!group.resolved);
 const pendingIssues=pending.flatMap(group=>group.entries.map(entry=>({type:'Duplicate Roll',roll:group.roll,rowNumber:entry.rowNumber,detail:'Decision required: choose which source row to keep.'})));
 const issues=[...final.issues,...pendingIssues];
 const retainedIds=new Set(final.results.map(row=>row.rowNumber));
 const issueGroups=new Map();
 for(const issue of issues){if(!issueGroups.has(issue.rowNumber))issueGroups.set(issue.rowNumber,{roll:issue.roll,rowNumber:issue.rowNumber,excluded:!retainedIds.has(issue.rowNumber),reasons:[]});issueGroups.get(issue.rowNumber).reasons.push(issue);}
 const flaggedRows=[...issueGroups.values()].map(row=>({...row,type:[...new Set(row.reasons.map(reason=>reason.type))].join(' + '),detail:row.reasons.map(reason=>reason.detail).join('; ')}));
 return {...final,issues,flaggedRows,reviewGroups:groups,pendingDuplicates:pending.length,reviewLog:Object.entries(corrections).map(([rowNumber,fix])=>({rowNumber:Number(rowNumber),...fix})),stats:{...final.stats,total:rows.length,excluded:rows.length-final.results.length,flagged:flaggedRows.length,issueCount:issues.length,reviewInResults:flaggedRows.filter(row=>!row.excluded).length}};
}
export function validateOmrCorrection(roll,name){
 const clean=String(roll??'').trim();if(!/^\d+$/.test(clean))throw Error('সংখ্যা দিয়ে সঠিক রোল লিখুন।');
 if(!String(name??'').trim())throw Error('শিক্ষার্থীর নাম লিখুন।');
 return {roll:clean,name:String(name).trim()};
}
