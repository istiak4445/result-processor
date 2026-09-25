import {describe,expect,it} from 'vitest';
import {combineCqSources,makeMap,normalizeRoll,parseRows,processSources,resolveCqRows,textSimilarity} from './main.jsx';
describe('normalizeRoll',()=>{
 it('normalizes six digit rolls',()=>expect(normalizeRoll('123456').normalized).toBe('00123456'));
 it('removes hyphens and preserves eight digits',()=>expect(normalizeRoll('28-28287-1').normalized).toBe('28282871'));
 it('rejects unsupported lengths',()=>expect(normalizeRoll('1234567').valid).toBe(false));
 it('rejects symbols',()=>expect(normalizeRoll('28_28287_1').valid).toBe(false));
});
describe('header mapping',()=>{
 it('prioritizes WEB Roll over an internal Roll column',()=>{
  const parsed=parseRows([['SL','Roll','Name','WEB Roll*'],['1','281001','Student','28-28047-1']],'web','web.xlsx');
  expect(parsed.mapping.roll).toBe(3);
 });
});
describe('web roll validation',()=>{
 it('ignores rows where WEB Roll is blank',()=>{
  const src=parseRows([['Roll','Name','WEB Roll*'],['281001','Blank student',''],['281002','Valid student','28-28047-1']],'web','web.xlsx');
  const indexed=makeMap(src);
  expect(indexed.invalid).toHaveLength(0);
  expect(indexed.records).toHaveLength(1);
  expect(indexed.map.has('28280471')).toBe(true);
 });
});
describe('optional marks sources',()=>{
 it('ranks using MCQ alone when CQ is not supplied',()=>{
  const students=parseRows([['Student Name','Roll'],['A','123456'],['B','123457']],'students','students.xlsx');
  const web=parseRows([['WEB Roll*','Name','College'],['123456','A','X'],['123457','B','Y']],'web','web.xlsx');
  const mcq=parseRows([['Roll Number','Score'],['123456','12'],['123457','15']],'mcq','mcq.xlsx');
  const result=processSources({students,web,mcq});
  expect(result.results.map(r=>[r.roll,r.total,r.rank])).toEqual([['00123457',15,1],['00123456',12,2]]);
 expect(result.issues.some(i=>i.type==='CQ missing')).toBe(false);
 });
 it('ignores enrolled students who did not appear in a marks sheet',()=>{
  const students=parseRows([['Student Name','Roll'],['Exam taker','123456'],['Did not sit','123457']],'students','students.xlsx');
  const web=parseRows([['WEB Roll*','Name','College'],['123456','Exam taker','X'],['123457','Did not sit','Y']],'web','web.xlsx');
  const mcq=parseRows([['Roll Number','Score'],['123456','12']],'mcq','mcq.xlsx');
  const result=processSources({students,web,mcq});
  expect(result.results.map(r=>r.roll)).toEqual(['00123456']);
  expect(result.issues.some(i=>i.roll==='00123457')).toBe(false);
 });
 it('flags and excludes a marks roll that is not in Students',()=>{
  const students=parseRows([['Student Name','Roll'],['Known','123456']],'students','students.xlsx');
  const mcq=parseRows([['Roll Number','Score'],['123456','12'],['123457','15']],'mcq','mcq.xlsx');
  const result=processSources({students,mcq});
  expect(result.results.map(r=>r.roll)).toEqual(['00123456']);
  expect(result.issues).toContainEqual({type:'Not in Students',roll:'00123457','Marks source':'MCQ','Manual Mark':'','Manual Status':'',description:'MCQ · mcq.xlsx · Row 3 · original 123457: No match in Students (Web sheet not loaded)'});
 });
 it('uses optional manual marks only when no uploaded mark exists',()=>{
  const students=parseRows([['Student Name','Roll'],['Known','123456']],'students','students.xlsx');
  const manual=parseRows([['Roll','Name','College','Marks'],['123456','Manual name','Manual college','17']],'manual','Manual entries');
  const result=processSources({students,manual});
  expect(result.results[0].total).toBe(17);
  expect(result.results[0].rank).toBe(1);
 });
 it('adds manual entries without removing uploaded marks rows',()=>{
  const students=parseRows([['Student Name','Roll'],['Uploaded','123456']],'students','students.xlsx');
  const mcq=parseRows([['Roll Number','Score'],['123456','12']],'mcq','mcq.xlsx');
  const manual=parseRows([['Roll','Name','College','Marks'],['123457','Manual','','17']],'manual','Manual entries');
  const result=processSources({students,mcq,manual});
  expect(result.results.map(r=>r.roll).sort()).toEqual(['00123456','00123457']);
  expect(result.results.find(r=>r.roll==='00123456').total).toBe(12);
  expect(result.results.find(r=>r.roll==='00123457').total).toBe(17);
  expect(result.issues.find(i=>i.roll==='00123457')).toMatchObject({'Manual Mark':'17','Manual Status':'✓ Edited'});
 });
});
describe('web source guard',()=>{
 it('accepts an exam roll absent from Students when a valid Web Roll matches',()=>{
  const students=parseRows([['Student Name','Roll'],['Other','123456']],'students','students.xlsx');
  const web=parseRows([['Roll','WEB Roll*','Name','College'],['281001','28-28047-1','Web student','Web college']],'web','web.xlsx');
  const mcq=parseRows([['Roll Number','Score'],['28280471','18']],'mcq','mcq.xlsx');
  const result=processSources({students,web,mcq});
  expect(result.results[0]).toMatchObject({roll:'28280471',name:'Web student',college:'Web college',total:18,rank:1});
  expect(result.issues.some(i=>i.type==='Not in Students')).toBe(false);
 });
 it('does not accept an internal Roll when the Web Roll field is blank',()=>{
  const students=parseRows([['Student Name','Roll']],'students','students.xlsx');
  const web=parseRows([['Roll','WEB Roll*','Name'],['123456','','Blank web roll']],'web','web.xlsx');
  const mcq=parseRows([['Roll Number','Score'],['123456','18']],'mcq','mcq.xlsx');
  const result=processSources({students,web,mcq});
  expect(result.results).toHaveLength(0);
  expect(result.issues.some(i=>i.type==='Not in Students')).toBe(true);
 });
 it('treats web data as optional enrichment when it has no usable rolls',()=>{
  const students=parseRows([['Student Name','Roll'],['A','123456'],['B','123457']],'students','students.xlsx');
  const web=parseRows([['WEB Roll*','Name'],['','A'],['','B']],'web','web.xlsx');
  const result=processSources({students,web});
  expect(result.issues.filter(i=>i.type==='Not in Web Roll')).toHaveLength(0);
  expect(result.issues.filter(i=>i.type==='Web Roll source unusable')).toHaveLength(0);
 });
});
describe('CQ recovery',()=>{
 it('combines CQ files with different column orders and headers',()=>{
  const first=parseRows([['Student Name','CQ','Roll','College'],['A','21','123456','X']],'cq','evaluator-a.xlsx');
  const second=parseRows([['Institution','Marks','Candidate Roll','Name'],['Y','22','123457','B']],'cq','evaluator-b.csv');
  second.mapping.roll=2;
  const combined=combineCqSources([first,second]);
  expect(combined.rows).toEqual([['123456','A','X','21'],['123457','B','Y','22']]);
  expect(makeMap(combined).records.map(record=>record.sourceFile)).toEqual(['evaluator-a.xlsx','evaluator-b.csv']);
 });
 it('recovers a one-digit CQ roll only with strong name, college and unique MCQ evidence',()=>{
  const students=parseRows([['Student Name','Roll'],['Ariyan Rahman','123456']],'students','students.xlsx');
  const web=parseRows([['WEB Roll*','Name','College'],['123456','Ariyan Rahman','Notre Dame College']],'web','web.xlsx');
  const mcq=parseRows([['Roll Number','Score'],['123456','15']],'mcq','mcq.xlsx');
  const cq=parseRows([['Roll','Student Name','College','Marks'],['123459','Ariyan Rahmn','NDC','25']],'cq','cq.xlsx');
  const result=processSources({students,web,mcq,cq});
  expect(result.results[0]).toMatchObject({roll:'00123456',mcq:15,cq:25,total:40});
  expect(result.cqRecovery[0]).toMatchObject({Status:'Auto-recovered','Resolved Roll':'00123456'});
  expect(result.issues.some(issue=>String(issue.type).includes('CQ'))).toBe(false);
 });
 it('never adds CQ marks when the resolved student has no MCQ row',()=>{
  const students=parseRows([['Student Name','Roll'],['Ariyan Rahman','123456']],'students','students.xlsx');
  const web=parseRows([['WEB Roll*','Name','College'],['123456','Ariyan Rahman','Notre Dame College']],'web','web.xlsx');
  const cq=parseRows([['Roll','Student Name','College','Marks'],['123456','Ariyan Rahman','Notre Dame College','25']],'cq','cq.xlsx');
  const result=processSources({students,web,cq});
  expect(result.results).toHaveLength(0);
  expect(result.cqRecovery[0].Status).toBe('Needs review');
 });
 it('keeps ambiguous name and college matches out of the result',()=>{
  const students=parseRows([['Student Name','Roll'],['Same Name','123456'],['Same Name','123457']],'students','students.xlsx');
  const web=parseRows([['WEB Roll*','Name','College'],['123456','Same Name','Same College'],['123457','Same Name','Same College']],'web','web.xlsx');
  const mcq=parseRows([['Roll Number','Score'],['123456','15'],['123457','14']],'mcq','mcq.xlsx');
  const cq=parseRows([['Roll','Student Name','College','Marks'],['','Same Name','Same College','25']],'cq','cq.xlsx');
  const recovery=resolveCqRows({students,web,mcq,cq});
  expect(recovery.map.size).toBe(0);
  expect(recovery.report[0].Status).toBe('Needs review');
 });
 it('supports minor spelling variation without treating unrelated names as equal',()=>{
  expect(textSimilarity('Ariyan Rahmn','Ariyan Rahman')).toBeGreaterThan(.9);
  expect(textSimilarity('Ariyan Rahman','Samiul Islam')).toBeLessThan(.5);
 });
 it('recovers CQ marks by name even when roll and college are missing (Adrita Aich case)',()=>{
  const web=parseRows([['SL','Date','ID','WEB Roll*','Name','College'],['30','14/06/26','3030','281028','Adrita Aich',"City Government Girls' High school"]],'web','web.xlsx');
  const mcq=parseRows([['Roll Number','Score'],['281028','14']],'mcq','mcq.xlsx');
  const cq=parseRows([['Student Name','Marks'],['Adrita aich','16']],'cq','cq.xlsx');
  const result=processSources({web,mcq,cq});
  expect(result.results[0]).toMatchObject({roll:'00281028',name:'Adrita Aich',mcq:14,cq:16,total:30});
  expect(result.cqRecovery).toHaveLength(1);
  expect(result.cqRecovery[0]).toMatchObject({Status:'Auto-recovered','Resolved Roll':'00281028','CQ Mark':'16'});
 });
 it('matches CQ roll and inherits college from CQ when web and student college are blank (Shreya Das case)',()=>{
  const web=parseRows([['WEB Roll*','Name','College'],['28280251','Shreya Das Oishi','']],'web','web.xlsx');
  const mcq=parseRows([['Roll Number','Score'],['28280251','18']],'mcq','mcq.xlsx');
  const cq=parseRows([['Name','College','Roll','Marks'],['shreya das oishe','Aunkur society girls high school','28280251','20']],'cq','cq.xlsx');
  const result=processSources({web,mcq,cq});
  expect(result.results[0]).toMatchObject({roll:'28280251',name:'Shreya Das Oishi',college:'Aunkur society girls high school',mcq:18,cq:20,total:38});
  expect(result.cqRecovery).toHaveLength(0);
 });
 it('recovers CQ marks when name has spelling/phonetic variation (istiak vs ishtiak)',()=>{
  const web=parseRows([['WEB Roll*','Name'],['28280011','Istiak Ahmed']],'web','web.xlsx');
  const mcq=parseRows([['Roll Number','Score'],['28280011','19']],'mcq','mcq.xlsx');
  const cq=parseRows([['Student Name','Marks'],['Ishtiak Ahmed','21']],'cq','cq.xlsx');
  const result=processSources({web,mcq,cq});
  expect(result.results[0]).toMatchObject({roll:'28280011',name:'Istiak Ahmed',mcq:19,cq:21,total:40});
  expect(result.cqRecovery[0]).toMatchObject({Status:'Auto-recovered','Resolved Roll':'28280011'});
 });
});
