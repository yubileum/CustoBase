import React, { useState, useRef, useEffect } from 'react';
import { useData, Relation, RelationType } from '../lib/DataContext';
import { X, Plus, Pencil, Trash2, Network, ArrowRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface Props { onClose: () => void; }

const RELATION_TYPES: { value: RelationType; label: string; color: string }[] = [
  { value: 'one-to-one',  label: '1 : 1', color: '#10b981' },
  { value: 'one-to-many', label: '1 : N', color: '#6366f1' },
  { value: 'many-to-many',label: 'N : N', color: '#a855f7' },
];

const EMPTY_FORM = { id: undefined as string|undefined, fromTable:'', fromField:'', toTable:'', toField:'', type:'one-to-many' as RelationType };

// ─── Simple SVG canvas ERD ────────────────────────────────────────────────────

interface NodePos { x: number; y: number; width: number; height: number; }

export default function ERDModal({ onClose }: Props) {
  const { tables, relations, upsertRelation, removeRelation } = useData();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [scale, setScale] = useState(1);
  const [activeTab, setActiveTab] = useState<'canvas' | 'list'>('canvas');

  // Compute node positions in a simple grid
  const COL_W = 200; const ROW_H_BASE = 40; const FIELD_H = 22; const PAD = 40;
  const COLS = 3;

  const nodePositions: Record<string, NodePos> = {};
  tables.forEach((t, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const height = ROW_H_BASE + t.fields.length * FIELD_H + 12;
    nodePositions[t.id] = {
      x: col * (COL_W + PAD) + PAD,
      y: row * (280 + PAD) + PAD,
      width: COL_W,
      height,
    };
  });

  const svgWidth  = Math.max(...Object.values(nodePositions).map(n => n.x + n.width + PAD), 600);
  const svgHeight = Math.max(...Object.values(nodePositions).map(n => n.y + n.height + PAD), 400);

  // Draw edge between two nodes
  function getEdgePath(r: Relation): string {
    const from = nodePositions[r.fromTable];
    const to   = nodePositions[r.toTable];
    if (!from || !to) return '';
    const x1 = from.x + from.width;
    const y1 = from.y + ROW_H_BASE / 2;
    const x2 = to.x;
    const y2 = to.y + ROW_H_BASE / 2;
    const cx = (x1 + x2) / 2;
    return `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
  }

  // Form helpers
  const fromTableObj = tables.find(t => t.id === form.fromTable);
  const toTableObj   = tables.find(t => t.id === form.toTable);

  const handleSave = () => {
    if (!form.fromTable || !form.fromField || !form.toTable || !form.toField) {
      setFormError('All fields are required.'); return;
    }
    if (form.fromTable === form.toTable && form.fromField === form.toField) {
      setFormError('Cannot link a field to itself.'); return;
    }
    upsertRelation({ ...form, id: editingId ?? undefined });
    setForm({ ...EMPTY_FORM });
    setEditingId(null); setFormError('');
  };

  const startEdit = (r: Relation) => {
    setForm({ id: r.id, fromTable: r.fromTable, fromField: r.fromField, toTable: r.toTable, toField: r.toField, type: r.type });
    setEditingId(r.id);
    setFormError('');
  };

  const relColors: Record<RelationType, string> = {
    'one-to-one': '#10b981', 'one-to-many': '#6366f1', 'many-to-many': '#a855f7',
  };

  const relatedFields = new Set(relations.flatMap(r => [`${r.fromTable}:${r.fromField}`, `${r.toTable}:${r.toField}`]));

  return (
    <div className="modal-backdrop">
      <div className="modal-panel" style={{ maxWidth: 960, height: '88vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-base)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="accent-gradient" style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Network size={15} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Entity Relationship Diagram</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="tab-bar">
              <button className={`tab-item ${activeTab === 'canvas' ? 'active' : ''}`} onClick={() => setActiveTab('canvas')}>Visual Canvas</button>
              <button className={`tab-item ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>Relations List</button>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* Canvas Tab */}
        {activeTab === 'canvas' && (
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'var(--bg-base)' }}>
            {/* Zoom controls */}
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 4 }}>
              <button className="btn btn-secondary btn-icon" onClick={() => setScale(s => Math.min(s + 0.15, 2))}><ZoomIn size={13} /></button>
              <button className="btn btn-secondary btn-icon" onClick={() => setScale(s => Math.max(s - 0.15, 0.4))}><ZoomOut size={13} /></button>
              <button className="btn btn-secondary btn-icon" onClick={() => setScale(1)}><Maximize2 size={13} /></button>
            </div>

            {tables.length === 0 ? (
              <div className="empty-state" style={{ height: '100%' }}>
                <p style={{ color: 'var(--text-muted)' }}>No tables loaded. Connect a data source first.</p>
              </div>
            ) : (
              <div style={{ overflow: 'auto', width: '100%', height: '100%' }}>
                <svg
                  width={svgWidth * scale}
                  height={svgHeight * scale}
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  style={{ display: 'block' }}
                >
                  {/* Grid pattern */}
                  <defs>
                    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--border-base)" strokeWidth="0.5" />
                    </pattern>
                    <marker id="arrow-end" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L8,3 z" fill="var(--color-accent)" />
                    </marker>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />

                  {/* Relation edges */}
                  {relations.map(r => {
                    const path = getEdgePath(r);
                    const color = relColors[r.type];
                    return (
                      <g key={r.id}>
                        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeDasharray="5,3" opacity={0.7} markerEnd="url(#arrow-end)" />
                        <text style={{ fontSize: 9, fill: color, fontWeight: 600 }}>
                          <textPath href={`#path-${r.id}`} startOffset="50%">
                            {RELATION_TYPES.find(t => t.value === r.type)?.label}
                          </textPath>
                        </text>
                      </g>
                    );
                  })}

                  {/* Table nodes */}
                  {tables.map(table => {
                    const pos = nodePositions[table.id];
                    return (
                      <g key={table.id}>
                        {/* Shadow */}
                        <rect x={pos.x + 3} y={pos.y + 3} width={pos.width} height={pos.height} rx={8} fill="rgba(0,0,0,0.15)" />
                        {/* Card */}
                        <rect x={pos.x} y={pos.y} width={pos.width} height={pos.height} rx={8} fill="var(--bg-surface)" stroke="var(--border-strong)" strokeWidth="1" />
                        {/* Header */}
                        <rect x={pos.x} y={pos.y} width={pos.width} height={ROW_H_BASE} rx={8} fill="var(--color-accent)" opacity={0.9} />
                        <rect x={pos.x} y={pos.y + ROW_H_BASE - 8} width={pos.width} height={8} fill="var(--color-accent)" opacity={0.9} />
                        <text x={pos.x + 10} y={pos.y + 24} fill="white" fontSize={12} fontWeight={700}>{table.name}</text>
                        <text x={pos.x + pos.width - 8} y={pos.y + 24} fill="rgba(255,255,255,0.7)" fontSize={10} textAnchor="end">
                          {table.data.length}r
                        </text>
                        {/* Fields */}
                        {table.fields.slice(0, 10).map((field, fi) => {
                          const fy = pos.y + ROW_H_BASE + 8 + fi * FIELD_H;
                          const isLinked = relatedFields.has(`${table.id}:${field}`);
                          return (
                            <g key={field}>
                              {fi > 0 && <line x1={pos.x + 8} y1={fy} x2={pos.x + pos.width - 8} y2={fy} stroke="var(--border-base)" strokeWidth="0.5" />}
                              {isLinked && <circle cx={pos.x + 14} cy={fy + 10} r={4} fill="var(--color-accent)" opacity={0.8} />}
                              <text
                                x={isLinked ? pos.x + 24 : pos.x + 14}
                                y={fy + 14}
                                fill={isLinked ? 'var(--color-accent)' : 'var(--text-secondary)'}
                                fontSize={11}
                                fontWeight={isLinked ? 600 : 400}
                              >
                                {field.length > 22 ? field.slice(0, 21) + '…' : field}
                              </text>
                            </g>
                          );
                        })}
                        {table.fields.length > 10 && (
                          <text x={pos.x + 10} y={pos.y + pos.height - 6} fill="var(--text-muted)" fontSize={10}>
                            +{table.fields.length - 10} more fields
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Relations List Tab */}
        {activeTab === 'list' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Relations list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Relations ({relations.length})
              </p>
              {relations.length === 0 ? (
                <div className="empty-state"><p style={{ fontSize: 13 }}>No relations defined yet. Add one below.</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {relations.map(r => {
                    const rt = RELATION_TYPES.find(t => t.value === r.type)!;
                    const fromName = tables.find(t => t.id === r.fromTable)?.name ?? r.fromTable;
                    const toName   = tables.find(t => t.id === r.toTable)?.name ?? r.toTable;
                    return (
                      <div key={r.id} style={{
                        padding: '10px 14px', borderRadius: 8,
                        border: `1px solid ${editingId === r.id ? 'var(--color-accent)' : 'var(--border-base)'}`,
                        background: editingId === r.id ? 'var(--bg-active)' : 'var(--bg-surface2)',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: rt.color, padding: '2px 6px', borderRadius: 4, border: `1px solid ${rt.color}`, background: `${rt.color}18` }}>
                          {rt.label}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>
                          <strong>{fromName}</strong>.{r.fromField}
                          <ArrowRight size={12} style={{ display: 'inline', margin: '0 6px', color: 'var(--text-muted)' }} />
                          <strong>{toName}</strong>.{r.toField}
                        </span>
                        <button className="btn btn-ghost btn-icon" style={{ padding: 4 }} onClick={() => startEdit(r)}><Pencil size={12} /></button>
                        <button className="btn btn-ghost btn-icon" style={{ padding: 4, color: 'var(--color-danger)' }} onClick={() => removeRelation(r.id)}><Trash2 size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Form */}
            <div style={{ width: 280, borderLeft: '1px solid var(--border-base)', padding: 16, background: 'var(--bg-surface2)', overflowY: 'auto', flexShrink: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                {editingId ? 'Edit Relation' : 'Add Relation'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'From Table', key: 'fromTable', dep: null },
                  { label: 'From Field', key: 'fromField', dep: fromTableObj },
                  { label: 'To Table',   key: 'toTable',   dep: null },
                  { label: 'To Field',   key: 'toField',   dep: toTableObj },
                ].map(({ label, key, dep }) => (
                  <div key={key}>
                    <label className="form-label">{label}</label>
                    <select
                      className="form-select"
                      value={(form as any)[key]}
                      disabled={key.endsWith('Field') && !dep}
                      onChange={e => {
                        const v = e.target.value;
                        if (key === 'fromTable') setForm(p => ({ ...p, fromTable: v, fromField: '' }));
                        else if (key === 'toTable') setForm(p => ({ ...p, toTable: v, toField: '' }));
                        else setForm(p => ({ ...p, [key]: v }));
                        setFormError('');
                      }}
                    >
                      <option value="">Select…</option>
                      {key.endsWith('Table')
                        ? tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                        : (dep?.fields ?? []).map((f: string) => <option key={f} value={f}>{f}</option>)
                      }
                    </select>
                  </div>
                ))}

                <div>
                  <label className="form-label">Relation Type</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {RELATION_TYPES.map(rt => (
                      <button
                        key={rt.value}
                        onClick={() => setForm(p => ({ ...p, type: rt.value }))}
                        style={{
                          flex: 1, padding: '5px 4px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                          border: `1px solid ${form.type === rt.value ? rt.color : 'var(--border-base)'}`,
                          background: form.type === rt.value ? `${rt.color}18` : 'transparent',
                          color: form.type === rt.value ? rt.color : 'var(--text-secondary)',
                          transition: '180ms',
                        }}
                      >
                        {rt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {formError && <p style={{ fontSize: 12, color: 'var(--color-danger)', background: 'rgba(239,68,68,0.08)', padding: '6px 10px', borderRadius: 6 }}>{formError}</p>}

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {editingId && <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setForm({ ...EMPTY_FORM }); setEditingId(null); }}>Cancel</button>}
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
                    <Plus size={13} />{editingId ? 'Update' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
