import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type DataRow = Record<string, any>;

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
      }
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

export const fetchPublicCSV = async (url: string): Promise<DataRow[]> => {
  let fetchUrl = url;
  
  if (url.includes('/pub?')) {
    if (!url.includes('output=csv')) {
      fetchUrl = url.replace(/pub\?.*/, 'pub?output=csv');
    }
  } else if (url.includes('docs.google.com/spreadsheets')) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1] && match[1] !== 'e') {
      const gsheetId = match[1];
      const urlParams = new URLSearchParams(url.split('?')[1] || '');
      const gid = urlParams.get('gid');
      fetchUrl = `https://docs.google.com/spreadsheets/d/${gsheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
    } else if (url.includes('/e/')) {
      const eMatch = url.match(/\/e\/([a-zA-Z0-9-_]+)/);
      if (eMatch && eMatch[1]) {
        fetchUrl = `https://docs.google.com/spreadsheets/d/e/${eMatch[1]}/pub?output=csv`;
      }
    }
  }

  const proxyUrl = `/api/proxy-csv?url=${encodeURIComponent(fetchUrl)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    let errorText;
    try {
      const errorJson = await response.json();
      errorText = errorJson.error;
    } catch (e) {
      errorText = response.statusText;
    }
    
    if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error(errorText || `Access Denied (HTTP ${response.status}). Please ensure Google Sheets "General access" is set to "Anyone with the link".`);
    }
    throw new Error(errorText || `Failed to fetch data: ${response.status} ${response.statusText}`);
  }
  
  const text = await response.text();
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as DataRow[]);
      },
      error: (error: Error) => {
        reject(error);
      }
    });
  });
};

export const extractFields = (data: DataRow[]): string[] => {
  if (!data || data.length === 0) return [];
  const keys = new Set<string>();
  data.forEach(row => {
    Object.keys(row).forEach(key => {
      // Don't add empty keys
      if (key && key.trim() !== '') {
        keys.add(key);
      }
    });
  });
  return Array.from(keys);
};
