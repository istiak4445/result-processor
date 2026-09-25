import { jsPDF } from 'jspdf';

const FONT_NAME = 'Kalpurush';
let fontBinary;

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function loadKalpurush(pdf) {
  if (!fontBinary) {
    const response = await fetch('/fonts/kalpurush.ttf');
    if (!response.ok) throw new Error('Kalpurush font could not be loaded. Please refresh and try again.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    const chunks = [];
    for (let index = 0; index < bytes.length; index += 0x8000) {
      chunks.push(String.fromCharCode(...bytes.subarray(index, index + 0x8000)));
    }
    fontBinary = chunks.join('');
  }
  pdf.addFileToVFS('kalpurush.ttf', fontBinary);
  pdf.addFont('kalpurush.ttf', FONT_NAME, 'normal');
  pdf.setFont(FONT_NAME, 'normal');
}

function extractTable(node) {
  const table = node?.querySelector('table');
  if (!table) return { headers: [], rows: [] };
  const headers = [...table.querySelectorAll('thead th')].map((cell) => clean(cell.textContent));
  const rows = [...table.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => clean(cell.textContent)),
  );
  return { headers, rows };
}

function columnWeight(header) {
  const key = clean(header).toLowerCase();
  if (/name|নাম/.test(key)) return 2.25;
  if (/college|institution|school|কলেজ|প্রতিষ্ঠান/.test(key)) return 2.15;
  if (/roll|রোল/.test(key)) return 0.9;
  if (/mark|score|মার্ক/.test(key)) return 0.9;
  if (/grade|position|rank|গ্রেড|স্থান/.test(key)) return 0.85;
  return 1.25;
}

