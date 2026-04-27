import React, { useMemo } from 'react';
import { useData, ChartConfig } from '../lib/DataContext';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface Props {
  config: ChartConfig;
}

export default function ChartRenderer({ config }: Props) {
  const { data } = useData();

  const formattedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Group and aggregate data if pie or if it's explicitly aggregated (like sum/avg on Card)
    if (config.type === 'Pie' && config.nameField && config.valueField) {
      const aggregated: Record<string, number> = {};
      data.forEach(row => {
        const key = row[config.nameField!] || 'Unknown';
        const val = Number(row[config.valueField!]) || 0;
        aggregated[key] = (aggregated[key] || 0) + val;
      });
      return Object.entries(aggregated).map(([name, value]) => ({ name, value }));
    }

    // For other charts, parse numbers
    return data.map(item => {
      const obj = { ...item };
      if (config.yAxisField) obj[config.yAxisField] = Number(obj[config.yAxisField]) || 0;
      return obj;
    });
  }, [data, config]);

  const cardValue = useMemo(() => {
    if (config.type !== 'Card' || !data || data.length === 0) return null;
    let val = 0;
    if (config.aggregation === 'count') {
      val = data.length;
    } else if (config.yAxisField) {
      const values = data.map(r => Number(r[config.yAxisField!]) || 0);
      if (config.aggregation === 'sum') val = values.reduce((a, b) => a + b, 0);
      if (config.aggregation === 'avg') val = values.reduce((a, b) => a + b, 0) / values.length;
      if (config.aggregation === 'max') val = Math.max(...values);
      if (config.aggregation === 'min') val = Math.min(...values);
    }
    return val;
  }, [data, config]);


  if (!data || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-400">No data available</div>;
  }

  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatString = (val: any) => {
    if (typeof val === 'string' && val.length > 12) return val.substring(0, 12) + '...';
    return val;
  };

  const renderChart = () => {
    switch (config.type) {
      case 'Card':
        return (
          <div className="flex flex-col items-start justify-center h-full pb-4">
             <div className="text-5xl font-light tracking-tight text-gray-900">
               {cardValue !== null ? formatNumber(cardValue) : '-'}
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
            <XAxis dataKey={config.xAxisField} tickFormatter={formatString} tick={{fontSize: 12, fill: '#6B7280'}} tickLine={false} axisLine={{stroke: '#D1D5DB'}} />
            <YAxis tickFormatter={formatNumber} tick={{fontSize: 12, fill: '#6B7280'}} tickLine={false} axisLine={false} width={50} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ color: '#111827', fontWeight: 500 }}
              formatter={(val: number) => typeof val === 'number' ? val.toLocaleString() : val}
            />
            <Bar dataKey={config.yAxisField!} fill="#4ade80" radius={[4, 4, 0, 0]} maxBarSize={60} />
          </BarChart>
        );
      case 'Line':
        return (
          <LineChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey={config.xAxisField} tickFormatter={formatString} tick={{fontSize: 12, fill: '#6B7280'}} tickLine={false} axisLine={{stroke: '#D1D5DB'}} />
            <YAxis tickFormatter={formatNumber} tick={{fontSize: 12, fill: '#6B7280'}} tickLine={false} axisLine={false} width={50} />
            <Tooltip
               contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
               itemStyle={{ color: '#111827', fontWeight: 500 }}
               formatter={(val: number) => typeof val === 'number' ? val.toLocaleString() : val}
            />
            <Line type="monotone" dataKey={config.yAxisField!} stroke="#818cf8" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }} />
          </LineChart>
        );
      case 'Pie':
        return (
          <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <Tooltip
               contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
               itemStyle={{ color: '#111827', fontWeight: 500 }}
               formatter={(val: number) => typeof val === 'number' ? val.toLocaleString() : val}
            />
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
              fill="#8884d8"
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
            <XAxis type="number" dataKey={config.xAxisField} name={config.xAxisField} tickFormatter={formatNumber} tick={{fontSize: 12, fill: '#6B7280'}} tickLine={false} axisLine={{stroke: '#D1D5DB'}} />
            <YAxis type="number" dataKey={config.yAxisField} name={config.yAxisField} tickFormatter={formatNumber} tick={{fontSize: 12, fill: '#6B7280'}} tickLine={false} axisLine={false} width={50} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }} 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Scatter name={config.title} data={formattedData} fill="#f472b6" />
          </ScatterChart>
        );
      case 'Table':
        return (
          <div className="overflow-auto h-full w-full rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-md z-10">
                <tr>
                  {Object.keys(formattedData[0] || {}).map((header) => (
                    <th key={header} className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {formattedData.slice(0, 50).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium font-mono">
                        {typeof val === 'number' ? val.toLocaleString() : String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <div className="w-full h-full relative group p-0">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
