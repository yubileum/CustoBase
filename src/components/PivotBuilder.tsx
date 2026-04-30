import React, { useState, useCallback } from 'react';
import { ChartConfig, PivotValue } from '../lib/DataContext';
import { GripVertical, Plus, Trash2, ChevronDown, ChevronRight, Hash, Layers, AlignLeft, Filter } from 'lucide-react';

interface Props {
  tableFields: string[];
  config: Partial<ChartConfig>;
  onChange: (c: Partial<ChartConfig>) => void;
}

const AGG_OPTS = ['sum','count','avg','min','max'] as const;

function FieldTag({ label, onRemove, extra }: { label: string; onRemove: () => void; extra?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      background: 'var(--bg-active)', border: '1px solid var(--color-accent)',
      borderRadius: 6, padding: '3px 6px 3px 8px', fontSize: 11,
      color: 'var(--color-accent)', fontWeight: 600,
    }}>
      <GripVertical size={10} style={{ opacity: 0.5, flexShrink: 0 }} />
      <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{label}</span>
      {extra}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}>
        <Trash2 size={10} />
      </button>
    </div>
  );
}

function DropZone({
  title, icon, items, onAdd, onRemove, fields,
  renderItem,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  onAdd: (f: string) => void;
  onRemove: (f: string) => void;
  fields: string[];
  renderItem?: (f: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const available = fields.filter(f => !items.includes(f));
  return (
    <div style={{ background: 'var(--bg-surface2)', borderRadius: 8, border: '1px solid var(--border-base)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', borderBottom: items.length ? '1px solid var(--border-base)' : 'none' }}
        onClick={() => setOpen(o => !o)}>
        <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>{title}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{items.length} field{items.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(f => renderItem ? <React.Fragment key={f}>{renderItem(f)}</React.Fragment> : (
          <FieldTag key={f} label={f} onRemove={() => onRemove(f)} />
        ))}
        {items.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Drag or add a field…</span>}
      </div>
      {open && available.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-base)', padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {available.slice(0, 20).map(f => (
            <button key={f} onClick={() => { onAdd(f); setOpen(false); }} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--border-base)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}>+ {f}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PivotBuilder({ tableFields, config, onChange }: Props) {
  const rows = config.pivotRows ?? (config.xAxisField ? [config.xAxisField] : []);
  const columns = config.pivotColumns ?? [];
  const values: PivotValue[] = config.pivotValues ?? (config.yAxisField ? [{ field: config.yAxisField, aggregation: (config.aggregation as any) ?? 'sum' }] : []);

  const setRows = useCallback((r: string[]) => onChange({ pivotRows: r, xAxisField: r[0] ?? '' }), [onChange]);
  const setCols = useCallback((c: string[]) => onChange({ pivotColumns: c }), [onChange]);
  const setVals = useCallback((v: PivotValue[]) => onChange({ pivotValues: v, yAxisField: v[0]?.field ?? '', aggregation: v[0]?.aggregation ?? 'sum' }), [onChange]);

  const addRow = (f: string) => setRows([...rows, f]);
  const removeRow = (f: string) => setRows(rows.filter(r => r !== f));
  const addCol = (f: string) => setCols([...columns, f]);
  const removeCol = (f: string) => setCols(columns.filter(c => c !== f));

  const addValue = (f: string) => setVals([...values, { field: f, aggregation: 'sum' }]);
  const removeValue = (f: string) => setVals(values.filter(v => v.field !== f));
  const updateAgg = (f: string, aggregation: PivotValue['aggregation']) =>
    setVals(values.map(v => v.field === f ? { ...v, aggregation } : v));
  const updateLabel = (f: string, label: string) =>
    setVals(values.map(v => v.field === f ? { ...v, label } : v));

  const allUsed = [...rows, ...columns, ...values.map(v => v.field)];
  const freeFields = tableFields.filter(f => !allUsed.includes(f));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Available Fields */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Available Fields ({tableFields.length})
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, background: 'var(--bg-surface2)', borderRadius: 8, padding: 8, border: '1px solid var(--border-base)', minHeight: 36 }}>
          {freeFields.map(f => (
            <div key={f} style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--border-base)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', cursor: 'default',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <AlignLeft size={9} style={{ opacity: 0.5 }} />
              {f}
            </div>
          ))}
          {freeFields.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>All fields assigned</span>}
        </div>
      </div>

      {/* Rows */}
      <DropZone title="Rows (X-Axis / Group By)" icon={<AlignLeft size={12} />} items={rows} onAdd={addRow} onRemove={removeRow} fields={tableFields} />

      {/* Columns (pivot cross-tab) */}
      <DropZone title="Columns (Cross-tab Pivot)" icon={<Layers size={12} />} items={columns} onAdd={addCol} onRemove={removeCol} fields={tableFields} />

      {/* Values */}
      <DropZone
        title="Values (Metrics)"
        icon={<Hash size={12} />}
        items={values.map(v => v.field)}
        onAdd={addValue}
        onRemove={removeValue}
        fields={tableFields}
        renderItem={(f) => {
          const pv = values.find(v => v.field === f)!;
          return (
            <div key={f} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--bg-active)', border: '1px solid var(--color-accent)',
              borderRadius: 6, padding: '3px 6px', fontSize: 11,
              color: 'var(--color-accent)', flexWrap: 'wrap',
            }}>
              <GripVertical size={10} style={{ opacity: 0.5 }} />
              <span style={{ fontWeight: 600 }}>{f}</span>
              <select
                value={pv.aggregation}
                onChange={e => updateAgg(f, e.target.value as PivotValue['aggregation'])}
                style={{
                  fontSize: 10, background: 'var(--bg-surface2)', border: '1px solid var(--border-base)',
                  borderRadius: 3, color: 'var(--text-primary)', padding: '1px 2px', cursor: 'pointer',
                }}
                onClick={e => e.stopPropagation()}
              >
                {AGG_OPTS.map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
              </select>
              <input
                value={pv.label ?? ''}
                onChange={e => updateLabel(f, e.target.value)}
                placeholder="label"
                onClick={e => e.stopPropagation()}
                style={{
                  fontSize: 10, width: 52, background: 'var(--bg-surface2)',
                  border: '1px solid var(--border-base)', borderRadius: 3,
                  color: 'var(--text-primary)', padding: '1px 4px',
                }}
              />
              <button onClick={() => removeValue(f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                <Trash2 size={10} />
              </button>
            </div>
          );
        }}
      />

      {/* Sort & TopN */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Sort By</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <select className="form-select" style={{ flex: 1, fontSize: 11 }}
              value={config.sortField ?? ''} onChange={e => onChange({ sortField: e.target.value || undefined })}>
              <option value="">None</option>
              {tableFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select className="form-select" style={{ width: 68, fontSize: 11 }}
              value={config.sortDir ?? 'desc'} onChange={e => onChange({ sortDir: e.target.value as 'asc' | 'desc' })}>
              <option value="asc">↑ Asc</option>
              <option value="desc">↓ Desc</option>
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Top N Results</label>
          <input className="form-input" type="number" min={1} max={1000} style={{ fontSize: 11 }}
            placeholder="All" value={config.topN ?? ''}
            onChange={e => onChange({ topN: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </div>
    </div>
  );
}
