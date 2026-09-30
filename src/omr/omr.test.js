import { describe, expect, it } from 'vitest';
import { parseAnswerKey, parseOmrMatrix } from './omrParser.js';
import { processOmrData } from './omrProcessor.js';

describe('OMR Answer Key Parser', () => {
  it('parses numbered answer key format with exam title prefix', () => {
    const raw = `28 offline 
1. B
2. B
3. C
4. B
5. B
6. D
7. B
8. B
9. A
10. C`;
    const res = parseAnswerKey(raw);
    expect(res.totalQuestions).toBe(10);
    expect(res.keyMap[1]).toBe('B');
    expect(res.keyMap[3]).toBe('C');
    expect(res.keyMap[6]).toBe('D');
    expect(res.keyMap[9]).toBe('A');
  });

  it('handles variations like 1: B, 1) B, 1 B', () => {
    const raw = `1: A\n2) B\n3 - C\n4 D`;
    const res = parseAnswerKey(raw);
    expect(res.totalQuestions).toBe(4);
    expect(res.keyMap[1]).toBe('A');
    expect(res.keyMap[2]).toBe('B');
    expect(res.keyMap[3]).toBe('C');
    expect(res.keyMap[4]).toBe('D');
  });
});

describe('OMR Data Processing & Grading', () => {
  const matrix = [
    ['27 Exam 9 - Results', '', '', '', ''],
    ['', '', '', '', ''],
    ['Roll Number', 'Score', 'Correct', 'Wrong', 'Empty', 'Invalid', 'Q1', 'Q2', 'Q3'],
    ['00260231', '3', '3', '0', '0', '0', 'B', 'D', 'C'],
    ['271540', '2', '2', '1', '0', '0', 'B', 'D', 'A'],
    ['N/A', '1', '1', '2', '0', '0', 'B', 'A', 'A']
  ];

  it('parses matrix and extracts title and questions', () => {
    const parsed = parseOmrMatrix(matrix);
    expect(parsed.examTitle).toBe('27 Exam 9 - Results');
    expect(parsed.questionColumns).toEqual(['Q1', 'Q2', 'Q3']);
    expect(parsed.rows.length).toBe(3);
  });

  it('grades questions against key, normalizes rolls, and flags N/A', () => {
    const parsed = parseOmrMatrix(matrix);
    const keyMap = { 1: 'B', 2: 'D', 3: 'C' };

    const { results, issues, stats } = processOmrData({
      omrData: parsed,
      answerKeyMap: keyMap,
      totalMcq: 3
    });

    expect(stats.total).toBe(3);
    expect(stats.valid).toBe(2);

    // Roll 1: 00260231 -> 3 correct, score 3, rank 1
    const s1 = results.find(r => r.roll === '00260231');
    expect(s1.isValidRoll).toBe(true);
    expect(s1.score).toBe(3);
    expect(s1.correct).toBe(3);
    expect(s1.wrong).toBe(0);
    expect(s1.rank).toBe(1);

    // Roll 2: 271540 (6-digit) -> normalized to 00271540, score 2, rank 2
    const s2 = results.find(r => r.roll === '00271540');
    expect(s2.isValidRoll).toBe(true);
    expect(s2.score).toBe(2);
    expect(s2.answers[3].isWrong).toBe(true);
    expect(s2.rank).toBe(2);

    // Roll 3: N/A -> flagged in issues, isValidRoll: false
    const s3 = results.find(r => r.roll === 'N/A');
    expect(s3.isValidRoll).toBe(false);
    expect(issues.some(i => i.roll === 'N/A')).toBe(true);
  });
});
