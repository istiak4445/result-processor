import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { safeExportName } from '../exportName.js';
import { generateInfographicCanvas } from './omrInfograph.js';

export function exportOmrPdf({
  results = [],
  totalMcq = 30,
  examTitle = 'OMR Exam Result',
  fileName = 'OMR_Result',
  stats = {}
}) {
  if (!results.length) return;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // ~842 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // ~595 pt
  const margin = 12;
  const usableWidth = pageWidth - margin * 2; // ~818 pt

  // Base Left Columns
  const leftColWidths = {
    0: 22, // Rank
    1: 46, // Roll
    2: 70, // Name
    3: 28, // Score
    4: 16, // Correct
    5: 16, // Wrong
    6: 16, // Blank
    7: 25  // Accuracy %
  };

  const totalLeftWidth = Object.values(leftColWidths).reduce((a, b) => a + b, 0); // 239 pt
  const availableForMcq = usableWidth - totalLeftWidth;
  const mcqColWidth = Math.max(8, Math.floor((availableForMcq / totalMcq) * 10) / 10);

  // Column styles mapping
  const columnStyles = {
    0: { cellWidth: leftColWidths[0], halign: 'center' },
    1: { cellWidth: leftColWidths[1], halign: 'center' },
    2: { cellWidth: leftColWidths[2], halign: 'left' },
    3: { cellWidth: leftColWidths[3], halign: 'center', fontStyle: 'bold' },
    4: { cellWidth: leftColWidths[4], halign: 'center' },
    5: { cellWidth: leftColWidths[5], halign: 'center' },
    6: { cellWidth: leftColWidths[6], halign: 'center' },
    7: { cellWidth: leftColWidths[7], halign: 'center' }
  };

  // Add MCQ column widths
  for (let i = 0; i < totalMcq; i++) {
    columnStyles[8 + i] = {
      cellWidth: mcqColWidth,
      halign: 'center',
      cellPadding: 0.5
    };
  }

  // Construct Header row
  const headRow = [
    'Rank', 'Roll', 'Student Name', 'Score', '✓', '✗', '—', 'Acc%',
    ...Array.from({ length: totalMcq }, (_, i) => String(i + 1))
  ];

  // Construct Body rows
  const bodyRows = results.map(r => {
    const row = [
      String(r.rank ?? '—'),
      String(r.roll ?? ''),
      String(r.name && r.name !== '—' ? r.name : ''),
      `${r.score}/${totalMcq}`,
      String(r.correct ?? 0),
      String(r.wrong ?? 0),
      String(r.blank ?? 0),
      String(r.accuracy ?? '0%')
    ];

    // Add each question cell as a styled object for colored cell backgrounds
    for (let q = 1; q <= totalMcq; q++) {
      const ans = r.answers?.[q] || { studentAns: '—', status: 'BLANK' };
      
      let fillColor = [241, 245, 249]; // Soft Gray for blank
      let textColor = [148, 163, 184];

      if (ans.isCorrect) {
        fillColor = [220, 252, 231]; // Clean Soft Mint Green (#dcfce7)
        textColor = [22, 101, 52];   // Forest Green (#166534)
      } else if (ans.isWrong) {
        fillColor = [254, 165, 165]; // High-Contrast Rose/Red (#fca5a5) - instantly stands out
        textColor = [127, 29, 29];   // Deep Dark Crimson (#7f1d1d)
      } else if (ans.isInvalid) {
        fillColor = [254, 215, 170]; // Warning Amber Orange (#fed7aa)
        textColor = [154, 52, 18];
      }

      row.push({
        content: ans.studentAns || '—',
        styles: {
          fillColor,
          textColor,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 0.5
        }
      });
    }

    return row;
  });

function drawVectorDashboard(doc, { stats, totalMcq, titleText, margin, usableWidth, pageWidth }) {
  const startY = 10;

  // 1. Header Banner (h: 26)
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.roundedRect(margin, startY, usableWidth, 26, 3, 3, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(titleText, margin + 8, startY + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // #94a3b8
  doc.text('Performance Analytics & Detailed Response Breakdown', margin + 8, startY + 21);

  // Full Marks Pill on Right (No auto-date)
  const pillW = 75;
  const pillH = 16;
  const pillX = pageWidth - margin - pillW - 6;
  const pillY = startY + 5;
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(pillX, pillY, pillW, pillH, 8, 8, 'F');
  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(0.6);
  doc.roundedRect(pillX, pillY, pillW, pillH, 8, 8, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(56, 189, 248);
  doc.text(`Full Marks: ${totalMcq}`, pillX + pillW / 2, pillY + 11, { align: 'center' });

  // 2. Row of 4 Metric Cards (y: 40, h: 46)
  const cardY = 40;
  const cardH = 46;
  const cardGap = 8;
  const cardW = (usableWidth - cardGap * 3) / 4;

  const valid = stats.valid || 0;
  const highest = stats.highest ?? 0;
  const average = stats.average ?? 0;
  const median = stats.median ?? 0;
  const lowest = stats.lowest ?? 0;
  const highAcc = totalMcq > 0 ? Math.round((highest / totalMcq) * 100) : 0;
  const lowAcc = totalMcq > 0 ? Math.round((lowest / totalMcq) * 100) : 0;

  const kpis = [
    {
      title: 'TOTAL EXAMINEES',
      value: `${valid}`,
      unit: 'Students',
      sub: `${stats.total || valid} Total rows in sheet`,
      bg: [248, 250, 252],
      border: [203, 213, 225],
      accent: [100, 116, 139],
      valColor: [15, 23, 42]
    },
    {
      title: 'HIGHEST SCORE',
      value: `${highest}`,
      unit: `/ ${totalMcq}`,
      sub: `Accuracy: ${highAcc}%`,
      bg: [240, 253, 244],
      border: [134, 239, 172],
      accent: [22, 163, 74],
      valColor: [21, 128, 61]
    },
    {
      title: 'CLASS AVERAGE',
      value: `${average}`,
      unit: `/ ${totalMcq}`,
      sub: `Median Score: ${median} / ${totalMcq}`,
      bg: [239, 246, 255],
      border: [147, 197, 253],
      accent: [37, 99, 235],
      valColor: [29, 78, 216]
    },
    {
      title: 'LOWEST SCORE',
      value: `${lowest}`,
      unit: `/ ${totalMcq}`,
      sub: `Accuracy: ${lowAcc}%`,
      bg: [254, 242, 242],
      border: [252, 165, 165],
      accent: [220, 38, 38],
      valColor: [185, 28, 28]
    }
  ];

  kpis.forEach((kpi, i) => {
    const cx = margin + i * (cardW + cardGap);
    doc.setFillColor(...kpi.bg);
    doc.setDrawColor(...kpi.border);
    doc.setLineWidth(0.6);
    doc.roundedRect(cx, cardY, cardW, cardH, 3, 3, 'FD');

    // Accent top bar
    doc.setFillColor(...kpi.accent);
    doc.rect(cx + 1, cardY, cardW - 2, 2.5, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...kpi.accent);
    doc.text(kpi.title, cx + 7, cardY + 10);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...kpi.valColor);
    doc.text(kpi.value, cx + 7, cardY + 26);

    // Unit
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const valWidth = doc.getTextWidth(kpi.value);
    doc.text(kpi.unit, cx + 9 + valWidth, cardY + 25);

    // Subtitle
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.sub, cx + 7, cardY + 39);
  });

  // 3. Question Difficulty Strip (y: 90, h: 18)
  const diffY = 90;
  const diffH = 18;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(253, 230, 138);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, diffY, usableWidth, diffH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(146, 64, 14);
  doc.text('QUESTION INSIGHTS:', margin + 8, diffY + 11.5);

  // Easiest Pill
  const easyPillX = margin + 110;
  doc.setFillColor(220, 252, 231);
  doc.setDrawColor(134, 239, 172);
  doc.roundedRect(easyPillX, diffY + 2.5, 210, 13, 6, 6, 'FD');
  doc.setTextColor(21, 128, 61);
  doc.setFont('helvetica', 'bold');
  doc.text(`Easiest Question: Q${stats.easiest?.q || '—'}  (${stats.easiest?.acc || 0}% Correct)`, easyPillX + 10, diffY + 11);

  // Hardest Pill
  const hardPillX = easyPillX + 220;
  doc.setFillColor(254, 226, 226);
  doc.setDrawColor(252, 165, 165);
  doc.roundedRect(hardPillX, diffY + 2.5, 210, 13, 6, 6, 'FD');
  doc.setTextColor(185, 28, 28);
  doc.text(`Hardest Question: Q${stats.hardest?.q || '—'}  (${stats.hardest?.acc || 0}% Correct)`, hardPillX + 10, diffY + 11);

  // Overall Pass Rate on Right
  const passRate = valid > 0 ? Math.round(((valid - (stats.bracketFail || 0)) / valid) * 100) : 0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 53, 15);
  doc.text(`Overall Pass Rate: ${passRate}%`, pageWidth - margin - 8, diffY + 11.5, { align: 'right' });

  // 4. Score Distribution & Grade Brackets (y: 112, h: 48)
  const distY = 112;
  const distH = 48;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, distY, usableWidth, distH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text('SCORE DISTRIBUTION & PERFORMANCE BRACKETS:', margin + 8, distY + 9);

  const bracketA = stats.bracketA || 0;
  const bracketB = stats.bracketB || 0;
  const bracketC = stats.bracketC || 0;
  const bracketFail = stats.bracketFail || 0;
  const pctA = valid > 0 ? Math.round((bracketA / valid) * 100) : 0;
  const pctB = valid > 0 ? Math.round((bracketB / valid) * 100) : 0;
  const pctC = valid > 0 ? Math.round((bracketC / valid) * 100) : 0;
  const pctFail = valid > 0 ? Math.round((bracketFail / valid) * 100) : 0;

  const brackets = [
    { label: '80% - 100% (A+)', tag: 'Excellent', count: bracketA, pct: pctA, color: [22, 163, 74], track: [220, 252, 231] },
    { label: '60% - 79% (A/B)', tag: 'Good', count: bracketB, pct: pctB, color: [37, 99, 235], track: [219, 234, 254] },
    { label: '40% - 59% (Pass)', tag: 'Passed', count: bracketC, pct: pctC, color: [217, 119, 6], track: [254, 243, 199] },
    { label: '< 40% (Fail)', tag: 'Failed', count: bracketFail, pct: pctFail, color: [220, 38, 38], track: [254, 226, 226] }
  ];

  const bGap = 8;
  const bW = (usableWidth - 16 - bGap * 3) / 4;

  brackets.forEach((b, i) => {
    const bx = margin + 8 + i * (bW + bGap);
    const by = distY + 14;
    const bh = 28;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(bx, by, bW, bh, 2.5, 2.5, 'FD');

    // Dot + Label
    doc.setFillColor(...b.color);
    doc.circle(bx + 6, by + 7.5, 2.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(b.label, bx + 11, by + 9.5);

    // Count badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...b.color);
    doc.text(`${b.count} (${b.pct}%)`, bx + bW - 5, by + 9.5, { align: 'right' });

    // Progress bar track
    const barX = bx + 5;
    const barY = by + 14;
    const barW = bW - 10;
    const barH = 5.5;

    doc.setFillColor(...b.track);
    doc.roundedRect(barX, barY, barW, barH, 2, 2, 'F');

    // Filled portion
    const fillW = Math.max(b.pct > 0 ? 3 : 0, Math.round((barW * b.pct) / 100));
    if (fillW > 0) {
      doc.setFillColor(...b.color);
      doc.roundedRect(barX, barY, fillW, barH, 2, 2, 'F');
    }

    // Sub note
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Grade: ${b.tag}`, bx + 5, by + 24.5);
  });
}

  const titleText = examTitle || 'Examination Results & MCQ Breakdown';
  const startY = 168; // Table begins right below the vector dashboard

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin, top: 22, bottom: 24 },
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    styles: {
      fontSize: totalMcq > 35 ? 6 : 6.5,
      cellPadding: 1.2,
      halign: 'center',
      lineColor: [226, 232, 240],
      lineWidth: 0.4
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: totalMcq > 35 ? 6 : 6.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2
    },
    columnStyles,
    didDrawPage: data => {
      if (data.pageNumber === 1) {
        // Draw 100% Vector Crisp Dashboard (Zero pixelation / blurriness at any zoom)
        drawVectorDashboard(doc, {
          stats,
          totalMcq,
          titleText,
          margin,
          usableWidth,
          pageWidth
        });
      } else {
        // Subsequent pages: Sleek compact top banner to maximize rows per page
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`${titleText} · Results`, margin, 15);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Examinees: ${stats.valid || results.length} · Full Marks: ${totalMcq} · Highest: ${stats.highest ?? '—'} · Average: ${stats.average ?? '—'}`,
          pageWidth - margin - 220,
          15
        );
      }

      // Footer Banner on all pages
      const pageStr = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Color Legend: [Green: Correct]  [Red: Wrong]  [Gray: Blank -]  [Orange: Invalid !]  ·  Searchable Vector PDF (Ctrl+F to search)',
        margin,
        pageHeight - 10
      );
      doc.text(pageStr, pageWidth - margin - 35, pageHeight - 10);
    }
  });

  const exportName = safeExportName(fileName || titleText);
  doc.save(`${exportName} - Detailed Answer Breakdown.pdf`);
}

