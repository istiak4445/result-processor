import {afterEach, expect, it, vi} from 'vitest';
import handler, {validateSheet} from './sheets.js';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});
it('only stores link metadata, not workbook contents',()=>{
  expect(validateSheet({url:'https://docs.google.com/spreadsheets/d/abc-123/edit',title:'Exam',webTab:'Web',rows:[1]})).toEqual({id:'abc-123',url:'https://docs.google.com/spreadsheets/d/abc-123/edit',title:'Exam',webTab:'Web'});
  expect(()=>validateSheet({url:'https://evil.test/spreadsheets/d/abc/edit'})).toThrow();
});
it('writes one entry without replacing other saved sheets',async()=>{
  vi.stubEnv('KV_REST_API_URL','https://redis.test');vi.stubEnv('KV_REST_API_TOKEN','secret');
  const fetchMock=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({result:1})}).mockResolvedValueOnce({ok:true,json:async()=>({result:[JSON.stringify({id:'abc'})]})});vi.stubGlobal('fetch',fetchMock);
  const res={setHeader:vi.fn(),status:vi.fn().mockReturnThis(),json:vi.fn()};
  await handler({method:'POST',body:{url:'https://docs.google.com/spreadsheets/d/abc/edit'}},res);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0]).toBe('HSET');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({sheets:[{id:'abc'}]});
});
