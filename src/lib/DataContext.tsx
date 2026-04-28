import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ChartType = 'Bar' | 'Line' | 'Pie' | 'Scatter' | 'Table' | 'Card';
export type RefreshInterval = 0 | 30 | 60 | 300 | 900 | 1800;
export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-many';

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  tableId?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisField?: string;
  yAxisField?: string;
  valueField?: string;
  nameField?: string;
  aggregation?: 'none' | 'sum' | 'count' | 'avg' | 'min' | 'max';
  colSpan?: 1 | 2 | 3;
}

export interface TableSource {
  id: string;
  name: string;
  data: any[];
  fields: string[];
  sourceUrl?: string;
  sheetName?: string;
  refreshInterval: RefreshInterval;
  lastUpdated: Date | null;
}

export interface Relation {
  id: string;
  fromTable: string;
  fromField: string;
  toTable: string;
  toField: string;
  type: RelationType;
}

interface DataContextType {
  // Multi-table
  tables: TableSource[];
  activeTableId: string;
  setActiveTable: (id: string) => void;
  upsertTable: (table: TableSource) => void;
  removeTable: (id: string) => void;
  updateTableData: (id: string, data: any[], fields: string[], lastUpdated: Date | null) => void;

  // ERD Relations
  relations: Relation[];
  upsertRelation: (r: Omit<Relation, 'id'> & { id?: string }) => void;
  removeRelation: (id: string) => void;

  // Charts
  charts: ChartConfig[];
  addChart: (chart: ChartConfig) => void;
  updateChart: (id: string, chart: Partial<ChartConfig>) => void;
  removeChart: (id: string) => void;

  // Refreshing state
  isRefreshing: boolean;
  setIsRefreshing: (v: boolean) => void;

  // Legacy backward-compat (derived from active table)
  data: any[];
  fields: string[];
  dataSourceName: string;
  sourceUrl: string;
  refreshInterval: RefreshInterval;
  lastUpdated: Date | null;

  // Legacy setters (operate on active table)
  setData: (data: any[]) => void;
  setFields: (fields: string[]) => void;
  setDataSourceName: (name: string) => void;
  setSourceUrl: (url: string) => void;
  setRefreshInterval: (interval: RefreshInterval) => void;
  setLastUpdated: (date: Date | null) => void;
}

// ─── Persistence helpers ───────────────────────────────────────────────────────

const STORAGE_KEY_V2 = 'custobase_v2';
const STORAGE_KEY_V1 = 'custobase_v1';

interface PersistedTable {
  id: string;
  name: string;
  sourceUrl?: string;
  sheetName?: string;
  refreshInterval: RefreshInterval;
}

interface PersistedState {
  activeTableId: string;
  tables: PersistedTable[];
  charts: ChartConfig[];
  relations: Relation[];
}

