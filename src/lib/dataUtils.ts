import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type DataRow = Record<string, any>;

// ─── CSV / Excel parsing ───────────────────────────────────────────────────────

export const parseCSV = (file: File): Promise<DataRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as DataRow[]);
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
};

export const parseExcel = async (file: File): Promise<DataRow[]> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

// ─── Multi-sheet Excel helpers ────────────────────────────────────────────────

/**
 * Returns the list of sheet names found inside an Excel workbook.
 */
export async function getExcelSheetNames(file: File): Promise<string[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  return workbook.SheetNames;
}

/**
 * Parses a single named sheet from an Excel file.
 */
export async function parseExcelSheet(file: File, sheetName: string): Promise<DataRow[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) throw new Error(`Sheet "${sheetName}" not found in workbook.`);
  return XLSX.utils.sheet_to_json(worksheet);
}

// ─── Google Sheets helpers ────────────────────────────────────────────────────

/**
 * Extracts the spreadsheet ID from any Google Sheets URL.
 * Returns null when the URL doesn't look like a Sheets URL.
 */
export function extractGoogleSheetsId(url: string): string | null {
  try {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Builds the CSV export URL for a Google Sheets spreadsheet.
 * When sheetName is supplied it uses the gviz/tq endpoint which accepts a
 * human-readable sheet name; otherwise falls back to the export endpoint.
 */
export function buildGoogleSheetsUrl(url: string, sheetName?: string): string {
  const id = extractGoogleSheetsId(url);
  if (!id) return url; // not a standard Sheets URL — return as-is

  if (sheetName) {
    return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  }

  // Fall back to the original export URL logic (preserves gid if present)
  const urlParams = new URLSearchParams(url.split('?')[1] || '');
  const gid = urlParams.get('gid');
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

// ─── Core CSV fetch (via server-side proxy) ───────────────────────────────────

async function fetchCsvText(fetchUrl: string): Promise<string> {
  const proxyUrl = `/api/proxy-csv?url=${encodeURIComponent(fetchUrl)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    let errorText: string;
    try {
      const errorJson = await response.json();
      errorText = errorJson.error;
    } catch {
      errorText = response.statusText;
    }
    if (response.status >= 400 && response.status < 500) {
      throw new Error(errorText || `Access Denied (HTTP ${response.status}). Please ensure Google Sheets "General access" is set to "Anyone with the link".`);
    }
    throw new Error(errorText || `Failed to fetch data: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseCsvText(text: string): Promise<DataRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as DataRow[]),
      error: (error: Error) => reject(error),
    });
  });
}

/**
 * Fetches a single Google Sheets sheet (or a plain CSV URL) and returns parsed rows.
 * When sheetName is provided, uses the gviz/tq CSV export for that specific sheet.
 */
export async function fetchSheetCSV(url: string, sheetName?: string): Promise<DataRow[]> {
  let fetchUrl: string;

  if (url.includes('docs.google.com/spreadsheets')) {
    fetchUrl = buildGoogleSheetsUrl(url, sheetName);
  } else if (url.includes('/pub?')) {
    fetchUrl = url.includes('output=csv') ? url : url.replace(/pub\?.*/, 'pub?output=csv');
  } else {
    fetchUrl = url;
  }

  const text = await fetchCsvText(fetchUrl);
  return parseCsvText(text);
}

/**
 * Legacy entry-point kept for backward compatibility with App.tsx / AIChat.tsx.
 */
export const fetchPublicCSV = async (url: string): Promise<DataRow[]> => {
  return fetchSheetCSV(url);
};

// ─── Field extraction ─────────────────────────────────────────────────────────

export const extractFields = (data: DataRow[]): string[] => {
  if (!data || data.length === 0) return [];
  const keys = new Set<string>();
  data.forEach(row => {
    Object.keys(row).forEach(key => {
      if (key && key.trim() !== '') keys.add(key);
    });
  });
  return Array.from(keys);
};
