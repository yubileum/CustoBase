import React, { useState } from 'react';
import { useData, RefreshInterval, TableSource } from '../lib/DataContext';
import {
  parseCSV,
  parseExcelSheet,
  getExcelSheetNames,
  fetchSheetCSV,
  extractFields,
} from '../lib/dataUtils';
import { Upload, Link as LinkIcon, Database, X, RefreshCw, Plus, Trash2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const REFRESH_OPTIONS: { label: string; value: RefreshInterval }[] = [
  { label: 'Manual only', value: 0 },
  { label: 'Every 30 seconds', value: 30 },
  { label: 'Every 1 minute', value: 60 },
  { label: 'Every 5 minutes', value: 300 },
  { label: 'Every 15 minutes', value: 900 },
  { label: 'Every 30 minutes', value: 1800 },
];

function isGoogleSheetsUrl(url: string): boolean {
  return url.includes('docs.google.com/spreadsheets');
}

export default function DataSourceModal({ onClose }: Props) {
  const { upsertTable } = useData();

  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedInterval, setSelectedInterval] = useState<RefreshInterval>(0);

  // ── URL tab state ────────────────────────────────────────────────────────────
  const [url, setUrl] = useState('');
  // Sheet name inputs: each entry is a sheet name string
  const [sheetNames, setSheetNames] = useState<string[]>(['']);

  // ── Upload tab state ─────────────────────────────────────────────────────────
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [detectedSheets, setDetectedSheets] = useState<string[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [detectingSheets, setDetectingSheets] = useState(false);

  // ── URL helpers ──────────────────────────────────────────────────────────────

  const addSheetNameInput = () => setSheetNames(prev => [...prev, '']);

  const removeSheetNameInput = (idx: number) => {
    setSheetNames(prev => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [''] : next;
    });
  };

  const updateSheetName = (idx: number, value: string) => {
    setSheetNames(prev => prev.map((s, i) => (i === idx ? value : s)));
  };

  const handleUrlConnect = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setLoading(true);
    setError('');

    try {
      if (isGoogleSheetsUrl(trimmedUrl)) {
        // Load each non-empty sheet name as a separate table
        const nonEmpty = sheetNames.map(s => s.trim()).filter(Boolean);

        // If no sheet names entered, load the default (first) sheet
        const sheetsToLoad: Array<string | undefined> = nonEmpty.length > 0 ? nonEmpty : [undefined];

        for (const sheetName of sheetsToLoad) {
          const parsedData = await fetchSheetCSV(trimmedUrl, sheetName);
          const fields = extractFields(parsedData);
          const tableName = sheetName || 'Sheet1';
          const table: TableSource = {
            id: crypto.randomUUID(),
            name: tableName,
            data: parsedData,
            fields,
            sourceUrl: trimmedUrl,
            sheetName: sheetName,
            refreshInterval: selectedInterval,
            lastUpdated: new Date(),
          };
          upsertTable(table);
        }
      } else {
        // Plain CSV URL — single table
        const parsedData = await fetchSheetCSV(trimmedUrl);
        const fields = extractFields(parsedData);
        const tableName = trimmedUrl.split('/').pop()?.split('?')[0] || 'Remote Data';
        const table: TableSource = {
          id: crypto.randomUUID(),
          name: tableName,
          data: parsedData,
          fields,
          sourceUrl: trimmedUrl,
          refreshInterval: selectedInterval,
          lastUpdated: new Date(),
        };
        upsertTable(table);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error fetching data from URL');
    } finally {
      setLoading(false);
    }
  };

  // ── Upload helpers ───────────────────────────────────────────────────────────

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setDetectedSheets([]);
    setSelectedSheets(new Set());
    setError('');

    if (file.name.match(/\.xlsx?$|\.xls$/i)) {
      setDetectingSheets(true);
      try {
        const sheets = await getExcelSheetNames(file);
        setDetectedSheets(sheets);
        setSelectedSheets(new Set(sheets)); // default: all selected
      } catch (err: any) {
        setError(err.message || 'Could not read Excel file.');
      } finally {
        setDetectingSheets(false);
      }
    }
  };

  const toggleSheet = (name: string) => {
    setSelectedSheets(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const selectAllSheets = () => setSelectedSheets(new Set(detectedSheets));
  const deselectAllSheets = () => setSelectedSheets(new Set());

  const handleImport = async () => {
    if (!uploadedFile) return;
    setLoading(true);
    setError('');

    try {
      if (uploadedFile.name.endsWith('.csv')) {
        const parsedData = await parseCSV(uploadedFile);
        const fields = extractFields(parsedData);
        const table: TableSource = {
          id: crypto.randomUUID(),
          name: uploadedFile.name,
          data: parsedData,
          fields,
          refreshInterval: 0,
          lastUpdated: new Date(),
        };
        upsertTable(table);
        onClose();
        return;
      }

      if (uploadedFile.name.match(/\.xlsx?$|\.xls$/i)) {
        const sheetsToImport = Array.from(selectedSheets);
        if (sheetsToImport.length === 0) {
          setError('Please select at least one sheet to import.');
          setLoading(false);
          return;
        }
        for (const sheetName of sheetsToImport) {
          const parsedData = await parseExcelSheet(uploadedFile, sheetName);
          const fields = extractFields(parsedData);
          const table: TableSource = {
            id: crypto.randomUUID(),
            name: sheetName,
            data: parsedData,
            fields,
            refreshInterval: 0,
            lastUpdated: new Date(),
          };
          upsertTable(table);
        }
        onClose();
        return;
      }

      throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
    } catch (err: any) {
      setError(err.message || 'Error processing file');
    } finally {
      setLoading(false);
    }
  };

  const isGSheets = isGoogleSheetsUrl(url);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="w-5 h-5" /> Connect Data Source
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto">
          {/* Tab switcher */}
          <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
            <button
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${mode === 'upload' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setMode('upload')}
            >
              Upload File
            </button>
            <button
              className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${mode === 'url' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setMode('url')}
            >
              Public URL
            </button>
          </div>

          {/* ── Upload tab ──────────────────────────────────────────────────── */}
          {mode === 'upload' && (
            <>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                />
                <Upload className="w-8 h-8 text-gray-400 mb-3" />
                {uploadedFile ? (
                  <>
                    <p className="font-medium text-gray-700 mb-1 truncate max-w-full px-4">{uploadedFile.name}</p>
                    <p className="text-xs text-gray-500">Click to change file</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-gray-700 mb-1">Click or drag file to this area to upload</p>
                    <p className="text-xs text-gray-500">Supports CSV or Excel (.xlsx, .xls) files.</p>
                  </>
                )}
              </div>

              {/* Sheet selector for Excel */}
              {detectingSheets && (
                <div className="text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Detecting sheets…
                </div>
              )}

              {detectedSheets.length > 0 && !detectingSheets && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Sheets to import ({selectedSheets.size} of {detectedSheets.length} selected)
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllSheets}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-xs text-gray-300">|</span>
                      <button
                        onClick={deselectAllSheets}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {detectedSheets.map(name => (
                      <label
                        key={name}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSheets.has(name)}
                          onChange={() => toggleSheet(name)}
                          className="accent-blue-600 w-4 h-4 shrink-0"
                        />
                        <span className="text-sm text-gray-700 truncate">{name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Import button (only shown once a file is chosen) */}
              {uploadedFile && !detectingSheets && (
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg shadow-sm text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {loading ? 'Importing…' : 'Import'}
                </button>
              )}
            </>
          )}

          {/* ── URL tab ─────────────────────────────────────────────────────── */}
          {mode === 'url' && (
            <div className="flex flex-col gap-4">
              {/* URL input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Google Sheets or CSV Public URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <LinkIcon className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Sheet names section — only for Google Sheets URLs */}
              {isGSheets && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Sheet Names</label>
                    <button
                      type="button"
                      onClick={addSheetNameInput}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add sheet
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 -mt-1">
                    Enter sheet names exactly as they appear in the spreadsheet. Each sheet loads as a separate table.
                  </p>
                  <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                    {sheetNames.map((name, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={`Sheet name ${idx + 1}`}
                          value={name}
                          onChange={(e) => updateSheetName(idx, e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeSheetNameInput(idx)}
                          disabled={sheetNames.length === 1}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Remove sheet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Auto-refresh */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Auto-Refresh Interval
                </label>
                <select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(Number(e.target.value) as RefreshInterval)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  {REFRESH_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-gray-500">
                For Google Sheets, set "General access" to "Anyone with the link" before connecting.
              </p>

              <button
                onClick={handleUrlConnect}
                disabled={!url.trim() || loading}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg shadow-sm text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {loading ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          )}

          {/* Error / loading feedback */}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center text-sm text-gray-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Processing data…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
