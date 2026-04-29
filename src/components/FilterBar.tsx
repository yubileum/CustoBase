import React, { useState } from 'react';
import { useFilters, FilterRule, FilterOperator } from '../lib/FilterContext';
import { useData } from '../lib/DataContext';
import { Filter, X, Plus, ChevronDown, SlidersHorizontal } from 'lucide-react';

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: '=', not_equals: '≠', contains: '∋', gt: '>', lt: '<',
  gte: '≥', lte: '≤', in: 'in', between: '↔',
};

export default function FilterBar() {
  const { filters, addFilter, removeFilter, clearFilters, isFilterEnabled, setFilterEnabled } = useFilters();
  const { tables } = useData();
  const [showPanel, setShowPanel] = useState(false);
  const [newFilter, setNewFilter] = useState<Partial<Omit<FilterRule,'id'>>>({});

  const allFields = tables.flatMap(t => t.fields.map(f => ({ tableId: t.id, tableName: t.name, field: f })));

  const handleAdd = () => {
    if (!newFilter.tableId || !newFilter.field || newFilter.operator == null) return;
    addFilter({
      tableId: newFilter.tableId!,
      field: newFilter.field!,
      operator: newFilter.operator!,
      value: newFilter.value ?? '',
    });
    setNewFilter({});
    setShowPanel(false);
  };

  const hasFilters = filters.length > 0;

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-base)',
        fontSize: 12,
      }}
      className="shrink-0 relative"
    >
      <div className="px-5 h-10 flex items-center gap-3">
        <button
          onClick={() => setShowPanel(v => !v)}
          className="btn btn-ghost btn-icon"
          style={{ color: hasFilters ? 'var(--color-accent)' : 'var(--text-muted)' }}
          title="Filters"
        >
          <SlidersHorizontal size={14} />
        </button>

        {hasFilters && (
          <>
            <button
              className="btn btn-ghost btn-icon"
              style={{ color: isFilterEnabled ? 'var(--color-success)' : 'var(--text-muted)' }}
              onClick={() => setFilterEnabled(!isFilterEnabled)}
              title={isFilterEnabled ? 'Filters ON — click to pause' : 'Filters OFF — click to enable'}
            >
              <Filter size={13} />
            </button>
            <div className="flex items-center gap-1.5 flex-wrap">
              {filters.map(f => {
                const tableName = tables.find(t => t.id === f.tableId)?.name ?? f.tableId;
                return (
                  <span key={f.id} className="filter-badge">
                    <span style={{ opacity: 0.6 }}>{tableName}.</span>
                    <strong>{f.field}</strong>
                    <span style={{ opacity: 0.7 }}>{OPERATOR_LABELS[f.operator]}</span>
                    <span>{String(f.value)}</span>
                    <button onClick={() => removeFilter(f.id)} style={{ marginLeft: 2, opacity: 0.6 }}>
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
              <button onClick={clearFilters} className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 11 }}>
                Clear all
              </button>
            </div>
          </>
        )}

        {!hasFilters && (
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            No active filters — click <Filter size={10} style={{ display:'inline', verticalAlign:'middle' }} /> to add
          </span>
        )}

        <button
          onClick={() => setShowPanel(v => !v)}
          className="btn btn-ghost ml-auto"
          style={{ fontSize: 11, gap: 4 }}
        >
          <Plus size={12} /> Add Filter
          <ChevronDown size={11} style={{ transform: showPanel ? 'rotate(180deg)' : 'none', transition: '180ms' }} />
        </button>
      </div>

      {/* Panel */}
      {showPanel && (
        <div
          className="absolute top-full right-0 z-30 animate-slide-up"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-base)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--card-shadow-hover)',
            padding: 16,
            minWidth: 360,
            marginTop: 4,
            marginRight: 12,
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)', fontSize: 13 }}>
            Add Filter Rule
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label className="form-label">Table.Field</label>
              <select
                className="form-select"
                value={newFilter.tableId && newFilter.field ? `${newFilter.tableId}:${newFilter.field}` : ''}
                onChange={e => {
                  const [tableId, field] = e.target.value.split(':');
                  setNewFilter(p => ({ ...p, tableId, field }));
                }}
              >
                <option value="">Select field…</option>
                {allFields.map(f => (
                  <option key={`${f.tableId}:${f.field}`} value={`${f.tableId}:${f.field}`}>
                    {f.tableName}.{f.field}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Operator</label>
              <select
                className="form-select"
                value={newFilter.operator ?? ''}
                onChange={e => setNewFilter(p => ({ ...p, operator: e.target.value as FilterOperator }))}
              >
                <option value="">…</option>
                {Object.entries(OPERATOR_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v} {k}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Value</label>
              <input
                className="form-input"
                placeholder="value"
                value={String(newFilter.value ?? '')}
                onChange={e => setNewFilter(p => ({ ...p, value: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowPanel(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd}>Add Filter</button>
          </div>
        </div>
      )}
    </div>
  );
}
