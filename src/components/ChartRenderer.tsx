import React, { useMemo, useState, useCallback } from 'react';
import { useData, ChartConfig } from '../lib/DataContext';
import { useFilters } from '../lib/FilterContext';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { Download, Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// ── Palettes ──────────────────────────────────────────────────────────────────
const PALETTES: Record<string, string[]> = {
  default: ['#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6'],
  ocean:   ['#0ea5e9','#38bdf8','#7dd3fc','#0284c7','#0369a1','#164e63','#06b6d4','#22d3ee'],
  sunset:  ['#f97316','#fb923c','#fbbf24','#ef4444','#e879f9','#a855f7','#6366f1','#f43f5e'],
  forest:  ['#10b981','#34d399','#6ee7b7','#059669','#16a34a','#65a30d','#4d7c0f','#a3e635'],
  mono:    ['#94a3b8','#64748b','#475569','#334155','#1e293b','#cbd5e1','#e2e8f0','#f1f5f9'],
};
const getPalette = (s?: string) => PALETTES[s ?? 'default'] ?? PALETTES.default;

// ── Helpers ───────────────────────────────────────────────────────────────────
function toNum(v: any): number {
  if (typeof v === 'number' && !isNaN(v)) return v;
  const n = Number(String(v ?? '').replace(/[^0-9.-]+/g, ''));
  return isNaN(n) ? 0 : n;
}
const fmt = (n: number) => {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
const trunc = (v: any) => { const s = String(v); return s.length > 14 ? s.slice(0, 13) + '…' : s; };

// ── Aggregate & group ─────────────────────────────────────────────────────────
function aggregate(data: any[], xKey: string, yKey: string, agg: string): any[] {
  if (!xKey) return data.slice(0, 500);
  if (agg === 'none') return data.slice(0, 500).map(r => ({ [xKey]: String(r[xKey] ?? ''), [yKey]: toNum(r[yKey]) }));

  const map: Record<string, number[]> = {};
  data.forEach(r => {
    const k = String(r[xKey] ?? '').trim() || 'Unknown';
    if (!map[k]) map[k] = [];
    map[k].push(toNum(r[yKey]));
  });

  return Object.entries(map).map(([name, vals]) => {
    let v: number;
    switch (agg) {
      case 'count': v = vals.length; break;
      case 'avg':   v = vals.reduce((a, b) => a + b, 0) / (vals.length || 1); break;
      case 'max':   v = Math.max(...vals); break;
      case 'min':   v = Math.min(...vals); break;
      default:      v = vals.reduce((a, b) => a + b, 0);
    }
    return { [xKey]: name, [yKey]: v };
  });
}

function applySort(data: any[], field?: string, dir?: 'asc' | 'desc') {
  if (!field) return data;
  return [...data].sort((a, b) => {
    const av = a[field], bv = b[field];
    const n = (typeof av === 'number' && typeof bv === 'number') ? av - bv : String(av).localeCompare(String(bv));
    return dir === 'asc' ? n : -n;
  });
}

// ── Tooltip style ──────────────────────────────────────────────────────────────
const TS = {
  contentStyle: { borderRadius: 8, border: '1px solid var(--border-base)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', fontSize: 12 },
  itemStyle: { color: 'var(--text-primary)', fontWeight: 500 },
  cursor: { fill: 'rgba(99,102,241,0.04)' },
};
const AP = { tick: { fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }, tickLine: false };

// ── CSV export ─────────────────────────────────────────────────────────────────
function exportCSV(data: any[], name: string) {
  if (!data.length) return;
  const cols = Object.keys(data[0]);
  const csv = [cols.join(','), ...data.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name; a.click();
}

// ── Enhanced Table ─────────────────────────────────────────────────────────────
function DataTable({ data, config }: { data: any[]; config: ChartConfig }) {
  const allCols  = Object.keys(data[0] || {});
  const cols     = config.visibleColumns?.length ? config.visibleColumns.filter(c => allCols.includes(c)) : allCols;
  const pageSize = config.tablePageSize ?? 50;

  const [search,  setSearch]  = useState('');
  const [sortCol, setSortCol] = useState(config.sortField ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(config.sortDir ?? 'asc');
  const [page,    setPage]    = useState(0);

  const filtered = useMemo(() => {
    let d = data;
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(r => cols.some(c => String(r[c] ?? '').toLowerCase().includes(q)));
    }
    if (sortCol) {
      d = [...d].sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol];
        const n = (typeof av === 'number' && typeof bv === 'number') ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? n : -n;
      });
    }
    return d;
  }, [data, search, sortCol, sortDir, cols]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData   = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = useCallback((col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(0);
  }, [sortCol]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border-base)', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search…"
            style={{ width: '100%', paddingLeft: 26, height: 28, fontSize: 12, background: 'var(--bg-surface2)', border: '1px solid var(--border-base)', borderRadius: 6, color: 'var(--text-primary)' }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{filtered.length.toLocaleString()} rows</span>
        <button onClick={() => exportCSV(filtered, 'export.csv')}
          style={{ background: 'none', border: '1px solid var(--border-base)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
          <Download size={11} /> CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {cols.map(h => (
                <th key={h} onClick={() => toggleSort(h)} style={{
                  position: 'sticky', top: 0, background: 'var(--bg-surface2)',
                  borderBottom: '1px solid var(--border-base)', padding: '7px 12px',
                  textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)',
                  fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em',
                  whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    {h}
                    {sortCol === h
                      ? (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
                      : <ChevronsUpDown size={10} style={{ opacity: 0.25 }} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-base)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-hover)' }}>
                {cols.map((col, j) => {
                  const val = row[col];
                  const isNum = typeof val === 'number' && !isNaN(val);
                  return (
                    <td key={j} style={{ padding: '5px 12px', color: 'var(--text-primary)', fontFamily: isNum ? 'var(--font-mono)' : 'var(--font-sans)', textAlign: isNum ? 'right' : 'left', whiteSpace: 'nowrap' }}>
                      {isNum ? val.toLocaleString() : String(val ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 12px', borderTop: '1px solid var(--border-base)', flexShrink: 0, fontSize: 11, color: 'var(--text-muted)' }}>
          <button onClick={() => setPage(0)}              disabled={page === 0}                style={pgBtn}>«</button>
          <button onClick={() => setPage(p => p - 1)}    disabled={page === 0}                style={pgBtn}>‹</button>
          <span>Page {page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => p + 1)}    disabled={page >= totalPages - 1}    style={pgBtn}>›</button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}   style={pgBtn}>»</button>
        </div>
      )}
    </div>
  );
}

const pgBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border-base)', borderRadius: 4,
  padding: '2px 7px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11,
};

// ── Main Renderer ─────────────────────────────────────────────────────────────
export default function ChartRenderer({ config }: { config: ChartConfig }) {
  const { tables, activeTableId } = useData();
  const { applyFilters } = useFilters();

  const tableId = config.tableId ?? activeTableId;
  const rawData = tables.find(t => t.id === tableId)?.data ?? [];
  const data    = useMemo(() => applyFilters(rawData, tableId), [rawData, tableId, applyFilters]);
  const COLORS  = getPalette(config.colorScheme);

  const xKey = config.pivotRows?.[0] ?? config.xAxisField ?? config.nameField ?? '';
  const yKey = config.pivotValues?.[0]?.field ?? config.yAxisField ?? config.valueField ?? '';
  const agg  = config.pivotValues?.[0]?.aggregation ?? config.aggregation ?? 'sum';

  const chartData = useMemo(() => {
    if (!data.length) return [];
    if (config.type === 'Table' || config.type === 'Card') return data;
    if (config.type === 'Scatter') {
      return data.map(r => ({ ...r, [xKey]: toNum(r[xKey]), [yKey]: toNum(r[yKey]) }));
    }
    let d = aggregate(data, xKey, yKey, agg);
    if (config.type === 'Pie' || config.type === 'Donut') {
      d = d.map(r => ({ name: r[xKey], value: r[yKey] })).sort((a: any, b: any) => b.value - a.value);
    } else {
      d = applySort(d, config.sortField, config.sortDir);
    }
    if (config.topN) d = d.slice(0, config.topN);
    return d;
  }, [data, config, xKey, yKey, agg]);

  const cardValue = useMemo(() => {
    if (config.type !== 'Card' || !data.length) return null;
    if (agg === 'count') return data.length;
    if (!yKey) return data.length;
    const vals = data.map(r => toNum(r[yKey]));
    switch (agg) {
      case 'avg': return vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      case 'max': return Math.max(...vals);
      case 'min': return Math.min(...vals);
      default:    return vals.reduce((a, b) => a + b, 0);
    }
  }, [data, config, agg, yKey]);

  if (!data.length) return (
    <div className="empty-state" style={{ minHeight: 120 }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data available</p>
    </div>
  );

  const stacked = config.barMode === 'stacked';

  const renderChart = () => {
    switch (config.type) {

      case 'Card':
        return (
          <div className="flex flex-col justify-center h-full px-2">
            <div className="kpi-value">{cardValue !== null ? fmt(cardValue) : '—'}</div>
            {yKey && <div className="kpi-label">{agg} of {yKey}</div>}
            <div className="kpi-trend" style={{ color: 'var(--color-success)' }}>{data.length.toLocaleString()} records</div>
          </div>
        );

      case 'Bar':
        return (
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" />
            <XAxis dataKey={xKey} tickFormatter={trunc} {...AP} axisLine={{ stroke: 'var(--border-base)' }} />
            <YAxis tickFormatter={fmt} {...AP} axisLine={false} width={48} />
            <Tooltip {...TS} formatter={(v: number) => fmt(v)} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {config.refLineValue !== undefined && (
              <ReferenceLine y={config.refLineValue} stroke="var(--color-warning)" strokeDasharray="4 3"
                label={{ value: config.refLineLabel ?? '', position: 'right', fontSize: 10, fill: 'var(--color-warning)' }} />
            )}
            <Bar dataKey={yKey} radius={stacked ? [0,0,0,0] : [4,4,0,0]} maxBarSize={56}
              stackId={stacked ? 'stack' : undefined}>
              {chartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        );

      case 'Line':
        return (
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" />
            <XAxis dataKey={xKey} tickFormatter={trunc} {...AP} axisLine={{ stroke: 'var(--border-base)' }} />
            <YAxis tickFormatter={fmt} {...AP} axisLine={false} width={48} />
            <Tooltip {...TS} formatter={(v: number) => fmt(v)} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {config.refLineValue !== undefined && (
              <ReferenceLine y={config.refLineValue} stroke="var(--color-warning)" strokeDasharray="4 3"
                label={{ value: config.refLineLabel ?? '', position: 'right', fontSize: 10, fill: 'var(--color-warning)' }} />
            )}
            <Line type="monotone" dataKey={yKey} stroke={COLORS[0]} strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 2, fill: 'var(--bg-surface)' }}
              activeDot={{ r: 5, strokeWidth: 0, fill: COLORS[0] }} />
          </LineChart>
        );

      case 'Area':
        return (
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 24 }}>
            <defs>
              <linearGradient id={`g-${config.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={COLORS[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-base)" />
            <XAxis dataKey={xKey} tickFormatter={trunc} {...AP} axisLine={{ stroke: 'var(--border-base)' }} />
            <YAxis tickFormatter={fmt} {...AP} axisLine={false} width={48} />
            <Tooltip {...TS} formatter={(v: number) => fmt(v)} />
            {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            <Area type="monotone" dataKey={yKey} stroke={COLORS[0]} strokeWidth={2}
              fill={`url(#g-${config.id})`} dot={{ r: 3, strokeWidth: 0, fill: COLORS[0] }} />
          </AreaChart>
        );

      case 'Pie':
      case 'Donut':
        return (
          <PieChart>
            <Tooltip {...TS} formatter={(v: number) => fmt(v)} />
            {config.showLegend !== false && (
              <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11, paddingTop: 16 }} />
            )}
            <Pie data={chartData} dataKey="value" nameKey="name"
              cx="50%" cy="47%"
              outerRadius={config.type === 'Donut' ? 90 : 100}
              innerRadius={config.type === 'Donut' ? 50 : 0}
              paddingAngle={config.type === 'Donut' ? 3 : 1}>
              {chartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
          </PieChart>
        );

      case 'Scatter': {
        const xOk = data.every(r => !isNaN(Number(r[xKey])));
        const yOk = data.every(r => !isNaN(Number(r[yKey])));
        if (!xOk || !yOk) return (
          <div className="empty-state">
            <p style={{ fontSize: 12, color: 'var(--color-warning)' }}>⚠ Scatter requires numeric X and Y fields.</p>
          </div>
        );
        return (
          <ScatterChart margin={{ top: 16, right: 16, bottom: 24, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-base)" />
            <XAxis type="number" dataKey={xKey} name={xKey} tickFormatter={fmt} {...AP} axisLine={{ stroke: 'var(--border-base)' }} />
            <YAxis type="number" dataKey={yKey} name={yKey} tickFormatter={fmt} {...AP} axisLine={false} width={48} />
            <Tooltip {...TS} />
            <Scatter data={chartData} fill={COLORS[0]} opacity={0.8} />
          </ScatterChart>
        );
      }

      case 'Table':
        return <DataTable data={data} config={config} />;

      default:
        return <div className="empty-state"><p>Unsupported chart type</p></div>;
    }
  };

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
