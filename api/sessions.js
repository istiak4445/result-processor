const INDEX='resultflow:sessions:v1',PREFIX='resultflow:session:v1:',TTL=20*24*60*60;
const env=()=>({endpoint:process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL,token:process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN});
function cleanSession(value){
  if(!value||typeof value!=='object')throw new Error('Invalid session');
  const id=String(value.id||'');if(!/^[\w-]{8,80}$/.test(id))throw new Error('Invalid id');
  const payload=value.payload;if(!payload||typeof payload!=='object'||typeof payload.sources!=='object')throw new Error('Invalid payload');
  const createdAt=String(value.createdAt||new Date().toISOString()),updatedAt=new Date().toISOString();
  const sourceFiles=Object.fromEntries(Object.entries(payload.sources).map(([type,source])=>[type,String(source?.fileName||'').slice(0,220)]));
  return {id,title:String(value.title||'Saved result session').slice(0,180),createdAt,updatedAt,expiresAt:new Date(Date.now()+TTL*1000).toISOString(),sourceFiles,payload};
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');const {endpoint,token}=env();
  if(!endpoint||!token)return res.status(503).json({error:'Permanent storage is not connected.'});
  if(!['GET','POST','DELETE'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  const command=async args=>{const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(12000)});const data=await response.json();if(!response.ok||data.error)throw new Error();return data.result};
  try{
    const id=String(req.query?.id||'');
    if(req.method==='GET'&&id){if(!/^[\w-]{8,80}$/.test(id))return res.status(400).json({error:'Invalid session ID'});const raw=await command(['GET',PREFIX+id]);return raw?res.status(200).json({session:typeof raw==='string'?JSON.parse(raw):raw}):res.status(404).json({error:'Session expired or not found'});}
    if(req.method==='POST'){
      const session=cleanSession(typeof req.body==='string'?JSON.parse(req.body):req.body);const json=JSON.stringify(session);
      if(Buffer.byteLength(json)>3_500_000)return res.status(413).json({error:'Session is too large to save. Remove unnecessary source rows.'});
      await command(['SET',PREFIX+session.id,json,'EX',TTL]);await command(['ZADD',INDEX,Date.parse(session.updatedAt),session.id]);
      return res.status(200).json({session:{...session,payload:undefined}});
    }
    if(req.method==='DELETE'){if(!/^[\w-]{8,80}$/.test(id))return res.status(400).json({error:'Invalid session ID'});await command(['DEL',PREFIX+id]);await command(['ZREM',INDEX,id]);return res.status(200).json({ok:true});}
    const ids=await command(['ZREVRANGE',INDEX,0,99]);if(!ids?.length)return res.status(200).json({sessions:[]});
    const values=await command(['MGET',...ids.map(id=>PREFIX+id)]);const stale=[];const sessions=(values||[]).flatMap((raw,i)=>{if(!raw){stale.push(ids[i]);return []}const value=typeof raw==='string'?JSON.parse(raw):raw;return [{id:value.id,title:value.title,createdAt:value.createdAt,updatedAt:value.updatedAt,expiresAt:value.expiresAt,sourceFiles:value.sourceFiles||{}}]});
    for(const dead of stale)await command(['ZREM',INDEX,dead]);return res.status(200).json({sessions});
  }catch{return res.status(502).json({error:'Could not access saved sessions. Please try again.'});}
}
