// Renders an executive-level visual infographic dashboard for OMR exam results
// Works in browser canvas to produce crystal-clear HD images with full Bengali font support + English digits

function roundRect(ctx, x, y, width, height, radius) {
  if (typeof radius === 'number') {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  } else {
    radius = Object.assign({ tl: 0, tr: 0, br: 0, bl: 0 }, radius);
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
}

export function generateInfographicCanvas({
  stats = {},
  totalMcq = 30,
  examTitle = 'OMR Exam Result',
  dateStr = ''
}) {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  // High-DPI canvas (width: 1640px, height: 340px)
  canvas.width = 1640;
  canvas.height = 340;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const valid = stats.valid || 1;
  const highest = stats.highest ?? 0;
  const average = stats.average ?? 0;
  const median = stats.median ?? 0;
  const lowest = stats.lowest ?? 0;
  const bracketA = stats.bracketA || 0;
  const bracketB = stats.bracketB || 0;
  const bracketC = stats.bracketC || 0;
  const bracketFail = stats.bracketFail || 0;
  const displayDate = dateStr || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Font family with Bengali fallback
  const fontBase = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hind Siliguri', 'Noto Sans Bengali', Arial, sans-serif";

  // Background Outer Card
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 0, 0, 1640, 340, 12);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 1. Top Header Banner
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, 0, 0, 1640, 64, { tl: 12, tr: 12, br: 0, bl: 0 });
  ctx.fill();

  // Title text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px ${fontBase}`;
  ctx.fillText(examTitle || 'OMR Exam Result', 24, 38);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `13px ${fontBase}`;
  ctx.fillText('ওএমআর মূল্যায়ন ও সার্বিক ফলাফল বিশ্লেষণ (OMR Performance Analytics)', 24, 55);

  // Right Date and Full Marks Pills
  const marksPillText = `পূর্ণমান: ${totalMcq}`;
  const datePillText = `তারিখ: ${displayDate}`;

  // Date Pill
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, 1430, 18, 185, 30, 15);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `12.5px ${fontBase}`;
  ctx.textAlign = 'center';
  ctx.fillText(datePillText, 1522, 38);

  // Marks Pill
  roundRect(ctx, 1290, 18, 125, 30, 15);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold 12.5px ${fontBase}`;
  ctx.fillText(marksPillText, 1352, 38);
  ctx.textAlign = 'left';

  // 2. Middle Row: 5 Metric Cards (x: 20 to 1620, width: 1600 / 5 = 308 each + gap 15)
  const cards = [
    {
      title: 'মোট পরীক্ষার্থী',
      value: `${stats.valid || 0}`,
      unit: 'জন',
      sub: `ফাইলে মোট সারি: ${stats.total || 0} টি`,
      bg: '#f8fafc',
      border: '#e2e8f0',
      accent: '#64748b',
      valColor: '#0f172a'
    },
    {
      title: 'সর্বোচ্চ নম্বর',
      value: `${highest}`,
      unit: `/ ${totalMcq}`,
      sub: `সঠিকতা: ${Math.round((highest / totalMcq) * 100)}%`,
      bg: '#f0fdf4',
      border: '#bbf7d0',
      accent: '#16a34a',
      valColor: '#15803d'
    },
    {
      title: 'গড় নম্বর (Average)',
      value: `${average}`,
      unit: `/ ${totalMcq}`,
      sub: `মধ্যমা (Median): ${median}`,
      bg: '#eff6ff',
      border: '#bfdbfe',
      accent: '#2563eb',
      valColor: '#1d4ed8'
    },
    {
      title: 'সর্বনিম্ন নম্বর',
      value: `${lowest}`,
      unit: `/ ${totalMcq}`,
      sub: `সঠিকতা: ${Math.round((lowest / totalMcq) * 100)}%`,
      bg: '#fef2f2',
      border: '#fecaca',
      accent: '#dc2626',
      valColor: '#b91c1c'
    },
    {
      title: 'কঠিন ও সহজ প্রশ্ন',
      custom: true,
      bg: '#fffbeb',
      border: '#fde68a',
      accent: '#d97706'
    }
  ];

  const cardY = 76;
  const cardH = 92;
  const cardW = 308;
  const gap = 15;

  cards.forEach((card, idx) => {
    const x = 20 + idx * (cardW + gap);
    ctx.fillStyle = card.bg;
    roundRect(ctx, x, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.strokeStyle = card.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Accent top strip
    ctx.fillStyle = card.accent;
    roundRect(ctx, x, cardY, cardW, 4, { tl: 8, tr: 8, br: 0, bl: 0 });
    ctx.fill();

    if (card.custom) {
      // Difficulty Card
      ctx.fillStyle = '#92400e';
      ctx.font = `bold 12px ${fontBase}`;
      ctx.fillText('প্রশ্নের কাঠিন্যতা ও সহজতা', x + 14, cardY + 22);

      // Easiest
      ctx.fillStyle = '#16a34a';
      ctx.font = `bold 13px ${fontBase}`;
      ctx.fillText(`সবচেয়ে সহজ: Q${stats.easiest?.q || '—'}`, x + 14, cardY + 46);
      ctx.font = `11.5px ${fontBase}`;
      ctx.fillText(`(${stats.easiest?.acc || 0}% সঠিক উত্তর)`, x + 175, cardY + 46);

      // Hardest
      ctx.fillStyle = '#dc2626';
      ctx.font = `bold 13px ${fontBase}`;
      ctx.fillText(`সবচেয়ে কঠিন: Q${stats.hardest?.q || '—'}`, x + 14, cardY + 70);
      ctx.font = `11.5px ${fontBase}`;
      ctx.fillText(`(${stats.hardest?.acc || 0}% সঠিক উত্তর)`, x + 175, cardY + 70);
    } else {
      // Standard Metric Card
      ctx.fillStyle = card.accent;
      ctx.font = `500 12.5px ${fontBase}`;
      ctx.fillText(card.title, x + 14, cardY + 24);

      // Value
      ctx.fillStyle = card.valColor;
      ctx.font = `bold 26px ${fontBase}`;
      ctx.fillText(card.value, x + 14, cardY + 58);

      // Unit
      if (card.unit) {
        ctx.fillStyle = '#64748b';
        ctx.font = `600 14px ${fontBase}`;
        const valWidth = ctx.measureText(card.value).width;
        ctx.fillText(card.unit, x + 18 + valWidth, cardY + 57);
      }

      // Subtitle
      ctx.fillStyle = '#64748b';
      ctx.font = `11.5px ${fontBase}`;
      ctx.fillText(card.sub, x + 14, cardY + 78);
    }
  });

  // 3. Bottom Section: Visual Score Distribution Bar Charts
  const distY = 180;
  const distH = 146;
  const distW = 1600;
  const distX = 20;

  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, distX, distY, distW, distH, 8);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Section Title
  ctx.fillStyle = '#1e293b';
  ctx.font = `bold 13.5px ${fontBase}`;
  ctx.fillText('নম্বর ভিত্তিক গ্রেড বণ্টন ও পারফরম্যান্স বিশ্লেষণ (Score Distribution & Grade Brackets):', distX + 16, distY + 24);

  // 4 Brackets side by side: each width = (1600 - 32 - 45) / 4 = ~374 px
  const bWidth = 374;
  const bGap = 15;
  const brackets = [
    {
      label: '80% - 100% (A+)',
      tag: 'মেধাবী',
      count: bracketA,
      pct: valid > 0 ? Math.round((bracketA / valid) * 100) : 0,
      color: '#16a34a',
      trackBg: '#dcfce7'
    },
    {
      label: '60% - 79% (A/B)',
      tag: 'উন্নত',
      count: bracketB,
      pct: valid > 0 ? Math.round((bracketB / valid) * 100) : 0,
      color: '#2563eb',
      trackBg: '#dbeafe'
    },
    {
      label: '40% - 59% (উত্তীর্ণ)',
      tag: 'পাস',
      count: bracketC,
      pct: valid > 0 ? Math.round((bracketC / valid) * 100) : 0,
      color: '#d97706',
      trackBg: '#fef3c7'
    },
    {
      label: '< 40% (অনুত্তীর্ণ)',
      tag: 'ফেল',
      count: bracketFail,
      pct: valid > 0 ? Math.round((bracketFail / valid) * 100) : 0,
      color: '#dc2626',
      trackBg: '#fee2e2'
    }
  ];

  brackets.forEach((b, i) => {
    const bx = distX + 16 + i * (bWidth + bGap);
    const by = distY + 42;

    // Inner card background
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, bx, by, bWidth, 88, 6);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Color dot + Bracket title
    ctx.fillStyle = b.color;
    roundRect(ctx, bx + 12, by + 14, 10, 10, 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 13px ${fontBase}`;
    ctx.fillText(b.label, bx + 28, by + 23);

    // Count + Percentage badge
    ctx.textAlign = 'right';
    ctx.fillStyle = b.color;
    ctx.font = `bold 14px ${fontBase}`;
    ctx.fillText(`${b.count} জন (${b.pct}%)`, bx + bWidth - 12, by + 23);
    ctx.textAlign = 'left';

    // Horizontal Progress Bar Track
    const barX = bx + 12;
    const barY = by + 40;
    const barW = bWidth - 24;
    const barH = 16;

    ctx.fillStyle = b.trackBg;
    roundRect(ctx, barX, barY, barW, barH, 8);
    ctx.fill();

    // Filled portion
    const fillWidth = Math.max(b.pct > 0 ? 12 : 0, Math.round((barW * b.pct) / 100));
    if (fillWidth > 0) {
      ctx.fillStyle = b.color;
      roundRect(ctx, barX, barY, fillWidth, barH, 8);
      ctx.fill();
    }

    // Bottom note / badge
    ctx.fillStyle = '#64748b';
    ctx.font = `11px ${fontBase}`;
    ctx.fillText(`গ্রেড স্তর: ${b.tag}`, bx + 12, by + 74);
    ctx.textAlign = 'right';
    ctx.fillText(`অনুপাত: ${b.pct}%`, bx + bWidth - 12, by + 74);
    ctx.textAlign = 'left';
  });

  return canvas;
}

export function downloadInfographicImage(canvas, fileName = 'OMR_Exam_Analytics_Graph') {
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `${fileName}.png`;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
}
