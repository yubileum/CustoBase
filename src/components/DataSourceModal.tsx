import React, { useState } from 'react';
import { useData, RefreshInterval, TableSource } from '../lib/DataContext';
import { isExcel365Url, parseCSV, parseExcelSheet, getExcelSheetNames, fetchSheetCSV, extractFields, fetchGoogleSheetNames, fetchExcel365SheetNames } from '../lib/dataUtils';
import { Upload, Link as LinkIcon, Database, X, RefreshCw, Plus, Trash2, Table2, ExternalLink } from 'lucide-react';
import { useToast } from '../lib/ToastContext';

interface Props { onClose: () => void; }

const REFRESH_OPTIONS: { label: string; value: RefreshInterval }[] = [
  { label: 'Manual only', value: 0 },
  { label: 'Every 30 seconds', value: 30 },
  { label: 'Every 1 minute', value: 60 },
  { label: 'Every 5 minutes', value: 300 },
  { label: 'Every 15 minutes', value: 900 },
  { label: 'Every 30 minutes', value: 1800 },
];

type SourceMode = 'upload' | 'google' | 'excel365' | 'csv';

function isGoogleSheetsUrl(url: string) { return url.includes('docs.google.com/spreadsheets'); }

export default function DataSourceModal({ onClose }: Props) {
  const { upsertTable } = useData();
  const { success, error: toastError } = useToast();

  const [mode, setMode] = useState<SourceMode>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedInterval, setSelectedInterval] = useState<RefreshInterval>(0);

  // URL states
  const [url, setUrl] = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>(['']);

  // Upload states
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [detectedSheets, setDetectedSheets] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [detectingSheets, setDetectingSheets] = useState(false);

  // Available sheets from URL
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [fetchingSheets, setFetchingSheets] = useState(false);

  React.useEffect(() => {
    const trimmed = url.trim();
    if (mode === 'google' && isGoogleSheetsUrl(trimmed)) {
      setFetchingSheets(true);
      fetchGoogleSheetNames(trimmed)
        .then(sheets => {
           setAvailableSheets(sheets);
           if (sheets.length > 0 && sheetNames.length === 1 && sheetNames[0] === '') {
             setSheetNames(['*']);
           }
        })
        .catch(() => setAvailableSheets([]))
        .finally(() => setFetchingSheets(false));
    } else if (mode === 'excel365' && isExcel365Url(trimmed)) {
      setFetchingSheets(true);
      fetchExcel365SheetNames(trimmed)
        .then(sheets => {
           setAvailableSheets(sheets);
           if (sheets.length > 0 && sheetNames.length === 1 && sheetNames[0] === '') {
             setSheetNames(['*']);
           }
        })
        .catch(() => setAvailableSheets([]))
        .finally(() => setFetchingSheets(false));
    } else {
      setAvailableSheets([]);
    }
  }, [url, mode]);

  // ── URL helpers ───────────────────────────────────────────────────────────
  const handleUrlConnect = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true); setError('');
    try {
      if (isGoogleSheetsUrl(trimmed) || isExcel365Url(trimmed)) {
        const nonEmpty = sheetNames.map(s => s.trim()).filter(Boolean);
        let sheetsToLoad: Array<string | undefined> = nonEmpty.length > 0 ? nonEmpty : [undefined];

        if (sheetsToLoad.includes('*') && availableSheets.length > 0) {
          sheetsToLoad = Array.from(new Set([
            ...sheetsToLoad.filter(s => s !== '*'),
            ...availableSheets
          ]));
        }

        for (const sheetName of sheetsToLoad) {
          const data = await fetchSheetCSV(trimmed, sheetName);
          const fields = extractFields(data);
          let defaultName = 'Data';
          if (isGoogleSheetsUrl(trimmed)) defaultName = sheetName || 'Sheet1';
          else defaultName = sheetName || new URL(trimmed).pathname.split('/').pop()?.replace(/\?.*/, '') || 'Excel 365';

          upsertTable({
            id: crypto.randomUUID(), name: defaultName,
            data, fields, sourceUrl: trimmed, sheetName,
            refreshInterval: selectedInterval, lastUpdated: new Date(),
          });
        }
      } else {
        const data = await fetchSheetCSV(trimmed);
        const fields = extractFields(data);
        const name = trimmed.split('/').pop()?.split('?')[0] || 'Remote Data';
        upsertTable({
          id: crypto.randomUUID(), name,
          data, fields, sourceUrl: trimmed,
          refreshInterval: selectedInterval, lastUpdated: new Date(),
        });
      }
      success('Data source connected!');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error fetching data');
    } finally { setLoading(false); }
  };

  // ── Upload helpers ────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file); setDetectedSheets([]); setSelectedSheets(new Set()); setError('');
    if (file.name.match(/\.xlsx?$|\\.xls$/i)) {
      setDetectingSheets(true);
      try {
        const sheets = await getExcelSheetNames(file);
        setDetectedSheets(sheets);
        setSelectedSheets(new Set(sheets));
      } catch (err: any) {
        setError(err.message || 'Could not read Excel file.');
      } finally { setDetectingSheets(false); }
    }
  };

  const toggleSheet = (name: string) => {
    setSelectedSheets(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleImport = async () => {
    if (!uploadedFile) return;
    setLoading(true); setError('');
    try {
      if (uploadedFile.name.endsWith('.csv')) {
        const data = await parseCSV(uploadedFile);
        const fields = extractFields(data);
        upsertTable({ id: crypto.randomUUID(), name: uploadedFile.name, data, fields, refreshInterval: 0, lastUpdated: new Date() });
        success(`"${uploadedFile.name}" imported!`);
        onClose(); return;
      }
      if (uploadedFile.name.match(/\.xlsx?$|\\.xls$/i)) {
        const sheetsToImport = Array.from(selectedSheets);
        if (sheetsToImport.length === 0) { setError('Select at least one sheet.'); setLoading(false); return; }
        for (const sheetName of sheetsToImport) {
          const data = await parseExcelSheet(uploadedFile, sheetName);
          const fields = extractFields(data);
          upsertTable({ id: crypto.randomUUID(), name: sheetName, data, fields, refreshInterval: 0, lastUpdated: new Date() });
        }
        success(`${sheetsToImport.length} sheet(s) imported!`);
        onClose(); return;
      }
      throw new Error('Unsupported file type. Use CSV or Excel (.xlsx, .xls).');
    } catch (err: any) { setError(err.message || 'Error processing file'); }
    finally { setLoading(false); }
  };

  const TABS: { id: SourceMode; label: string; icon: any }[] = [
    { id: 'upload',   label: 'Upload File',     icon: Upload },
    { id: 'google',   label: 'Google Sheets',   icon: Table2 },
    { id: 'excel365', label: 'Excel 365',        icon: ExternalLink },
    { id: 'csv',      label: 'CSV URL',          icon: LinkIcon },
  ];

  return (
    <div className="modal-backdrop">
      <div className="modal-panel" style={{ maxWidth: 500 }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-base)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="accent-gradient" style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={15} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Connect Data Source</span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Tabs */}
          <div className="tab-bar">
            {TABS.map(t => (
              <button key={t.id} className={`tab-item ${mode === t.id ? 'active' : ''}`} onClick={() => setMode(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <t.icon size={12} />{t.label}
              </button>
            ))}
          </div>

          {/* ── Upload ─────────────────────────────────────────────────── */}
          {mode === 'upload' && (
            <>
              <div style={{
                border: '2px dashed var(--border-strong)', borderRadius: 12,
                padding: '32px 16px', textAlign: 'center', position: 'relative',
                cursor: 'pointer', transition: 'all 180ms',
                background: 'var(--bg-surface2)',
              }}>
                <input type="file" accept=".csv,.xlsx,.xls" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} onChange={handleFileChange} />
                <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
                {uploadedFile ? (
                  <>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{uploadedFile.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click to change</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }}>Drop file or click to browse</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>CSV, Excel (.xlsx, .xls)</p>
                  </>
                )}
              </div>

              {detectingSheets && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                  <RefreshCw size={14} className="animate-spin-slow" /> Detecting sheets…
                </div>
              )}

              {detectedSheets.length > 0 && !detectingSheets && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ margin: 0 }}>Sheets ({selectedSheets.size}/{detectedSheets.length})</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setSelectedSheets(new Set(detectedSheets))} style={{ fontSize: 11, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>All</button>
                      <button onClick={() => setSelectedSheets(new Set())} style={{ fontSize: 11, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>None</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                    {detectedSheets.map(name => (
                      <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-base)', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                        <input type="checkbox" checked={selectedSheets.has(name)} onChange={() => toggleSheet(name)} style={{ accentColor: 'var(--color-accent)' }} />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {uploadedFile && !detectingSheets && (
                <button onClick={handleImport} disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  {loading ? <RefreshCw size={14} className="animate-spin-slow" /> : <Upload size={14} />}
                  {loading ? 'Importing…' : 'Import'}
                </button>
              )}
            </>
          )}

          {/* ── Google Sheets ──────────────────────────────────────────── */}
          {mode === 'google' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Google Sheets URL</label>
                <input className="form-input" type="url" placeholder="https://docs.google.com/spreadsheets/d/..." value={url} onChange={e => setUrl(e.target.value)} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Sheet Names (optional)
                    {fetchingSheets && <RefreshCw size={12} className="animate-spin-slow" style={{ color: 'var(--text-muted)' }} />}
                  </label>
                  <button onClick={() => setSheetNames(p => [...p, ''])} style={{ fontSize: 11, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Plus size={11} style={{ display: 'inline' }} /> Add sheet
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Each sheet loads as a separate table. Leave blank for default sheet.</p>
                {sheetNames.map((name, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    {availableSheets.length > 0 ? (
                      <select className="form-select" value={name} onChange={e => setSheetNames(p => p.map((s, i) => i === idx ? e.target.value : s))} style={{ flex: 1 }}>
                        <option value="*">All</option>
                        {availableSheets.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input className="form-input" placeholder={`Sheet ${idx + 1}`} value={name} onChange={e => setSheetNames(p => p.map((s, i) => i === idx ? e.target.value : s))} />
                    )}
                    <button className="btn btn-ghost btn-icon" onClick={() => setSheetNames(p => { const n = p.filter((_, i) => i !== idx); return n.length ? n : ['']; })} disabled={sheetNames.length === 1}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <AutoRefreshSelect value={selectedInterval} onChange={setSelectedInterval} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Set Google Sheets access to <strong>"Anyone with the link"</strong> before connecting.
              </p>
              <button onClick={handleUrlConnect} disabled={!url.trim() || loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? <RefreshCw size={14} className="animate-spin-slow" /> : <Database size={14} />}
                {loading ? 'Connecting…' : 'Connect Google Sheets'}
              </button>
            </div>
          )}

          {/* ── Excel 365 ─────────────────────────────────────────────── */}
          {mode === 'excel365' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, background: 'var(--bg-active)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)', fontSize: 12, color: 'var(--text-secondary)' }}>
                <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--color-accent)' }}>📊 Excel 365 / OneDrive / SharePoint</p>
                <ol style={{ margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
                  <li>Open your Excel file in Office 365 online</li>
                  <li>Click <strong>Share → Copy link</strong></li>
                  <li>Set permission to <strong>"Anyone with the link can view"</strong></li>
                  <li>Paste the share URL below</li>
                </ol>
              </div>
              <div>
                <label className="form-label">OneDrive / SharePoint Share URL</label>
                <input className="form-input" type="url" placeholder="https://1drv.ms/x/... or https://company.sharepoint.com/..." value={url} onChange={e => setUrl(e.target.value)} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Sheet Names (optional)
                    {fetchingSheets && <RefreshCw size={12} className="animate-spin-slow" style={{ color: 'var(--text-muted)' }} />}
                  </label>
                  <button onClick={() => setSheetNames(p => [...p, ''])} style={{ fontSize: 11, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Plus size={11} style={{ display: 'inline' }} /> Add sheet
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Each sheet loads as a separate table. Leave blank for default sheet.</p>
                {sheetNames.map((name, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    {availableSheets.length > 0 ? (
                      <select className="form-select" value={name} onChange={e => setSheetNames(p => p.map((s, i) => i === idx ? e.target.value : s))} style={{ flex: 1 }}>
                        <option value="*">All</option>
                        {availableSheets.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input className="form-input" placeholder={`Sheet ${idx + 1}`} value={name} onChange={e => setSheetNames(p => p.map((s, i) => i === idx ? e.target.value : s))} />
                    )}
                    <button className="btn btn-ghost btn-icon" onClick={() => setSheetNames(p => { const n = p.filter((_, i) => i !== idx); return n.length ? n : ['']; })} disabled={sheetNames.length === 1}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <AutoRefreshSelect value={selectedInterval} onChange={setSelectedInterval} />
              <button onClick={handleUrlConnect} disabled={!url.trim() || loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? <RefreshCw size={14} className="animate-spin-slow" /> : <ExternalLink size={14} />}
                {loading ? 'Connecting…' : 'Connect Excel 365'}
              </button>
            </div>
          )}

          {/* ── CSV URL ────────────────────────────────────────────────── */}
          {mode === 'csv' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Public CSV URL</label>
                <input className="form-input" type="url" placeholder="https://example.com/data.csv" value={url} onChange={e => setUrl(e.target.value)} />
              </div>
              <AutoRefreshSelect value={selectedInterval} onChange={setSelectedInterval} />
              <button onClick={handleUrlConnect} disabled={!url.trim() || loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? <RefreshCw size={14} className="animate-spin-slow" /> : <LinkIcon size={14} />}
                {loading ? 'Fetching…' : 'Connect CSV'}
              </button>
            </div>
          )}

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AutoRefreshSelect({ value, onChange }: { value: RefreshInterval; onChange: (v: RefreshInterval) => void }) {
  return (
    <div>
      <label className="form-label">Auto-Refresh</label>
      <select className="form-select" value={value} onChange={e => onChange(Number(e.target.value) as RefreshInterval)}>
        {REFRESH_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  );
}