function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    if (raw) return JSON.parse(raw) as PersistedState;

    // Migrate from v1
    const v1Raw = localStorage.getItem(STORAGE_KEY_V1);
    if (!v1Raw) return null;
    const v1 = JSON.parse(v1Raw);
    const migratedTable: PersistedTable = {
      id: crypto.randomUUID(),
      name: v1.dataSourceName || 'Imported Data',
      sourceUrl: v1.sourceUrl || undefined,
      refreshInterval: v1.refreshInterval ?? 0,
    };
    const migrated: PersistedState = {
      activeTableId: migratedTable.id,
      tables: v1.dataSourceName || v1.sourceUrl ? [migratedTable] : [],
      charts: v1.charts ?? [],
      relations: [],
    };
    return migrated;
  } catch {
    return null;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const stored = loadState();

  const [tables, setTables] = useState<TableSource[]>(() => {
    if (!stored?.tables?.length) return [];
    return stored.tables.map(t => ({
      id: t.id,
      name: t.name,
      data: [],
      fields: [],
      sourceUrl: t.sourceUrl,
      sheetName: t.sheetName,
      refreshInterval: t.refreshInterval,
      lastUpdated: null,
    }));
  });

  const [activeTableId, setActiveTableIdState] = useState<string>(
    stored?.activeTableId ?? ''
  );

  const [charts, setCharts] = useState<ChartConfig[]>(stored?.charts ?? []);
  const [relations, setRelations] = useState<Relation[]>(stored?.relations ?? []);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Persist metadata on every change
  useEffect(() => {
    const persistedTables: PersistedTable[] = tables.map(t => ({
      id: t.id,
      name: t.name,
      sourceUrl: t.sourceUrl,
      sheetName: t.sheetName,
      refreshInterval: t.refreshInterval,
    }));
    saveState({
      activeTableId,
      tables: persistedTables,
      charts,
      relations,
    });
  }, [tables, activeTableId, charts, relations]);

  // ── Table CRUD ──────────────────────────────────────────────────────────────

  const setActiveTable = (id: string) => {
    setActiveTableIdState(id);
  };

  const upsertTable = (table: TableSource) => {
    setTables(prev => {
      const idx = prev.findIndex(t => t.id === table.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = table;
        return next;
      }
      return [...prev, table];
    });
    setActiveTableIdState(table.id);
  };

  const removeTable = (id: string) => {
    setTables(prev => {
      const next = prev.filter(t => t.id !== id);
      return next;
    });
    // If active table was removed, switch to first remaining
    setActiveTableIdState(prev => {
      if (prev === id) {
        const remaining = tables.filter(t => t.id !== id);
        return remaining[0]?.id ?? '';
      }
      return prev;
    });
    // Remove charts that referenced this table
    setCharts(prev => prev.map(c => c.tableId === id ? { ...c, tableId: undefined } : c));
    // Remove relations involving this table
    setRelations(prev => prev.filter(r => r.fromTable !== id && r.toTable !== id));
  };

  const updateTableData = (
    id: string,
    data: any[],
    fields: string[],
    lastUpdated: Date | null,
  ) => {
    setTables(prev =>
      prev.map(t => t.id === id ? { ...t, data, fields, lastUpdated } : t)
    );
  };

  // ── Relations CRUD ──────────────────────────────────────────────────────────

  const upsertRelation = (r: Omit<Relation, 'id'> & { id?: string }) => {
    const id = r.id ?? crypto.randomUUID();
    const full: Relation = { ...r, id };
    setRelations(prev => {
      const idx = prev.findIndex(rel => rel.id === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = full;
        return next;
      }
      return [...prev, full];
    });
  };

  const removeRelation = (id: string) => {
    setRelations(prev => prev.filter(r => r.id !== id));
  };

  // ── Charts CRUD ─────────────────────────────────────────────────────────────

  const addChart = (chart: ChartConfig) => setCharts(prev => [...prev, chart]);
  const updateChart = (id: string, updated: Partial<ChartConfig>) =>
    setCharts(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
  const removeChart = (id: string) => setCharts(prev => prev.filter(c => c.id !== id));

  // ── Active table (for legacy compat) ────────────────────────────────────────

  const activeTable = tables.find(t => t.id === activeTableId) ?? null;

  // ── Legacy setters (update active table in-place) ───────────────────────────

  const setData = (data: any[]) => {
    if (!activeTableId) return;
    setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, data } : t));
  };

  const setFields = (fields: string[]) => {
    if (!activeTableId) return;
    setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, fields } : t));
  };

  const setDataSourceName = (name: string) => {
    if (!activeTableId) return;
    setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, name } : t));
  };

  const setSourceUrl = (url: string) => {
    if (!activeTableId) return;
    setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, sourceUrl: url || undefined } : t));
  };

  const setRefreshInterval = (interval: RefreshInterval) => {
    if (!activeTableId) return;
    setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, refreshInterval: interval } : t));
  };

  const setLastUpdated = (date: Date | null) => {
    if (!activeTableId) return;
    setTables(prev => prev.map(t => t.id === activeTableId ? { ...t, lastUpdated: date } : t));
  };

  return (
    <DataContext.Provider value={{
      tables,
      activeTableId,
      setActiveTable,
      upsertTable,
      removeTable,
      updateTableData,
      relations,
      upsertRelation,
      removeRelation,
      charts,
      addChart,
      updateChart,
      removeChart,
      isRefreshing,
      setIsRefreshing,
      // Legacy derived
      data: activeTable?.data ?? [],
      fields: activeTable?.fields ?? [],
      dataSourceName: activeTable?.name ?? '',
      sourceUrl: activeTable?.sourceUrl ?? '',
      refreshInterval: activeTable?.refreshInterval ?? 0,
      lastUpdated: activeTable?.lastUpdated ?? null,
      // Legacy setters
      setData,
      setFields,
      setDataSourceName,
      setSourceUrl,
      setRefreshInterval,
      setLastUpdated,
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
