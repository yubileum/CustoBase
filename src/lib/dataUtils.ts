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
  
  // Transform standard Google Sheets URL to CSV export URL
  if (url.includes('docs.google.com/spreadsheets')) {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const gsheetId = match[1];
      // Check for GID
      const urlParams = new URLSearchParams(url.split('?')[1] || '');
      const gid = urlParams.get('gid') || '0';
      fetchUrl = `https://docs.google.com/spreadsheets/d/${gsheetId}/export?format=csv&gid=${gid}`;
    }
  }

  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
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
  // return all unique keys from the first few rows to be safe
  const keys = new Set<string>();
  const samples = data.slice(0, 10);
  samples.forEach(row => {
    Object.keys(row).forEach(key => keys.add(key));
  });
  return Array.from(keys);
};
