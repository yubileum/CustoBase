import React, { useState, useEffect } from 'react';
import { useData, ChartType, ChartConfig } from '../lib/DataContext';
import { X, LayoutTemplate, BarChart3, LineChart as LineChartIcon, PieChart, Crosshair, TableProperties, Hash, Table2, TrendingUp, CircleDot } from 'lucide-react';

interface Props {
  onClose: () => void;
  editChartId?: string;
}

const chartTypes: { type: ChartType; icon: any; label: string }[] = [
  { type: 'Card',    icon: Hash,           label: 'KPI Card'  },
  { type: 'Bar',     icon: BarChart3,       label: 'Bar'       },
  { type: 'Line',    icon: LineChartIcon,   label: 'Line'      },
  { type: 'Area',    icon: TrendingUp,      label: 'Area'      },
  { type: 'Pie',     icon: PieChart,        label: 'Pie'       },
  { type: 'Donut',   icon: CircleDot,      label: 'Donut'     },
  { type: 'Scatter', icon: Crosshair,       label: 'Scatter'   },
  { type: 'Table',   icon: TableProperties, label: 'Table'     },
];

const COLOR_SCHEMES = [
  { id: 'default', label: 'Violet', colors: ['#6366f1','#8b5cf6','#10b981'] },
  { id: 'ocean',   label: 'Ocean',  colors: ['#0ea5e9','#38bdf8','#06b6d4'] },
  { id: 'sunset',  label: 'Sunset', colors: ['#f97316','#fbbf24','#ef4444'] },
  { id: 'forest',  label: 'Forest', colors: ['#10b981','#65a30d','#34d399'] },
  { id: 'mono',    label: 'Slate',  colors: ['#94a3b8','#64748b','#334155'] },
];

const AGGREGATABLE: ChartType[] = ['Bar', 'Line', 'Area', 'Pie', 'Donut', 'Card'];

