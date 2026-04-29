import React, { useState, useCallback } from 'react';
import { useData } from '../lib/DataContext';
import { usePages } from '../lib/PageContext';
import ChartRenderer from './ChartRenderer';
import ChartBuilder from './ChartBuilder';
import { Settings, Trash2, GripVertical, Plus, LayoutGrid, ChevronDown, Pencil, Check, X } from 'lucide-react';

// ─── Simple sortable grid without external dnd library ───────────────────────
// (We avoid requiring @dnd-kit until the user installs it)

function PageTabs() {
  const { pages, activePageId, setActivePage, addPage, renamePage, removePage } = usePages();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startRename = (id: string, name: string) => { setEditingId(id); setEditName(name); };
  const commitRename = () => {
    if (editingId && editName.trim()) renamePage(editingId, editName.trim());
    setEditingId(null);
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-base)',
        paddingLeft: 16, paddingRight: 8,
        overflowX: 'auto', flexShrink: 0,
      }}
    >
      {pages.map(p => (
        <div
          key={p.id}
          className={`page-tab ${p.id === activePageId ? 'active' : ''}`}
          onClick={() => setActivePage(p.id)}
          style={{ position: 'relative' }}
        >
          {editingId === p.id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                style={{
                  width: 80, fontSize: 12, background: 'var(--bg-surface2)',
                  border: '1px solid var(--color-accent)', borderRadius: 4,
                  padding: '1px 4px', color: 'var(--text-primary)',
                }}
              />
              <button onClick={commitRename} className="btn btn-ghost btn-icon" style={{ padding: 2 }}><Check size={10} /></button>
              <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-icon" style={{ padding: 2 }}><X size={10} /></button>
            </div>
          ) : (
            <>
              <span style={{ userSelect: 'none' }}>{p.name}</span>
              {p.id === activePageId && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
                  <button
                    className="btn btn-ghost btn-icon"
                    style={{ padding: 2, opacity: 0.5 }}
                    onClick={e => { e.stopPropagation(); startRename(p.id, p.name); }}
                  ><Pencil size={9} /></button>
                  {pages.length > 1 && (
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ padding: 2, opacity: 0.5 }}
                      onClick={e => { e.stopPropagation(); removePage(p.id); }}
                    ><X size={9} /></button>
                  )}
                </span>
              )}
            </>
          )}
        </div>
      ))}
      <button
        className="btn btn-ghost btn-icon"
        onClick={() => addPage()}
        style={{ marginLeft: 4, padding: '2px 8px', fontSize: 11 }}
        title="New page"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { charts, removeChart, tables } = useData();
  const { activePageId, activePageChartIds, addChartToPage, removeChartFromPage, reorderChartsInPage } = usePages();
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const hasAnyData = tables.some(t => t.data.length > 0);

  // Charts visible on this page
  const pageCharts = activePageChartIds
    .map(id => charts.find(c => c.id === id))
    .filter(Boolean) as typeof charts;

  // Charts not yet assigned to this page
  const unassignedCharts = charts.filter(c => !activePageChartIds.includes(c.id));

  // Auto-add newly created charts to active page
  React.useEffect(() => {
    charts.forEach(c => {
      if (!activePageChartIds.includes(c.id)) {
        addChartToPage(c.id);
      }
    });
  }, [charts.length]); // eslint-disable-line

  // ── Drag & Drop (native HTML5) ──────────────────────────────────────────
  const onDragStart = (id: string) => setDraggedId(id);
  const onDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const onDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    const ids = [...activePageChartIds];
    const fromIdx = ids.indexOf(draggedId);
    const toIdx   = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { setDraggedId(null); setDragOverId(null); return; }
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    reorderChartsInPage(activePageId, ids);
    setDraggedId(null);
    setDragOverId(null);
  };
  const onDragEnd = () => { setDraggedId(null); setDragOverId(null); };

  // ── Empty states ────────────────────────────────────────────────────────
  if (!hasAnyData) {
    return (
      <>
        <PageTabs />
        <div className="flex-1 empty-state">
          <div className="empty-state-icon">
            <LayoutGrid size={28} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>
            No data source connected
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320 }}>
            Connect a Google Sheet, Excel file, or CSV to start building your dashboard.
          </p>
        </div>
      </>
    );
  }

  if (pageCharts.length === 0) {
    return (
      <>
        <PageTabs />
        <div className="flex-1 empty-state">
          <div className="empty-state-icon">
            <Plus size={28} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>
            This page is empty
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Click <strong>+ Add Chart</strong> to create your first visualization.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageTabs />
      <div
        className="flex-1 overflow-auto"
        style={{ background: 'var(--bg-base)', padding: 24 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            maxWidth: 1440,
            margin: '0 auto',
            alignItems: 'start',
          }}
        >
          {pageCharts.map(chart => {
            const span = chart.colSpan ?? 1;
            const isBeingDraggedOver = dragOverId === chart.id;
            const isBeingDragged = draggedId === chart.id;

            return (
              <div
                key={chart.id}
                draggable
                onDragStart={() => onDragStart(chart.id)}
                onDragOver={e => onDragOver(e, chart.id)}
                onDrop={() => onDrop(chart.id)}
                onDragEnd={onDragEnd}
                className={`dash-card flex flex-col overflow-hidden group ${isBeingDragged ? 'opacity-40' : ''}`}
                style={{
                  gridColumn: span === 3 ? '1 / -1' : span === 2 ? 'span 2' : 'span 1',
                  height: chart.type === 'Card' ? 160 : chart.type === 'Table' ? 380 : 340,
                  transition: 'all 200ms ease',
                  outline: isBeingDraggedOver ? '2px solid var(--color-accent)' : 'none',
                  outlineOffset: 2,
                }}
              >
                {/* Card Header */}
                <div
                  style={{
                    padding: '12px 14px 10px',
                    borderBottom: '1px solid var(--border-base)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <GripVertical
                    size={14}
                    className="drag-handle"
                    style={{ flexShrink: 0 }}
                  />
                  <p style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0,
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {chart.title}
                  </p>
                  <div
                    style={{ display: 'flex', gap: 2 }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ padding: 5 }}
                      onClick={() => setEditingChartId(chart.id)}
                      title="Edit chart"
                    >
                      <Settings size={13} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ padding: 5, color: 'var(--color-danger)' }}
                      onClick={() => {
                        removeChart(chart.id);
                        removeChartFromPage(chart.id, activePageId);
                      }}
                      title="Remove chart"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Chart Body */}
                <div style={{ flex: 1, padding: chart.type === 'Table' ? 0 : '12px 14px', minHeight: 0, overflow: 'hidden' }}>
                  <ChartRenderer config={chart} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editingChartId && (
        <ChartBuilder editChartId={editingChartId} onClose={() => setEditingChartId(null)} />
      )}
    </>
  );
}
