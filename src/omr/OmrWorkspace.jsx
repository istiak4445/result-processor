import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  Filter,
  Search,
  Key,
  Sparkles,
  RotateCcw,
  Eye,
  Check,
  Users,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { parseAnswerKey, parseOmrMatrix, autoDetectAnswerKey } from './omrParser.js';
import { processOmrData } from './omrProcessor.js';
import { exportOmrPdf, exportOmrXlsx } from './omrExport.js';
import { generateInfographicCanvas, downloadInfographicImage } from './omrInfograph.js';
import { safeExportName } from '../exportName.js';

const SAMPLE_KEY = `28 offline 
1. B
2. B
3. C
4. B
5. B
6. D
7. B
8. B
9. A
10. C
11. A
12. B
13. C
14. C
15. B
16. A
17. D
18. C
19. B
20. A
21. D
22. C
23. D
24. A
25. B
26. B
27. B
28. C
29. A
30. B`;

export default function OmrWorkspace({
  sources = {},
  onFile,
  savedSheets = [],
  activeSavedId = '',
  selectSaved
}) {
  const [omrData, setOmrData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [keyText, setKeyText] = useState(SAMPLE_KEY);
  const [onlyValidRolls, setOnlyValidRolls] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState(0);
  const [activeTab, setActiveTab] = useState('results'); // 'results' | 'issues'
  const [isExporting, setIsExporting] = useState(false);

  // Parse Answer Key
  const parsedKey = useMemo(() => parseAnswerKey(keyText), [keyText]);

  // Handle OMR File Upload
  const handleFileUpload = async (file) => {
    if (!file) return;
    setFileName(file.name);
    try {
      const bytes = await file.arrayBuffer();
      const wb = XLSX.read(bytes, { type: 'array', raw: false });
      const sheetName = wb.SheetNames[0];
      const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false });
      const parsed = parseOmrMatrix(matrix, file.name);
      setOmrData(parsed);
      if (parsed.examTitle) {
        setExamTitle(parsed.examTitle);
      }

      // Check for auto-detected key if key field is empty
      if (!keyText.trim()) {
        const detected = autoDetectAnswerKey(parsed.rows, parsed.questionColumns);
        if (detected) {
          const autoKeyStr = Object.entries(detected.keyMap)
            .map(([q, ans]) => `${q}. ${ans}`)
            .join('\n');
          setKeyText(`Auto-detected Key (From Roll ${detected.detectedFromRoll})\n${autoKeyStr}`);
        }
      }
    } catch (err) {
      console.error('Error reading OMR file:', err);
      alert('Could not read the uploaded OMR file. Please ensure it is a valid .xlsx or .csv.');
    }
  };

  // Process data using bridged logic from main.jsx
  const processed = useMemo(() => {
    if (!omrData) return { results: [], issues: [], stats: {} };
    return processOmrData({
      omrData,
      answerKeyMap: parsedKey.keyMap,
      sources,
      totalMcq: parsedKey.totalQuestions || omrData.questionColumns?.length || 30
    });
  }, [omrData, parsedKey, sources]);

  // Filtered results
  const filteredResults = useMemo(() => {
    return (processed.results || []).filter(item => {
      if (onlyValidRolls && !item.isValidRoll) return false;
      if (minScoreFilter > 0 && item.score < minScoreFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const rollMatch = String(item.roll || '').toLowerCase().includes(q);
        const nameMatch = String(item.name || '').toLowerCase().includes(q);
        return rollMatch || nameMatch;
      }
      return true;
    });
  }, [processed.results, onlyValidRolls, minScoreFilter, searchQuery]);

  const totalMcq = processed.stats?.totalQuestions || parsedKey.totalQuestions || 30;

  // Auto-detect Key action
  const handleAutoDetect = () => {
    if (!omrData) return;
    const detected = autoDetectAnswerKey(omrData.rows, omrData.questionColumns);
    if (detected) {
      const autoKeyStr = Object.entries(detected.keyMap)
        .map(([q, ans]) => `${q}. ${ans}`)
        .join('\n');
    } else {
      alert('Could not find a student with 100% score to auto-detect the answer key. Please paste the answer key manually.');
    }
  };

  // Live Infographic Canvas Generator
  const infographDataUrl = useMemo(() => {
    if (!omrData || typeof document === 'undefined') return null;
    const canvas = generateInfographicCanvas({
      stats: processed.stats,
      totalMcq,
      examTitle: examTitle || fileName || 'OMR Exam Result'
    });
    return canvas ? canvas.toDataURL('image/png', 0.95) : null;
  }, [omrData, processed.stats, totalMcq, examTitle, fileName]);

  const handleDownloadGraph = () => {
    const canvas = generateInfographicCanvas({
      stats: processed.stats,
      totalMcq,
      examTitle: examTitle || fileName || 'OMR Exam Result'
    });
    if (canvas) {
      const baseName = safeExportName(fileName || examTitle || 'OMR_Exam');
      downloadInfographicImage(canvas, `${baseName} - Detailed Analytics Infograph`);
    }
  };

  return (
    <div className="omr-workspace" style={{ padding: '20px 24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Banner */}
      <div style={{ background: '#1e293b', color: 'white', padding: '16px 20px', borderRadius: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>OMR Result Cleaner & 50-MCQ Analyzer</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Cleans raw OMR exports, bridges student roster matching, grades responses against Answer Key, and exports compact searchable PDF & Excel.
          </p>
        </div>
        {(sources.web?.linked || sources.students) && (
          <div style={{ background: '#0f172a', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
            <CheckCircle2 size={16} /> Roster connected: {sources.web?.linked ? sources.web.workbookTitle : sources.students?.fileName}
          </div>
        )}
      </div>

      {/* Setup Panels: OMR File, Answer Key, and Student Roster */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        {/* Panel 1: Upload OMR File */}
        <div style={{ background: 'white', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <FileSpreadsheet size={18} color="#0284c7" />
            <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>1. Upload Raw OMR Export</h3>
          </div>
          <label style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            border: '2px dashed #cbd5e1',
            borderRadius: '8px',
            cursor: 'pointer',
            background: omrData ? '#f0fdf4' : '#f8fafc',
            transition: 'all 0.2s'
          }}>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e.target.files[0])}
            />
            {omrData ? (
              <>
                <CheckCircle2 size={32} color="#16a34a" />
                <span style={{ fontWeight: '600', color: '#16a34a', marginTop: '8px' }}>{fileName}</span>
                <span style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {omrData.rows?.length || 0} students loaded · {omrData.questionColumns?.length || 0} MCQ columns
                </span>
              </>
            ) : (
              <>
                <Upload size={32} color="#64748b" />
                <span style={{ fontWeight: '600', color: '#334155', marginTop: '8px' }}>Click to select OMR file</span>
                <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Supports .csv, .xlsx</span>
              </>
            )}
          </label>

          {omrData && (
            <div style={{ marginTop: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>
                Exam Title
              </label>
              <input
                type="text"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="e.g. 27 Exam 9 - Results"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          )}
        </div>

        {/* Panel 2: Answer Key Input */}
        <div style={{ background: 'white', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} color="#d97706" />
              <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>2. Exam Answer Key</h3>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              padding: '3px 8px',
              borderRadius: '12px',
              background: parsedKey.totalQuestions > 0 ? '#dcfce7' : '#fee2e2',
              color: parsedKey.totalQuestions > 0 ? '#15803d' : '#b91c1c'
            }}>
              {parsedKey.totalQuestions} Questions Loaded
            </span>
          </div>

          <textarea
            rows={6}
            value={keyText}
            onChange={(e) => setKeyText(e.target.value)}
            placeholder={"Paste answer key here:\n1. B\n2. B\n3. C..."}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontFamily: 'monospace',
              fontSize: '12.5px',
              lineHeight: '1.4',
              resize: 'vertical'
            }}
          />

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setKeyText(SAMPLE_KEY)}
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
            >
              Prefill 30-MCQ Sample Key
            </button>
            <button
              onClick={handleAutoDetect}
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Sparkles size={13} color="#d97706" /> Auto-detect from Perfect Scorer
            </button>
            <button
              onClick={() => setKeyText('')}
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', marginLeft: 'auto' }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Panel 3: Student Names Roster */}
        <div style={{ background: 'white', padding: '18px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="#8b5cf6" />
              <h3 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>3. Student Names Roster</h3>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              padding: '3px 8px',
              borderRadius: '12px',
              background: (sources.web?.linked || sources.students) ? '#dcfce7' : '#f1f5f9',
              color: (sources.web?.linked || sources.students) ? '#15803d' : '#64748b'
            }}>
              {(sources.web?.linked || sources.students) ? 'Connected' : 'Optional'}
            </span>
          </div>

          {(sources.web?.linked || sources.students) ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: '600', fontSize: '13px' }}>
                <CheckCircle2 size={16} /> {sources.web?.linked ? sources.web.workbookTitle : sources.students?.fileName}
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                {sources.web?.rows?.length || sources.students?.rows?.length || 0} registered students available
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px 0', lineHeight: '1.4' }}>
              Connect a roster to automatically replace roll numbers with student names in exports.
            </p>
          )}

          {/* Database Selector if saved Google Sheets exist */}
          {savedSheets && savedSheets.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>
                Choose Saved Google Sheet:
              </label>
              <select
                value={activeSavedId}
                onChange={(e) => selectSaved && selectSaved(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
              >
                <option value="">Select Google Sheet database...</option>
                {savedSheets.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Upload Students File */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px',
            border: '1px dashed #cbd5e1',
            borderRadius: '6px',
            cursor: 'pointer',
            background: '#f8fafc',
            fontSize: '12px',
            fontWeight: '600',
            color: '#334155'
          }}>
            <Upload size={15} color="#64748b" />
            <span>{sources.students ? 'Change Students sheet (.xlsx/.csv)' : 'Upload Students sheet (.xlsx/.csv)'}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files[0] && onFile && onFile(e.target.files[0], 'students')}
            />
          </label>
        </div>
      </div>

      {/* Comprehensive Exam Analytics & Stat Bar */}
      {omrData && (
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="#0284c7" />
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>পরীক্ষার সার্বিক ফলাফল ও পরিসংখ্যান বিশ্লেষণ</h3>
            </div>
            <div style={{ display: 'flex', gap: '15px', fontSize: '12px', fontWeight: '600' }}>
              <span style={{ color: '#16a34a' }}>সবচেয়ে সহজ: Q{processed.stats?.easiest?.q || '—'} ({processed.stats?.easiest?.acc || 0}% সঠিক উত্তর)</span>
              <span style={{ color: '#dc2626' }}>সবচেয়ে কঠিন: Q{processed.stats?.hardest?.q || '—'} ({processed.stats?.hardest?.acc || 0}% সঠিক উত্তর)</span>
            </div>
          </div>

          {/* Key Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500' }}>মোট পরীক্ষার্থী</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>{processed.stats?.valid || 0}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>ফাইলে মোট তথ্য: {processed.stats?.total || 0} টি</div>
            </div>
            <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '11.5px', color: '#166534', fontWeight: '500' }}>সর্বোচ্চ নম্বর</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803d' }}>{processed.stats?.highest || 0} <span style={{ fontSize: '13px', fontWeight: '600' }}>/ {totalMcq}</span></div>
              <div style={{ fontSize: '11px', color: '#16a34a' }}>সঠিকতার হার: {Math.round(((processed.stats?.highest || 0) / totalMcq) * 100)}%</div>
            </div>
            <div style={{ background: '#eff6ff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '11.5px', color: '#1e40af', fontWeight: '500' }}>গড় নম্বর (Average)</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#1d4ed8' }}>{processed.stats?.average || 0} <span style={{ fontSize: '13px', fontWeight: '600' }}>/ {totalMcq}</span></div>
              <div style={{ fontSize: '11px', color: '#3b82f6' }}>মধ্যমা (Median): {processed.stats?.median || 0}</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '11.5px', color: '#991b1b', fontWeight: '500' }}>সর্বনিম্ন নম্বর</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#b91c1c' }}>{processed.stats?.lowest || 0} <span style={{ fontSize: '13px', fontWeight: '600' }}>/ {totalMcq}</span></div>
              <div style={{ fontSize: '11px', color: '#dc2626' }}>সঠিকতার হার: {Math.round(((processed.stats?.lowest || 0) / totalMcq) * 100)}%</div>
            </div>
            {(sources.students || sources.web) && (
              <div style={{ background: '#faf5ff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
                <div style={{ fontSize: '11.5px', color: '#6b21a8', fontWeight: '500' }}>তালিকা বহির্ভূত রোল</div>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#7e22ce' }}>{processed.stats?.excluded || 0}</div>
                <div style={{ fontSize: '11px', color: '#a855f7' }}>ফলাফল তালিকা থেকে বাদ</div>
              </div>
            )}
            <div style={{ background: '#fffbeb', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '11.5px', color: '#92400e', fontWeight: '500' }}>পর্যালোচনা প্রয়োজন</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#b45309' }}>{processed.issues?.length || 0}</div>
              <div style={{ fontSize: '11px', color: '#d97706' }}>ভুল বা ডুপ্লিকেট রোল</div>
            </div>
          </div>

          {/* Visual Score Distribution Brackets */}
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
              নম্বর ভিত্তিক গ্রেড বণ্টন ও মেধা বিশ্লেষণ:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#16a34a' }}></span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>80% - 100% (A+)</span>
                <span style={{ marginLeft: 'auto', fontWeight: '700', color: '#16a34a' }}>{processed.stats?.bracketA || 0} জন ({processed.stats?.valid ? Math.round(((processed.stats?.bracketA || 0) / processed.stats.valid) * 100) : 0}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#2563eb' }}></span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>60% - 79% (A/B)</span>
                <span style={{ marginLeft: 'auto', fontWeight: '700', color: '#2563eb' }}>{processed.stats?.bracketB || 0} জন ({processed.stats?.valid ? Math.round(((processed.stats?.bracketB || 0) / processed.stats.valid) * 100) : 0}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#d97706' }}></span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>40% - 59% (উত্তীর্ণ)</span>
                <span style={{ marginLeft: 'auto', fontWeight: '700', color: '#d97706' }}>{processed.stats?.bracketC || 0} জন ({processed.stats?.valid ? Math.round(((processed.stats?.bracketC || 0) / processed.stats.valid) * 100) : 0}%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#dc2626' }}></span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>&lt; 40% (অনুত্তীর্ণ)</span>
                <span style={{ marginLeft: 'auto', fontWeight: '700', color: '#dc2626' }}>{processed.stats?.bracketFail || 0} জন ({processed.stats?.valid ? Math.round(((processed.stats?.bracketFail || 0) / processed.stats.valid) * 100) : 0}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar: Filters & Export Buttons */}
      {omrData && (
        <div style={{ background: 'white', padding: '14px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <Search size={14} color="#64748b" style={{ marginRight: '6px' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Roll or Name..."
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '160px' }}
              />
            </div>

            {/* Filter Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={onlyValidRolls}
                onChange={(e) => setOnlyValidRolls(e.target.checked)}
              />
              <span style={{ fontWeight: '500' }}>Filter Valid Rolls Only (hide N/A)</span>
            </label>

            {/* Tabs */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px' }}>
              <button
                onClick={() => setActiveTab('results')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: activeTab === 'results' ? 'white' : 'transparent',
                  color: activeTab === 'results' ? '#0f172a' : '#64748b',
                  boxShadow: activeTab === 'results' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Results ({filteredResults.length})
              </button>
              <button
                onClick={() => setActiveTab('issues')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: activeTab === 'issues' ? 'white' : 'transparent',
                  color: activeTab === 'issues' ? '#dc2626' : '#64748b',
                  boxShadow: activeTab === 'issues' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Flagged Issues ({processed.issues?.length || 0})
              </button>
            </div>
          </div>

          {/* Export Actions */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleDownloadGraph}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
              }}
            >
              <BarChart3 size={15} /> গ্রাফ ইমেজ (HD PNG)
            </button>

            <button
              onClick={() => {
                exportOmrPdf({
                  results: filteredResults,
                  totalMcq,
                  examTitle,
                  fileName,
                  stats: processed.stats
                });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: '#0f172a',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <Download size={15} /> Export Detailed PDF (A4)
            </button>

            <button
              onClick={() => {
                exportOmrXlsx({
                  results: filteredResults,
                  totalMcq,
                  examTitle,
                  fileName,
                  issues: processed.issues,
                  stats: processed.stats
                });
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <FileSpreadsheet size={15} /> Export Detailed Excel (.xlsx)
            </button>
          </div>
        </div>
      )}

      {/* Visual Infographic & Performance Graph Preview */}
      {omrData && infographDataUrl && (
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '18px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ background: '#0f172a', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600' }}>
              <BarChart3 size={16} color="#38bdf8" />
              <span>ভিজ্যুয়াল ইনফোগ্রাফিক ও পারফরম্যান্স গ্রাফ (PDF-এর প্রথম পাতায় স্বয়ংক্রিয়ভাবে যুক্ত হবে)</span>
            </div>
            <button
              onClick={handleDownloadGraph}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Download size={14} /> গ্রাফ ইমেজ ডাউনলোড (HD PNG)
            </button>
          </div>
          <div style={{ padding: '14px', background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
            <img
              src={infographDataUrl}
              alt="Exam Analytics Infographic"
              style={{ width: '100%', maxWidth: '1200px', height: 'auto', borderRadius: '6px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}
            />
          </div>
        </div>
      )}

      {/* Main Table Preview */}
      {omrData && activeTab === 'results' && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Legend Bar */}
          <div style={{ background: '#f8fafc', padding: '8px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '20px', fontSize: '11px', fontWeight: '600', alignItems: 'center' }}>
            <span style={{ color: '#64748b' }}>Color Legend:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '14px', height: '14px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '3px', display: 'inline-block' }}></span>
              <span style={{ color: '#15803d' }}>Correct Answer (✓)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '14px', height: '14px', background: '#fca5a5', border: '1px solid #f87171', borderRadius: '3px', display: 'inline-block' }}></span>
              <span style={{ color: '#7f1d1d', fontWeight: '700' }}>Wrong Answer (✗)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '14px', height: '14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '3px', display: 'inline-block' }}></span>
              <span style={{ color: '#64748b' }}>Blank / Unattempted (—)</span>
            </div>
            <span style={{ marginLeft: 'auto', color: '#64748b' }}>PDF Capacity: ~35 students per page</span>
          </div>

          {/* Scrollable Table */}
          <div style={{ overflowX: 'auto', maxHeight: '550px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'center' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1e293b', color: 'white' }}>
                <tr>
                  <th style={{ padding: '8px 6px', width: '38px', borderRight: '1px solid #334155' }}>Rank</th>
                  <th style={{ padding: '8px 8px', width: '80px', borderRight: '1px solid #334155' }}>Roll</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', width: '130px', borderRight: '1px solid #334155' }}>Student Name</th>
                  <th style={{ padding: '8px 6px', width: '50px', borderRight: '1px solid #334155' }}>Score</th>
                  <th style={{ padding: '8px 4px', width: '28px', borderRight: '1px solid #334155' }}>✓</th>
                  <th style={{ padding: '8px 4px', width: '28px', borderRight: '1px solid #334155' }}>✗</th>
                  <th style={{ padding: '8px 4px', width: '28px', borderRight: '1px solid #334155' }}>—</th>
                  <th style={{ padding: '8px 6px', width: '45px', borderRight: '1px solid #334155' }}>Acc%</th>
                  {Array.from({ length: totalMcq }, (_, i) => (
                    <th key={i} style={{ padding: '8px 2px', minWidth: totalMcq > 35 ? '20px' : '24px', borderRight: '1px solid #334155', fontSize: '10px' }}>
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, rowIdx) => (
                  <tr key={rowIdx} style={{ borderBottom: '1px solid #e2e8f0', background: rowIdx % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td style={{ padding: '6px 4px', fontWeight: '700', color: '#475569', borderRight: '1px solid #e2e8f0' }}>{r.rank}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: '600', borderRight: '1px solid #e2e8f0' }}>{r.roll}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '500', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>
                      {r.name && r.name !== '—' ? r.name : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ padding: '6px 4px', fontWeight: '700', color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>{r.score}/{totalMcq}</td>
                    <td style={{ padding: '6px 4px', color: '#16a34a', fontWeight: '600', borderRight: '1px solid #e2e8f0' }}>{r.correct}</td>
                    <td style={{ padding: '6px 4px', color: '#dc2626', fontWeight: '600', borderRight: '1px solid #e2e8f0' }}>{r.wrong}</td>
                    <td style={{ padding: '6px 4px', color: '#64748b', borderRight: '1px solid #e2e8f0' }}>{r.blank}</td>
                    <td style={{ padding: '6px 4px', fontWeight: '600', borderRight: '1px solid #e2e8f0' }}>{r.accuracy}</td>
                    {Array.from({ length: totalMcq }, (_, i) => {
                      const qNum = i + 1;
                      const ans = r.answers?.[qNum] || { studentAns: '—', status: 'BLANK' };
                      let bg = '#f1f5f9';
                      let color = '#94a3b8';
                      if (ans.isCorrect) {
                        bg = '#dcfce7';
                        color = '#15803d';
                      } else if (ans.isWrong) {
                        bg = '#fca5a5';
                        color = '#7f1d1d';
                      } else if (ans.isInvalid) {
                        bg = '#fed7aa';
                        color = '#9a3412';
                      }
                      return (
                        <td
                          key={qNum}
                          style={{
                            padding: '4px 1px',
                            background: bg,
                            color,
                            fontWeight: '700',
                            borderRight: '1px solid #e2e8f0',
                            fontSize: '10px'
                          }}
                          title={`Q${qNum}: Student answered ${ans.studentAns}${ans.keyAns ? ` (Correct: ${ans.keyAns})` : ''}`}
                        >
                          {ans.studentAns}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Flagged Issues View */}
      {omrData && activeTab === 'issues' && (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#dc2626' }}>
            Flagged Rolls & Audit Issues ({processed.issues?.length || 0})
          </h4>
          {processed.issues?.length === 0 ? (
            <div style={{ color: '#16a34a', fontSize: '13px' }}>No issues found! All roll numbers are valid.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Type</th>
                  <th style={{ padding: '8px' }}>Roll in Sheet</th>
                  <th style={{ padding: '8px' }}>Row Number</th>
                  <th style={{ padding: '8px' }}>Details / Reason</th>
                </tr>
              </thead>
              <tbody>
                {processed.issues.map((issue, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px', fontWeight: '600', color: '#dc2626' }}>{issue.type}</td>
                    <td style={{ padding: '8px', fontFamily: 'monospace' }}>{issue.roll}</td>
                    <td style={{ padding: '8px' }}>{issue.rowNumber}</td>
                    <td style={{ padding: '8px', color: '#64748b' }}>{issue.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
