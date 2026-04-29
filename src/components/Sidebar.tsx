import React from 'react';
import { useData, RefreshInterval } from '../lib/DataContext';
import { inferFieldType } from '../lib/dataUtils';
import {
  Plus, Database, LayoutDashboard, FileSpreadsheet, RefreshCw,
  Clock, Table2, X, Network, Hash, Type, Calendar,
} from 'lucide-react';

interface Props {
  onAddData: () => void;
  onAddChart: () => void;
  onRefresh?: () => void;
  onOpenERD?: () => void;
}

function formatLastUpdated(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatInterval(interval: RefreshInterval): string {
  if (interval === 0) return 'Manual';
  if (interval < 60) return `${interval}s`;
  return `${interval / 60}m`;
}

function FieldTypeIcon({ type }: { type: 'number' | 'date' | 'string' }) {
  if (type === 'number') return <Hash size={9} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />;
  if (type === 'date')   return <Calendar size={9} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />;
  return <Type size={9} style={{ color: 'var(--color-success)', flexShrink: 0 }} />;
}

export default function Sidebar({ onAddData, onAddChart, onRefresh, onOpenERD }: Props) {
  const {
    tables, activeTableId, setActiveTable, removeTable,
    data, fields, dataSourceName, lastUpdated, isRefreshing, refreshInterval, sourceUrl,
  } = useData();

  const hasAnyTable = tables.length > 0;
  const activeTable = tables.find(t => t.id === activeTableId);
  // ✅ FIX: check ANY table has data, not just active
  const hasAnyData = tables.some(t => t.data.length > 0);

  return (
    <div className="sidebar h-full flex flex-col" style={{ width: 260 }}>
      {/* Logo */}
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: '1px solid var(--sidebar-border)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <div className="accent-gradient" style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LayoutDashboard size={16} color="white" />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0', margin: 0, letterSpacing: '-0.02em' }}>CustoBase</p>
          <p style={{ fontSize: 10, color: 'var(--sidebar-muted)', margin: 0 }}>Analytics Studio</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Data Source ──────────────────────────────────────────────────── */}
        <section>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Data Sources
          </p>

          {!hasAnyTable ? (
            <button onClick={onAddData} className="sidebar-item" style={{
              width: '100%', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8,
              border: '1px dashed var(--sidebar-border)', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, background: 'transparent',
            }}>
              <Database size={14} style={{ color: 'var(--sidebar-muted)' }} />
              <span style={{ color: 'var(--sidebar-muted)' }}>Connect Data Source</span>
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeTable && (
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 8, marginBottom: 4,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isRefreshing
                      ? <RefreshCw size={14} style={{ color: '#a5b4fc', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                      : <FileSpreadsheet size={14} style={{ color: '#a5b4fc', flexShrink: 0 }} />
                    }
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#c7d2fe', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dataSourceName || 'Data source'}
                    </p>
                  </div>
                  <p style={{ fontSize: 11, color: '#818cf8', marginTop: 4 }}>
                    {isRefreshing ? 'Refreshing…' : `${data.length.toLocaleString()} rows`}
                  </p>
                  {lastUpdated && !isRefreshing && (
                    <p style={{ fontSize: 10, color: '#6366f1', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={9} />
                      {formatLastUpdated(lastUpdated)}
                      {sourceUrl && refreshInterval > 0 && (
                        <span style={{ opacity: 0.7 }}>· auto {formatInterval(refreshInterval)}</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
                <button onClick={onAddData} style={{ fontSize: 11, color: 'var(--sidebar-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  + Add source
                </button>
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    style={{ fontSize: 11, color: 'var(--sidebar-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    <RefreshCw size={10} className={isRefreshing ? 'animate-spin-slow' : ''} />
                    Refresh
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Tables ───────────────────────────────────────────────────────── */}
        {tables.length > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Table2 size={10} /> Tables
              </p>
              <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', color: 'var(--sidebar-muted)', padding: '1px 6px', borderRadius: 99 }}>
                {tables.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {tables.map(table => {
                const isActive = table.id === activeTableId;
                return (
                  <div
                    key={table.id}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer' }}
                    onClick={() => setActiveTable(table.id)}
                  >
                    <FileSpreadsheet size={12} style={{ color: isActive ? '#a5b4fc' : 'var(--sidebar-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {table.name}
                      </p>
                      <p style={{ fontSize: 10, color: isActive ? '#818cf8' : 'var(--sidebar-muted)', margin: 0 }}>
                        {table.data.length > 0 ? `${table.data.length.toLocaleString()} rows` : 'No data'}
                      </p>
                    </div>
                    {tables.length > 1 && (
                      <button
                        onClick={e => { e.stopPropagation(); removeTable(table.id); }}
                        className="btn btn-ghost btn-icon"
                        style={{ padding: 3, opacity: 0, transition: '180ms' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                      >
                        <X size={10} style={{ color: 'var(--color-danger)' }} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Fields ───────────────────────────────────────────────────────── */}
        {fields.length > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                Fields
              </p>
              <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.06)', color: 'var(--sidebar-muted)', padding: '1px 6px', borderRadius: 99 }}>
                {fields.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 200, overflowY: 'auto' }}>
              {fields.map(field => {
                const ftype = activeTable ? inferFieldType(activeTable.data, field) : 'string';
                return (
                  <div
                    key={field}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 8px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      fontSize: 11, color: 'var(--sidebar-text)',
                      overflow: 'hidden',
                    }}
                    title={field}
                  >
                    <FieldTypeIcon type={ftype} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {field}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* ── Bottom actions ─────────────────────────────────────────────────── */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--sidebar-border)', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <button
          onClick={onAddChart}
          disabled={!hasAnyData}  // ✅ FIX: check all tables, not just active
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
        >
          <Plus size={14} /> Add Chart
        </button>
        {onOpenERD && tables.length > 0 && (
          <button onClick={onOpenERD} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
            <Network size={14} /> View ERD
          </button>
        )}
      </div>
    </div>
  );
}
