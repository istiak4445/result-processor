export function safeExportName(value) {
  return String(value || '').replace(/\.(xlsx?|csv|pdf|png|zip)$/i,'').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').replace(/\s+/g,' ').replace(/^[.\s-]+|[.\s-]+$/g,'').slice(0,150) || 'Exam Result';
}
export function automaticExportName(fileName) {
  if(!fileName)return 'Exam Result';
  const months={jan:'Jan',feb:'Feb',mar:'Mar',apr:'Apr',may:'May',jun:'Jun',jul:'Jul',aug:'Aug',sep:'Sep',sept:'Sept',oct:'Oct',nov:'Nov',dec:'Dec'};
  let name=String(fileName).replace(/\.(xlsx?|csv)$/i,'');
  name=name.replace(/[_()\[\]]+/g,' ').replace(/\b(HSC|SSC)(\d{2,4})\b/gi,'$1 $2');
  name=name.replace(/\b(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)(?:EMBER|UARY|CH|IL|E|Y|UST|OBER)?\b/gi,(_,day,month)=>`${day} ${months[month.toLowerCase()]}`);
  name=name.replace(/\b(mcq|cq|marks?|scores?|results?|processed|upload(?:ed)?|up|download|export|sheet|data|copy|final|updated|version\s*\d+)\b/gi,' ').replace(/\s*-\s*/g,' - ').replace(/(?:\s*-\s*){2,}/g,' - ').replace(/\s+/g,' ').replace(/^[\s-]+|[\s-]+$/g,'');
  name=name.replace(/^(HSC|SSC)\s+(\d{2,4})\s+(?!-)(.+)$/i,(_,course,batch,rest)=>`${course.toUpperCase()} ${batch} - ${rest}`);
  // Keep useful title/date words without exporting a long vendor-generated filename.
  if(name.length>80){const date=name.match(/\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)(?:\s+\d{4})?\b/i)?.[0]||'';const head=name.replace(date,'').slice(0,date?60:75).replace(/\s+\S*$/,'').replace(/[\s-]+$/,'');name=date?`${head} - ${date}`:head;}
  return `${safeExportName(name || 'Exam')} - Result`;
}
