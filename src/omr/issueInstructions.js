// Browser text shaping keeps Bengali conjuncts readable in the compact PDF intro.
let fontPromise;
export async function renderIssueInstructions() {
  if (!fontPromise) fontPromise = (async () => {
    const font = new FontFace('ChemShifuGuide', 'url(/fonts/kalpurush.ttf)');
    await font.load();
    document.fonts.add(font);
  })().catch(error => { fontPromise = undefined; throw error; });
  await fontPromise;
  const canvas = document.createElement('canvas');
  canvas.width = 1556;
  canvas.height = 580;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare PDF instructions. Please try again.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  const text = (value, x, y, width, size = 21, color = '#334155') => {
    ctx.font = `${size}px ChemShifuGuide`;
    ctx.fillStyle = color;
    let line = '';
    for (const word of value.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        ctx.fillText(line, x, y); y += size * 1.35; line = word;
      } else line = next;
    }
    if (line) ctx.fillText(line, x, y);
    return y + size * 1.35;
  };
  text('রেজাল্টে তোমার নাম নেই? আগে এটা দেখে নাও', 0, 2, 1556, 36, '#49378b');
  text('পরীক্ষায় দেওয়া রোল দিয়ে তোমার তথ্য খুঁজে রেজাল্ট তৈরি হয়। নিচের লিস্টে রোল খুঁজে পাশে সমস্যার কারণ দেখে নাও।', 0, 52, 1556, 23);
  const card = (x, y, title, body, color, background) => {
    ctx.fillStyle = background; ctx.fillRect(x, y, 766, 145);
    text(title, x + 18, y + 12, 730, 25, color);
    text(body, x + 18, y + 48, 730, 21);
  };
  card(0, 96, 'Students / Web Roll Sheet কী?', 'Students Sheet হলো ওয়েবসাইট থেকে ডাউনলোড করা স্টুডেন্ট লিস্ট। Web Roll Sheet হলো ChemShifu আলাদাভাবে যে ওয়েব রোলের লিস্ট রাখে।', '#1d4ed8', '#eff6ff');
  card(790, 96, 'Not in Students / Invalid Roll', 'Not in Students: দুই লিস্টের কোনোটাতেই রোল মেলেনি। Invalid Roll: রোল ফাঁকা, ডিজিট কম-বেশি বা অন্য চিহ্ন আছে; রোল ঠিকভাবে পড়া যায়নি।', '#b45309', '#fffbeb');
  card(0, 251, 'Duplicate Roll / Result Status', 'Duplicate Roll: একই রোল একাধিকবার আছে, যাচাই দরকার। Excluded: রেজাল্টে যোগ হয়নি। In result - review needed: রেজাল্টে আছে, তবে সমস্যাটা চেক করতে হবে।', '#b91c1c', '#fff1f2');
  card(790, 251, 'রেজাল্ট না আসার সম্ভাব্য কারণ', 'মানি রিসিপ্টের রোল ব্যবহার, ভুল বা ডাবল বৃত্ত ভরাট, অস্পষ্ট রোল কিংবা অন্যের রোল দেওয়া। পরীক্ষায় কোর্স অ্যাক্সেস নিয়ে পাওয়া নিজের Web Roll ব্যবহার করো।', '#b91c1c', '#fff1f2');
  card(0, 406, 'লিস্টটা কীভাবে দেখবে?', 'Roll in Sheet হলো OMR থেকে পাওয়া রোল। Row Number ফাইলের লাইন নম্বর, rank নয়। এক entry-তে একাধিক সমস্যা হতে পারে; এখানে প্রতি row একবার দেখানো হয়েছে।', '#49378b', '#f5f3ff');
  card(790, 406, 'এখন কী করবে?', 'নিজের Web Roll নিশ্চিত করো। PDF-এ Search / Find দিয়ে রোল খোঁজো। সব ঠিক দিয়েও নাম না এলে নাম, Web Roll, পরীক্ষার নাম ও screenshot দিয়ে ChemShifu-কে জানাও।', '#166534', '#f0fdf4');
  return canvas.toDataURL('image/jpeg', 0.85);
}
