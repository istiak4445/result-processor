import {jsPDF} from 'jspdf';

// Vector PDF: no screenshot, print dialog, gradients, or transparency masks.
export async function downloadCardPdf(nodes, size, title) {
  await document.fonts.ready;
  const pdf = new jsPDF({unit:'pt',format:[size.width,size.height],orientation:size.width>size.height?'landscape':'portrait',compress:true,putOnlyUsedFonts:true});
  pdf.setProperties({title,subject:'Searchable examination results'});
  for (let pageIndex=0;pageIndex<nodes.length;pageIndex++) {
    const source=nodes[pageIndex];
    if (!source) throw new Error('Result preview is not ready. Please try again.');
    if(pageIndex)pdf.addPage([size.width,size.height],size.width>size.height?'landscape':'portrait');
    // An unscaled, off-screen clone gives exact layout measurements for every page.
    const host=document.createElement('div');host.className='image-maker-shell';
    host.style.cssText=`position:fixed;left:-20000px;top:0;width:${size.width}px;pointer-events:none;`;
    const card=source.cloneNode(true);card.style.transform='none';host.appendChild(card);document.body.appendChild(host);
    try {
      const origin=card.getBoundingClientRect();
      const backgrounds=new Map();
      const rgb=(value,base=[8,17,31])=>{
        const numbers=value.match(/[\d.]+/g)?.map(Number);
        if(!numbers||numbers.length<3)return null;
        const alpha=numbers[3]??1;if(!alpha)return null;
        return numbers.slice(0,3).map((v,i)=>Math.round(v*alpha+base[i]*(1-alpha)));
      };
      pdf.setFillColor(8,17,31);pdf.rect(0,0,size.width,size.height,'F');
      for(const element of [card,...card.querySelectorAll('*')]) {
        const css=getComputedStyle(element),rect=element.getBoundingClientRect();
        if(css.display==='none'||css.visibility==='hidden'||!rect.width||!rect.height)continue;
        const parent=backgrounds.get(element.parentElement)||[8,17,31];
        const fill=rgb(css.backgroundColor,parent);backgrounds.set(element,fill||parent);
        const x=rect.left-origin.left,y=rect.top-origin.top;
        if(fill){pdf.setFillColor(...fill);const radius=Math.min(parseFloat(css.borderRadius)||0,rect.width/2,rect.height/2);pdf.roundedRect(x,y,rect.width,rect.height,radius,radius,'F');}
        for(const [side,a,b,c,d] of [['Top',x,y,x+rect.width,y],['Bottom',x,y+rect.height,x+rect.width,y+rect.height],['Left',x,y,x,y+rect.height],['Right',x+rect.width,y,x+rect.width,y+rect.height]]) {
          const width=parseFloat(css[`border${side}Width`]);const colour=rgb(css[`border${side}Color`],fill||parent);
          if(width&&colour){pdf.setDrawColor(...colour);pdf.setLineWidth(width);pdf.line(a,b,c,d);}
        }
        if(element.tagName==='IMG') {
          try {await element.decode();const canvas=document.createElement('canvas');canvas.width=Math.min(600,element.naturalWidth);canvas.height=Math.round(canvas.width*element.naturalHeight/element.naturalWidth);canvas.getContext('2d').drawImage(element,0,0,canvas.width,canvas.height);pdf.addImage(canvas.toDataURL('image/jpeg',0.8),'JPEG',x,y,rect.width,rect.height);} catch {throw new Error('Could not export the logo. Remove it or upload a local logo and try again.');}
        }
      }
      // Paint real text on top; group browser-wrapped glyphs into searchable lines.
      const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
      let textNode;
      while((textNode=walker.nextNode())) {
        const raw=textNode.textContent;if(!raw.trim())continue;
        const css=getComputedStyle(textNode.parentElement);
        if(css.display==='none'||css.visibility==='hidden')continue;
        if(/[^\u0000-\u00ff\u2010-\u2027]/.test(raw))throw new Error('Direct PDF currently supports Latin text. Bengali or other scripts need an embedded font; use Latin text for this export.');
        pdf.setFont('helvetica',Number(css.fontWeight)>=600?'bold':'normal');
        const fontSize=parseFloat(css.fontSize)||20;pdf.setFontSize(fontSize);pdf.setTextColor(...(rgb(css.color)||[248,250,252]));
        const lines=[];const range=document.createRange();
        for(let i=0;i<raw.length;i++) {
          range.setStart(textNode,i);range.setEnd(textNode,i+1);const rect=range.getBoundingClientRect();if(!rect.height)continue;
          let line=lines[lines.length-1];
          if(!line||Math.abs(line.top-rect.top)>1){line={top:rect.top,left:rect.left,width:0,text:''};lines.push(line);}
          line.text+=raw[i];line.width=Math.max(line.width,rect.right-line.left);
        }
        for(const line of lines) {
          const text=line.text.replace(/\s+/g,' ').trim();if(!text)continue;
          const available=Math.min(line.width,size.width-(line.left-origin.left));
          const measured=pdf.getTextWidth(text);pdf.setFontSize(measured>available&&available>0?fontSize*available/measured:fontSize);
          pdf.text(text,line.left-origin.left,line.top-origin.top+fontSize*0.82);
          pdf.setFontSize(fontSize);
        }
      }
    } finally {host.remove();}
  }
  pdf.save(`${(title||'Final Result').replace(/[\\/:*?"<>|]/g,'-')}.pdf`);
}
