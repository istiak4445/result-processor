import {expect,it} from 'vitest';
import {automaticExportName,safeExportName} from './exportName.js';
it('labels the actual uploaded marks components',()=>{
 expect(automaticExportName('HSC28.xlsx',{mcq:true})).toBe('HSC 28 - MCQ Result');
 expect(automaticExportName('HSC28.xlsx',{cq:true})).toBe('HSC 28 - CQ Result');
 expect(automaticExportName('HSC28.xlsx',{mcq:true,cq:true})).toBe('HSC 28 - Result');
});
it('extracts batch and date without guessing missing details',()=>{
 expect(automaticExportName('HSC28(21AUG).xlsx')).toBe('HSC 28 - 21 Aug - Result');
 expect(automaticExportName('28 cq up.xlsx')).toBe('28 - Result');
 expect(automaticExportName('HSC 28 _ Weekly Exam - 10 Sept MCQ.xlsx')).toBe('HSC 28 - Weekly Exam - 10 Sept - Result');
});
it('keeps filenames short and strips workflow clutter',()=>{
 expect(automaticExportName('HSC28 MCQ marks final upload copy.xlsx')).toBe('HSC 28 - Result');
 expect(automaticExportName('HSC28 '+ 'Long title '.repeat(20)+'21AUG.xlsx')).toContain('21 Aug');
 expect(automaticExportName('HSC28 '+ 'Long title '.repeat(20)+'21AUG.xlsx').length).toBeLessThan(95);
 expect(safeExportName('abc/result.pdf')).toBe('abc-result');
});
