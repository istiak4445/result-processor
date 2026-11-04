import {describe,it,expect} from 'vitest';
import {HEADER_ALIASES,detectHeadingColumn,parseHeadingRows} from './headerMapping.js';
import {parseRows,processSources} from './main.jsx';
describe('heading based mapping',()=>{
 it('reads NUMBER instead of serial 113 and gives the student 9 CQ marks',()=>{
  const cq=parseRows([['SL ',' NAME',' COLLEGE NAME','ROLL','NUMBER'],['113','Samir Khan','College','24240011','9']],'cq','written.xlsx');
  expect(cq.mapping.mark).toBe(4);expect(cq.rows[0][cq.mapping.mark]).toBe('9');
  const students=parseRows([['Roll','Name'],['24240011','Samir Khan']],'students','roster.xlsx');
  const mcq=parseRows([['Roll','MCQ Marks'],['24240011','19']],'mcq','mcq.xlsx');
  expect(processSources({students,mcq,cq}).results[0]).toMatchObject({cq:9,mcq:19,total:28});
 });
 it('recognizes all supported mark headings regardless of case and spacing',()=>{
  for(const alias of HEADER_ALIASES.mark){const parsed=parseHeadingRows([['Serial No','Student Name','Roll',alias.toUpperCase()],['113','Test Student','123456','9']],'cq','exam.xlsx');expect(parsed.mapping.mark,alias).toBe(3);}
 });
 it('never guesses serial, roll, phone, question counts, maximum marks or unrelated numeric columns as obtained marks',()=>{
  for(const heading of ['SL','Serial Number','Roll Number','Phone Number','Mobile Number','Maximum Marks','Full Marks','Total Questions','Score Rank']){
   const parsed=parseHeadingRows([['Student Name','Roll',heading],['Test Student','123456','113']],'cq','exam.xlsx');expect(parsed.mapping.mark,heading).toBe(-1);
  }
 });
 it('chooses CQ or MCQ marks for the requested source type',()=>{
  const headers=['SL','Name','Roll','Total Marks','MCQ Marks','CQ Marks'];expect(detectHeadingColumn(headers,'mark','cq')).toBe(5);expect(detectHeadingColumn(headers,'mark','mcq')).toBe(4);
 });
 it('retains authoritative WEB Roll and supports Bangla and annotated headings',()=>{
  expect(parseHeadingRows([['Roll','WEB Roll*','Name','Obtained Marks (out of 20)'],['1','28280011','Test Student','9']],'web','web.xlsx').mapping).toMatchObject({roll:1,mark:3});
  expect(parseHeadingRows([['ক্রমিক নং','শিক্ষার্থীর নাম','রোল নম্বর','প্রাপ্ত নম্বর'],['113','নাম','28280011','9']],'cq','bn.xlsx').mapping).toEqual({roll:2,name:1,college:-1,mark:3});
 });
 it('preserves every row and infers distinct columns in a headingless source',()=>{
  const rows=[['First Student','City College','28280011','6'],['Second Student','College','28280012','4']];const parsed=parseHeadingRows(rows,'cq','no-header.xlsx');expect(parsed.rows).toEqual(rows);expect(parsed.rowNumbers).toEqual([1,2]);expect(parsed.headingMissing).toBe(true);expect(parsed.mapping).toEqual({roll:2,name:0,college:1,mark:3});
 });
 it('finds headings below title and blank rows without using data as headings',()=>{
  const parsed=parseHeadingRows([['CQ Examination'],[],['SL','Student Name','Roll','NUMBER'],['113','Test Student','28280011','9']],'cq','exam.xlsx');expect(parsed.headerIndex).toBe(2);expect(parsed.rowNumbers).toEqual([4]);expect(parsed.mapping.mark).toBe(3);
 });
});

describe('headerless detection safeguards',()=>{
 it('ignores serial and uses the separate score column',()=>{
 const rows=[['1','A Student','City College','28280011','9'],['2','B Student','City College','28280012','4'],['3','C Student','City College','28280013','7']];
 const parsed=parseHeadingRows(rows,'cq','headerless.xlsx');expect(parsed.mapping).toEqual({roll:3,name:1,college:2,mark:4});expect(parsed.rows).toHaveLength(3);
 });
 it('does not assign serial as marks when a marks column is absent',()=>{
 const parsed=parseHeadingRows([['1','A Student','28280011'],['2','B Student','28280012'],['3','C Student','28280013']],'cq','headerless.xlsx');expect(parsed.mapping.mark).toBe(-1);
 });
 it('leaves multiple plausible score columns unresolved',()=>{
 const parsed=parseHeadingRows([['A Student','28280011','9','8'],['B Student','28280012','4','3'],['C Student','28280013','7','2']],'cq','headerless.xlsx');expect(parsed.mapping.mark).toBe(-1);
 });
 it('does not infer telephone numbers as marks',()=>{
 const parsed=parseHeadingRows([['A Student','01812345678'],['B Student','01912345678'],['C Student','01712345678']],'cq','headerless.xlsx');expect(parsed.mapping.mark).toBe(-1);
 });
 it('preserves decimal, zero and negative marks when they are the only eligible score column',()=>{
 const parsed=parseHeadingRows([['A Student','28280011','0'],['B Student','28280012','-1.5'],['C Student','28280013','8.5']],'mcq','headerless.xlsx');expect(parsed.mapping.mark).toBe(2);
 });
 it('keeps named headings authoritative even if data resembles serial or roll numbers',()=>{
 const parsed=parseHeadingRows([['SL','Name','Roll','NUMBER'],['1','A Student','28280011','1'],['2','B Student','28280012','2'],['3','C Student','28280013','3']],'cq','headed.xlsx');expect(parsed.mapping.mark).toBe(3);
 });
});
