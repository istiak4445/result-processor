export const DEFAULT_CARD_FOOTER='মতি টাওয়ার (৫ম তলা),চকবাজার 01332552536';
export const DEFAULT_CARD_FONT_SIZE=15;
export function columnKind(header){const value=String(header).toLowerCase().replace(/[^a-z0-9]/g,'');if(/name|student/.test(value))return 'name';if(/college|school|institution/.test(value))return 'wide';if(['sl','sln','serial','serialno','roll','rollno','marks','mark','mcq','cq','total','grade'].includes(value))return 'compact';return 'normal';}
export function cardPdfLayout(size,rowCount,style={},brand={}){
 const square=size.height<=1080,tall=size.height>1500;
 const padding=tall?72:square?42:58,headerHeight=tall?300:square?215:255,footerHeight=brand.contact||brand.web||brand.note?102:square?74:86;
 const shellPadding=square?24:32,tableTop=padding+headerHeight;
 const tableWidth=(size.width-padding*2-80)*Math.max(35,Math.min(100,Number(style.tableWidth)||96))/100;
 const fontSize=Math.max(10,Number(style.fontSize)||DEFAULT_CARD_FONT_SIZE),headHeight=Math.max(58,Math.min(92,fontSize*2.45));
 const available=size.height-padding*2-headerHeight-footerHeight-shellPadding;
 const rowHeight=(available-headHeight)/Math.max(rowCount,1);
 if(rowCount>0&&rowHeight<14)throw new Error('Too many rows on one PDF page. Reduce Rows per image and try again.');
 return {padding,headerHeight,footerHeight,tableTop,tableWidth,tableLeft:(size.width-tableWidth)/2,headHeight,rowHeight,fontSize:Math.min(fontSize,Math.max(8,rowHeight*.43)),footerTop:size.height-padding-footerHeight};
}
const rounded=(ctx,x,y,w,h,r)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);};
const readImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('A preview image could not be loaded.'));image.src=src;});
export async function createCardBackground(size,style={},brandOptions={},accent={}){
 const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;const ctx=canvas.getContext('2d');
 const w=size.width,h=size.height;
 const gradient=ctx.createLinearGradient(0,0,w,h);
 const colors=style.backgroundStyle==='carbon'?['#07090f','#111827','#030712']:style.backgroundStyle==='midnight'?['#020617','#0f172a','#020617']:['#020617','#08111f','#02030a'];
 colors.forEach((color,index)=>gradient.addColorStop(index*.5,color));ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
 if(style.customBackground){const image=await readImage(style.customBackground);const scale=Math.max(w/image.width,h/image.height);ctx.drawImage(image,(w-image.width*scale)/2,(h-image.height*scale)/2,image.width*scale,image.height*scale);ctx.fillStyle='rgba(2,6,23,.76)';ctx.fillRect(0,0,w,h);}
 else if(style.backgroundStyle!=='midnight'){
  const glows=style.backgroundStyle==='carbon'?[[.18,.12,248,211,106,.22,.4],[.82,.24,34,211,238,.16,.45]]:[[.14,.10,34,211,238,.24,.44],[.85,.06,248,211,106,.22,.38],[.50,.98,14,165,233,.16,.34]];
  glows.forEach(([x,y,r,g,b,opacity,radius])=>{const fill=ctx.createRadialGradient(w*x,h*y,0,w*x,h*y,Math.min(w,h)*radius);fill.addColorStop(0,'rgba('+[r,g,b,opacity].join(',')+')');fill.addColorStop(1,'rgba('+[r,g,b,0].join(',')+')');ctx.fillStyle=fill;ctx.fillRect(0,0,w,h);});
 }
 const layout=cardPdfLayout(size,0,style);const p=layout.padding,r=Number(style.borderRadius)||34;
 ctx.save();ctx.shadowColor=accent.glow||'rgba(248,211,106,.34)';ctx.shadowBlur=45;rounded(ctx,p,p,w-p*2,h-p*2,r);ctx.fillStyle='rgba(255,255,255,.075)';ctx.fill();ctx.restore();ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1;rounded(ctx,p,p,w-p*2,h-p*2,r);ctx.stroke();
 for(const y of [p,size.height-p-(size.height<=1080?74:86)+12]){const line=ctx.createLinearGradient(w*.2,0,w*.8,0);line.addColorStop(0,'transparent');line.addColorStop(.5,accent.primary||'#f8d36a');line.addColorStop(1,'transparent');ctx.fillStyle=line;ctx.fillRect(w*.2,y,w*.6,1);}
 if(brandOptions.logo&&brandOptions.topMode!=='text'){
  const logo=await readImage(brandOptions.logo);const strip=brandOptions.topMode==='strip';const maxW=strip?w-p*2:360,maxH=strip?96:56;
  if(strip){ctx.fillStyle='#ffffff';ctx.fillRect(p,p,w-p*2,maxH);}
  const factor=Math.min(maxW/logo.width,maxH/logo.height);ctx.drawImage(logo,(w-logo.width*factor)/2,p+10,logo.width*factor,logo.height*factor);
 }
 return canvas.toDataURL('image/jpeg',.86);
}
