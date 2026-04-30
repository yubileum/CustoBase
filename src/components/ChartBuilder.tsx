import React, { useState, useEffect } from 'react';
import { useData, ChartType, ChartConfig } from '../lib/DataContext';
import {
  X, LayoutTemplate, BarChart3, LineChart as LineChartIcon, PieChart,
  Crosshair, TableProperties, Hash, Table2, TrendingUp, CircleDot,
} from 'lucide-react';

interface Props { onClose: () => void; editChartId?: string; }

const CHART_TYPES: { type: ChartType; icon: any; label: string }[] = [
  { type: 'Card',    icon: Hash,           label: 'KPI Card' },
  { type: 'Bar',     icon: BarChart3,       label: 'Bar'      },
  { type: 'Line',    icon: LineChartIcon,   label: 'Line'     },
  { type: 'Area',    icon: TrendingUp,      label: 'Area'     },
  { type: 'Pie',     icon: PieChart,        label: 'Pie'      },
  { type: 'Donut',   icon: CircleDot,       label: 'Donut'    },
  { type: 'Scatter', icon: Crosshair,       label: 'Scatter'  },
  { type: 'Table',   icon: TableProperties, label: 'Table'    },
];

const COLOR_SCHEMES = [
  { id: 'default', colors: ['#6366f1','#8b5cf6','#10b981'] },
  { id: 'ocean',   colors: ['#0ea5e9','#38bdf8','#06b6d4'] },
  { id: 'sunset',  colors: ['#f97316','#fbbf24','#ef4444'] },
  { id: 'forest',  colors: ['#10b981','#65a30d','#34d399'] },
  { id: 'mono',    colors: ['#94a3b8','#64748b','#334155'] },
];

const AGG_OPTS = [
  { value: 'sum',   label: 'Sum'     },
  { value: 'count', label: 'Count'   },
  { value: 'avg',   label: 'Average' },
  { value: 'max',   label: 'Max'     },
  { value: 'min',   label: 'Min'     },
];

