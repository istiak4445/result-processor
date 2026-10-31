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
  canvas.height = 650;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare PDF instructions. Please try again.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  const text = (value, x, y, width, size = 21, color = '#334155') => {
    ctx.font = `${size}px ChemShifuGuide`;
    ctx.fillStyle = color;
    let line = '';
    for (const word of value.replace(/\n/g, ' \n ').split(/[^\S\n]+/)) {
      if (word === '\n') {
        if (line) ctx.fillText(line, x, y);
        y += size * 1.35; line = ''; continue;
      }
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        ctx.fillText(line, x, y); y += size * 1.35; line = word;
      } else line = next;
    }
    if (line) ctx.fillText(line, x, y);
    return y + size * 1.35;
  };
  text('রেজাল্টে তোমার নাম নেই? কী করবে, দেখে নাও', 0, 2, 1556, 36, '#49378b');
  text('নিচের লিস্টে পরীক্ষায় দেওয়া রোল খোঁজো। পাশে কী লেখা আছে দেখো, তারপর সেই অনুযায়ী নিচের নির্দেশনা পড়ো।', 0, 52, 1556, 23);
  const card = (x, y, title, body, color, background) => {
    ctx.fillStyle = background; ctx.fillRect(x, y, 766, 145);
    text(title, x + 18, y + 12, 730, 25, color);
    text(body, x + 18, y + 48, 730, 21);
  };
  card(0, 96, '১. আগে নিজের রোল খুঁজে নাও', 'PDF-এ Search / Find চাপো। কম্পিউটারে Ctrl+F / Cmd+F।\nরোল 271540 হলে 00271540 দিয়েও খোঁজো।\nরোল ভুল ভরাট করলে লিস্টেও ভুল রোল আসতে পারে।', '#1d4ed8', '#eff6ff');
  card(790, 96, '২. Not in Students = আমাদের লিস্টে রোল মেলেনি', 'Students = ওয়েবসাইট থেকে ডাউনলোড করা স্টুডেন্ট লিস্ট।\nWeb Roll Sheet = ChemShifu নিজেরা যে রোলের লিস্ট রাখে।\nদুই লিস্টেই মেলেনি। সঠিক Web Roll দিয়ে আমাদের জানাও।', '#b45309', '#fffbeb');
  card(0, 251, '৩. Invalid Roll = রোল ঠিকভাবে পড়া যায়নি', 'রোল ফাঁকা, সংখ্যা কম-বেশি বা অন্য চিহ্ন পাওয়া গেছে।\nভুল ঘর বা এক জায়গায় দুটো বৃত্ত ভরাট করলে এমন হতে পারে।\nপরীক্ষায় কোন রোল দিয়েছ, নিজের Web Roll-এর সঙ্গে মিলাও।', '#b91c1c', '#fff1f2');
  card(790, 251, '৪. Duplicate Roll = একই রোল একাধিকবার আছে', 'পরীক্ষার ফাইল বা আমাদের লিস্টে একই রোল বারবার আছে।\nপাশের কারণটা দেখো। এতে কার marks ঠিক, যাচাই দরকার।\nনিজের রোল দিয়েও এমন হলে screenshot দিয়ে আমাদের জানাও।', '#b45309', '#fffbeb');
  card(0, 406, '৫. পরীক্ষায় কোন রোল দিতে হবে?', 'কোর্স অ্যাক্সেস নেওয়ার পর পাওয়া নিজের Web Roll দেবে।\nমানি রিসিপ্টের রোল বা অন্য কারও রোল দেবে না।\nনা হলে রেজাল্ট বাদ যেতে বা অন্যের নামে যুক্ত হতে পারে।', '#49378b', '#f5f3ff');
  card(790, 406, '৬. তোমার রেজাল্ট কি বাদ গেছে?', 'Excluded from result = এই entry রেজাল্টে যোগ হয়নি।\nIn result - review needed = আছে, তবে চেক করতে হবে।\nশুধু Duplicate লেখা দেখেই রেজাল্ট বাদ গেছে ধরে নিও না।', '#166534', '#f0fdf4');
  text('সমাধানের জন্য পাঠাও: তোমার নাম + সঠিক Web Roll + পরীক্ষার নাম + সমস্যার screenshot। ChemShifu-কে জানাও।', 0, 568, 1556, 23, '#166534');
  text('Row Number ফাইলের লাইন নম্বর, তোমার rank নয়। একই entry-তে একাধিক সমস্যা থাকতে পারে।', 0, 610, 1556, 21, '#64748b');
  return canvas.toDataURL('image/jpeg', 0.85);
}
