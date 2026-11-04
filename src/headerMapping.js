// Heading-driven source mapping. Never guess marks from a numeric/serial column.
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
 const mapping=Object.fromEntries(['roll','name','college','mark'].map(field=>[field,headerIndex>=0?detectHeadingColumn(headers,field,type):-1]));
 return {type,fileName,headerIndex,headers,rows:entries.map(entry=>entry.row),rowNumbers:entries.map(entry=>entry.rowNumber),mapping,headingMissing:headerIndex<0};
}
