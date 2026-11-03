import {describe,it,expect} from 'vitest';
import {processReviewedOmr,validateOmrCorrection,makeOmrDecision} from './omrReview.js';
const students={type:'students',fileName:'students',rows:[['123456','Known','College']],mapping:{roll:0,name:1,college:2},headerIndex:0};
const data=rows=>({rows,questionColumns:['Q1','Q2']});
const options={answerKeyMap:{1:'A',2:'B'},totalMcq:2};
describe('manual OMR review boundary',()=>{
 it('leaves normal enrolled grading unchanged',()=>{const result=processReviewedOmr({...options,sources:{students},omrData:data([{'Roll Number':'123456',Q1:'A',Q2:'B',_rowIndex:3}])});expect(result.results[0]).toMatchObject({roll:'00123456',name:'Known',score:2,rank:1});expect(result.pendingDuplicates).toBe(0);});
 it('holds all duplicate rows pending then keeps only the chosen row and recomputes rank/statistics',()=>{const omrData=data([{'Roll Number':'123456',Q1:'A',Q2:'B',_rowIndex:3},{'Roll Number':'00123456',Q1:'C',Q2:'B',_rowIndex:4}]);const pending=processReviewedOmr({...options,sources:{students},omrData});expect(pending.pendingDuplicates).toBe(1);expect(pending.results).toHaveLength(0);expect(pending.flaggedRows).toHaveLength(2);expect(pending.reviewGroups[0].entries.map(row=>row.score)).toEqual([2,1]);const chosen=processReviewedOmr({...options,sources:{students},omrData,decisions:{'00123456':4}});expect(chosen.results).toHaveLength(1);expect(chosen.results[0]).toMatchObject({rowNumber:4,score:1,rank:1});expect(chosen.stats.average).toBe('1.0');expect(chosen.pendingDuplicates).toBe(0);});
 it('manually recovers excluded invalid rolls and names, preserving source data',()=>{const row={'Roll Number':'1234567',Q1:'A',Q2:'B',_rowIndex:8};const omrData=data([row]);const result=processReviewedOmr({...options,sources:{students},omrData,corrections:{8:{roll:'00001',name:'New Student'}}});expect(result.results[0]).toMatchObject({roll:'00001',name:'New Student',score:2,rank:1});expect(row['Roll Number']).toBe('1234567');expect(students.rows).toHaveLength(1);expect(result.reviewLog).toHaveLength(1);});
 it('detects duplicates created by a manual correction',()=>{const result=processReviewedOmr({...options,sources:{students},omrData:data([{'Roll Number':'123456',_rowIndex:3},{'Roll Number':'999999',_rowIndex:4}]),corrections:{4:{roll:'123456',name:'Known'}}});expect(result.pendingDuplicates).toBe(1);expect(result.results).toHaveLength(0);});
 it('ignores stale decisions that do not select a current row',()=>{const result=processReviewedOmr({...options,omrData:data([{'Roll Number':'123456',_rowIndex:3},{'Roll Number':'123456',_rowIndex:4}]),decisions:{'00123456':99}});expect(result.pendingDuplicates).toBe(1);});
 it('uses the uploaded custom roster in OMR',()=>{const result=processReviewedOmr({...options,sources:{custom:{rows:[['00001','Custom student','']]}},omrData:data([{'Roll Number':'00001',Q1:'A',_rowIndex:2}])});expect(result.results[0]).toMatchObject({roll:'00001',name:'Custom student',score:1});});
 it('requires a numeric roll and a name for manual recovery',()=>{expect(()=>validateOmrCorrection('abc','A')).toThrow();expect(()=>validateOmrCorrection('00001','')).toThrow();expect(validateOmrCorrection('00001',' A ')).toEqual({roll:'00001',name:'A'});});
});

