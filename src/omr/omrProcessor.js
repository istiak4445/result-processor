// Bridges existing normalizeRoll and roster mapping from rollLogic.js
import { normalizeRoll, makeMap, sourceValue } from '../rollLogic.js';

export function processOmrData({ omrData, answerKeyMap = {}, sources = {}, totalMcq = 0 }) {
  if (!omrData || !omrData.rows || !omrData.rows.length) {
    return { results: [], issues: [], stats: { total: 0, valid: 0, highest: 0, average: 0 } };
  }

  // Bridge student and web sheets if available in sources
  const sMap = sources.students ? makeMap(sources.students) : { map: new Map(), duplicates: new Set(), invalid: [] };
  const wMap = sources.web ? makeMap(sources.web) : { map: new Map(), duplicates: new Set(), invalid: [] };
  const hasRoster = !!sources.students || !!sources.web;

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
        detail: `Row ${row._rowIndex || idx + 1}: Duplicate roll found in exam sheet`
      });
    }

    // Match student and web roster exactly as in main.jsx processSources
    const studentRecord = norm.valid ? sMap.map.get(norm.normalized) : null;
    const webRecord = norm.valid ? wMap.map.get(norm.normalized) : null;
    const isEnrolled = !!studentRecord || !!webRecord;

    // Check duplicate in Students sheet or Web Roll (same as main.jsx)
    if (norm.valid && sMap.duplicates.has(norm.normalized)) {
      issues.push({
        type: 'Duplicate roll',
        roll: norm.normalized,
        rowNumber: row._rowIndex || idx + 1,
        detail: 'Repeated exam roll in Students sheet'
      });
    }
    if (norm.valid && wMap.duplicates.has(norm.normalized)) {
      issues.push({
        type: 'Duplicate roll',
        roll: norm.normalized,
        rowNumber: row._rowIndex || idx + 1,
        detail: 'Repeated exam roll in Web Roll'
      });
    }

    // Flag Not in Students if roster is present but roll is not found (same as main.jsx)
    if (norm.valid && hasRoster && !isEnrolled) {
      issues.push({
        type: 'Not in Students',
        roll: norm.normalized,
        rowNumber: row._rowIndex || idx + 1,
        detail: `Row ${row._rowIndex || idx + 1}: No match in Students${sources.web ? ' or valid Web Roll' : ''}`
      });
    }
    
    // Extract name following exact priority: Web Roll > Students Sheet > OMR row Name
    const studentName = sourceValue(webRecord, sources.web, 'name') ||
                        sourceValue(studentRecord, sources.students, 'name') ||
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
        studentAns = '-';
        blankCount++;
      } else if (rawAns === 'INVALID' || rawAns === 'DOUBLE' || rawAns === 'MULTIPLE') {
        status = 'INVALID';
        studentAns = '!';
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

    // If roster is provided, flag and exclude rolls not in roster (exactly like main.jsx)
    if (hasRoster && !isEnrolled) {
      issues.push({
        type: 'Not in Students',
        roll: norm.valid ? norm.normalized : rawRoll,
        rowNumber: row._rowIndex || idx + 1,
        detail: `Row ${row._rowIndex || idx + 1}: No match in Students${sources.web ? ' or valid Web Roll' : ''} (Excluded from final result)`
      });
      return; // Exclude from final results list
    }

    results.push({
      _id: idx,
      roll: norm.valid ? norm.normalized : rawRoll,
      rawRoll,
      isValidRoll: norm.valid,
      isEnrolled,
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

  // Calculate comprehensive statistics
  const validResults = sorted.filter(r => r.isValidRoll);
  const scores = validResults.map(r => r.score).sort((a, b) => a - b);
  const totalScore = scores.reduce((acc, s) => acc + s, 0);
  const highest = scores.length ? scores[scores.length - 1] : 0;
  const lowest = scores.length ? scores[0] : 0;
  const average = scores.length ? (totalScore / scores.length).toFixed(1) : 0;
  const median = scores.length
    ? (scores.length % 2 === 0
        ? ((scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2).toFixed(1)
        : scores[Math.floor(scores.length / 2)])
    : 0;

  // Grade Breakdown
  const bracketA = validResults.filter(r => (r.score / numQuestions) >= 0.8).length; // 80%+
  const bracketB = validResults.filter(r => (r.score / numQuestions) >= 0.6 && (r.score / numQuestions) < 0.8).length; // 60-79%
  const bracketC = validResults.filter(r => (r.score / numQuestions) >= 0.4 && (r.score / numQuestions) < 0.6).length; // 40-59%
  const bracketFail = validResults.filter(r => (r.score / numQuestions) < 0.4).length; // < 40%

  // Question-by-question breakdown & hardest/easiest questions
  const questionAccuracy = {};
  let hardest = { q: 1, acc: 100 };
  let easiest = { q: 1, acc: 0 };

  for (let q = 1; q <= numQuestions; q++) {
    const cor = validResults.filter(r => r.answers?.[q]?.isCorrect).length;
    const acc = validResults.length ? Math.round((cor / validResults.length) * 100) : 0;
    questionAccuracy[q] = acc;
    if (acc < hardest.acc) hardest = { q, acc };
    if (acc > easiest.acc) easiest = { q, acc };
  }

  return {
    results: sorted,
    issues,
    stats: {
      total: omrData.rows.length,
      valid: validResults.length,
      excluded: issues.filter(i => i.type === 'Not in Students').length,
      invalid: issues.filter(i => i.type === 'Invalid Roll').length,
      highest,
      lowest,
      average,
      median,
      bracketA,
      bracketB,
      bracketC,
      bracketFail,
      hardest,
      easiest,
      questionAccuracy,
      totalQuestions: numQuestions
    }
  };
}
