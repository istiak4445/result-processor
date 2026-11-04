import {jsPDF} from 'jspdf';
import {cardPdfLayout,columnKind,createCardBackground} from './cardPdfDesign.js';
const FONT_NAME = 'Kalpurush';
let fontBinary;

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function loadKalpurush(pdf) {
  if (!fontBinary) {
    const response = await fetch('/fonts/kalpurush.ttf');
    if (!response.ok) throw new Error('Kalpurush font could not be loaded. Please refresh and try again.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const chunks = [];
    for (let index = 0; index < bytes.length; index += 0x8000) {
      chunks.push(String.fromCharCode(...bytes.subarray(index, index + 0x8000)));
    }
    fontBinary = chunks.join('');
  }
  pdf.addFileToVFS('kalpurush.ttf', fontBinary);
  pdf.addFont('kalpurush.ttf', FONT_NAME, 'normal');
  pdf.setFont(FONT_NAME, 'normal');
}

function extractTable(node) {
  const table = node?.querySelector('table');
  if (!table) return { headers: [], rows: [] };
  const headers = [...table.querySelectorAll('thead th')].map((cell) => clean(cell.textContent));
  const rows = [...table.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => clean(cell.textContent)),
  );
  return { headers, rows };
}


function fitCell(pdf,value,width,height,fontSize){
 const text=clean(value)||'—';let size=fontSize,lines;
 do{pdf.setFontSize(size);lines=pdf.splitTextToSize(text,width);if(lines.length*size*1.08<=height)break;size-=.4;}while(size>=5);
 if(size<5)throw new Error('Text cannot fit in a PDF cell. Reduce rows per image or shorten the longest value.');
 return {lines,size};
}
function drawText(pdf,value,x,y,size,color,align='left'){
 const text=String(value??'');pdf.setFontSize(size);pdf.setTextColor(color);
 if(/[\u0980-\u09ff]/.test(text)&&typeof document!=='undefined'){
  // Let the browser shape Bengali conjuncts; retain the original Unicode text for search/copy.
  const canvas=document.createElement('canvas');const context=canvas.getContext('2d');context.font=size+'px Kalpurush';const width=Math.max(1,context.measureText(text).width),height=size*1.8;
  canvas.width=Math.ceil(width*3);canvas.height=Math.ceil(height*3);context.scale(3,3);context.font=size+'px Kalpurush';context.fillStyle=color;context.textBaseline='alphabetic';context.fillText(text,0,size*1.22);
  const left=align==='center'?x-width/2:align==='right'?x-width:x;
  pdf.addImage(canvas.toDataURL('image/png'),'PNG',left,y-size*1.22,width,height,'bangla-'+size+'-'+color+'-'+text,'FAST');
  pdf.text(text,x,y,{align,renderingMode:'invisible'});
 }else pdf.text(text,x,y,{align});
}
function drawPage(pdf,node,size,options,index,pageCount,background){
 const brand=options.brand||{},style=options.style||{},accent=options.accent||{};
 const {headers,rows}=extractTable(node);const layout=cardPdfLayout(size,rows.length,style,brand);
 const p=layout.padding,primary=accent.primary||'#f8d36a',header=style.headerColor||'#f5c542';
 pdf.addImage(background,'JPEG',0,0,size.width,size.height,'shared-preview-background','FAST');
 const logo=options.brandOptions?.logo&&options.brandOptions?.topMode!=='text';
 if(!logo){const name=(clean(brand.institute)||'ChemShifu').toUpperCase(),tracking=5.75;pdf.setFontSize(24);pdf.setTextColor(primary);const width=pdf.getTextWidth(name)+(name.length-1)*tracking;pdf.text(name,(size.width-width)/2,p+53,{charSpace:tracking});pdf.setCharSpace(0);}
 const strip=options.brandOptions?.topMode==='strip'&&logo;
 const title=fitCell(pdf,brand.title||'Examination Result',size.width-p*2-96,90,size.height<=1080?48:58);
 title.lines.forEach((line,i)=>drawText(pdf,line,size.width/2,p+(strip?148:112)+i*title.size*1.05,title.size,primary,'center'));
 if(brand.subtitle)drawText(pdf,clean(brand.subtitle),size.width/2,p+(strip?187:158),22,'#f1f5f9','center');
 if(brand.printMeta||brand.showMeta)drawText(pdf,[brand.batch,brand.exam,brand.date].map(clean).filter(Boolean).join(' • '),size.width/2,p+(strip?210:190),16,primary,'center');
 const weights=headers.map(h=>{const kind=columnKind(h);return kind==='name'?2.1:kind==='wide'?1.55:kind==='compact'?.78:1;});
 const sum=weights.reduce((a,b)=>a+b,0)||1,widths=weights.map(weight=>layout.tableWidth*weight/sum);
 const x0=layout.tableLeft,y0=layout.tableTop,headH=layout.headHeight;
 pdf.setFillColor(header);pdf.roundedRect(x0,y0,layout.tableWidth,headH,18,18,'F');pdf.rect(x0,y0+20,layout.tableWidth,headH-20,'F');
 let x=x0;
 headers.forEach((label,col)=>{const configured=Number(options.columnFontSizes?.[col])||layout.fontSize;const fitted=fitCell(pdf,label,widths[col]-20,headH-8,configured);fitted.lines.forEach((line,li)=>drawText(pdf,line,x+10,y0+(headH-fitted.lines.length*fitted.size*1.08)/2+fitted.size+li*fitted.size*1.08,fitted.size,'#07111f'));x+=widths[col];});
 rows.forEach((row,ri)=>{
  const y=y0+headH+ri*layout.rowHeight;const highlighted=style.highlightTop3!==false&&index===0&&ri<3;
  pdf.setGState(new pdf.GState({opacity:highlighted?.16:ri%2?.065:.105}));pdf.setFillColor(highlighted?'#f8d36a':'#ffffff');pdf.rect(x0,y,layout.tableWidth,layout.rowHeight,'F');pdf.setGState(new pdf.GState({opacity:1}));
  x=x0;
  row.forEach((cell,col)=>{
   if(style.highlightColumns&&!highlighted&&(col===0||col===row.length-1)){pdf.setGState(new pdf.GState({opacity:.14}));pdf.setFillColor('#22d3ee');pdf.rect(x,y,widths[col],layout.rowHeight,'F');pdf.setGState(new pdf.GState({opacity:1}));}
   const align=columnKind(headers[col])==='name'?'left':style.alignment||'center';const cellSize=Number(options.columnFontSizes?.[col])||layout.fontSize;
   const fitted=fitCell(pdf,cell,widths[col]-20,layout.rowHeight-7,cellSize),lineH=fitted.size*1.08;
   const baseline=y+(layout.rowHeight-fitted.lines.length*lineH)/2+fitted.size;
   fitted.lines.forEach((line,li)=>drawText(pdf,line,align==='left'?x+10:align==='right'?x+widths[col]-10:x+widths[col]/2,baseline+li*lineH,fitted.size,'#f8fafc',align));
   if(col){pdf.setDrawColor('#59616c');pdf.setLineWidth(.25);pdf.line(x,y,x,y+layout.rowHeight);}x+=widths[col];
  });
  pdf.setDrawColor('#aab0b8');pdf.setLineWidth(.6);pdf.line(x0,y+layout.rowHeight,x0+layout.tableWidth,y+layout.rowHeight);
 });
 const footer=fitCell(pdf,brand.footer??'',size.width-p*2-96,36,20);
 footer.lines.forEach((line,li)=>drawText(pdf,line,size.width/2,layout.footerTop+40+li*footer.size,footer.size,primary,'center'));
 const contact=[brand.contact,brand.web,brand.note].map(clean).filter(Boolean).join(' • ');
 if(contact)drawText(pdf,contact,size.width/2,layout.footerTop+70,15,'#e2e8f0','center');
}
export async function buildCardPdf(nodes,size,title,options={}){
 if(typeof document!=='undefined'){await document.fonts.load('16px Kalpurush');await document.fonts.ready;}
 if(!nodes.length)throw new Error('No result pages to export.');
 const orientation=size.width>size.height?'landscape':'portrait';
 const pdf=new jsPDF({unit:'pt',format:[size.width,size.height],orientation,compress:true,putOnlyUsedFonts:true});
 await loadKalpurush(pdf);pdf.setProperties({title,subject:'Searchable preview-style examination results',creator:'ChemShifu ResultFlow'});
 const background=options.backgroundData||await createCardBackground(size,options.style,options.brandOptions,options.accent);
 for(let i=0;i<nodes.length;i++){
  if(!nodes[i])throw new Error('Result preview is not ready. Please try again.');
  if(i)pdf.addPage([size.width,size.height],orientation);pdf.setFont(FONT_NAME,'normal');drawPage(pdf,nodes[i],size,options,i,nodes.length,background);
 }
 return pdf;
}
export async function downloadCardPdf(nodes,size,title,options={}){
 const pdf=await buildCardPdf(nodes,size,title,options);const bytes=pdf.output('arraybuffer').byteLength;
 pdf.save((title||'Final Result').replace(/[\\/:*?"<>|]/g,'-')+'.pdf');return {bytes,pages:nodes.length};
}
