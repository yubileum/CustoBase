import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface DashboardPage {
  id: string;
  name: string;
  chartIds: string[];
}

interface PageContextType {
  pages: DashboardPage[];
  activePageId: string;
  setActivePage: (id: string) => void;
  addPage: (name?: string) => void;
  renamePage: (id: string, name: string) => void;
  removePage: (id: string) => void;
  addChartToPage: (chartId: string, pageId?: string) => void;
  removeChartFromPage: (chartId: string, pageId: string) => void;
  reorderChartsInPage: (pageId: string, chartIds: string[]) => void;
  activePageChartIds: string[];
}

const PageContext = createContext<PageContextType | undefined>(undefined);

const STORAGE_KEY = 'custobase_pages_v1';

function loadPages(): { pages: DashboardPage[], activePageId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    return null;
  } catch { return null; }
}

function savePages(pages: DashboardPage[], activePageId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pages, activePageId }));
  } catch {}
}

export const PageProvider = ({ children }: { children: ReactNode }) => {
  const stored = loadPages();
  const defaultPage: DashboardPage = { id: crypto.randomUUID(), name: 'Page 1', chartIds: [] };

  const [pages, setPagesRaw] = useState<DashboardPage[]>(
    stored?.pages?.length ? stored.pages : [defaultPage]
  );
  const [activePageId, setActivePageIdRaw] = useState<string>(
    stored?.activePageId || (stored?.pages?.[0]?.id ?? defaultPage.id)
  );

  const persist = useCallback((newPages: DashboardPage[], newActiveId: string) => {
    savePages(newPages, newActiveId);
  }, []);

  const setPages = useCallback((updater: ((prev: DashboardPage[]) => DashboardPage[]) | DashboardPage[]) => {
    setPagesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  }, []);

  const setActivePage = useCallback((id: string) => {
    setActivePageIdRaw(id);
    setPagesRaw(prev => { persist(prev, id); return prev; });
  }, [persist]);

  const addPage = useCallback((name?: string) => {
    const newPage: DashboardPage = {
      id: crypto.randomUUID(),
      name: name || `Page ${pages.length + 1}`,
      chartIds: [],
    };
    setPagesRaw(prev => {
      const next = [...prev, newPage];
      persist(next, newPage.id);
      return next;
    });
    setActivePageIdRaw(newPage.id);
  }, [pages.length, persist]);

  const renamePage = useCallback((id: string, name: string) => {
    setPagesRaw(prev => {
      const next = prev.map(p => p.id === id ? { ...p, name } : p);
      persist(next, activePageId);
      return next;
    });
  }, [activePageId, persist]);

  const removePage = useCallback((id: string) => {
    setPagesRaw(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(p => p.id !== id);
      const newActive = next[0]?.id ?? '';
      setActivePageIdRaw(newActive);
      persist(next, newActive);
      return next;
    });
  }, [persist]);

  const addChartToPage = useCallback((chartId: string, pageId?: string) => {
    const targetId = pageId ?? activePageId;
    setPagesRaw(prev => {
      const next = prev.map(p => p.id === targetId && !p.chartIds.includes(chartId)
        ? { ...p, chartIds: [...p.chartIds, chartId] } : p);
      persist(next, activePageId);
      return next;
    });
  }, [activePageId, persist]);

  const removeChartFromPage = useCallback((chartId: string, pageId: string) => {
    setPagesRaw(prev => {
      const next = prev.map(p => p.id === pageId
        ? { ...p, chartIds: p.chartIds.filter(id => id !== chartId) } : p);
      persist(next, activePageId);
      return next;
    });
  }, [activePageId, persist]);

  const reorderChartsInPage = useCallback((pageId: string, chartIds: string[]) => {
    setPagesRaw(prev => {
      const next = prev.map(p => p.id === pageId ? { ...p, chartIds } : p);
      persist(next, activePageId);
      return next;
    });
  }, [activePageId, persist]);

  const activePage = pages.find(p => p.id === activePageId) ?? pages[0];

  return (
    <PageContext.Provider value={{
      pages, activePageId, setActivePage,
      addPage, renamePage, removePage,
      addChartToPage, removeChartFromPage, reorderChartsInPage,
      activePageChartIds: activePage?.chartIds ?? [],
    }}>
      {children}
    </PageContext.Provider>
  );
};

export const usePages = () => {
  const ctx = useContext(PageContext);
  if (!ctx) throw new Error('usePages must be used within PageProvider');
  return ctx;
};
