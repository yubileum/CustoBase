import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useData } from '../lib/DataContext';
import { usePages } from '../lib/PageContext';
import ChartRenderer from './ChartRenderer';
import ChartBuilder from './ChartBuilder';
import { Settings, Trash2, GripVertical, Plus, LayoutGrid, Pencil, Check, X } from 'lucide-react';

// ─── Persisted card sizes ────────────────────────────────────────────────────

const SIZES_KEY = 'custobase_card_sizes_v1';

function loadSizes(): Record<string, { w: number; h: number }> {
  try { return JSON.parse(localStorage.getItem(SIZES_KEY) ?? '{}'); } catch { return {}; }
}

function saveSizes(sizes: Record<string, { w: number; h: number }>) {
  try { localStorage.setItem(SIZES_KEY, JSON.stringify(sizes)); } catch {}
}

// ─── Default heights by chart type ───────────────────────────────────────────

function defaultHeight(type: string) {
  if (type === 'Card') return 160;
  if (type === 'Table') return 380;
  return 340;
}

// ─── Resize handle hook ───────────────────────────────────────────────────────

interface Size { w: number; h: number }

function useResize(
  id: string,
  initialSize: Size,
  onSizeChange: (id: string, size: Size) => void
) {
  const [size, setSize] = useState<Size>(initialSize);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef<Size>(initialSize);

  // Keep size in sync if initialSize changes (e.g. first render from localStorage)
  useEffect(() => { setSize(initialSize); }, [initialSize.w, initialSize.h]); // eslint-disable-line

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = size;

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - startPos.current.x;
      const dy = ev.clientY - startPos.current.y;
      const newW = Math.max(200, startSize.current.w + dx);
      const newH = Math.max(120, startSize.current.h + dy);
      setSize({ w: newW, h: newH });
    };

    const onUp = (ev: MouseEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      const dx = ev.clientX - startPos.current.x;
      const dy = ev.clientY - startPos.current.y;
      const finalW = Math.max(200, startSize.current.w + dx);
      const finalH = Math.max(120, startSize.current.h + dy);
      const finalSize = { w: finalW, h: finalH };
      setSize(finalSize);
      onSizeChange(id, finalSize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [id, size, onSizeChange]);

  return { size, onMouseDown };
}

// ─── Resizable Card Wrapper ───────────────────────────────────────────────────

interface ResizableCardProps {
  id: string;
  savedSize?: { w: number; h: number };
  chartType: string;
  colSpan: number;
  children: React.ReactNode;
  isDragged: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onSizeChange: (id: string, size: { w: number; h: number }) => void;
}

function ResizableCard({
  id, savedSize, chartType, colSpan, children,
  isDragged, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onSizeChange,
}: ResizableCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute natural width based on colSpan so we have a good starting w
  const estimatedW = colSpan === 3 ? 1400 : colSpan === 2 ? 900 : 440;
  const initial: Size = savedSize ?? { w: estimatedW, h: defaultHeight(chartType) };

  const { size, onMouseDown } = useResize(id, initial, onSizeChange);

  return (
    // Outer wrapper: overflow VISIBLE so the resize badge never gets clipped.
    // `group` lives here so both the card and badge share the hover state.
    <div
      ref={containerRef}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group ${isDragged ? 'opacity-40' : ''}`}
      style={{
        width: size.w,
        height: size.h,
        minWidth: 200,
        minHeight: 120,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Inner card — overflow hidden for chart clipping, fills the wrapper */}
      <div
        className="dash-card flex flex-col overflow-hidden"
        style={{
          width: '100%',
          height: '100%',
          transition: 'outline 80ms ease',
          outline: isDragOver ? '2px solid var(--color-accent)' : 'none',
          outlineOffset: 2,
        }}
      >
        {children}
      </div>

      {/* Resize icon — tilted ↕ arrow, sibling so it's never clipped */}
      <div
        onMouseDown={onMouseDown}
        title="Drag to resize"
        className="resize-handle"
        style={{
          position: 'absolute',
          bottom: 6,
          right: 6,
          zIndex: 20,
          cursor: 'se-resize',
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          pointerEvents: 'auto',
        }}
      >
        {/* Tilted ↕ double-headed chevron — rotated 45° = diagonal resize icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{ pointerEvents: 'none', transform: 'rotate(45deg)' }}
        >
          {/* Up arrowhead */}
          <polyline points="4,5 7,2 10,5" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Down arrowhead */}
          <polyline points="4,9 7,12 10,9" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {/* Centre stem */}
          <line x1="7" y1="2" x2="7" y2="12" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

// ─── Page Tabs ────────────────────────────────────────────────────────────────

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

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { charts, removeChart, tables } = useData();
  const { activePageId, activePageChartIds, addChartToPage, removeChartFromPage, reorderChartsInPage } = usePages();
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Per-card sizes persisted in localStorage
  const [cardSizes, setCardSizes] = useState<Record<string, { w: number; h: number }>>(loadSizes);

  const handleSizeChange = useCallback((id: string, size: { w: number; h: number }) => {
    setCardSizes(prev => {
      const next = { ...prev, [id]: size };
      saveSizes(next);
      return next;
    });
  }, []);

  const hasAnyData = tables.some(t => t.data.length > 0);

  // Charts visible on this page
  const pageCharts = activePageChartIds
    .map(id => charts.find(c => c.id === id))
    .filter(Boolean) as typeof charts;

  // Auto-add newly created charts to active page
  React.useEffect(() => {
    charts.forEach(c => {
      if (!activePageChartIds.includes(c.id)) addChartToPage(c.id);
    });
  }, [charts.length]); // eslint-disable-line

  // ── Drag & Drop (native HTML5) ────────────────────────────────────────────
  const onDragStart = (id: string) => setDraggedId(id);
  const onDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const onDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    const ids = [...activePageChartIds];
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { setDraggedId(null); setDragOverId(null); return; }
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    reorderChartsInPage(activePageId, ids);
    setDraggedId(null);
    setDragOverId(null);
  };
  const onDragEnd = () => { setDraggedId(null); setDragOverId(null); };

  // ── Empty states ──────────────────────────────────────────────────────────
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
        {/* Free-flow flex wrap — cards size themselves */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 20,
            alignItems: 'flex-start',
            maxWidth: '100%',
          }}
        >
          {pageCharts.map(chart => (
            <ResizableCard
              key={chart.id}
              id={chart.id}
              savedSize={cardSizes[chart.id]}
              chartType={chart.type}
              colSpan={chart.colSpan ?? 1}
              isDragged={draggedId === chart.id}
              isDragOver={dragOverId === chart.id}
              onDragStart={() => onDragStart(chart.id)}
              onDragOver={e => onDragOver(e, chart.id)}
              onDrop={() => onDrop(chart.id)}
              onDragEnd={onDragEnd}
              onSizeChange={handleSizeChange}
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
            </ResizableCard>
          ))}
        </div>
      </div>

      {editingChartId && (
        <ChartBuilder editChartId={editingChartId} onClose={() => setEditingChartId(null)} />
      )}
    </>
  );
}