export default function ChartBuilder({ onClose, editChartId }: Props) {
  const { tables, activeTableId, fields, charts, addChart, updateChart } = useData();

  const [tableId,      setTableId]      = useState(activeTableId);
  const [type,         setType]         = useState<ChartType>('Bar');
  const [title,        setTitle]        = useState('New Chart');
  const [xField,       setXField]       = useState('');
  const [yField,       setYField]       = useState('');
  const [aggregation,  setAggregation]  = useState<ChartConfig['aggregation']>('sum');
  const [colSpan,      setColSpan]      = useState<1|2|3>(1);
  const [colorScheme,  setColorScheme]  = useState('default');
  const [showLegend,   setShowLegend]   = useState(true);
  const [visibleCols,  setVisibleCols]  = useState<string[]>([]);
  const [sortField,    setSortField]    = useState('');
  const [sortDir,      setSortDir]      = useState<'asc'|'desc'>('desc');
  const [topN,         setTopN]         = useState<number|undefined>(undefined);
  const [barMode,      setBarMode]      = useState<'grouped'|'stacked'>('grouped');

  const tbl     = tables.find(t => t.id === tableId);
  const tFields = tbl?.fields ?? fields;

  // Load existing when editing
  useEffect(() => {
    if (!editChartId) return;
    const c = charts.find(c => c.id === editChartId);
    if (!c) return;
    setTableId(c.tableId ?? activeTableId);
    setType(c.type);
    setTitle(c.title);
    setXField(c.pivotRows?.[0] ?? c.xAxisField ?? c.nameField ?? '');
    setYField(c.pivotValues?.[0]?.field ?? c.yAxisField ?? c.valueField ?? '');
    setAggregation(c.pivotValues?.[0]?.aggregation ?? c.aggregation ?? 'sum');
    setColSpan(c.colSpan ?? 1);
    setColorScheme(c.colorScheme ?? 'default');
    setShowLegend(c.showLegend ?? true);
    setVisibleCols(c.visibleColumns ?? []);
    setSortField(c.sortField ?? '');
    setSortDir(c.sortDir ?? 'desc');
    setTopN(c.topN);
    setBarMode(c.barMode ?? 'grouped');
  }, [editChartId]); // eslint-disable-line

  // Auto-pick first fields when table changes (new chart only)
  useEffect(() => {
    if (editChartId) return;
    if (tFields.length > 0) {
      setXField(tFields[0] ?? '');
      setYField(tFields[1] ?? tFields[0] ?? '');
    }
    setVisibleCols([]);
  }, [tableId]); // eslint-disable-line

  const toggleCol = (col: string) =>
    setVisibleCols(p => p.includes(col) ? p.filter(c => c !== col) : [...p, col]);

  const handleSave = () => {
    const base: Partial<ChartConfig> = {
      type, title, colSpan, tableId: tableId || undefined,
      colorScheme, showLegend, sortField: sortField || undefined,
      sortDir, topN, barMode,
      // Always keep pivotValues in sync
      pivotRows: type !== 'Card' && type !== 'Table' ? [xField] : undefined,
      pivotValues: yField ? [{ field: yField, aggregation: aggregation ?? 'sum' }] : undefined,
      // Legacy fields for backward compat
      xAxisField: xField, yAxisField: yField, aggregation,
      nameField:  (type === 'Pie' || type === 'Donut') ? xField : undefined,
      valueField: (type === 'Pie' || type === 'Donut') ? yField : undefined,
      visibleColumns: visibleCols.length > 0 ? visibleCols : undefined,
    };

    const full: ChartConfig = { id: editChartId ?? crypto.randomUUID(), ...base } as ChartConfig;
    if (editChartId) updateChart(editChartId, full);
    else addChart(full);
    onClose();
  };

  const isPie     = type === 'Pie' || type === 'Donut';
  const isTable   = type === 'Table';
  const isCard    = type === 'Card';
  const isScatter = type === 'Scatter';
  const isBar     = type === 'Bar' || type === 'Line' || type === 'Area';

  return (
    <div className="modal-backdrop">
      <div className="modal-panel" style={{ maxWidth: 560 }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-base)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="accent-gradient" style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutTemplate size={14} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {editChartId ? 'Edit Chart' : 'Add Chart'}
            </span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '76vh', overflowY: 'auto' }}>

          {/* Data source */}
          {tables.length > 0 && (
            <div>
              <label className="form-label"><Table2 size={11} style={{ display:'inline', marginRight:4 }} />Data Table</label>
              <select className="form-select" value={tableId} onChange={e => setTableId(e.target.value)}>
                {tables.map(t => <option key={t.id} value={t.id}>{t.name} ({t.data.length.toLocaleString()} rows)</option>)}
              </select>
            </div>
          )}

          {/* Title + Width */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <div>
              <label className="form-label">Title</label>
              <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Width</label>
              <select className="form-select" value={colSpan} onChange={e => setColSpan(Number(e.target.value) as 1|2|3)} style={{ width: 130 }}>
                <option value={1}>1/3 width</option>
                <option value={2}>2/3 width</option>
                <option value={3}>Full width</option>
              </select>
            </div>
          </div>

          {/* Chart type */}
          <div>
            <label className="form-label">Chart Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {CHART_TYPES.map(ct => (
                <button key={ct.type} onClick={() => setType(ct.type)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  padding: '10px 6px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${type === ct.type ? 'var(--color-accent)' : 'var(--border-base)'}`,
                  background: type === ct.type ? 'var(--bg-active)' : 'var(--bg-surface2)',
                  color: type === ct.type ? 'var(--color-accent)' : 'var(--text-secondary)',
                  transition: 'all 150ms',
                }}>
                  <ct.icon size={18} />
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ct.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Field config — changes per type ── */}
          {!isTable && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

              {/* X / Category / Label */}
              {!isCard && (
                <div>
                  <label className="form-label">
                    {isPie ? 'Category' : isScatter ? 'X-Axis (number)' : 'X-Axis / Group by'}
                  </label>
                  <select className="form-select" value={xField} onChange={e => setXField(e.target.value)}>
                    {tFields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              )}

              {/* Y / Value / Metric */}
              <div>
                <label className="form-label">
                  {isPie ? 'Value' : isCard ? 'Metric Field' : isScatter ? 'Y-Axis (number)' : 'Y-Axis / Value'}
                </label>
                <select className="form-select" value={yField} onChange={e => setYField(e.target.value)}>
                  {tFields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Aggregation (not for scatter) */}
              {!isScatter && (
                <div>
                  <label className="form-label">Aggregation</label>
                  <select className="form-select" value={aggregation} onChange={e => setAggregation(e.target.value as ChartConfig['aggregation'])}>
                    {AGG_OPTS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    {isBar && <option value="none">None (raw rows)</option>}
                  </select>
                </div>
              )}

              {/* Top N */}
              {!isCard && !isScatter && (
                <div>
                  <label className="form-label">Top N results</label>
                  <input className="form-input" type="number" min={1} max={500}
                    placeholder="All" value={topN ?? ''}
                    onChange={e => setTopN(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
              )}

              {/* Sort (bar/line/area) */}
              {isBar && (
                <>
                  <div>
                    <label className="form-label">Sort By</label>
                    <select className="form-select" value={sortField} onChange={e => setSortField(e.target.value)}>
                      <option value="">Default</option>
                      {tFields.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Bar Mode</label>
                    <select className="form-select" value={barMode} onChange={e => setBarMode(e.target.value as 'grouped'|'stacked')}>
                      <option value="grouped">Grouped</option>
                      <option value="stacked">Stacked</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Table: column picker ── */}
          {isTable && tFields.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Visible Columns</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setVisibleCols(tFields)} style={{ fontSize: 11, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer' }}>All</button>
                  <button onClick={() => setVisibleCols([])}      style={{ fontSize: 11, color: 'var(--text-muted)',    background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tFields.map(col => {
                  const on = visibleCols.length === 0 || visibleCols.includes(col);
                  return (
                    <button key={col} onClick={() => toggleCol(col)} style={{
                      fontSize: 11, padding: '4px 11px', borderRadius: 20, cursor: 'pointer',
                      border: `1px solid ${on ? 'var(--color-accent)' : 'var(--border-base)'}`,
                      background: on ? 'var(--bg-active)' : 'var(--bg-surface2)',
                      color: on ? 'var(--color-accent)' : 'var(--text-muted)',
                      fontWeight: on ? 600 : 400, transition: 'all 130ms',
                    }}>{col}</button>
                  );
                })}
              </div>

              {/* Table sort */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 12 }}>
                <div>
                  <label className="form-label">Sort By</label>
                  <select className="form-select" value={sortField} onChange={e => setSortField(e.target.value)}>
                    <option value="">None</option>
                    {tFields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Direction</label>
                  <select className="form-select" value={sortDir} onChange={e => setSortDir(e.target.value as 'asc'|'desc')}>
                    <option value="asc">↑ Asc</option>
                    <option value="desc">↓ Desc</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Styling ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <label className="form-label" style={{ marginBottom: 6 }}>Color</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {COLOR_SCHEMES.map(s => (
                  <button key={s.id} onClick={() => setColorScheme(s.id)} style={{
                    display: 'flex', gap: 2, padding: '4px 7px', borderRadius: 8,
                    border: `2px solid ${colorScheme === s.id ? 'var(--color-accent)' : 'transparent'}`,
                    background: colorScheme === s.id ? 'var(--bg-active)' : 'var(--bg-surface2)',
                    cursor: 'pointer',
                  }}>
                    {s.colors.map((c, i) => <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
                  </button>
                ))}
              </div>
            </div>
            {!isTable && !isCard && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', marginTop: 16 }}>
                <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} />
                Show legend
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-base)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {editChartId ? 'Update Chart' : 'Add Chart'}
          </button>
        </div>
      </div>
    </div>
  );
}