describe('correction and duplicate state regressions',()=>{
 const exam=data([{'Roll Number':'123456',Q1:'A',Q2:'B',_rowIndex:12},{'Roll Number':'28286911',Q1:'A',Q2:'B',_rowIndex:30},{'Roll Number':'28286911',Q1:'C',Q2:'B',_rowIndex:31},{'Roll Number':'2828709',Q1:'A',Q2:'B',_rowIndex:41}]);
 const roster={...students,rows:[...students.rows,['28286911','Other student','College']]};
 const opts={...options,sources:{students:roster},omrData:exam};
 it('keeps unrelated duplicate decisions after another row is edited or undone',()=>{
  const initial=processReviewedOmr(opts);
  const decisions={'28286911':makeOmrDecision(initial.reviewGroups,'28286911',31)};
  const corrected=processReviewedOmr({...opts,decisions,corrections:{41:{roll:'00001',name:'Recovered student'}}});
  expect(corrected.pendingDuplicates).toBe(0);
  expect(corrected.reviewGroups[0]).toMatchObject({resolved:true,selected:31});
  expect(corrected.flaggedRows).toHaveLength(0);
  expect(corrected.results.some(row=>row.rowNumber===41)).toBe(true);
  expect(corrected.reviewLog[0]).toMatchObject({originalRoll:'2828709',roll:'00001',status:'resolved'});
  const undone=processReviewedOmr({...opts,decisions});expect(undone.reviewGroups[0].resolved).toBe(true);
 });
 it('explains a new duplicate collision and clears it only when an entry is chosen',()=>{
  const corrections={41:{roll:'123456',name:'Corrected student'}};
  const initial=processReviewedOmr(opts);
  const decisions={'28286911':makeOmrDecision(initial.reviewGroups,'28286911',31)};
  const collision=processReviewedOmr({...opts,decisions,corrections});
  expect(collision.pendingDuplicates).toBe(1);
  expect(collision.reviewLog[0]).toMatchObject({status:'duplicate-pending',conflictingRows:[12],originalRoll:'2828709'});
  const choice=makeOmrDecision(collision.reviewGroups,'00123456',41);
  const resolved=processReviewedOmr({...opts,corrections,decisions:{...decisions,'00123456':choice}});
  expect(resolved.flaggedRows).toHaveLength(0);
  expect(resolved.pendingDuplicates).toBe(0);
  expect(resolved.results.map(row=>row.rowNumber).sort()).toEqual([31,41]);
  expect(resolved.reviewLog[0].status).toBe('resolved');
 });
 it('invalidates just the changed duplicate group when a new member is added',()=>{
  const initial=processReviewedOmr(opts);
  const decisions={'28286911':makeOmrDecision(initial.reviewGroups,'28286911',31)};
  const changed=processReviewedOmr({...opts,decisions,corrections:{41:{roll:'28286911',name:'New collision'}}});
  expect(changed.pendingDuplicates).toBe(1);expect(changed.reviewGroups[0].resolved).toBe(false);
  expect(changed.reviewGroups[0].entries).toHaveLength(3);
 });
 it('does not leak a discarded correction name into the chosen original entry',()=>{
  const omrData=data([{'Roll Number':'222222',Name:'Original student',_rowIndex:12},{'Roll Number':'7654321',Name:'Another student',_rowIndex:41}]);
  const corrections={41:{roll:'222222',name:'Corrected student'}};
  const pending=processReviewedOmr({...options,omrData,corrections});
  const decisions={'00222222':makeOmrDecision(pending.reviewGroups,'00222222',12)};
  const resolved=processReviewedOmr({...options,omrData,corrections,decisions});
  expect(resolved.results[0].name).toBe('Original student');
  expect(resolved.reviewLog[0].status).toBe('discarded');
 });
});

it('does not activate roster exclusion for other rows when a correction is added without an uploaded roster',()=>{
 const omrData=data([{'Roll Number':'123456',Name:'Original',_rowIndex:2},{'Roll Number':'123456',Name:'Duplicate',_rowIndex:3},{'Roll Number':'7654321',Name:'Invalid',_rowIndex:4}]);
 const pending=processReviewedOmr({...options,omrData});
 const decisions={'00123456':makeOmrDecision(pending.reviewGroups,'00123456',3)};
 const result=processReviewedOmr({...options,omrData,decisions,corrections:{4:{roll:'00001',name:'Recovered'}}});
 expect(result.results.map(row=>row.rowNumber).sort()).toEqual([3,4]);
 expect(result.flaggedRows).toHaveLength(0);
 expect(result.stats.flaggedExcluded).toBe(0);
 expect(result.stats.discardedDuplicates).toBe(1);
});
