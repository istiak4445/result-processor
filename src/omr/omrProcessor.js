// Bridges existing normalizeRoll and roster mapping from rollLogic.js
import { normalizeRoll, makeMap } from '../rollLogic.js';

export function processOmrData({ omrData, answerKeyMap = {}, sources = {}, totalMcq = 0 }) {
  if (!omrData || !omrData.rows || !omrData.rows.length) {
    return { results: [], issues: [], stats: { total: 0, valid: 0, highest: 0, average: 0 } };
  }

  // Bridge student and web sheets if available in sources
  const sMap = sources.students ? makeMap(sources.students) : { map: new Map() };
  const wMap = sources.web ? makeMap(sources.web) : { map: new Map() };

  // Detect total questions
  const qCols = omrData.questionColumns || [];
  const numQuestions = totalMcq > 0 ? totalMcq : (Object.keys(answerKeyMap).length || qCols.length || 30);

  const results = [];
  const issues = [];
  const rollCounts = new Map();

  // First pass: track duplicates
  omrData.rows.forEach(row => {
    const rawRoll = row['Roll Number'] || row.Roll || row['roll'] || '';
    const norm = normalizeRoll(rawRoll);
    if (norm.valid) {
      rollCounts.set(norm.normalized, (rollCounts.get(norm.normalized) || 0) + 1);
    }
  });

  omrData.rows.forEach((row, idx) => {
    const rawRoll = row['Roll Number'] || row.Roll || row['roll'] || '';
    const norm = normalizeRoll(rawRoll);

    if (!norm.valid) {
      issues.push({
        type: 'Invalid Roll',
        roll: rawRoll || 'BLANK',
        rowNumber: row._rowIndex || idx + 1,
        detail: `Row ${row._rowIndex || idx + 1}: ${norm.reason || 'Invalid roll format'}`
      });
    }

    if (norm.valid && (rollCounts.get(norm.normalized) || 0) > 1) {
      issues.push({
        type: 'Duplicate Roll',
        roll: norm.normalized,
        rowNumber: row._rowIndex || idx + 1,
        detail: `Row ${row._rowIndex || idx + 1}: Duplicate roll found in sheet`
      });
    }

    // Match student name from bridged student / web maps
    const studentRecord = norm.valid ? sMap.map.get(norm.normalized) : null;
    const webRecord = norm.valid ? wMap.map.get(norm.normalized) : null;
    
    // Extract name from roster or fallback
    const studentName = (webRecord?.row?.[sources.web?.mapping?.name]) ||
                        (studentRecord?.row?.[sources.students?.mapping?.name]) ||
                        row['Student Name'] ||
                        row['Name'] ||
                        row['name'] ||
                        '—';

    // Grade each question
    let correctCount = 0;
    let wrongCount = 0;
    let blankCount = 0;
    let invalidCount = 0;
    const answers = {};

    for (let q = 1; q <= numQuestions; q++) {
      const qColName = `Q${q}`;
      const rawAns = String(row[qColName] ?? row[`q${q}`] ?? '').trim().toUpperCase();
      const keyAns = String(answerKeyMap[q] ?? '').trim().toUpperCase();

      let status = 'BLANK';
      let studentAns = rawAns;

      if (!rawAns || rawAns === 'EMPTY' || rawAns === 'BLANK' || rawAns === 'NULL') {
        status = 'BLANK';
        studentAns = '—';
        blankCount++;
      } else if (rawAns === 'INVALID' || rawAns === 'DOUBLE' || rawAns === 'MULTIPLE') {
        status = 'INVALID';
        studentAns = '⚠';
        invalidCount++;
      } else if (keyAns && rawAns === keyAns) {
        status = 'CORRECT';
        correctCount++;
      } else if (keyAns && rawAns !== keyAns) {
        status = 'WRONG';
        wrongCount++;
      } else {
        // If no answer key is given for this question, rely on row score/correct or default
        studentAns = rawAns;
      }

      answers[q] = {
        qNum: q,
        studentAns,
        keyAns,
        status,
        isCorrect: status === 'CORRECT',
        isWrong: status === 'WRONG',
        isBlank: status === 'BLANK',
        isInvalid: status === 'INVALID',
      };
    }

    // Score calculation
    const hasKey = Object.keys(answerKeyMap).length > 0;
    const finalScore = hasKey ? correctCount : Number(row.Score ?? row.score ?? correctCount);
    const finalCorrect = hasKey ? correctCount : Number(row.Correct ?? row.correct ?? correctCount);
    const finalWrong = hasKey ? wrongCount : Number(row.Wrong ?? row.wrong ?? wrongCount);
    const finalBlank = hasKey ? blankCount : Number(row.Empty ?? row.empty ?? blankCount);
    const accuracy = numQuestions > 0 ? Math.round((finalCorrect / numQuestions) * 100) : 0;

    results.push({
      _id: idx,
      roll: norm.valid ? norm.normalized : rawRoll,
      rawRoll,
      isValidRoll: norm.valid,
      name: studentName,
      score: finalScore,
      correct: finalCorrect,
      wrong: finalWrong,
      blank: finalBlank,
      invalid: invalidCount,
      accuracy: `${accuracy}%`,
      accuracyNum: accuracy,
      totalQuestions: numQuestions,
      answers,
      rowNumber: row._rowIndex || idx + 1,
      rank: null
    });
  });

  // Dense ranking: sort by score descending, then roll ascending
  const sorted = [...results].sort((a, b) => {
    // Valid rolls first, then higher scores
    if (a.isValidRoll && !b.isValidRoll) return -1;
    if (!a.isValidRoll && b.isValidRoll) return 1;
    if (b.score !== a.score) return b.score - a.score;
    return String(a.roll).localeCompare(String(b.roll));
  });

  let currentRank = 0;
  let lastScore = null;
  sorted.forEach(item => {
    if (!item.isValidRoll) {
      item.rank = '—';
      return;
    }
    if (item.score !== lastScore) {
      currentRank++;
      lastScore = item.score;
    }
    item.rank = currentRank;
  });

  // Calculate statistics
  const validResults = sorted.filter(r => r.isValidRoll);
  const totalScore = validResults.reduce((acc, r) => acc + (r.score || 0), 0);
  const highest = validResults.length ? Math.max(...validResults.map(r => r.score)) : 0;
  const average = validResults.length ? (totalScore / validResults.length).toFixed(1) : 0;

  return {
    results: sorted,
    issues,
    stats: {
      total: results.length,
      valid: validResults.length,
      invalid: issues.filter(i => i.type === 'Invalid Roll').length,
      highest,
      average,
      totalQuestions: numQuestions
    }
  };
}
