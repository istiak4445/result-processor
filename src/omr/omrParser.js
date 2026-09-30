// Answer Key Parser & OMR File Matrix Parser
// Parses answer keys in formats like:
// "28 offline\n1. B\n2. B\n...30. B" or "1: B", "1) B", "1 B", "B, B, C...", or continuous string "BBCB..."

export function parseAnswerKey(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { keyMap: {}, totalQuestions: 0, text: '' };
  }

  const lines = rawText.split('\n');
  const keyMap = {};
  let maxQ = 0;

  // Regex pattern matching: "1. B" or "1: B" or "1) B" or "1 - B" or "1 B"
  const numberedPattern = /^\s*(\d+)\s*[\.\:\)\-\s]\s*([A-Da-d])\s*$/;
  let matchedNumbered = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(numberedPattern);
    if (match) {
      matchedNumbered = true;
      const qNum = parseInt(match[1], 10);
      const opt = match[2].toUpperCase();
      keyMap[qNum] = opt;
      if (qNum > maxQ) maxQ = qNum;
    }
  }

  // Fallback: If not formatted with question numbers, check if comma/space separated or continuous letters
  if (!matchedNumbered) {
    // Clean text of non-alpha characters except commas and spaces
    const tokens = rawText
      .replace(/offline|online|exam|set|key|ans|answer/gi, '')
      .replace(/[^A-Za-z]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 0);

    let q = 1;
    for (const token of tokens) {
      if (token.length === 1 && /^[A-Da-d]$/.test(token)) {
        keyMap[q] = token.toUpperCase();
        maxQ = q;
        q++;
      } else if (/^[A-Da-d]+$/.test(token)) {
        for (const char of token) {
          keyMap[q] = char.toUpperCase();
          maxQ = q;
          q++;
        }
      }
    }
  }

  return { keyMap, totalQuestions: maxQ, text: rawText };
}

export function autoDetectAnswerKey(omrRows, questionColumns) {
  if (!omrRows || !omrRows.length || !questionColumns || !questionColumns.length) {
    return null;
  }

  const numQ = questionColumns.length;

  const getAns = (row, col) => {
    const val = String(row[col] ?? '').trim().toUpperCase();
    return /^[A-D]$/.test(val) ? val : '';
  };

  // Strategy 1: Check for explicit "Answer Key" or "Master" row
  const masterRow = omrRows.find(r => {
    const roll = String(r['Roll Number'] || r.Roll || r.roll || '').trim().toLowerCase();
    const name = String(r['Student Name'] || r.Name || r.name || '').trim().toLowerCase();
    return /key|master|answer|correct|template|^0+$/.test(roll) || /key|master|answer|correct|template/.test(name);
  });

  if (masterRow) {
    const keyMap = {};
    let count = 0;
    questionColumns.forEach((qCol, idx) => {
      const qNum = idx + 1;
      const ans = getAns(masterRow, qCol);
      if (ans) {
        keyMap[qNum] = ans;
        count++;
      }
    });
    if (count >= Math.min(5, numQ)) {
      return { keyMap, totalQuestions: count, method: 'Master Key Row', detectedFromRoll: masterRow['Roll Number'] || masterRow.Roll || 'Key' };
    }
  }

  // Helper to extract score / correct count
  const getScoreInfo = (r) => {
    let score = -1;
    let correct = -1;
    let wrong = 0;

    for (const [k, v] of Object.entries(r)) {
      if (k.startsWith('_')) continue;
      const lower = k.toLowerCase().trim();
      const num = Number(v);
      if (Number.isFinite(num)) {
        if (/^(score|marks?|total|total marks|obtained)$/.test(lower) && score === -1) {
          score = num;
        } else if (/^(correct|right)$/.test(lower) && correct === -1) {
          correct = num;
        } else if (/^(wrong|incorrect)$/.test(lower)) {
          wrong = num;
        }
      }
    }

    if (correct === -1 && score !== -1 && score <= numQ) correct = score;
    if (score === -1 && correct !== -1) score = correct;

    return { score, correct, wrong };
  };

  // Strategy 2: Look for 100% perfect scorer
  const perfect = omrRows.find(r => {
    const { score, correct, wrong } = getScoreInfo(r);
    return (correct === numQ && wrong === 0) || (score === numQ && wrong === 0);
  });

  if (perfect) {
    const keyMap = {};
    questionColumns.forEach((qCol, idx) => {
      const qNum = idx + 1;
      const ans = getAns(perfect, qCol);
      if (ans) keyMap[qNum] = ans;
    });
    if (Object.keys(keyMap).length > 0) {
      const roll = perfect['Roll Number'] || perfect.Roll || perfect.roll || 'Perfect Scorer';
      return { keyMap, totalQuestions: Object.keys(keyMap).length, method: '100% Scorer', detectedFromRoll: roll };
    }
  }

  // Strategy 3: Find highest scorers and use consensus among top performers
  const scoredRows = omrRows
    .map(r => ({ row: r, ...getScoreInfo(r) }))
    .filter(item => item.correct > 0 || item.score > 0)
    .sort((a, b) => Math.max(b.correct, b.score) - Math.max(a.correct, a.score));

  if (scoredRows.length > 0) {
    const topScorer = scoredRows[0];
    const topScore = Math.max(topScorer.correct, topScorer.score);

    if (topScore >= Math.floor(numQ * 0.5)) {
      const topCohort = scoredRows.filter(s => Math.max(s.correct, s.score) >= topScore - 2);
      const keyMap = {};

      questionColumns.forEach((qCol, idx) => {
        const qNum = idx + 1;
        const votes = { A: 0, B: 0, C: 0, D: 0 };
        topCohort.forEach(({ row }) => {
          const ans = getAns(row, qCol);
          if (ans && votes[ans] !== undefined) {
            votes[ans]++;
          }
        });
        let bestAns = '';
        let maxVotes = 0;
        for (const [ans, count] of Object.entries(votes)) {
          if (count > maxVotes) {
            maxVotes = count;
            bestAns = ans;
          }
        }
        if (bestAns) {
          keyMap[qNum] = bestAns;
        } else {
          const topAns = getAns(topScorer.row, qCol);
          if (topAns) keyMap[qNum] = topAns;
        }
      });

      if (Object.keys(keyMap).length > 0) {
        const roll = topScorer.row['Roll Number'] || topScorer.row.Roll || topScorer.row.roll;
        return {
          keyMap,
          totalQuestions: Object.keys(keyMap).length,
          method: topScore === numQ ? '100% Scorer' : `Top Scorer (Score: ${topScore}/${numQ})`,
          detectedFromRoll: roll || 'Top Scorer'
        };
      }
    }
  }

  // Strategy 4: Universal Consensus Voting
  const keyMap = {};
  questionColumns.forEach((qCol, idx) => {
    const qNum = idx + 1;
    const votes = { A: 0, B: 0, C: 0, D: 0 };
    omrRows.forEach(row => {
      const ans = getAns(row, qCol);
      if (ans && votes[ans] !== undefined) votes[ans]++;
    });
    let bestAns = '';
    let maxVotes = 0;
    for (const [ans, count] of Object.entries(votes)) {
      if (count > maxVotes) {
        maxVotes = count;
        bestAns = ans;
      }
    }
    if (bestAns && maxVotes > 0) {
      keyMap[qNum] = bestAns;
    }
  });

  if (Object.keys(keyMap).length >= Math.min(5, numQ)) {
    return {
      keyMap,
      totalQuestions: Object.keys(keyMap).length,
      method: 'Majority Response Consensus',
      detectedFromRoll: 'Class Consensus'
    };
  }

  return null;
}