function fitLines(pdf, value, width, fontSize, maxLines = 2) {
  const text = clean(value) || '—';
  let size = fontSize;
  let lines = pdf.splitTextToSize(text, width);
  while (lines.length > maxLines && size > fontSize * 0.72) {
    size -= 0.6;
    pdf.setFontSize(size);
    lines = pdf.splitTextToSize(text, width);
  }
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (pdf.getTextWidth(`${last}…`) > width && last.length > 2) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trim()}…`;
  }
  return { lines, size };
}

function centeredLines(pdf, lines, x, y, lineHeight) {
  lines.forEach((line, index) => pdf.text(line, x, y + index * lineHeight, { align: 'center' }));
}

function drawPage(pdf, node, size, brand, pageNumber, pageCount) {
  const { width, height } = size;
  const scale = Math.min(width, height) / 1080;
  const u = (value) => value * scale;
  const margin = u(62);
  const contentWidth = width - margin * 2;
  const navy = [10, 31, 55];
  const navySoft = [21, 52, 79];
  const gold = [235, 181, 67];
  const ivory = [249, 247, 240];
  const ink = [18, 35, 51];
  const muted = [91, 107, 121];
  const institute = clean(brand.institute) || 'ChemShifu';
  const documentTitle = clean(brand.title) || 'Examination Result';
  const subtitle = clean(brand.subtitle);
  const meta = [brand.batch, brand.exam, brand.date].map(clean).filter(Boolean);
  const { headers, rows } = extractTable(node);

  pdf.setFillColor(...ivory);
  pdf.rect(0, 0, width, height, 'F');

  const headerY = u(42);
  const headerH = u(238);
  pdf.setFillColor(...navy);
  pdf.roundedRect(margin, headerY, contentWidth, headerH, u(24), u(24), 'F');
  pdf.setFillColor(...gold);
  pdf.roundedRect(margin, headerY, u(12), headerH, u(6), u(6), 'F');

  pdf.setTextColor(...gold);
  pdf.setFontSize(u(21));
  pdf.text(institute.toUpperCase(), margin + u(40), headerY + u(49));

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(u(43));
  const titleLines = pdf.splitTextToSize(documentTitle, contentWidth - u(80)).slice(0, 2);
  centeredLines(pdf, titleLines, width / 2, headerY + u(103), u(43));

  if (subtitle) {
    pdf.setTextColor(220, 228, 234);
    pdf.setFontSize(u(18));
    pdf.text(subtitle, width / 2, headerY + u(182), { align: 'center', maxWidth: contentWidth - u(100) });
  }
  if (meta.length) {
    pdf.setTextColor(...gold);
    pdf.setFontSize(u(16));
    pdf.text(meta.join('  •  '), width / 2, headerY + u(214), { align: 'center', maxWidth: contentWidth - u(90) });
  }

  const tableY = headerY + headerH + u(31);
  const footerH = u(54);
  const footerY = height - margin - footerH;
  const availableH = footerY - tableY - u(24);
  const headH = u(58);
  const rowH = Math.min(u(57), Math.max(u(37), (availableH - headH) / Math.max(rows.length, 1)));
  const weights = headers.map(columnWeight);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  const widths = weights.map((value) => (contentWidth * value) / totalWeight);

  pdf.setFillColor(...gold);
  pdf.roundedRect(margin, tableY, contentWidth, headH, u(12), u(12), 'F');
  pdf.rect(margin, tableY + headH / 2, contentWidth, headH / 2, 'F');
  pdf.setTextColor(...ink);
  pdf.setFontSize(u(17));
  let x = margin;
  headers.forEach((header, index) => {
    const align = index === 0 || /college|institution|school|নাম|কলেজ|প্রতিষ্ঠান/i.test(header) ? 'left' : 'center';
    const textX = align === 'left' ? x + u(14) : x + widths[index] / 2;
    pdf.text(header || `Column ${index + 1}`, textX, tableY + u(36), { align, maxWidth: widths[index] - u(20) });
    x += widths[index];
  });

  rows.forEach((row, rowIndex) => {
    const y = tableY + headH + rowIndex * rowH;
    const highlighted = rowIndex < 3 && pageNumber === 1;
    pdf.setFillColor(...(highlighted ? [255, 249, 227] : rowIndex % 2 ? [239, 243, 246] : [255, 255, 255]));
    pdf.rect(margin, y, contentWidth, rowH, 'F');
    pdf.setDrawColor(215, 222, 226);
    pdf.setLineWidth(u(0.8));
    pdf.line(margin, y + rowH, margin + contentWidth, y + rowH);
    pdf.setTextColor(...ink);
    x = margin;
    row.forEach((cell, index) => {
      if (!widths[index]) return;
      const align = index === 0 || /college|institution|school|নাম|কলেজ|প্রতিষ্ঠান/i.test(headers[index]) ? 'left' : 'center';
      const textX = align === 'left' ? x + u(14) : x + widths[index] / 2;
      const fitted = fitLines(pdf, cell, widths[index] - u(24), u(16), rowH >= u(48) ? 2 : 1);
      pdf.setFontSize(fitted.size);
      const lineH = fitted.size * 1.05;
      const startY = y + (rowH - fitted.lines.length * lineH) / 2 + fitted.size * 0.84;
      fitted.lines.forEach((line, lineIndex) => pdf.text(line, textX, startY + lineIndex * lineH, { align }));
      x += widths[index];
    });
  });

  pdf.setFillColor(...navySoft);
  pdf.roundedRect(margin, footerY, contentWidth, footerH, u(13), u(13), 'F');
  pdf.setTextColor(...gold);
  pdf.setFontSize(u(15));
  pdf.text(institute, margin + u(20), footerY + u(34));
  pdf.setTextColor(224, 232, 238);
  pdf.text(`Page ${pageNumber} of ${pageCount}`, width - margin - u(20), footerY + u(34), { align: 'right' });
}

// Dedicated vector layout: searchable text, embedded Bengali font, and no raster page image.
export async function downloadCardPdf(nodes, size, title, options = {}) {
  await document.fonts.ready;
  const orientation = size.width > size.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ unit: 'pt', format: [size.width, size.height], orientation, compress: true, putOnlyUsedFonts: true });
  await loadKalpurush(pdf);
  pdf.setProperties({ title, subject: 'Searchable examination results', creator: 'ChemShifu ResultFlow' });
  for (let pageIndex = 0; pageIndex < nodes.length; pageIndex += 1) {
    if (!nodes[pageIndex]) throw new Error('Result preview is not ready. Please try again.');
    if (pageIndex) pdf.addPage([size.width, size.height], orientation);
    pdf.setFont(FONT_NAME, 'normal');
    drawPage(pdf, nodes[pageIndex], size, options.brand || {}, pageIndex + 1, nodes.length);
  }
  pdf.save(`${(title || 'Final Result').replace(/[\\/:*?"<>|]/g, '-')}.pdf`);
}
