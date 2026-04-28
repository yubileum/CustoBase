import { useState, useEffect, useCallback } from 'react';
import { DataProvider, useData, TableSource } from './lib/DataContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DataSourceModal from './components/DataSourceModal';
import ChartBuilder from './components/ChartBuilder';
import AIChat from './components/AIChat';
import ERDModal from './components/ERDModal';
import { Menu } from 'lucide-react';
import { fetchSheetCSV, extractFields } from './lib/dataUtils';

function AppContent() {
  const [showDataModal, setShowDataModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showERDModal, setShowERDModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const {
    tables,
    updateTableData,
    setIsRefreshing,
    activeTableId,
  } = useData();

  // ── Fetch data for a single table ─────────────────────────────────────────

  const fetchTableData = useCallback(async (table: TableSource) => {
    if (!table.sourceUrl) return;
    try {
      const parsedData = await fetchSheetCSV(table.sourceUrl, table.sheetName);
      const fields = extractFields(parsedData);
      updateTableData(table.id, parsedData, fields, new Date());
    } catch (err) {
      console.error(`Data fetch failed for table "${table.name}":`, err);
    }
  }, [updateTableData]);

  // ── On mount: restore data for all tables that have a sourceUrl ───────────

  useEffect(() => {
    const toRestore = tables.filter(t => t.sourceUrl && t.data.length === 0);
    if (toRestore.length === 0) return;
    setIsRefreshing(true);
    Promise.all(toRestore.map(t => fetchTableData(t))).finally(() => {
      setIsRefreshing(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-refresh: iterate over ALL tables that have a refresh interval ────

  useEffect(() => {
    const timers: ReturnType<typeof setInterval>[] = [];

    tables.forEach(table => {
      if (!table.sourceUrl || table.refreshInterval === 0) return;
      const timer = setInterval(() => {
        fetchTableData(table);
      }, table.refreshInterval * 1000);
      timers.push(timer);
    });

    return () => timers.forEach(clearInterval);
  // Re-run when table config changes (new tables, interval changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.map(t => `${t.id}:${t.refreshInterval}:${t.sourceUrl}`).join(',')]);

  // ── Manual refresh for active table ──────────────────────────────────────

  const handleManualRefresh = useCallback(async () => {
    const activeTable = tables.find(t => t.id === activeTableId);
    if (!activeTable?.sourceUrl) return;
    setIsRefreshing(true);
    try {
      await fetchTableData(activeTable);
    } finally {
      setIsRefreshing(false);
    }
  }, [tables, activeTableId, fetchTableData, setIsRefreshing]);

  const hasActiveSource = !!tables.find(t => t.id === activeTableId)?.sourceUrl;

  return (
    <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden relative">
      {/* Sidebar */}
      <div className={`transition-all duration-300 ease-in-out shrink-0 flex flex-col ${isSidebarOpen ? 'w-64 border-r border-gray-200' : 'w-0'}`}>
        <div className="w-64 h-full overflow-hidden shrink-0">
          <Sidebar
            onAddData={() => setShowDataModal(true)}
            onAddChart={() => setShowChartModal(true)}
            onRefresh={hasActiveSource ? handleManualRefresh : undefined}
            onOpenERD={() => setShowERDModal(true)}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden relative">
        <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
              title="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-semibold text-gray-800">Dashboard Editor</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Autosaved
            </span>
          </div>
        </header>

        <Dashboard />
      </main>

      <AIChat />

      {showDataModal && <DataSourceModal onClose={() => setShowDataModal(false)} />}
      {showChartModal && <ChartBuilder onClose={() => setShowChartModal(false)} />}
      {showERDModal && <ERDModal onClose={() => setShowERDModal(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
