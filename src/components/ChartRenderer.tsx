import React, { useMemo } from 'react';
import { useData, ChartConfig } from '../lib/DataContext';
import { useFilters } from '../lib/FilterContext';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';

// ─── Colour palettes ──────────────────────────────────────────────────────────
const PALETTES: Record<string, string[]> = {
  default: ['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6'],
  ocean:   ['#0ea5e9','#38bdf8','#7dd3fc','#0284c7','#0369a1','#164e63','#06b6d4','#22d3ee'],
  sunset:  ['#f97316','#fb923c','#fbbf24','#ef4444','#e879f9','#a855f7','#6366f1','#f43f5e'],
  forest:  ['#10b981','#34d399','#6ee7b7','#059669','#16a34a','#65a30d','#4d7c0f','#a3e635'],
  mono:    ['#94a3b8','#64748b','#475569','#334155','#1e293b','#cbd5e1','#e2e8f0','#f1f5f9'],
};

function getPalette(scheme?: string): string[] {
  return PALETTES[scheme ?? 'default'] ?? PALETTES.default;
}

function toNumber(val: any): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const n = Number(val.replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

const formatNumber = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
const truncate = (v: any) => { const s = String(v); return s.length > 14 ? s.slice(0, 13) + '…' : s; };

function aggregateData(
  data: any[],
  config: ChartConfig,
): any[] {
  if (!data.length) return [];
  const agg = config.aggregation || 'sum';

  const categoryField = config.type === 'Pie' || config.type === 'Donut' ? config.nameField : config.xAxisField;
  const metricField   = config.type === 'Pie' || config.type === 'Donut' ? config.valueField : config.yAxisField;

  if (!categoryField) return data;

  // Raw rows mode
  if (agg === 'none') {
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

  const result = Object.entries(grouped).map(([name, vals]) => {
    let aggVal: number;
    switch (agg) {
      case 'count': aggVal = vals.length; break;
      case 'avg':   aggVal = vals.reduce((a, b) => a + b, 0) / (vals.length || 1); break;
      case 'max':   aggVal = Math.max(...vals); break;
      case 'min':   aggVal = Math.min(...vals); break;
      default:      aggVal = vals.reduce((a, b) => a + b, 0);
    }
    return (config.type === 'Pie' || config.type === 'Donut')
      ? { name, value: aggVal }
      : { [categoryField]: name, ...(metricField ? { [metricField]: aggVal } : {}) };
  });

  if (config.type === 'Pie' || config.type === 'Donut' || config.type === 'Bar') {
    const vk = config.type === 'Pie' || config.type === 'Donut' ? 'value' : metricField!;
    result.sort((a: any, b: any) => b[vk] - a[vk]);
  }
  return result.slice(0, 50);
}

// ─── Tooltip style helper ─────────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid var(--border-base)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    fontSize: 12,
  },
  itemStyle: { color: 'var(--text-primary)', fontWeight: 500 },
  cursor: { fill: 'rgba(99,102,241,0.04)' },
};

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { config: ChartConfig; }

