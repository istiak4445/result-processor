import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import * as htmlToImage from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  AlignCenter,
  AlignLeft,
  Award,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Palette,
  RefreshCcw,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';

const sampleHeaders = ['Student Name', 'Roll', 'College', 'Marks', 'Grade'];
const sampleRows = [
  ['Ariyan Rahman', '101', 'Dhaka City College', '96', 'A+'],
  ['Nusrat Jahan', '102', 'Holy Cross College', '94', 'A+'],
  ['Samiul Islam', '103', 'Notre Dame College', '92', 'A+'],
  ['Mehjabin Akter', '104', 'Viqarunnisa Noon', '89', 'A'],
  ['Rafsan Mahmud', '105', 'Ideal College', '87', 'A'],
  ['Tasnim Chowdhury', '106', 'BAF Shaheen College', '85', 'A'],
  ['Fahim Hasan', '107', 'Rajuk Uttara Model', '83', 'A'],
  ['Maliha Islam', '108', 'Cambrian College', '80', 'A'],
  ['Sadia Afrin', '109', 'Milestone College', '78', 'A-'],
  ['Farhan Ahmed', '110', 'Residential Model', '76', 'A-'],
  ['Lamisa Zarin', '111', 'Dhaka College', '74', 'A-'],
  ['Adnan Kabir', '112', 'Adamjee Cantonment', '72', 'A-'],
  ['Raisa Sultana', '113', 'Birsreshtha Noor Mohammad', '70', 'A-'],
  ['Shafin Alam', '114', 'St. Joseph Higher Secondary', '68', 'B'],
  ['Jannatul Ferdous', '115', 'Shaheed Bir Uttam Lt. Anwar', '65', 'B'],
];

const sizeOptions = {
  square: { label: 'Square 1080 x 1080', width: 1080, height: 1080 },
  portrait: { label: 'Portrait 1080 x 1350', width: 1080, height: 1350 },
  story: { label: 'Story 1080 x 1920', width: 1080, height: 1920 },
};

const accentOptions = {
  gold: {
    label: 'Gold',
    primary: '#f8d36a',
    secondary: '#22d3ee',
    header: '#f5c542',
    glow: 'rgba(248, 211, 106, 0.34)',
  },
  cyan: {
    label: 'Cyan',
    primary: '#38d6ff',
    secondary: '#f8d36a',
    header: '#24d4ff',
    glow: 'rgba(56, 214, 255, 0.32)',
  },
  white: {
    label: 'White',
    primary: '#ffffff',
    secondary: '#a5f3fc',
    header: '#e2e8f0',
    glow: 'rgba(255, 255, 255, 0.24)',
  },
};

const defaultBrand = {
  title: 'ChemShifu Result Sheet',
  subtitle: 'Congratulations to all achievers',
  batch: 'HSC 27 Chemistry',
  exam: 'Weekly Exam Result',
  date: new Date().toISOString().slice(0, 10),
  institute: 'ChemShifu',
  footer: 'ChemShifu | Chemistry A to Z',
  contact: '',
  web: '',
  note: '',
};

const defaultBrandOptions = {
  topMode: 'text',
  logo: '',
};

const defaultStyle = {
  rowsPerImage: 12,
  fontSize: 25,
  padding: 18,
  tableWidth: 96,
  headerColor: '#f5c542',
  backgroundStyle: 'aurora',
  borderRadius: 34,
  showSerial: false,
  highlightTop3: true,
  highlightColumns: false,
  alignment: 'center',
  exportSize: 'square',
  accent: 'gold',
  customBackground: '',
};

function chunkRows(rows, size) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks.length ? chunks : [[]];
}

function normalizeSheet(rows, firstRowHeader) {
  if (!rows.length) return { headers: sampleHeaders, data: sampleRows };
  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => Array.from({ length: width }, (_, i) => String(row[i] ?? '').trim()));
  if (firstRowHeader) {
    const headers = normalized[0].map((cell, i) => cell || `Column ${i + 1}`);
    return { headers, data: normalized.slice(1).filter((row) => row.some(Boolean)) };
  }
  return {
    headers: Array.from({ length: width }, (_, i) => `Column ${i + 1}`),
    data: normalized.filter((row) => row.some(Boolean)),
  };
}

function hasSerialColumn(headers) {
  return headers.some((header) => {
    const normalized = String(header).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    return ['sl', 'sln', 'serial', 'serialno', 'serialnumber', 'ক্রমিক'].includes(normalized);
  });
}

