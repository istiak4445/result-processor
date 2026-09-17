import {describe,expect,it} from 'vitest';
import {makeMap,normalizeRoll,parseRows,processSources} from './main.jsx';
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