export default function ChartRenderer({ config }: Props) {
  const { tables, activeTableId } = useData();
  const { applyFilters } = useFilters();

  const tableId = config.tableId ?? activeTableId;
  const rawData = tables.find(t => t.id === tableId)?.data ?? [];

  // Apply global filters
  const data = useMemo(() => applyFilters(rawData, tableId), [rawData, tableId, applyFilters]);

  const COLORS = getPalette(config.colorScheme);

  const formattedData = useMemo(() => {
    if (!data.length) return [];
    if (config.type === 'Table' || config.type === 'Card') return data;
    if (config.type === 'Scatter') {
      return data.map(row => ({
        ...row,
        [config.xAxisField || 'x']: toNumber(row[config.xAxisField!]),
        [config.yAxisField || 'y']: toNumber(row[config.yAxisField!]),
      }));
    }
    return aggregateData(data, config);
  }, [data, config]);

  const cardValue = useMemo(() => {
    if (config.type !== 'Card' || !data.length) return null;
    if (config.aggregation === 'count') return data.length;
    if (!config.yAxisField) return null;
    const vals = data.map(row => toNumber(row[config.yAxisField!]));
    switch (config.aggregation) {
      case 'avg': return vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      case 'max': return Math.max(...vals);
      case 'min': return Math.min(...vals);
      default:    return vals.reduce((a, b) => a + b, 0);
    }
  }, [data, config]);

  // ── No data state ─────────────────────────────────────────────────────────
  if (!data.length) {
    return (
      <div className="empty-state" style={{ minHeight: 120 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data available</p>
      </div>
    );
  }

  const axisProps = {
    tick: { fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' },
    tickLine: false,
  };

  const renderChart = () => {
    switch (config.type) {
      // ── KPI Card ────────────────────────────────────────────────────────────
      case 'Card':
        return (
          <div className="flex flex-col justify-center h-full px-2">
            <div className="kpi-value">{cardValue !== null ? formatNumber(cardValue) : '—'}</div>
            {config.yAxisField && (
              <div className="kpi-label">{config.aggregation} of {config.yAxisField}</div>
            )}
            <div className="kpi-trend" style={{ color: 'var(--color-success)' }}>
              {data.length.toLocaleString()} records
            </div>
          </div>
        );

      // ── Bar Chart ───────────────────────────────────────────────────────────
      case 'Bar':
        return (
          <BarChart data={formattedData} margin={{ top: 8, right: 8, left: -8, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" />
            <XAxis dataKey={config.xAxisField} tickFormatter={truncate} {...axisProps} axisLine={{ stroke: 'var(--border-base)' }} />
            <YAxis tickFormatter={formatNumber} {...axisProps} axisLine={false} width={48} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => formatNumber(v)} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            <Bar dataKey={config.yAxisField!} radius={[4,4,0,0]} maxBarSize={56}>
              {formattedData.map((_: any, i: number) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        );

      // ── Line Chart ──────────────────────────────────────────────────────────
      case 'Line':
        return (
          <LineChart data={formattedData} margin={{ top: 8, right: 8, left: -8, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" />
            <XAxis dataKey={config.xAxisField} tickFormatter={truncate} {...axisProps} axisLine={{ stroke: 'var(--border-base)' }} />
            <YAxis tickFormatter={formatNumber} {...axisProps} axisLine={false} width={48} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => formatNumber(v)} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            <Line
              type="monotone" dataKey={config.yAxisField!}
              stroke={COLORS[0]} strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 2, fill: 'var(--bg-surface)' }}
              activeDot={{ r: 5, strokeWidth: 0, fill: COLORS[0] }}
            />
          </LineChart>
        );

      // ── Area Chart ──────────────────────────────────────────────────────────
      case 'Area':
        return (
          <AreaChart data={formattedData} margin={{ top: 8, right: 8, left: -8, bottom: 24 }}>
            <defs>
              <linearGradient id={`grad-${config.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" />
            <XAxis dataKey={config.xAxisField} tickFormatter={truncate} {...axisProps} axisLine={{ stroke: 'var(--border-base)' }} />
            <YAxis tickFormatter={formatNumber} {...axisProps} axisLine={false} width={48} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => formatNumber(v)} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            <Area
              type="monotone" dataKey={config.yAxisField!}
              stroke={COLORS[0]} strokeWidth={2}
              fill={`url(#grad-${config.id})`}
              dot={{ r: 3, strokeWidth: 0, fill: COLORS[0] }}
            />
          </AreaChart>
        );

      // ── Pie / Donut ─────────────────────────────────────────────────────────
      case 'Pie':
      case 'Donut':
        return (
          <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Tooltip {...tooltipStyle} formatter={(v: number) => formatNumber(v)} />
            {config.showLegend !== false && (
              <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
            )}
            <Pie
              data={formattedData}
              dataKey="value"
              nameKey="name"
              cx="50%" cy="47%"
              outerRadius={config.type === 'Donut' ? 90 : 100}
              innerRadius={config.type === 'Donut' ? 50 : 0}
              paddingAngle={config.type === 'Donut' ? 3 : 1}
            >
              {formattedData.map((_: any, i: number) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      // ── Scatter ─────────────────────────────────────────────────────────────
      case 'Scatter': {
        // ✅ FIX: validate numeric fields
        const xIsNum = data.every(r => typeof r[config.xAxisField!] === 'number' || !isNaN(Number(r[config.xAxisField!])));
        const yIsNum = data.every(r => typeof r[config.yAxisField!] === 'number' || !isNaN(Number(r[config.yAxisField!])));
        if (!xIsNum || !yIsNum) {
          return (
            <div className="empty-state">
              <p style={{ fontSize: 12, color: 'var(--color-warning)' }}>
                ⚠ Scatter requires numeric fields. Select numeric X and Y axis fields.
              </p>
            </div>
          );
        }
        return (
          <ScatterChart margin={{ top: 16, right: 16, bottom: 24, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-base)" />
            <XAxis type="number" dataKey={config.xAxisField} name={config.xAxisField} tickFormatter={formatNumber} {...axisProps} axisLine={{ stroke: 'var(--border-base)' }} />
            <YAxis type="number" dataKey={config.yAxisField} name={config.yAxisField} tickFormatter={formatNumber} {...axisProps} axisLine={false} width={48} />
            <Tooltip {...tooltipStyle} />
            <Scatter data={formattedData} fill={COLORS[0]} opacity={0.8} />
          </ScatterChart>
        );
      }

      // ── Data Table ──────────────────────────────────────────────────────────
      case 'Table': {
        const cols = Object.keys(formattedData[0] || {});
        return (
          <div className="overflow-auto h-full w-full">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {cols.map(h => (
                    <th key={h} style={{
                      position: 'sticky', top: 0,
                      background: 'var(--bg-surface2)',
                      borderBottom: '1px solid var(--border-base)',
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {formattedData.slice(0, 200).map((row: any, i: number) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--border-base)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg-hover)',
                    }}
                  >
                    {cols.map((col, j) => {
                      const val = row[col];
                      const isNum = typeof val === 'number' && !isNaN(val);
                      return (
                        <td key={j} style={{
                          padding: '6px 12px',
                          color: 'var(--text-primary)',
                          fontFamily: isNum ? 'var(--font-mono)' : 'var(--font-sans)',
                          textAlign: isNum ? 'right' : 'left',
                          whiteSpace: 'nowrap',
                        }}>
                          {isNum ? val.toLocaleString() : String(val ?? '')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {formattedData.length > 200 && (
              <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11 }}>
                Showing 200 of {formattedData.length.toLocaleString()} rows
              </div>
            )}
          </div>
        );
      }

      default:
        return <div className="empty-state"><p>Unsupported chart type</p></div>;
    }
  };

  // ✅ FIX: Card and Table must NOT be wrapped in ResponsiveContainer
  if (config.type === 'Card' || config.type === 'Table') {
    return <div className="w-full h-full">{renderChart()}</div>;
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart() as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}
