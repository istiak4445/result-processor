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

  const titleText = examTitle || 'Examination Results & MCQ Breakdown';

  // Generate visual infographic dashboard canvas for Page 1 (No auto-date)
  let infographicDataUrl = null;
  const canvas = generateInfographicCanvas({
    stats,
    totalMcq,
    examTitle: titleText
  });
  if (canvas) {
    try {
      infographicDataUrl = canvas.toDataURL('image/png', 0.95);
    } catch (e) {
      console.warn('Could not generate canvas data URL:', e);
    }
  }

  const startY = infographicDataUrl ? 232 : 46;

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
      if (data.pageNumber === 1 && infographicDataUrl) {
        // Draw the HD Infographic Dashboard covering top of page 1 (~215 pt height)
        doc.addImage(infographicDataUrl, 'PNG', margin, 10, usableWidth, 215, undefined, 'FAST');
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
  doc.save(`${exportName} - Searchable Result.pdf`);
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
  XLSX.writeFile(wb, `${exportName} - Student Ready.xlsx`);
}
