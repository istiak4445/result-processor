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
  // If there are students with full marks, or find the highest scoring student
  if (!omrRows || !omrRows.length || !questionColumns || !questionColumns.length) {
    return null;
  }

  const perfect = omrRows.find(r => {
    const score = Number(r.Score ?? r.score);
    const correct = Number(r.Correct ?? r.correct);
    const wrong = Number(r.Wrong ?? r.wrong);
    return Number.isFinite(score) && correct === questionColumns.length && wrong === 0;
  });

  if (perfect) {
    const keyMap = {};
    questionColumns.forEach((qCol, idx) => {
      const qNum = idx + 1;
      const ans = String(perfect[qCol] ?? '').trim().toUpperCase();
      if (/^[A-D]$/.test(ans)) {
        keyMap[qNum] = ans;
      }
    });
    return { keyMap, totalQuestions: questionColumns.length, detectedFromRoll: perfect['Roll Number'] || perfect.roll };
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
