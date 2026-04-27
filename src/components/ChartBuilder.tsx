import React, { useState, useEffect } from 'react';
import { useData, ChartType, ChartConfig } from '../lib/DataContext';
import { X, LayoutTemplate, BarChart3, LineChart as LineChartIcon, PieChart, ScatterChart as ScatterChartIcon, TableProperties, Hash } from 'lucide-react';

interface Props {
  onClose: () => void;
  editChartId?: string;
}

const chartTypes: { type: ChartType; icon: any; label: string }[] = [
  { type: 'Card', icon: Hash, label: 'Scorecard' },
  { type: 'Bar', icon: BarChart3, label: 'Bar Chart' },
  { type: 'Line', icon: LineChartIcon, label: 'Line Chart' },
  { type: 'Pie', icon: PieChart, label: 'Pie Chart' },
  { type: 'Scatter', icon: ScatterChartIcon, label: 'Scatter Plot' },
  { type: 'Table', icon: TableProperties, label: 'Data Table' },
];

export default function ChartBuilder({ onClose, editChartId }: Props) {
  const { fields, charts, addChart, updateChart } = useData();
  const [type, setType] = useState<ChartType>('Bar');
  const [title, setTitle] = useState('New Chart');
  const [xAxis, setXAxis] = useState(fields[0] || '');
  const [yAxis, setYAxis] = useState(fields[1] || fields[0] || '');
  const [aggregation, setAggregation] = useState<ChartConfig['aggregation']>('sum');
  const [colSpan, setColSpan] = useState<ChartConfig['colSpan']>(1);

  useEffect(() => {
    if (editChartId) {
      const existing = charts.find(c => c.id === editChartId);
      if (existing) {
        setType(existing.type);
        setTitle(existing.title);
        setXAxis(existing.type === 'Pie' ? (existing.nameField || '') : (existing.xAxisField || ''));
        setYAxis(existing.type === 'Pie' ? (existing.valueField || '') : (existing.yAxisField || ''));
        setAggregation(existing.aggregation || 'sum');
        setColSpan(existing.colSpan || 1);
      }
    } else {
      // Defaults based on type change
      if (type === 'Card') {
        setColSpan(1);
      } else if (type === 'Table') {
        setColSpan(3);
      } else {
        setColSpan(1);
      }
    }
  }, [editChartId, charts, type]);

  const handleSave = () => {
    const chartData: any = {
      title,
      type,
      colSpan
    };

    if (type === 'Card') {
      chartData.yAxisField = yAxis;
      chartData.aggregation = aggregation;
    } else if (type === 'Pie') {
      chartData.nameField = xAxis;
      chartData.valueField = yAxis;
      chartData.aggregation = aggregation;
    } else if (type !== 'Table') {
      chartData.xAxisField = xAxis;
      chartData.yAxisField = yAxis;
    }

    if (editChartId) {
      updateChart(editChartId, chartData);
    } else {
      addChart({
        id: crypto.randomUUID(),
        ...chartData
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5" /> 
            {editChartId ? 'Edit Visualization' : 'Add Visualization'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Chart Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Layout Size (Width)</label>
              <select 
                value={colSpan} 
                onChange={(e) => setColSpan(Number(e.target.value) as 1 | 2 | 3)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value={1}>1 Column (1/3 Width)</option>
                <option value={2}>2 Columns (2/3 Width)</option>
                <option value={3}>3 Columns (Full Width)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
            <label className="text-sm font-medium text-gray-700">Visualization Type</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {chartTypes.map((ctype) => (
                <button
                  key={ctype.type}
                  onClick={() => setType(ctype.type)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                    type === ctype.type 
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-500' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <ctype.icon className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">{ctype.label}</span>
                </button>
              ))}
            </div>
          </div>

          {type !== 'Table' && (
            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              {type !== 'Card' && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">
                    {type === 'Pie' ? 'Category Field (Name)' : 'X-Axis Field (Categories)'}
                  </label>
                  <select 
                    value={xAxis} 
                    onChange={(e) => setXAxis(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {fields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">
                  {type === 'Pie' ? 'Value Field' : type === 'Card' ? 'Metric Field' : 'Y-Axis Field (Values)'}
                </label>
                <select 
                  value={yAxis} 
                  onChange={(e) => setYAxis(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  {fields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {(type === 'Card' || type === 'Pie') && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Aggregation Rule</label>
                  <select 
                    value={aggregation} 
                    onChange={(e) => setAggregation(e.target.value as any)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="count">Count (Rows)</option>
                    <option value="max">Maximum</option>
                    <option value="min">Minimum</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md shadow-sm text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700"
            >
              {editChartId ? 'Update Chart' : 'Add Chart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
