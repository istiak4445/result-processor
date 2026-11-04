// Prefer headings; infer headerless columns only when the data distinguishes them.
export const HEADER_ALIASES = {
 roll: ['roll','roll number','roll no','web roll','web roll number','web roll no','website roll','student roll','student roll number','roll phone','candidate roll','exam roll','board roll','class roll','student id','candidate id','id','reg','registration','reg no','reg number','registration number','রোল','রোল নং','রোল নম্বর','রোল নাম্বার','শিক্ষার্থীর রোল'],
 name: ['name','student name','full name','candidate name','examinee name','student','name of student','name of candidate','student full name','students name','নাম','শিক্ষার্থীর নাম','ছাত্র ছাত্রীর নাম','পরীক্ষার্থীর নাম'],
 college: ['college','institution','school','college institution name','college name','school name','institute','institute name','institution name','institution school','college school','college school name','name of institution','name of college','college or school','কলেজ','স্কুল','প্রতিষ্ঠান','প্রতিষ্ঠানের নাম','শিক্ষা প্রতিষ্ঠান','কলেজের নাম'],
 mark: ['marks','mark','score','number','numbers','num','obtained','obtained mark','obtained marks','marks obtained','score obtained','obtained score','total score','total marks','total mark','total number','total numbers','total','result','points','point','marks scored','earned marks','secured marks','marks secured','awarded marks','exam marks','exam score','test score','mcq','mcq mark','mcq marks','mcq score','mcq number','cq','cq mark','cq marks','cq score','cq number','written','written mark','written marks','written score','written number','creative marks','creative score','objective marks','objective score','নম্বর','নাম্বার','মার্ক','মার্কস','প্রাপ্ত নম্বর','প্রাপ্ত নাম্বার','মোট নম্বর','মোট নাম্বার','প্রাপ্ত মার্কস','লিখিত','লিখিত নম্বর','সৃজনশীল','সৃজনশীল নম্বর','এমসিকিউ','এমসিকিউ নম্বর','সিকিউ','সিকিউ নম্বর']
};
export const normalizeHeading = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g,' ').replace(/[\n\r_*/.:#'’()\-]+/g,' ').replace(/\s+/g,' ').trim();
const sets=Object.fromEntries(Object.entries(HEADER_ALIASES).map(([field,aliases])=>[field,new Set(aliases.map(normalizeHeading))]));
const serial = heading => /^(?:sl|s l|serial|serial no|serial number|s no|sr no|sr|index|row|row number|ক্রমিক|ক্রমিক নং|ক্রমিক নম্বর)$/.test(heading);
export function detectHeadingColumn(headers,field,type) {
 const normalized=headers.map(normalizeHeading);
 if(field==='mark') {
  const own=type==='cq'?['cq','written','creative','সিকিউ','লিখিত','সৃজনশীল']:type==='mcq'?['mcq','objective','এমসিকিউ']:[];
  const specific=normalized.findIndex(h=>sets.mark.has(h)&&own.some(prefix=>h===prefix||h.startsWith(prefix+' ')));
  if(specific>=0)return specific;
 }
 if(field==='roll'&&type==='web'){
  const web=normalized.findIndex(h=>/^(?:web|website) roll(?: number| no)?$/.test(h));if(web>=0)return web;
 }
 return normalized.findIndex(h=>!serial(h)&&sets[field].has(h));
}
export function inferHeaderlessMapping(rows) {
 const mapping={roll:-1,name:-1,college:-1,mark:-1};
 const sample=rows.slice(0,100),width=Math.max(0,...sample.map(row=>row.length));
 const profiles=Array.from({length:width},(_,col)=>{
  const values=sample.map(row=>String(row[col]??'').trim()).filter(Boolean);
  const compact=values.map(value=>value.replace(/[\s-]/g,''));
  const numeric=values.filter(value=>/^-?\d+(?:\.\d+)?$/.test(value)).map(Number);
  const integerIds=compact.filter(value=>/^\d+$/.test(value));
  const serial=values.length>=3&&numeric.length===values.length&&numeric.every((value,index)=>Number.isInteger(value)&&(index===0||value===numeric[index-1]+1));
  const institution=values.filter(value=>/college|school|institution|institute|university|madrasha|madrasa|কলেজ|স্কুল|বিদ্যালয়|বিদ্যালয়|প্রতিষ্ঠান|মাদ্রাসা/i.test(value)).length/Math.max(values.length,1);
  return {col,values,numeric,serial,institution,numericRatio:numeric.length/Math.max(values.length,1),idRatio:integerIds.length/Math.max(values.length,1),strongIds:integerIds.filter(value=>/^(?:\d{6}|\d{8})$/.test(value)).length,longIds:integerIds.filter(value=>value.length>=3).length,phone:integerIds.length>0&&integerIds.every(value=>value.length>=10),textRatio:values.filter(value=>/[a-zA-Z\u0980-\u09ff]/.test(value)).length/Math.max(values.length,1)};
 });
 const colleges=profiles.filter(p=>p.institution>=.2).sort((a,b)=>b.institution-a.institution);
 if(colleges.length&&(!colleges[1]||colleges[0].institution-colleges[1].institution>=.2))mapping.college=colleges[0].col;
 const names=profiles.filter(p=>p.col!==mapping.college&&p.textRatio>=.8&&p.institution<.2);
 if(names.length===1)mapping.name=names[0].col;
 const numericColumns=profiles.filter(p=>p.values.length&&p.idRatio>=.8&&(!p.serial||p.strongIds>0)&&!p.phone&&p.col!==mapping.college&&p.col!==mapping.name);
 const rolls=numericColumns.filter(p=>p.strongIds>0&&p.longIds/p.values.length>=.8).sort((a,b)=>b.strongIds-a.strongIds);
 if(rolls.length===1||(rolls.length>1&&rolls[0].strongIds>rolls[1].strongIds*2))mapping.roll=rolls[0].col;
 const eligible=profiles.filter(p=>p.values.length&&p.numericRatio>=.9&&!p.serial&&!p.phone&&p.col!==mapping.roll&&p.col!==mapping.college&&p.col!==mapping.name&&p.strongIds===0);
 if(eligible.length===1)mapping.mark=eligible[0].col;
 // Short incomplete rolls can be distinguished by their longer IDs only when a separate marks column exists.
 if(mapping.roll<0&&mapping.mark<0){
  const shortRolls=eligible.filter(p=>p.idRatio>=.9&&p.longIds/p.values.length>=.9);
  const smallMarks=eligible.filter(p=>p.numeric.every(value=>Math.abs(value)<100));
  if(shortRolls.length===1&&smallMarks.length===1&&shortRolls[0].col!==smallMarks[0].col){mapping.roll=shortRolls[0].col;mapping.mark=smallMarks[0].col;}
 }
 return mapping;
}
export function parseHeadingRows(matrix,type,fileName) {
 let headerIndex=-1,best=0;
 matrix.slice(0,20).forEach((row,index)=>{
  const fields=['roll','name','college','mark'].filter(field=>detectHeadingColumn(row,field,type)>=0);
  // Two distinct recognized fields distinguish a heading from a title or a student row.
  const score=fields.length;
  if(score>=2&&score>best){best=score;headerIndex=index;}
 });
 const width=Math.max(0,...matrix.map(row=>row.length));
 const headers=headerIndex>=0?(matrix[headerIndex]||[]).map(value=>String(value??'').trim()):Array.from({length:width},(_,i)=>'Column '+(i+1));
 const entries=matrix.slice(headerIndex+1).map((row,index)=>({row,rowNumber:headerIndex+index+2})).filter(({row})=>row.some(value=>String(value??'').trim()));
 const mapping=headerIndex>=0?Object.fromEntries(['roll','name','college','mark'].map(field=>[field,detectHeadingColumn(headers,field,type)])):inferHeaderlessMapping(entries.map(entry=>entry.row));
 return {type,fileName,headerIndex,headers,rows:entries.map(entry=>entry.row),rowNumbers:entries.map(entry=>entry.rowNumber),mapping,headingMissing:headerIndex<0};
}
