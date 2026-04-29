import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type DataRow = Record<string, any>;

// ─── CSV / Excel parsing ───────────────────────────────────────────────────────

export const parseCSV = (file: File): Promise<DataRow[]> =>
  new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: r => resolve(r.data as DataRow[]),
      error: (e: Error) => reject(e),
    });
  });

export const parseExcel = async (file: File): Promise<DataRow[]> => {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
};

export async function getExcelSheetNames(file: File): Promise<string[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  return wb.SheetNames;
}

export async function parseExcelSheet(file: File, sheetName: string): Promise<DataRow[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found.`);
  return XLSX.utils.sheet_to_json(ws);
}

// ─── Google Sheets helpers ────────────────────────────────────────────────────

export function extractGoogleSheetsId(url: string): string | null {
  try {
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m?.[1] ?? null;
  } catch { return null; }
}

export function buildGoogleSheetsUrl(url: string, sheetName?: string): string {
  const id = extractGoogleSheetsId(url);
  if (!id) return url;
  if (sheetName)
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const gid = new URLSearchParams(url.split('?')[1] || '').get('gid');
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

// ─── Excel 365 / OneDrive / SharePoint helpers ────────────────────────────────

/**
 * Detects whether the URL points to a Microsoft OneDrive / SharePoint shared file.
 */
export function isExcel365Url(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.endsWith('sharepoint.com') ||
      u.hostname.endsWith('onedrive.live.com') ||
      u.hostname === '1drv.ms' ||
      u.hostname.endsWith('.sharepoint.com') ||
      u.pathname.includes('/_layouts/') ||
      u.pathname.includes('/personal/') ||
      (u.hostname.endsWith('office.com') && u.pathname.includes('/xlsx'))
    );
  } catch { return false; }
}

/**
 * Attempts to build a direct CSV download URL for a publicly shared Excel 365 file.
 *
 * Strategies tried (in order):
 * 1. SharePoint "download" endpoint: append ?download=1
 * 2. OneDrive embed  → replace /embed? with /download?
 * 3. Short-link (1drv.ms) — pass-through; server follows redirect
 */
export function buildExcel365CsvUrl(url: string): string {
  try {
    const u = new URL(url);

    // SharePoint /_layouts/15/WopiFrame.aspx or guestaccess.aspx
    if (u.pathname.includes('/_layouts/')) {
      u.searchParams.set('download', '1');
      return u.toString();
    }

    // OneDrive embed  → direct download
    if (u.pathname.includes('/embed')) {
      return url.replace('/embed', '/download');
    }

    // SharePoint personal / sites document library  → append ?download=1
    if (u.hostname.endsWith('sharepoint.com') || u.pathname.includes('/personal/')) {
      u.searchParams.set('download', '1');
      return u.toString();
    }

    return url; // fall-through; proxy will attempt as-is
  } catch { return url; }
}

// ─── Core CSV fetch (via server-side proxy) ───────────────────────────────────

async function fetchCsvText(fetchUrl: string): Promise<string> {
  const proxyUrl = `/api/proxy-csv?url=${encodeURIComponent(fetchUrl)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    let errorText: string;
    try { const j = await response.json(); errorText = j.error; }
    catch { errorText = response.statusText; }
    if (response.status >= 400 && response.status < 500) {
      throw new Error(
        errorText ||
        `Access Denied (HTTP ${response.status}). For Google Sheets set "Anyone with the link". For Excel 365 use a public share link.`
      );
    }
    throw new Error(errorText || `Failed to fetch: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseCsvText(text: string): Promise<DataRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: r => resolve(r.data as DataRow[]),
      error: (e: Error) => reject(e),
    });
  });
}

export async function fetchSheetCSV(url: string, sheetName?: string): Promise<DataRow[]> {
  let fetchUrl: string;

  if (url.includes('docs.google.com/spreadsheets')) {
    fetchUrl = buildGoogleSheetsUrl(url, sheetName);
  } else if (isExcel365Url(url)) {
    fetchUrl = buildExcel365CsvUrl(url);
  } else if (url.includes('/pub?')) {
    fetchUrl = url.includes('output=csv') ? url : url.replace(/pub\?.*/, 'pub?output=csv');
  } else {
    fetchUrl = url;
  }

  const text = await fetchCsvText(fetchUrl);
  return parseCsvText(text);
}

export const fetchPublicCSV = (url: string): Promise<DataRow[]> => fetchSheetCSV(url);

// ─── Field extraction ─────────────────────────────────────────────────────────

export const extractFields = (data: DataRow[]): string[] => {
  if (!data || data.length === 0) return [];
  const keys = new Set<string>();
  data.forEach(row => Object.keys(row).forEach(k => { if (k && k.trim() !== '') keys.add(k); }));
  return Array.from(keys);
};

/**
 * Infers the data type of a field: 'number' | 'date' | 'string'
 */
export function inferFieldType(data: DataRow[], field: string): 'number' | 'date' | 'string' {
  const samples = data.slice(0, 20).map(r => r[field]).filter(v => v !== null && v !== undefined && v !== '');
  if (samples.length === 0) return 'string';

  const numericCount = samples.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && v !== '')).length;
  if (numericCount / samples.length > 0.7) return 'number';

  const dateCount = samples.filter(v => {
    const d = new Date(v);
    return !isNaN(d.getTime()) && String(v).length > 4;
  }).length;
  if (dateCount / samples.length > 0.6) return 'date';

  return 'string';
}
