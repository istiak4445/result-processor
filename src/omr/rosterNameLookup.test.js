import {it,expect} from 'vitest';
import {createRosterNameLookup} from './rosterNameLookup.js';
import {processReviewedOmr,validateOmrCorrection} from './omrReview.js';
const src=(type,rows)=>({type,rows,mapping:{roll:0,name:1,college:2},fileName:type,headerIndex:0});
it('looks up corrected rolls with Web then Students then Custom priority',()=>{
 const find=createRosterNameLookup({web:src('web',[['28-28709-1','Web Name','']]),students:src('students',[['28287091','Student Name',''],['123456','Known Student','']]),custom:src('custom',[['00001','New Student',''],['28287091','Custom Name','']])});
 expect(find('28287091')).toEqual({name:'Web Name',source:'Web sheet'});
 expect(find('00123456')?.name).toBe('Known Student');
 expect(find('123456')?.name).toBe('Known Student');
 expect(find('00001')).toEqual({name:'New Student',source:'Custom sheet'});
 expect(find('00002')).toBe(null);
});
it('does not carry the last roll name to a different unknown roll',()=>{
 const find=createRosterNameLookup({students:src('students',[['28287091','Correct Student','']])});
 expect(find('28287091')?.name).toBe('Correct Student');expect(find('28287092')).toBe(null);expect(find('')).toBe(null);
});
it('falls back to Students if the matching Web name is blank and ignores blank Web rolls',()=>{
 const find=createRosterNameLookup({web:src('web',[['','Wrong person',''],['123456','','']]),students:src('students',[['123456','Fallback Student','']])});expect(find('123456')?.name).toBe('Fallback Student');expect(find('')).toBe(null);
});
it('saves a correction using the automatically found name and clears the original issue',()=>{
 const sources={students:src('students',[['28287091','Found Student','']])};const find=createRosterNameLookup(sources);const fix=validateOmrCorrection('28287091',find('28287091')?.name);
 const result=processReviewedOmr({sources,omrData:{rows:[{'Roll Number':'2828709',Q1:'A',_rowIndex:41}],questionColumns:['Q1']},answerKeyMap:{1:'A'},corrections:{41:fix}});
 expect(result.results[0]).toMatchObject({roll:'28287091',name:'Found Student',score:1});expect(result.flaggedRows).toHaveLength(0);
});
