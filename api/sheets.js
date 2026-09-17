const KEY = 'resultflow:savedSheets:v1';
export function validateSheet(item) {
  const url = new URL(item?.url || '');
  const id = url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)(?:\/|$)/)?.[1];
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || !id) throw new Error('Invalid Google Sheets link');
  return {id, url: `https://docs.google.com/spreadsheets/d/${id}/edit`, title: String(item.title || `Google Sheet · ${id.slice(0,8)}`).slice(0,300), webTab: String(item.webTab || '').slice(0,300)};
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const endpoint = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) return res.status(503).json({error:'Permanent storage is not connected. Connect Redis to this Vercel project.'});
  if (!['GET','POST','DELETE'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  async function command(args) {
    const response = await fetch(endpoint, {method:'POST', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}, body:JSON.stringify(args), signal:AbortSignal.timeout(10000)});
    const data = await response.json();
    if (!response.ok || data.error) throw new Error('Storage request failed');
    return data.result;
  }
  let item, id;
  try {
    if (req.method === 'POST') item = validateSheet(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
    if (req.method === 'DELETE') {
      id = req.query.id;
      if (typeof id !== 'string' || !/^[\w-]+$/.test(id)) throw new Error('Invalid sheet ID');
    }
  } catch { return res.status(400).json({error:'Invalid Google Sheets entry'}); }
  try {
    if (item) await command(['HSET',KEY,item.id,JSON.stringify(item)]);
    if (id) await command(['HDEL',KEY,id]);
    const values = await command(['HVALS',KEY]);
    return res.status(200).json({sheets:(values || []).map(value=>typeof value === 'string' ? JSON.parse(value) : value)});
  } catch { return res.status(502).json({error:'Could not access permanent storage. Please try again.'}); }
}