function getColumnKind(header) {
  const normalized = String(header).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.includes('name') || normalized.includes('student')) return 'name';
  if (normalized.includes('college') || normalized.includes('school') || normalized.includes('institution')) return 'wide';
  if (['sl', 'sln', 'serial', 'serialno', 'roll', 'rollno', 'marks', 'mark', 'mcq', 'cq', 'total', 'grade'].includes(normalized)) return 'compact';
  return 'normal';
}

function getColumnWeight(kind) {
  if (kind === 'name') return 2.1;
  if (kind === 'wide') return 1.55;
  if (kind === 'compact') return 0.78;
  return 1;
}

function isNumericValue(value) {
  return /^[\d\s.,:/+-]+$/.test(String(value ?? '').trim());
}

export default function ImageMaker({ sourceData }) {
  const [rawRows, setRawRows] = useState([sampleHeaders, ...sampleRows]);
  const [useFirstRowHeader, setUseFirstRowHeader] = useState(true);
  const initial = normalizeSheet([sampleHeaders, ...sampleRows], true);
  const [headers, setHeaders] = useState(initial.headers);
  const [rows, setRows] = useState(initial.data);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [columnFontSizes, setColumnFontSizes] = useState({});
  const [brand, setBrand] = useState(defaultBrand);
  const [brandOptions, setBrandOptions] = useState(defaultBrandOptions);
  const [style, setStyle] = useState(defaultStyle);
  const [currentPage, setCurrentPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [fileName, setFileName] = useState('Sample data loaded');
  const [previewWidth, setPreviewWidth] = useState(1080);
  const cardRefs = useRef([]);
  const previewHostRef = useRef(null);

  useEffect(() => {
    if (!sourceData?.headers?.length) return;
    const incoming = [sourceData.headers, ...sourceData.rows];
    applyRows(incoming, true);
    setUseFirstRowHeader(true);
    setFileName('Live ResultFlow output');
  }, [sourceData]);

  useEffect(() => {
    const node = previewHostRef.current;
    if (!node) return undefined;
    const updateWidth = () => setPreviewWidth(node.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const visibleColumns = headers
    .map((name, index) => ({ name, index }))
    .filter((col) => !hiddenColumns.includes(col.index));

  const pages = useMemo(() => chunkRows(rows, Math.max(1, Number(style.rowsPerImage) || 1)), [rows, style.rowsPerImage]);
  const exportSize = sizeOptions[style.exportSize];
  const previewScale = Math.min(1, Math.max(0.25, (previewWidth - 28) / exportSize.width));
  const accent = accentOptions[style.accent];
  const selectedHighlightColumns = style.highlightColumns
    ? visibleColumns.filter((_, index) => index === 0 || index === visibleColumns.length - 1).map((col) => col.index)
    : [];
  const unreadableWarning = visibleColumns.length > 7;

  const applyRows = (incomingRaw, firstRowHeader = useFirstRowHeader) => {
    const parsed = normalizeSheet(incomingRaw, firstRowHeader);
    setRawRows(incomingRaw);
    setHeaders(parsed.headers);
    setRows(parsed.data);
    setHiddenColumns([]);
    setColumnFontSizes({});
    setStyle((current) => ({ ...current, showSerial: hasSerialColumn(parsed.headers) ? false : current.showSerial }));
    setCurrentPage(0);
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    applyRows(data, useFirstRowHeader);
  };

  const readImageFile = (file, onLoad) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onLoad(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleBrandLogo = (event) => {
    readImageFile(event.target.files?.[0], (logo) => {
      setBrandOptions((current) => ({ ...current, logo, topMode: current.topMode === 'text' ? 'logo' : current.topMode }));
    });
  };

  const handleCustomBackground = (event) => {
    readImageFile(event.target.files?.[0], (customBackground) => {
      setStyle((current) => ({ ...current, customBackground }));
    });
  };

  const handleHeaderToggle = (checked) => {
    setUseFirstRowHeader(checked);
    applyRows(rawRows, checked);
  };

  const updateCell = (rowIndex, colIndex, value) => {
    setRows((current) => current.map((row, r) => (r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row)));
  };

  const deleteRow = (rowIndex) => {
    setRows((current) => current.filter((_, index) => index !== rowIndex));
  };

  const toggleColumn = (index) => {
    setHiddenColumns((current) => (current.includes(index) ? current.filter((i) => i !== index) : [...current, index]));
  };

  const updateColumnFontSize = (index, value) => {
    setColumnFontSizes((current) => {
      const next = { ...current };
      const numeric = Number(value);
      if (!value || Number.isNaN(numeric)) delete next[index];
      else next[index] = numeric;
      return next;
    });
  };

  const loadSample = () => {
    setFileName('Sample data loaded');
    applyRows([sampleHeaders, ...sampleRows], true);
    setUseFirstRowHeader(true);
  };

  const resetStyle = () => setStyle(defaultStyle);

  const exportNode = async (node) => {
    const dataUrl = await htmlToImage.toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      width: exportSize.width,
      height: exportSize.height,
      style: {
        width: `${exportSize.width}px`,
        height: `${exportSize.height}px`,
      },
    });
    return dataUrl;
  };

  const downloadCurrent = async () => {
    const node = cardRefs.current[currentPage];
    if (!node) return;
    setExporting(true);
    try {
      const dataUrl = await exportNode(node);
      saveAs(dataUrl, `chemshifu-result-page-${currentPage + 1}.png`);
    } finally {
      setExporting(false);
    }
  };

  // Native browser PDF preserves selectable Unicode text and the actual card layout.
  const exportSearchablePdf = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Allow pop-ups for this site to export the searchable PDF.');
      return;
    }
    const doc = printWindow.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    doc.close();
    doc.title = `${brand.title || 'Final Result'} - Searchable PDF`;
    const base = doc.createElement('base');
    base.href = document.baseURI;
    doc.head.appendChild(base);
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      doc.head.appendChild(node.cloneNode(true));
    });
    const printStyle = doc.createElement('style');
    printStyle.textContent = `
      @page { size: ${exportSize.width}px ${exportSize.height}px; margin: 0; }
      html, body { margin: 0 !important; padding: 0 !important; background: #020617; }
      * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
      .pdf-card { width: ${exportSize.width}px; height: ${exportSize.height}px; break-after: page; page-break-after: always; }
      .pdf-card:last-child { break-after: auto; page-break-after: auto; }
      .pdf-card article { transform: none !important; margin: 0 !important; }
      .pdf-card, .pdf-card * { text-shadow: none !important; }
      .pdf-toolbar { padding: 16px; background: white; color: #222; font: 14px sans-serif; }
      .pdf-toolbar button { padding: 10px 16px; cursor: pointer; }
      @media print { .pdf-toolbar { display: none !important; } }
    `;
    doc.head.appendChild(printStyle);
    const toolbar = doc.createElement('div');
    toolbar.className = 'pdf-toolbar';
    toolbar.textContent = 'Choose Save as PDF. Use all pages, zero margins, and enable background graphics. ';
    const printButton = doc.createElement('button');
    printButton.textContent = 'Save searchable PDF';
    printButton.onclick = () => printWindow.print();
    toolbar.appendChild(printButton);
    doc.body.appendChild(toolbar);
    const shell = doc.createElement('div');
    shell.className = 'image-maker-shell';
    cardRefs.current.slice(0, pages.length).forEach((node) => {
      if (!node) return;
      const page = doc.createElement('div');
      page.className = 'pdf-card';
      page.appendChild(node.cloneNode(true));
      shell.appendChild(page);
    });
    doc.body.appendChild(shell);
    await Promise.all([...doc.querySelectorAll('link[rel="stylesheet"]')].map((link) => new Promise((resolve) => {
      if (link.sheet) return resolve();
      link.onload = resolve;
      link.onerror = resolve;
      setTimeout(resolve, 5000);
    })));
    await doc.fonts.ready;
    await Promise.all([...doc.images].map((img) => img.decode().catch(() => {})));
    if (!printWindow.closed) { printWindow.focus(); printWindow.print(); }
  };

  const downloadZip = async () => {
    setExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < pages.length; i += 1) {
        const dataUrl = await exportNode(cardRefs.current[i]);
        zip.file(`chemshifu-result-page-${i + 1}.png`, dataUrl.split(',')[1], { base64: true });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'chemshifu-result-images.zip');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="image-maker-shell min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,#040716,#09111f_48%,#02030a)] text-slate-100">
      <div className="mx-auto flex w-full max-w-[1780px] flex-col gap-5 px-4 py-5 lg:flex-row lg:px-6">
        <aside className="w-full space-y-4 lg:sticky lg:top-5 lg:max-h-[calc(100vh-40px)] lg:w-[410px] lg:overflow-y-auto lg:pr-1 hide-scrollbar">
          <div className="control-panel">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
                <FileSpreadsheet size={23} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">ChemShifu Result Image Maker</h1>
                <p className="text-sm text-slate-400">Upload, polish, split, and export post-ready result cards.</p>
              </div>
            </div>
            <label className="secondary-button w-full cursor-pointer">
              <Upload size={17} />
              Upload Excel or CSV
              <input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
            </label>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-400">
              <span className="truncate">{fileName}</span>
              <button className="text-cyan-200 hover:text-cyan-100" onClick={loadSample}>Sample data</button>
            </div>
            <Toggle label="Use first row as header" checked={useFirstRowHeader} onChange={handleHeaderToggle} />
            {unreadableWarning && (
              <div className="mt-3 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                This table has many visible columns. Hide a few columns or reduce font size for a cleaner export.
              </div>
            )}
          </div>

          <EditorSection title="Header" icon={<Award size={17} />}>
            <TextInput label="Main title" value={brand.title} onChange={(title) => setBrand({ ...brand, title })} />
            <TextInput label="Subtitle" value={brand.subtitle} onChange={(subtitle) => setBrand({ ...brand, subtitle })} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Batch/course" value={brand.batch} onChange={(batch) => setBrand({ ...brand, batch })} />
              <TextInput label="Exam name" value={brand.exam} onChange={(exam) => setBrand({ ...brand, exam })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Date" type="date" value={brand.date} onChange={(date) => setBrand({ ...brand, date })} />
              <TextInput label="Brand name" value={brand.institute} onChange={(institute) => setBrand({ ...brand, institute })} />
            </div>
            <SelectInput label="Top brand display" value={brandOptions.topMode} onChange={(topMode) => setBrandOptions({ ...brandOptions, topMode })}>
              <option value="text">Text</option>
              <option value="logo">Logo</option>
              <option value="strip">Logo strip</option>
            </SelectInput>
            <label className="secondary-button w-full cursor-pointer">
              <ImageIcon size={16} />
              Upload top logo
              <input className="hidden" type="file" accept="image/*" onChange={handleBrandLogo} />
            </label>
          </EditorSection>

          <EditorSection title="Footer" icon={<FileSpreadsheet size={17} />}>
            <TextInput label="Footer text" value={brand.footer} onChange={(footer) => setBrand({ ...brand, footer })} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Contact number" value={brand.contact} onChange={(contact) => setBrand({ ...brand, contact })} />
              <TextInput label="Website/Facebook" value={brand.web} onChange={(web) => setBrand({ ...brand, web })} />
            </div>
            <TextInput label="Optional note line" value={brand.note} onChange={(note) => setBrand({ ...brand, note })} />
          </EditorSection>

          <EditorSection title="Style" icon={<Palette size={17} />}>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Rows per image" min="1" max="30" value={style.rowsPerImage} onChange={(rowsPerImage) => setStyle({ ...style, rowsPerImage })} />
              <NumberInput label="Font size" min="16" max="40" value={style.fontSize} onChange={(fontSize) => setStyle({ ...style, fontSize })} />
              <NumberInput label="Cell padding" min="8" max="30" value={style.padding} onChange={(padding) => setStyle({ ...style, padding })} />
              <NumberInput label="Table width %" min="70" max="100" value={style.tableWidth} onChange={(tableWidth) => setStyle({ ...style, tableWidth })} />
              <NumberInput label="Radius" min="12" max="56" value={style.borderRadius} onChange={(borderRadius) => setStyle({ ...style, borderRadius })} />
              <ColorInput label="Header color" value={style.headerColor} onChange={(headerColor) => setStyle({ ...style, headerColor })} />
            </div>
            <SelectInput label="Export size" value={style.exportSize} onChange={(exportSize) => setStyle({ ...style, exportSize })}>
              {Object.entries(sizeOptions).map(([key, size]) => <option key={key} value={key}>{size.label}</option>)}
            </SelectInput>
            <SelectInput label="Accent" value={style.accent} onChange={(value) => setStyle({ ...style, accent: value, headerColor: accentOptions[value].header })}>
              {Object.entries(accentOptions).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
            </SelectInput>
            <SelectInput label="Background style" value={style.backgroundStyle} onChange={(backgroundStyle) => setStyle({ ...style, backgroundStyle })}>
              <option value="aurora">Dark aurora</option>
              <option value="carbon">Carbon glow</option>
              <option value="midnight">Midnight clean</option>
            </SelectInput>
            <label className="secondary-button w-full cursor-pointer">
              <ImageIcon size={16} />
              Upload custom background
              <input className="hidden" type="file" accept="image/*" onChange={handleCustomBackground} />
            </label>
            {style.customBackground && (
              <button className="secondary-button w-full" onClick={() => setStyle({ ...style, customBackground: '' })}>
                <RefreshCcw size={16} />
                Remove custom background
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Serial number" checked={style.showSerial} onChange={(showSerial) => setStyle({ ...style, showSerial })} />
              <Toggle label="Top 3 badges" checked={style.highlightTop3} onChange={(highlightTop3) => setStyle({ ...style, highlightTop3 })} />
              <Toggle label="Column highlight" checked={style.highlightColumns} onChange={(highlightColumns) => setStyle({ ...style, highlightColumns })} />
              <button
                className="secondary-button"
                onClick={() => setStyle({ ...style, alignment: style.alignment === 'left' ? 'center' : 'left' })}
                title="Toggle text alignment"
              >
                {style.alignment === 'left' ? <AlignLeft size={16} /> : <AlignCenter size={16} />}
                {style.alignment}
              </button>
            </div>
            <button className="secondary-button w-full" onClick={resetStyle}>
              <RefreshCcw size={16} />
              Reset style
            </button>
          </EditorSection>

          <EditorSection title="Columns" icon={<Eye size={17} />}>
            <div className="grid grid-cols-1 gap-2">
              {headers.map((header, index) => (
                <div key={index} className="grid grid-cols-[1fr_88px_40px] items-center gap-2">
                  <input
                    className="control-input"
                    value={header}
                    onChange={(event) => setHeaders((current) => current.map((h, i) => (i === index ? event.target.value : h)))}
                  />
                  <input
                    className="control-input px-2 text-center"
                    type="number"
                    min="12"
                    max="46"
                    placeholder="Auto"
                    title="Column font size"
                    value={columnFontSizes[index] ?? ''}
                    onChange={(event) => updateColumnFontSize(index, event.target.value)}
                  />
                  <button className="icon-button shrink-0" onClick={() => toggleColumn(index)} title={hiddenColumns.includes(index) ? 'Show column' : 'Hide column'}>
                    {hiddenColumns.includes(index) ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              ))}
            </div>
          </EditorSection>

          <div className="control-panel space-y-3">
            <button className="primary-button w-full" onClick={exportSearchablePdf} disabled={exporting || !rows.length}>
              <Download size={17} /> Export Final Searchable PDF
            </button>
            <p className="text-xs text-slate-400">Same final card layout, searchable names and rolls. Choose “Save as PDF” and enable background graphics.</p>
            <button className="primary-button w-full" onClick={downloadCurrent} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" size={17} /> : <Download size={17} />}
              Download Current Image
            </button>
            <button className="secondary-button w-full" onClick={downloadZip} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" size={17} /> : <Wand2 size={17} />}
              Download All Images as ZIP
            </button>
          </div>
        </aside>

        <section ref={previewHostRef} className="min-w-0 flex-1 space-y-4">
          <div className="control-panel">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Editable Data Preview</h2>
                <p className="text-sm text-slate-400">{rows.length} rows, {visibleColumns.length} visible columns, {pages.length} image page{pages.length === 1 ? '' : 's'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {pages.map((_, index) => (
                  <button
                    key={index}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${currentPage === index ? 'bg-cyan-300 text-slate-950' : 'bg-white/[0.06] text-slate-200 hover:bg-white/10'}`}
                    onClick={() => setCurrentPage(index)}
                  >
                    Page {index + 1}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[320px] overflow-auto rounded-md border border-white/10">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="sticky top-0 bg-slate-900">
                  <tr>
                    <th className="w-12 border-b border-white/10 px-2 py-2 text-left text-slate-400">#</th>
                    {headers.map((header, index) => (
                      <th key={index} className={`${hiddenColumns.includes(index) ? 'hidden' : ''} border-b border-white/10 px-2 py-2 text-left`}>
                        {header}
                      </th>
                    ))}
                    <th className="w-12 border-b border-white/10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="odd:bg-white/[0.03]">
                      <td className="px-2 py-2 text-slate-500">{rowIndex + 1}</td>
                      {headers.map((_, colIndex) => (
                        <td key={colIndex} className={`${hiddenColumns.includes(colIndex) ? 'hidden' : ''} px-2 py-1`}>
                          <input
                            className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-slate-100 outline-none focus:border-cyan-300/50 focus:bg-white/[0.06]"
                            value={row[colIndex] ?? ''}
                            onChange={(event) => updateCell(rowIndex, colIndex, event.target.value)}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1">
                        <button className="icon-button h-8 w-8" onClick={() => deleteRow(rowIndex)} title="Delete row">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-5">
            {pages.map((pageRows, index) => (
              <div key={index} className={`${currentPage === index ? 'block' : 'hidden xl:block'}`}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Page {index + 1}</h3>
                  <span className="text-sm text-slate-500">{exportSize.label}</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30 p-3">
                  <div
                    style={{
                      width: exportSize.width * previewScale,
                      height: exportSize.height * previewScale,
                    }}
                  >
                    <div style={{width:exportSize.width,height:exportSize.height,transform:`scale(${previewScale})`,transformOrigin:'top left'}}>
                      <ResultCard
                        ref={(node) => { cardRefs.current[index] = node; }}
                        brand={brand}
                        brandOptions={brandOptions}
                        headers={headers}
                        rows={pageRows}
                        pageIndex={index}
                        rowOffset={index * Number(style.rowsPerImage)}
                        totalPages={pages.length}
                        visibleColumns={visibleColumns}
                        selectedHighlightColumns={selectedHighlightColumns}
                        columnFontSizes={columnFontSizes}
                        styleConfig={style}
                        exportSize={exportSize}
                        accent={accent}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const ResultCard = React.forwardRef(function ResultCard(
  { brand, brandOptions, headers, rows, pageIndex, rowOffset, totalPages, visibleColumns, selectedHighlightColumns, columnFontSizes, styleConfig, exportSize, accent },
  ref
) {
  const isSquare = exportSize.height <= 1080;
  const cardPadding = exportSize.height > 1500 ? 72 : isSquare ? 42 : 58;
  const headerBlockHeight = isSquare ? 215 : exportSize.height > 1500 ? 300 : 255;
  const footerBlockHeight = brand.contact || brand.web || brand.note ? 102 : isSquare ? 74 : 86;
  const tableShellPadding = isSquare ? 24 : 32;
  const tableAreaHeight = exportSize.height - cardPadding * 2 - headerBlockHeight - footerBlockHeight - tableShellPadding;
  const tableHeadHeight = Math.max(58, Math.min(92, styleConfig.fontSize * 2.45));
  const rowHeight = rows.length
    ? Math.max(36, Math.floor((tableAreaHeight - tableHeadHeight) / rows.length))
    : 58;
  const effectiveFontSize = Math.min(styleConfig.fontSize + 2, Math.max(18, Math.floor(rowHeight * 0.43)));
  const columnMeta = visibleColumns.map((col) => {
    const kind = getColumnKind(headers[col.index]);
    return { ...col, kind, weight: getColumnWeight(kind) };
  });
  const totalColumnWeight = columnMeta.reduce((sum, col) => sum + col.weight, styleConfig.showSerial ? 0.7 : 0);
  const cellPaddingX = Math.max(10, Math.min(styleConfig.padding, Math.floor(rowHeight * 0.2)));
  const isLogoStrip = brandOptions.topMode === 'strip' && brandOptions.logo;
  const background =
    styleConfig.customBackground
      ? `linear-gradient(rgba(2,6,23,.68), rgba(2,6,23,.82)), url("${styleConfig.customBackground}") center / cover no-repeat`
      : styleConfig.backgroundStyle === 'carbon'
        ? 'radial-gradient(circle at 18% 12%, rgba(248,211,106,.22), transparent 30%), radial-gradient(circle at 82% 24%, rgba(34,211,238,.16), transparent 32%), linear-gradient(135deg,#07090f,#111827 50%,#030712)'
      : styleConfig.backgroundStyle === 'midnight'
        ? 'linear-gradient(145deg,#020617,#0f172a 56%,#020617)'
        : 'radial-gradient(circle at 14% 10%, rgba(34,211,238,.24), transparent 31%), radial-gradient(circle at 85% 6%, rgba(248,211,106,.22), transparent 27%), radial-gradient(circle at 50% 98%, rgba(14,165,233,.16), transparent 34%), linear-gradient(145deg,#020617,#08111f 52%,#02030a)';

  return (
    <article
      ref={ref}
      style={{
        width: exportSize.width,
        height: exportSize.height,
        background,
        padding: cardPadding,
      }}
      className="relative overflow-hidden text-white"
    >
      <div
        className="absolute inset-x-16 top-12 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent.primary}, transparent)` }}
      />
      <div
        className="relative flex h-full flex-col border border-white/16 bg-white/[0.075] shadow-2xl backdrop-blur"
        style={{ borderRadius: styleConfig.borderRadius, boxShadow: `0 28px 80px rgba(0,0,0,.44), 0 0 62px ${accent.glow}` }}
      >
        <div className="shrink-0 px-12 text-center" style={{ height: headerBlockHeight, paddingTop: isLogoStrip ? 0 : isSquare ? 24 : 34 }}>
          <TopBrand brand={brand} brandOptions={brandOptions} accent={accent} isSquare={isSquare} />
          <h2 className={`${isSquare ? 'text-[52px]' : 'text-[62px]'} font-black leading-none tracking-normal`} style={{ color: accent.primary }}>{brand.title}</h2>
          <p className={`${isSquare ? 'mt-3 text-2xl' : 'mt-4 text-3xl'} font-semibold text-slate-100`}>{brand.subtitle}</p>
        </div>

        <div className="flex min-h-0 flex-1 items-start justify-center px-10" style={{ paddingBottom: tableShellPadding, height: tableAreaHeight + tableShellPadding }}>
          <table
            className="table-fixed overflow-hidden border-separate border-spacing-0"
            style={{
              width: `${styleConfig.tableWidth}%`,
              fontSize: effectiveFontSize,
              textAlign: styleConfig.alignment,
            }}
          >
            <colgroup>
              {styleConfig.showSerial && <col style={{ width: `${(0.7 / totalColumnWeight) * 100}%` }} />}
              {columnMeta.map((col) => (
                <col key={col.index} style={{ width: `${(col.weight / totalColumnWeight) * 100}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {styleConfig.showSerial && (
                  <th
                    style={{ background: styleConfig.headerColor, color: '#07111f', height: tableHeadHeight, padding: `0 ${cellPaddingX}px`, borderTopLeftRadius: 18 }}
                    className="border-r border-black/20 font-black last:border-r-0"
                  >
                    SL
                  </th>
                )}
                {columnMeta.map((col, index) => (
                  <th
                    key={col.index}
                    style={{
                      background: styleConfig.headerColor,
                      color: '#07111f',
                      height: tableHeadHeight,
                      padding: `0 ${cellPaddingX}px`,
                      fontSize: columnFontSizes[col.index] ? Math.max(12, columnFontSizes[col.index] - 1) : effectiveFontSize,
                      whiteSpace: col.kind === 'compact' ? 'nowrap' : 'normal',
                      borderRight: index === columnMeta.length - 1 ? '0' : '1px solid rgba(7,17,31,.24)',
                      borderTopLeftRadius: !styleConfig.showSerial && index === 0 ? 18 : 0,
                      borderTopRightRadius: index === visibleColumns.length - 1 ? 18 : 0,
                    }}
                    className="font-black leading-tight"
                  >
                    {headers[col.index]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const absoluteIndex = rowOffset + rowIndex;
                const rank = absoluteIndex + 1;
                const ranked = styleConfig.highlightTop3 && rank <= 3;
                return (
                  <tr key={rowIndex}>
                    {styleConfig.showSerial && (
                      <td
                        className="font-black"
                        style={{
                          height: rowHeight,
                          padding: `0 ${cellPaddingX}px`,
                          background: ranked ? 'rgba(248,211,106,.22)' : rowIndex % 2 ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.12)',
                          color: ranked ? accent.primary : '#e2e8f0',
                          borderRight: '1px solid rgba(255,255,255,.10)',
                        }}
                      >
                        {ranked ? `#${rank}` : rank}
                      </td>
                    )}
                    {columnMeta.map((col) => {
                      const highlighted = selectedHighlightColumns.includes(col.index);
                      const isName = col.kind === 'name';
                      const cellValue = row[col.index];
                      const isNumberLike = col.kind === 'compact' || isNumericValue(cellValue);
                      const configuredFontSize = columnFontSizes[col.index];
                      const bodyFontSize = configuredFontSize || (isName ? Math.min(effectiveFontSize + 4, Math.floor(rowHeight * 0.56)) : effectiveFontSize);
                      return (
                        <td
                          key={col.index}
                          style={{
                            height: rowHeight,
                            padding: `0 ${cellPaddingX}px`,
                            fontSize: bodyFontSize,
                            fontWeight: isName ? 900 : 750,
                            textAlign: isName ? 'left' : styleConfig.alignment,
                            whiteSpace: isNumberLike ? 'nowrap' : 'normal',
                            wordBreak: isNumberLike ? 'normal' : 'break-word',
                            overflowWrap: isNumberLike ? 'normal' : 'break-word',
                            background: ranked
                              ? 'rgba(248,211,106,.16)'
                              : highlighted
                                ? 'rgba(34,211,238,.14)'
                                : rowIndex % 2
                                  ? 'rgba(255,255,255,.065)'
                                  : 'rgba(255,255,255,.105)',
                            color: isName ? '#ffffff' : highlighted ? '#cffafe' : '#f8fafc',
                            borderTop: '1px solid rgba(255,255,255,.07)',
                            borderRight: col.index === columnMeta[columnMeta.length - 1]?.index ? '0' : '1px solid rgba(255,255,255,.10)',
                            textShadow: '0 2px 4px rgba(0,0,0,.82)',
                          }}
                          className={`${isName ? 'break-normal' : 'break-words'} leading-tight`}
                        >
                          {cellValue}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 px-12 text-center" style={{ height: footerBlockHeight, paddingTop: isSquare ? 12 : 18 }}>
          <div className="mx-auto h-px w-4/5" style={{ background: `linear-gradient(90deg, transparent, ${accent.primary}, transparent)` }} />
          <div className={`${isSquare ? 'mt-3 text-xl' : 'mt-4 text-2xl'} font-black`} style={{ color: accent.primary }}>{brand.footer}</div>
          <div className={`${isSquare ? 'mt-1 text-base' : 'mt-2 text-lg'} flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-semibold text-slate-200`}>
            {brand.contact && <span>{brand.contact}</span>}
            {brand.web && <span>{brand.web}</span>}
            {brand.note && <span>{brand.note}</span>}
          </div>
        </div>
      </div>
    </article>
  );
});


function TopBrand({ brand, brandOptions, accent, isSquare }) {
  if (brandOptions.topMode === 'logo' && brandOptions.logo) {
    return (
      <div className={`${isSquare ? 'mb-3 h-14' : 'mb-4 h-16'} flex items-center justify-center`}>
        <img src={brandOptions.logo} alt="" className="max-h-full max-w-[360px] object-contain" />
      </div>
    );
  }

  if (brandOptions.topMode === 'strip' && brandOptions.logo) {
    return (
      <div
        className={`${isSquare ? 'mb-4 h-24' : 'mb-5 h-28'} flex items-center justify-center bg-white px-10`}
        style={{ marginLeft: -48, marginRight: -48 }}
      >
        <img src={brandOptions.logo} alt="" className="max-h-full w-full object-contain" />
      </div>
    );
  }

  return (
    <div className={`${isSquare ? 'mb-3' : 'mb-4'} text-center`}>
      <div className={`${isSquare ? 'text-2xl' : 'text-3xl'} font-black uppercase tracking-[0.24em]`} style={{ color: accent.primary }}>{brand.institute}</div>
    </div>
  );
}

function EditorSection({ title, icon, children }) {
  return (
    <section className="control-panel space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-slate-300">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function TextInput({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block space-y-1.5">
      <span className="control-label">{label}</span>
      <input className="control-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberInput({ label, value, onChange, ...props }) {
  return (
    <label className="block space-y-1.5">
      <span className="control-label">{label}</span>
      <input className="control-input" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} {...props} />
    </label>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <label className="block space-y-1.5">
      <span className="control-label">{label}</span>
      <input className="h-10 w-full cursor-pointer rounded-md border border-white/10 bg-white/[0.06] p-1" type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectInput({ label, value, onChange, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="control-label">{label}</span>
      <select className="control-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-200">
      <span>{label}</span>
      <input className="h-4 w-4 accent-cyan-300" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