export function exportOmrXlsx({
  results = [],
  totalMcq = 30,
  examTitle = 'OMR Result',
  fileName = 'OMR_Result',
  issues = [],
  stats = {}
}) {
  const wb = XLSX.utils.book_new();

  // 1. Executive Summary & Analytics Sheet
  const analyticsRows = [
    { Metric: 'Exam Title', Value: examTitle },
    { Metric: 'Total Questions (Full Marks)', Value: totalMcq },
    { Metric: 'Total Processed Examinees', Value: stats.valid || results.length },
    { Metric: 'Highest Score', Value: `${stats.highest ?? 0} / ${totalMcq}` },
    { Metric: 'Average Score', Value: stats.average ?? 0 },
    { Metric: 'Median Score', Value: stats.median ?? 0 },
    { Metric: 'Lowest Score', Value: `${stats.lowest ?? 0} / ${totalMcq}` },
    { Metric: '', Value: '' },
    { Metric: '--- SCORE DISTRIBUTION ---', Value: '' },
    { Metric: '80% - 100% (A+ / Excellent)', Value: stats.bracketA ?? 0 },
    { Metric: '60% - 79% (A/B / Good)', Value: stats.bracketB ?? 0 },
    { Metric: '40% - 59% (Pass)', Value: stats.bracketC ?? 0 },
    { Metric: '< 40% (Fail)', Value: stats.bracketFail ?? 0 },
    { Metric: '', Value: '' },
    { Metric: '--- QUESTION DIFFICULTY ---', Value: '' },
    { Metric: 'Easiest Question', Value: `Q${stats.easiest?.q || '—'} (${stats.easiest?.acc || 0}% correct)` },
    { Metric: 'Hardest Question', Value: `Q${stats.hardest?.q || '—'} (${stats.hardest?.acc || 0}% correct)` }
  ];

  if (stats.questionAccuracy) {
    analyticsRows.push({ Metric: '', Value: '' });
    analyticsRows.push({ Metric: '--- QUESTION-BY-QUESTION SUCCESS RATE ---', Value: '' });
    for (let q = 1; q <= totalMcq; q++) {
      analyticsRows.push({ Metric: `Question ${q}`, Value: `${stats.questionAccuracy[q] || 0}% correct` });
    }
  }

  const wsAnalytics = XLSX.utils.json_to_sheet(analyticsRows);
  wsAnalytics['!cols'] = [{ wch: 38 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, wsAnalytics, 'Exam Analytics');

  // 2. Detailed MCQ Breakdown Sheet
  const detailedData = results.map(r => {
    const row = {
      Rank: r.rank ?? '',
      Roll: r.roll ?? '',
      'Student Name': r.name && r.name !== '—' ? r.name : '',
      Score: r.score ?? 0,
      'Total Marks': totalMcq,
      Correct: r.correct ?? 0,
      Wrong: r.wrong ?? 0,
      Blank: r.blank ?? 0,
      'Accuracy %': r.accuracy ?? '0%'
    };

    for (let q = 1; q <= totalMcq; q++) {
      const ans = r.answers?.[q] || { studentAns: '-' };
      row[`Q${q}`] = ans.studentAns;
    }
    return row;
  });

  const wsDetailed = XLSX.utils.json_to_sheet(detailedData);

  // Set column widths for Sheet 2
  const colWidths = [
    { wch: 6 },  // Rank
    { wch: 12 }, // Roll
    { wch: 22 }, // Name
    { wch: 8 },  // Score
    { wch: 11 }, // Total Marks
    { wch: 8 },  // Correct
    { wch: 8 },  // Wrong
    { wch: 8 },  // Blank
    { wch: 11 }, // Accuracy %
  ];
  const qWidth = Math.max(4, Math.floor(120 / totalMcq));
  for (let i = 0; i < totalMcq; i++) {
    colWidths.push({ wch: qWidth });
  }
  wsDetailed['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, wsDetailed, 'MCQ Breakdown');

  // 3. Merit Summary Sheet
  const meritData = results.map(r => ({
    Rank: r.rank ?? '',
    Roll: r.roll ?? '',
    'Student Name': r.name && r.name !== '—' ? r.name : '',
    Score: r.score ?? 0,
    'Total Marks': totalMcq,
    Correct: r.correct ?? 0,
    Wrong: r.wrong ?? 0,
    Blank: r.blank ?? 0,
    'Accuracy %': r.accuracy ?? '0%'
  }));
  const wsMerit = XLSX.utils.json_to_sheet(meritData);
  wsMerit['!cols'] = colWidths.slice(0, 9);
  XLSX.utils.book_append_sheet(wb, wsMerit, 'Merit List');

  // 4. Audit Issues Sheet (if any)
  if (issues && issues.length > 0) {
    const wsIssues = XLSX.utils.json_to_sheet(issues);
    XLSX.utils.book_append_sheet(wb, wsIssues, 'Audit Issues');
  }

  const exportName = safeExportName(fileName || examTitle);
  XLSX.writeFile(wb, `${exportName} - Detailed Answer Breakdown.xlsx`);
}
