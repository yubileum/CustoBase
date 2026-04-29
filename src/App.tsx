import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataProvider, useData, TableSource } from './lib/DataContext';
import { FilterProvider } from './lib/FilterContext';
import { PageProvider } from './lib/PageContext';
import { ToastProvider, useToast } from './lib/ToastContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DataSourceModal from './components/DataSourceModal';
import ChartBuilder from './components/ChartBuilder';
import AIChat from './components/AIChat';
import ERDModal from './components/ERDModal';
import FilterBar from './components/FilterBar';
import { Menu, Moon, Sun, RefreshCw } from 'lucide-react';
import { fetchSheetCSV, extractFields } from './lib/dataUtils';

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('custobase_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('custobase_theme', dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark(d => !d) };
}

function AppContent() {
  const [showDataModal, setShowDataModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showERDModal, setShowERDModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { dark, toggle: toggleTheme } = useTheme();
  const { success, error: toastError } = useToast();

  const { tables, updateTableData, setIsRefreshing, activeTableId } = useData();

  const fetchTableData = useCallback(async (table: TableSource) => {
    if (!table.sourceUrl) return;
    try {
      const parsedData = await fetchSheetCSV(table.sourceUrl, table.sheetName);
      const fields = extractFields(parsedData);
      updateTableData(table.id, parsedData, fields, new Date());
    } catch (err: any) {
      console.error(`Fetch failed for "${table.name}":`, err);
      toastError(`Failed to refresh "${table.name}"`, err.message);
    }
  }, [updateTableData, toastError]);

  // Restore data on mount
  useEffect(() => {
    const toRestore = tables.filter(t => t.sourceUrl && t.data.length === 0);
    if (toRestore.length === 0) return;
    setIsRefreshing(true);
    Promise.all(toRestore.map(t => fetchTableData(t))).finally(() => setIsRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ FIX: stable dep key via useMemo instead of inline .map().join()
  const tableRefreshKey = useMemo(
    () => tables.map(t => `${t.id}:${t.refreshInterval}:${t.sourceUrl ?? ''}`).join(','),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tables.length, ...tables.map(t => t.refreshInterval), ...tables.map(t => t.sourceUrl ?? '')]
  );

  useEffect(() => {
    const timers: ReturnType<typeof setInterval>[] = [];
    tables.forEach(table => {
      if (!table.sourceUrl || table.refreshInterval === 0) return;
      timers.push(setInterval(() => fetchTableData(table), table.refreshInterval * 1000));
    });
    return () => timers.forEach(clearInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableRefreshKey]);

  const handleManualRefresh = useCallback(async () => {
    const activeTable = tables.find(t => t.id === activeTableId);
    if (!activeTable?.sourceUrl) return;
    setIsRefreshing(true);
    try {
      await fetchTableData(activeTable);
      success(`"${activeTable.name}" refreshed`);
    } finally {
      setIsRefreshing(false);
    }
  }, [tables, activeTableId, fetchTableData, setIsRefreshing, success]);

  const hasActiveSource = !!tables.find(t => t.id === activeTableId)?.sourceUrl;
  const hasAnyData = tables.some(t => t.data.length > 0);

  return (
    <div
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
      className="flex h-screen w-full overflow-hidden relative"
    >
      {/* Sidebar */}
      <div
        className="shrink-0 flex flex-col transition-all duration-300 ease-in-out overflow-hidden"
        style={{ width: isSidebarOpen ? 260 : 0 }}
      >
        <div style={{ width: 260 }} className="h-full">
          <Sidebar
            onAddData={() => setShowDataModal(true)}
            onAddChart={() => setShowChartModal(true)}
            onRefresh={hasActiveSource ? handleManualRefresh : undefined}
            onOpenERD={() => setShowERDModal(true)}
          />
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header
          className="h-13 px-5 flex items-center justify-between shrink-0 z-20"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--header-border)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(v => !v)}
              className="btn btn-ghost btn-icon"
              title="Toggle sidebar"
            >
              <Menu size={16} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md accent-gradient flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </div>
              <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
                CustoBase
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 chip"
              style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)', fontSize: 10 }}
            >
              <span className="status-dot live" />
              Autosaved
            </span>
            <button onClick={toggleTheme} className="btn btn-ghost btn-icon" title="Toggle theme">
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {hasActiveSource && (
              <button onClick={handleManualRefresh} className="btn btn-ghost btn-icon" title="Refresh data">
                <RefreshCw size={15} />
              </button>
            )}
            <button
              onClick={() => setShowDataModal(true)}
              className="btn btn-secondary"
              style={{ fontSize: 12 }}
            >
              + Data Source
            </button>
            <button
              onClick={() => setShowChartModal(true)}
              disabled={!hasAnyData}
              className="btn btn-primary"
              style={{ fontSize: 12 }}
            >
              + Add Chart
            </button>
          </div>
        </header>

        {/* Filter Bar */}
        <FilterBar />

        {/* Dashboard */}
        <Dashboard />
      </main>

      <AIChat />

      {showDataModal  && <DataSourceModal onClose={() => setShowDataModal(false)} />}
      {showChartModal && <ChartBuilder onClose={() => setShowChartModal(false)} />}
      {showERDModal   && <ERDModal onClose={() => setShowERDModal(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <FilterProvider>
          <PageProvider>
            <AppContent />
          </PageProvider>
        </FilterProvider>
      </DataProvider>
    </ToastProvider>
  );
}
