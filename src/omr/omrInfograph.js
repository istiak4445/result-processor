// Executive Visual Infographic Dashboard for OMR Exam Results
// Uses Kalpurush font, zero auto-date, spacious layout, zero text-overlap, English digits

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
  examTitle = 'OMR Exam Result'
}) {
  if (typeof document === 'undefined') {
    return null;
  }

  // Ensure Kalpurush font link is in the DOM
  if (!document.getElementById('kalpurush-font-stylesheet')) {
    const link = document.createElement('link');
    link.id = 'kalpurush-font-stylesheet';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.maateen.me/kalpurush/font.css';
    document.head.appendChild(link);
  }

  const canvas = document.createElement('canvas');
  // High-DPI Canvas: Width 1640px, Height 440px (Generous, spacious executive layout)
  canvas.width = 1640;
  canvas.height = 440;
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

  // Kalpurush Bengali Font Stack
  const fontBase = "'Kalpurush', 'Hind Siliguri', 'SolaimanLipi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

  // 0. Background Outer Card
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 0, 0, 1640, 440, 14);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 1. Top Header Banner (Height: 74px)
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, 0, 0, 1640, 74, { tl: 14, tr: 14, br: 0, bl: 0 });
  ctx.fill();

  // Title text (Big, proud, distinct)
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 25px ${fontBase}`;
  ctx.fillText(examTitle || 'OMR Exam Result', 28, 42);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `14px ${fontBase}`;
  ctx.fillText('ওএমআর মূল্যায়ন ও সামগ্রিক ফলাফল বিশ্লেষণ (OMR Performance Analytics)', 28, 62);

  // Right: Full Marks Pill (NO auto date as requested)
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, 1450, 18, 162, 38, 19);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold 16px ${fontBase}`;
  ctx.textAlign = 'center';
  ctx.fillText(`পূর্ণমান: ${totalMcq}`, 1531, 42);
  ctx.textAlign = 'left';

  // 2. Middle Row: 4 Giant, Spacious Metric KPI Cards (x: 24 to 1616, width: 382px each, height: 122px)
  const cards = [
    {
      title: 'মোট পরীক্ষার্থী',
      value: `${stats.valid || 0}`,
      unit: 'জন',
      sub: `ফাইলে মোট তথ্য: ${stats.total || 0} টি`,
      bg: '#f8fafc',
      border: '#cbd5e1',
      accent: '#64748b',
      valColor: '#0f172a'
    },
    {
      title: 'সর্বোচ্চ নম্বর',
      value: `${highest}`,
      unit: `/ ${totalMcq}`,
      sub: `সঠিকতার হার: ${Math.round((highest / totalMcq) * 100)}%`,
      bg: '#f0fdf4',
      border: '#86efac',
      accent: '#16a34a',
      valColor: '#15803d'
    },
    {
      title: 'গড় নম্বর (Average)',
      value: `${average}`,
      unit: `/ ${totalMcq}`,
      sub: `মধ্যমা (Median): ${median} / ${totalMcq}`,
      bg: '#eff6ff',
      border: '#93c5fd',
      accent: '#2563eb',
      valColor: '#1d4ed8'
    },
    {
      title: 'সর্বনিম্ন নম্বর',
      value: `${lowest}`,
      unit: `/ ${totalMcq}`,
      sub: `সঠিকতার হার: ${Math.round((lowest / totalMcq) * 100)}%`,
      bg: '#fef2f2',
      border: '#fca5a5',
      accent: '#dc2626',
      valColor: '#b91c1c'
    }
  ];

  const cardY = 90;
  const cardH = 124;
  const cardW = 382;
  const cardGap = 21;

  cards.forEach((card, idx) => {
    const x = 24 + idx * (cardW + cardGap);
    ctx.fillStyle = card.bg;
    roundRect(ctx, x, cardY, cardW, cardH, 10);
    ctx.fill();
    ctx.strokeStyle = card.border;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Accent top strip
    ctx.fillStyle = card.accent;
    roundRect(ctx, x, cardY, cardW, 5, { tl: 10, tr: 10, br: 0, bl: 0 });
    ctx.fill();

    // Title Label
    ctx.fillStyle = card.accent;
    ctx.font = `bold 15px ${fontBase}`;
    ctx.fillText(card.title, x + 18, cardY + 28);

    // Giant Value & Unit rendered cleanly on the same baseline with zero collision
    ctx.fillStyle = card.valColor;
    ctx.font = `bold 38px ${fontBase}`;
    ctx.fillText(card.value, x + 18, cardY + 74);

    if (card.unit) {
      const valW = ctx.measureText(card.value).width;
      ctx.fillStyle = '#64748b';
      ctx.font = `600 18px ${fontBase}`;
      ctx.fillText(card.unit, x + 18 + valW + 8, cardY + 72);
    }

    // Subtitle Note
    ctx.fillStyle = '#475569';
    ctx.font = `13px ${fontBase}`;
    ctx.fillText(card.sub, x + 18, cardY + 104);
  });

  // 3. Question Difficulty Analysis Strip (x: 24 to 1616, width: 1592, height: 48px)
  const diffY = 228;
  const diffH = 50;
  const diffW = 1592;
  const diffX = 24;

  ctx.fillStyle = '#fffbeb';
  roundRect(ctx, diffX, diffY, diffW, diffH, 8);
  ctx.fill();
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Left Tag
  ctx.fillStyle = '#92400e';
  ctx.font = `bold 14.5px ${fontBase}`;
  ctx.fillText('প্রশ্নের কাঠিন্যতা ও সহজতা বিশ্লেষণ:', diffX + 18, diffY + 31);

  // Easiest Question Pill
  const easyPillX = diffX + 270;
  ctx.fillStyle = '#dcfce7';
  roundRect(ctx, easyPillX, diffY + 10, 420, 30, 15);
  ctx.fill();
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#15803d';
  ctx.font = `bold 14px ${fontBase}`;
  ctx.fillText(`সবচেয়ে সহজ প্রশ্ন: Q${stats.easiest?.q || '—'}`, easyPillX + 16, diffY + 30);
  ctx.font = `13px ${fontBase}`;
  ctx.fillText(`(${stats.easiest?.acc || 0}% সঠিক উত্তর)`, easyPillX + 260, diffY + 30);

  // Hardest Question Pill
  const hardPillX = diffX + 710;
  ctx.fillStyle = '#fee2e2';
  roundRect(ctx, hardPillX, diffY + 10, 420, 30, 15);
  ctx.fill();
  ctx.strokeStyle = '#fca5a5';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#b91c1c';
  ctx.font = `bold 14px ${fontBase}`;
  ctx.fillText(`সবচেয়ে কঠিন প্রশ্ন: Q${stats.hardest?.q || '—'}`, hardPillX + 16, diffY + 30);
  ctx.font = `13px ${fontBase}`;
  ctx.fillText(`(${stats.hardest?.acc || 0}% সঠিক উত্তর)`, hardPillX + 260, diffY + 30);

  // Pass rate on right
  const passRate = stats.valid ? Math.round(((stats.valid - (stats.bracketFail || 0)) / stats.valid) * 100) : 0;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#78350f';
  ctx.font = `bold 14px ${fontBase}`;
  ctx.fillText(`সামগ্রিক পাসের হার: ${passRate}%`, diffX + diffW - 20, diffY + 31);
  ctx.textAlign = 'left';

  // 4. Bottom Section: Visual Score Distribution Bar Charts (Height: 142px)
  const distY = 290;
  const distH = 136;
  const distW = 1592;
  const distX = 24;

  ctx.fillStyle = '#f8fafc';
  roundRect(ctx, distX, distY, distW, distH, 10);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Section Header
  ctx.fillStyle = '#1e293b';
  ctx.font = `bold 15px ${fontBase}`;
  ctx.fillText('নম্বর ভিত্তিক গ্রেড বণ্টন ও পারফরম্যান্স বিশ্লেষণ (Score Distribution & Grade Brackets):', distX + 18, distY + 26);

  // 4 Spacious Brackets: width = (1592 - 36 - 60) / 4 = 374px
  const bWidth = 374;
  const bGap = 20;
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
    const bx = distX + 18 + i * (bWidth + bGap);
    const by = distY + 40;

    // Inner card background
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, bx, by, bWidth, 84, 8);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Color indicator & Bracket title
    ctx.fillStyle = b.color;
    roundRect(ctx, bx + 14, by + 12, 10, 10, 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold 14px ${fontBase}`;
    ctx.fillText(b.label, bx + 30, by + 22);

    // Count + Percentage badge on right
    ctx.textAlign = 'right';
    ctx.fillStyle = b.color;
    ctx.font = `bold 15px ${fontBase}`;
    ctx.fillText(`${b.count} জন (${b.pct}%)`, bx + bWidth - 14, by + 22);
    ctx.textAlign = 'left';

    // Horizontal Progress Bar Track
    const barX = bx + 14;
    const barY = by + 36;
    const barW = bWidth - 28;
    const barH = 18;

    ctx.fillStyle = b.trackBg;
    roundRect(ctx, barX, barY, barW, barH, 9);
    ctx.fill();

    // Filled portion
    const fillWidth = Math.max(b.pct > 0 ? 14 : 0, Math.round((barW * b.pct) / 100));
    if (fillWidth > 0) {
      ctx.fillStyle = b.color;
      roundRect(ctx, barX, barY, fillWidth, barH, 9);
      ctx.fill();
    }

    // Bottom note / badge
    ctx.fillStyle = '#64748b';
    ctx.font = `12px ${fontBase}`;
    ctx.fillText(`গ্রেড স্তর: ${b.tag}`, bx + 14, by + 72);
    ctx.textAlign = 'right';
    ctx.fillText(`অনুপাত: ${b.pct}%`, bx + bWidth - 14, by + 72);
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
