import React from 'react';
import { useData, RefreshInterval } from '../lib/DataContext';
import {
  Plus, Database, LayoutDashboard, FileSpreadsheet, RefreshCw,
  Clock, Table2, X, Network,
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

export default function Sidebar({ onAddData, onAddChart, onRefresh, onOpenERD }: Props) {
  const {
    tables, activeTableId, setActiveTable, removeTable,
    data, fields, dataSourceName, lastUpdated, isRefreshing, refreshInterval, sourceUrl,
  } = useData();

  const hasAnyTable = tables.length > 0;
  const activeTable = tables.find(t => t.id === activeTableId);

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-inner">
          <LayoutDashboard className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-gray-900 tracking-tight">DataViz Studio</span>
      </div>

      <div className="p-4 flex flex-col gap-6 flex-1 overflow-y-auto">
        {/* ── Data Source Section ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Source</h3>

          {!hasAnyTable ? (
            <button
              onClick={onAddData}
              className="w-full py-2 px-3 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4" />
              Connect Data
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Active table info */}
              {activeTable && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3">
                  {isRefreshing ? (
                    <RefreshCw className="w-5 h-5 text-blue-500 mt-0.5 animate-spin shrink-0" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900 truncate" title={dataSourceName}>
                      {dataSourceName || 'Data source'}
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      {isRefreshing ? 'Refreshing…' : `${data.length.toLocaleString()} rows`}
                    </p>
                    {lastUpdated && !isRefreshing && (
                      <p className="text-xs text-blue-500 mt-1 flex items-center gap-1 flex-wrap">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{formatLastUpdated(lastUpdated)}</span>
                        {sourceUrl && refreshInterval > 0 && (
                          <span className="text-blue-400">· auto {formatInterval(refreshInterval)}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center px-1">
                <button
                  onClick={onAddData}
                  className="text-xs text-gray-500 hover:text-blue-600 font-medium"
                >
                  Add source…
                </button>
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    title="Refresh data now"
                    className="text-xs text-gray-500 hover:text-blue-600 font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Tables Section ────────────────────────────────────────────────── */}
        {tables.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Table2 className="w-3.5 h-3.5" /> Tables
              </h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {tables.length}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {tables.map(table => {
                const isActive = table.id === activeTableId;
                return (
                  <div
                    key={table.id}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors group ${
                      isActive
                        ? 'bg-blue-50 border border-blue-200 text-blue-800'
                        : 'border border-transparent hover:bg-gray-50 text-gray-700'
                    }`}
                    onClick={() => setActiveTable(table.id)}
                  >
                    <FileSpreadsheet className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{table.name}</p>
                      <p className={`text-[10px] ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
                        {table.data.length > 0 ? `${table.data.length.toLocaleString()} rows` : 'No data'}
                      </p>
                    </div>
                    {tables.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTable(table.id);
                        }}
                        title="Remove table"
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Available Fields Section ──────────────────────────────────────── */}
        {fields.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Available Fields</h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{fields.length}</span>
            </div>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {fields.map(field => (
                <div
                  key={field}
                  className="text-xs text-gray-700 bg-gray-50 border border-gray-100 px-2 py-1.5 rounded truncate hover:bg-gray-100 cursor-default"
                  title={field}
                >
                  {field}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Action Buttons ────────────────────────────────────────────────── */}
        <div className="mt-auto pt-4 border-t border-gray-100 flex flex-col gap-2">
          <button
            onClick={onAddChart}
            disabled={data.length === 0}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg shadow-sm text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Chart
          </button>

          {onOpenERD && tables.length > 0 && (
            <button
              onClick={onOpenERD}
              className="w-full py-2 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg shadow-sm text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
            >
              <Network className="w-4 h-4" />
              ERD
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
