import React, { useState } from 'react';
import { useData } from '../lib/DataContext';
import { parseCSV, parseExcel, fetchPublicCSV, extractFields } from '../lib/dataUtils';
import { Upload, Link as LinkIcon, Database, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function DataSourceModal({ onClose }: Props) {
  const { setData, setFields, setDataSourceName } = useData();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'upload' | 'url'>('upload');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    
    try {
      setDataSourceName(file.name);
      let parsedData: any[] = [];
      if (file.name.endsWith('.csv')) {
        parsedData = await parseCSV(file);
      } else if (file.name.match(/\.xlsx?$|\.xls$/)) {
        parsedData = await parseExcel(file);
      } else {
        throw new Error('Unsupported file type. Please upload a CSV or Excel file.');
      }
      
      const fields = extractFields(parsedData);
      setData(parsedData);
      setFields(fields);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error processing file');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlLoad = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      const parsedData = await fetchPublicCSV(url);
      const fields = extractFields(parsedData);
      setData(parsedData);
      setFields(fields);
      setDataSourceName(url.split('/').pop() || 'Remote Data');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error fetching data from URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Database className="w-5 h-5" /> Connect Data Source
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="flex bg-gray-100 p-1 rounded-lg">
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

          {mode === 'upload' ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                accept=".csv, .xlsx, .xls" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileUpload}
              />
              <Upload className="w-8 h-8 text-gray-400 mb-3" />
              <p className="font-medium text-gray-700 mb-1">Click or drag file to this area to upload</p>
              <p className="text-xs text-gray-500">Support for a single or bulk upload. Strictly CSV or Excel (.xlsx) files.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-gray-700">Google Sheets or CSV Public URL</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
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
                <button 
                  onClick={handleUrlLoad}
                  disabled={!url || loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Connect
                </button>
              </div>
              <p className="text-xs text-gray-500">Note: URL must output directly to CSV format.</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center text-sm text-gray-500">
              Processing data...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