export default function ChartBuilder({ onClose, editChartId }: Props) {
  const { tables, activeTableId, fields, charts, addChart, updateChart } = useData();

  const [selectedTableId, setSelectedTableId] = useState<string>(activeTableId);
  const [type, setType] = useState<ChartType>('Bar');
  const [title, setTitle] = useState('New Chart');
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [aggregation, setAggregation] = useState<ChartConfig['aggregation']>('sum');
  const [colSpan, setColSpan] = useState<ChartConfig['colSpan']>(1);
  const [colorScheme, setColorScheme] = useState('default');
  const [showLegend, setShowLegend] = useState(true);

  const selectedTable = tables.find(t => t.id === selectedTableId);
  const tableFields = selectedTable?.fields ?? fields;

  // ✅ FIX: separated init-from-existing and type-change effects
  useEffect(() => {
    if (!editChartId) return;
    const existing = charts.find(c => c.id === editChartId);
    if (!existing) return;
    setSelectedTableId(existing.tableId ?? activeTableId);
    setType(existing.type);
    setTitle(existing.title);
    setXAxis(existing.type === 'Pie' || existing.type === 'Donut'
      ? (existing.nameField || '') : (existing.xAxisField || ''));
    setYAxis(existing.type === 'Pie' || existing.type === 'Donut'
      ? (existing.valueField || '') : (existing.yAxisField || ''));
    setAggregation(existing.aggregation || 'sum');
    setColSpan(existing.colSpan || 1);
    setColorScheme(existing.colorScheme || 'default');
    setShowLegend(existing.showLegend ?? true);
  }, [editChartId]); // eslint-disable-line

  // Default colSpan by type (new chart only)
  useEffect(() => {
    if (editChartId) return;
    setColSpan(type === 'Table' ? 3 : type === 'Card' ? 1 : 1);
  }, [type, editChartId]);

  // Auto-select first fields when table changes
  useEffect(() => {
    const tbl = tables.find(t => t.id === selectedTableId);
    if (tbl && tbl.fields.length > 0) {
      setXAxis(tbl.fields[0] || '');
      setYAxis(tbl.fields[1] || tbl.fields[0] || '');
    }
  }, [selectedTableId]); // eslint-disable-line

  const handleSave = () => {
    const base: any = { title, type, colSpan, tableId: selectedTableId || undefined, colorScheme, showLegend };

    if (type === 'Card') {
      base.yAxisField = yAxis;
      base.aggregation = aggregation;
    } else if (type === 'Pie' || type === 'Donut') {
      base.nameField  = xAxis;
      base.valueField = yAxis;
      base.aggregation = aggregation;
    } else if (type === 'Scatter') {
      base.xAxisField = xAxis;
      base.yAxisField = yAxis;
    } else {
      base.xAxisField = xAxis;
      base.yAxisField = yAxis;
      base.aggregation = aggregation;
    }

    if (editChartId) {
      updateChart(editChartId, base);
    } else {
      addChart({ id: crypto.randomUUID(), ...base });
    }
    onClose();
  };

  const showXAxis = type !== 'Card' && type !== 'Table';
  const showYAxis = type !== 'Table';
  const showAgg   = AGGREGATABLE.includes(type);

  return (
    <div className="modal-backdrop">
      <div className="modal-panel" style={{ maxWidth: 620 }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-base)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="accent-gradient" style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutTemplate size={14} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {editChartId ? 'Edit Visualization' : 'Add Visualization'}
            </span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Table selector */}
          {tables.length > 0 && (
            <div>
              <label className="form-label"><Table2 size={11} style={{ display: 'inline', marginRight: 4 }} />Data Table</label>
              <select className="form-select" value={selectedTableId} onChange={e => setSelectedTableId(e.target.value)}>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.data.length.toLocaleString()} rows)</option>
                ))}
              </select>
            </div>
          )}

          {/* Title + Width */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Chart Title</label>
              <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Layout Width</label>
              <select className="form-select" value={colSpan} onChange={e => setColSpan(Number(e.target.value) as 1|2|3)}>
                <option value={1}>1 Column (1/3)</option>
                <option value={2}>2 Columns (2/3)</option>
                <option value={3}>3 Columns (Full)</option>
              </select>
            </div>
          </div>

          {/* Chart type picker */}
          <div>
            <label className="form-label">Visualization Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {chartTypes.map(ct => (
                <button
                  key={ct.type}
                  onClick={() => setType(ct.type)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 6, padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${type === ct.type ? 'var(--color-accent)' : 'var(--border-base)'}`,
                    background: type === ct.type ? 'var(--bg-active)' : 'var(--bg-surface2)',
                    color: type === ct.type ? 'var(--color-accent)' : 'var(--text-secondary)',
                    transition: 'all 180ms',
                  }}
                >
                  <ct.icon size={20} />
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {ct.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Field config */}
          {type !== 'Table' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {showXAxis && (
                <div>
                  <label className="form-label">
                    {type === 'Pie' || type === 'Donut' ? 'Category (Name)' : 'X-Axis (Categories)'}
                  </label>
                  <select className="form-select" value={xAxis} onChange={e => setXAxis(e.target.value)}>
                    {tableFields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              )}
              {showYAxis && (
                <div>
                  <label className="form-label">
                    {type === 'Pie' || type === 'Donut' ? 'Value' : type === 'Card' ? 'Metric Field' : 'Y-Axis (Values)'}
                  </label>
                  <select className="form-select" value={yAxis} onChange={e => setYAxis(e.target.value)}>
                    {tableFields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              )}
              {showAgg && (
                <div>
                  <label className="form-label">Aggregation</label>
                  <select className="form-select" value={aggregation} onChange={e => setAggregation(e.target.value as ChartConfig['aggregation'])}>
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="count">Count (rows)</option>
                    <option value="max">Maximum</option>
                    <option value="min">Minimum</option>
                    {(type === 'Bar' || type === 'Line' || type === 'Area') && (
                      <option value="none">None (raw rows)</option>
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Styling */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label className="form-label">Color Scheme</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {COLOR_SCHEMES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setColorScheme(s.id)}
                    title={s.label}
                    style={{
                      display: 'flex', gap: 2, padding: '5px 8px', borderRadius: 8,
                      border: `2px solid ${colorScheme === s.id ? 'var(--color-accent)' : 'transparent'}`,
                      background: colorScheme === s.id ? 'var(--bg-active)' : 'var(--bg-surface2)',
                      cursor: 'pointer',
                    }}
                  >
                    {s.colors.map((c, i) => (
                      <span key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
                    ))}
                  </button>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 2 }}>
              <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} />
              Show Legend
            </label>
          </div>
        </div>

        {/* Actions */}
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