export function parseOmrMatrix(matrix, fileName = 'OMR Sheet') {
  if (!matrix || !matrix.length) {
    return { examTitle: '', headers: [], rows: [], questionColumns: [] };
  }

  let examTitle = '';
  let headerIndex = -1;

  // Search first 10 rows for the header row containing 'roll' and 'score'
  for (let i = 0; i < Math.min(10, matrix.length); i++) {
    const row = matrix[i] || [];
    const normalized = row.map(c => String(c ?? '').trim().toLowerCase());
    
    // Check if row 0 has a title like '27 Exam 9 - Results'
    if (i === 0 && row[0] && String(row[0]).trim() && !normalized.includes('score')) {
      examTitle = String(row[0]).replace(/,/g, '').trim();
    }

    const hasRoll = normalized.some(c => c.includes('roll'));
    const hasScore = normalized.some(c => c.includes('score') || c.includes('correct'));

    if (hasRoll && hasScore) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    // Fallback: look for row with Q1, Q2
    headerIndex = matrix.findIndex(row => (row || []).some(c => /^q\d+$/i.test(String(c).trim())));
  }

  if (headerIndex === -1) {
    headerIndex = 0;
  }

  const rawHeaders = (matrix[headerIndex] || []).map(c => String(c ?? '').trim());
  const questionColumns = rawHeaders.filter(h => /^q\d+$/i.test(h)).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  const rawRows = matrix.slice(headerIndex + 1);
  const rows = [];

  rawRows.forEach((r, idx) => {
    if (!r || !r.some(cell => String(cell ?? '').trim() !== '')) return;
    const rowObj = { _rowIndex: headerIndex + idx + 2 };
    rawHeaders.forEach((h, colIdx) => {
      rowObj[h] = r[colIdx] !== undefined ? String(r[colIdx] ?? '').trim() : '';
    });
    rows.push(rowObj);
  });

  if (!examTitle && fileName) {
    examTitle = fileName.replace(/\.(xlsx?|csv)$/i, '').replace(/[_-]+/g, ' ').trim();
  }

  return { examTitle, headers: rawHeaders, rows, questionColumns };
}
