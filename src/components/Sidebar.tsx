import React, { useState } from 'react';
import { useData } from '../lib/DataContext';
import { Plus, Database, LayoutDashboard, FileSpreadsheet } from 'lucide-react';

interface Props {
  onAddData: () => void;
  onAddChart: () => void;
}

export default function Sidebar({ onAddData, onAddChart }: Props) {
  const { data, fields, dataSourceName } = useData();

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner">
          <LayoutDashboard className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900 tracking-tight">DataViz Studio</span>
      </div>

      <div className="p-4 flex flex-col gap-6 flex-1 overflow-y-auto">
        {/* Data Source Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Source</h3>
          </div>
          
          {data.length === 0 ? (
            <button 
              onClick={onAddData}
              className="w-full py-2 px-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4" />
              Connect Data
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 truncate">{dataSourceName}</p>
                  <p className="text-xs text-blue-700 mt-0.5">{data.length} rows</p>
                </div>
              </div>
              <div className="flex justify-between items-center px-1">
                <button 
                  onClick={onAddData}
                  className="text-xs text-gray-500 hover:text-blue-600 font-medium text-left"
                >
                  Change source...
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Fields Section */}
        {fields.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Available Fields</h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{fields.length}</span>
            </div>
            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {fields.map(field => (
                <div key={field} className="text-xs text-gray-700 bg-gray-50 border border-gray-100 px-2 py-1.5 rounded truncate hover:bg-gray-100 cursor-default">
                  {field}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto pt-4 border-t border-gray-100">
          <button 
            onClick={onAddChart}
            disabled={data.length === 0}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg shadow-sm text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Chart
          </button>
        </div>
      </div>
    </div>
  );
}
