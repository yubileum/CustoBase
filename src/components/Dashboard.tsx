import React, { useState } from 'react';
import { useData } from '../lib/DataContext';
import ChartRenderer from './ChartRenderer';
import { Settings, Trash2, MoreVertical } from 'lucide-react';
import ChartBuilder from './ChartBuilder';

export default function Dashboard() {
  const { charts, removeChart, data } = useData();
  const [editingChartId, setEditingChartId] = useState<string | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 h-full">
        <div className="w-24 h-24 mb-6 rounded-full bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-200">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-600 mb-2">No data source connected</p>
        <p className="text-sm max-w-sm text-center">Connect a dataset to start building your dashboard.</p>
      </div>
    );
  }

  if (charts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 h-full">
        <p className="text-lg font-medium text-gray-600 mb-2">Your dashboard is empty</p>
        <p className="text-sm max-w-sm text-center">Click "Add Chart" to create your first visualization.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[#f5f5f5] p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto grid-flow-row-dense items-start">
        {charts.map((chart) => (
          <div 
            key={chart.id} 
            className={`bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 flex flex-col overflow-hidden group transition-all duration-200 hover:shadow-md 
              ${chart.colSpan === 2 ? 'md:col-span-2' : chart.colSpan === 3 ? 'md:col-span-2 lg:col-span-3' : ''}
              ${chart.type === 'Card' ? 'h-[200px]' : 'min-h-[380px] h-full'}
            `}
          >
            <div className="px-5 py-4 flex justify-between items-start bg-white z-10 shrink-0">
              <h3 className="font-medium text-base text-gray-900 leading-tight">{chart.title}</h3>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setEditingChartId(chart.id)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => removeChart(chart.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-5 pt-0 min-h-0 relative">
              <ChartRenderer config={chart} />
            </div>
          </div>
        ))}
      </div>
      
      {editingChartId && (
        <ChartBuilder 
          editChartId={editingChartId} 
          onClose={() => setEditingChartId(null)} 
        />
      )}
    </div>
  );
}
