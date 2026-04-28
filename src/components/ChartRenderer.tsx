import React, { useMemo } from 'react';
import { useData, ChartConfig } from '../lib/DataContext';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

const COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#34d399', '#fbbf24', '#f87171'];

interface Props {
  config: ChartConfig;
}

function toNumber(val: any): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const n = Number(val.replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export default function ChartRenderer({ config }: Props) {
  const { tables, activeTableId } = useData();
  const tableId = config.tableId ?? activeTableId;
  const data = tables.find(t => t.id === tableId)?.data ?? [];

  const formattedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (config.type === 'Table' || config.type === 'Card') return data;

    if (config.type === 'Scatter') {
      return data.map(item => ({
        ...item,
        [config.xAxisField || 'x']: toNumber(item[config.xAxisField!]),
        [config.yAxisField || 'y']: toNumber(item[config.yAxisField!]),
      }));
    }

    const categoryField = config.type === 'Pie' ? config.nameField : config.xAxisField;
    const metricField   = config.type === 'Pie' ? config.valueField : config.yAxisField;
    const aggType       = config.aggregation || 'sum';

    if (!categoryField) return data;

    if (aggType === 'none' && (config.type === 'Bar' || config.type === 'Line')) {
      return data.slice(0, 500).map(row => ({
        [categoryField]: String(row[categoryField] ?? ''),
        ...(metricField ? { [metricField]: toNumber(row[metricField]) } : {}),
      }));
    }

    const grouped: Record<string, number[]> = {};
    data.forEach(row => {
      let key = String(row[categoryField] ?? '').trim();
      if (!key || key === 'null' || key === 'undefined') key = 'Unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(metricField ? toNumber(row[metricField]) : 0);
    });

    const result = Object.entries(grouped).map(([name, values]) => {
      let aggVal: number;
      switch (aggType) {
        case 'count': aggVal = values.length; break;
        case 'avg':   aggVal = values.reduce((a, b) => a + b, 0) / (values.length || 1); break;
        case 'max':   aggVal = Math.max(...values); break;
        case 'min':   aggVal = Math.min(...values); break;
        default:      aggVal = values.reduce((a, b) => a + b, 0);
      }

      return config.type === 'Pie'
        ? { name, value: aggVal }
        : { [categoryField]: name, [metricField!]: aggVal };
    });

    if (config.type === 'Pie' || config.type === 'Bar') {
      const valKey = config.type === 'Pie' ? 'value' : metricField!;
      result.sort((a: any, b: any) => b[valKey] - a[valKey]);
    }

    return result.slice(0, 50);
  }, [data, config]);

  const cardValue = useMemo(() => {
    if (config.type !== 'Card' || !data || data.length === 0) return null;
    if (config.aggregation === 'count') return data.length;
    if (!config.yAxisField) return null;

    const values = data.map(row => toNumber(row[config.yAxisField!]));
    switch (config.aggregation) {
      case 'avg': return values.reduce((a, b) => a + b, 0) / (values.length || 1);
      case 'max': return Math.max(...values);
      case 'min': return Math.min(...values);
      default:    return values.reduce((a, b) => a + b, 0);
    }
  }, [data, config]);

  if (!data || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data available</div>;
  }

  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const truncateLabel = (val: any) => {
    const s = String(val);
    return s.length > 14 ? s.substring(0, 13) + '…' : s;
  };

  const tooltipStyle = {
    contentStyle: { borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' },
    itemStyle: { color: '#111827', fontWeight: 500 },
    formatter: (val: number) => typeof val === 'number' ? val.toLocaleString() : val,
  };

  const renderChart = () => {
    switch (config.type) {
      case 'Card':
        return (
          <div className="flex flex-col items-start justify-center h-full pb-4">
            <div className="text-5xl font-light tracking-tight text-gray-900">
              {cardValue !== null ? formatNumber(cardValue) : '—'}
            </div>
            {config.yAxisField && (
              <div className="text-sm font-medium text-gray-500 mt-2 uppercase tracking-wider">
                {config.aggregation} of {config.yAxisField}
              </div>
            )}
          </div>
        );

      case 'Bar':
        return (
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey={config.xAxisField} tickFormatter={truncateLabel} tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#D1D5DB' }} />
            <YAxis tickFormatter={formatNumber} tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} width={50} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey={config.yAxisField!} fill={COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={60} />
          </BarChart>
        );

      case 'Line':
        return (
          <LineChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey={config.xAxisField} tickFormatter={truncateLabel} tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#D1D5DB' }} />
            <YAxis tickFormatter={formatNumber} tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} width={50} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey={config.yAxisField!} stroke={COLORS[1]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} />
          </LineChart>
        );

      case 'Pie':
        return (
          <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <Tooltip {...tooltipStyle} />
            <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
            <Pie
              data={formattedData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={60}
              paddingAngle={2}
            >
              {formattedData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      case 'Scatter':
        return (
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis type="number" dataKey={config.xAxisField} name={config.xAxisField} tickFormatter={formatNumber} tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#D1D5DB' }} />
            <YAxis type="number" dataKey={config.yAxisField} name={config.yAxisField} tickFormatter={formatNumber} tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} width={50} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }} />
            <Scatter name={config.title} data={formattedData} fill={COLORS[2]} />
          </ScatterChart>
        );

      case 'Table':
        return (
          <div className="overflow-auto h-full w-full rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-md z-10">
                <tr>
                  {Object.keys(formattedData[0] || {}).map((header) => (
                    <th key={header} className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {formattedData.slice(0, 100).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    {Object.keys(formattedData[0] || {}).map((col, j) => {
                      const val = row[col];
                      return (
                        <td key={j} className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                          {typeof val === 'number' && !isNaN(val) ? val.toLocaleString() : String(val ?? '')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return <div className="h-full flex items-center justify-center text-gray-400 text-sm">Unsupported chart type</div>;
    }
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
