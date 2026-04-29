import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between';

export interface FilterRule {
  id: string;
  tableId: string;
  field: string;
  operator: FilterOperator;
  value: any;
  value2?: any; // for 'between'
}

export interface FilterState {
  rules: FilterRule[];
  enabled: boolean;
}

interface FilterContextType {
  filters: FilterRule[];
  isFilterEnabled: boolean;
  addFilter: (rule: Omit<FilterRule, 'id'>) => void;
  updateFilter: (id: string, rule: Partial<FilterRule>) => void;
  removeFilter: (id: string) => void;
  clearFilters: () => void;
  setFilterEnabled: (v: boolean) => void;
  applyFilters: (data: any[], tableId: string) => any[];
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [isFilterEnabled, setIsFilterEnabled] = useState(true);

  const addFilter = useCallback((rule: Omit<FilterRule, 'id'>) => {
    setFilters(prev => [...prev, { ...rule, id: crypto.randomUUID() }]);
  }, []);

  const updateFilter = useCallback((id: string, rule: Partial<FilterRule>) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...rule } : f));
  }, []);

  const removeFilter = useCallback((id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFilters = useCallback(() => setFilters([]), []);

  const setFilterEnabled = useCallback((v: boolean) => setIsFilterEnabled(v), []);

  const applyFilters = useCallback((data: any[], tableId: string): any[] => {
    if (!isFilterEnabled || filters.length === 0) return data;

    const tableFilters = filters.filter(f => f.tableId === tableId);
    if (tableFilters.length === 0) return data;

    return data.filter(row => {
      return tableFilters.every(filter => {
        const rawVal = row[filter.field];
        const cellVal = typeof rawVal === 'string' ? rawVal.toLowerCase() : rawVal;
        const filterVal = typeof filter.value === 'string' ? filter.value.toLowerCase() : filter.value;

        switch (filter.operator) {
          case 'equals':     return String(rawVal) === String(filter.value);
          case 'not_equals': return String(rawVal) !== String(filter.value);
          case 'contains':   return String(rawVal).toLowerCase().includes(filterVal);
          case 'gt':  return Number(rawVal) > Number(filter.value);
          case 'lt':  return Number(rawVal) < Number(filter.value);
          case 'gte': return Number(rawVal) >= Number(filter.value);
          case 'lte': return Number(rawVal) <= Number(filter.value);
          case 'in':  return Array.isArray(filter.value) && filter.value.map(String).includes(String(rawVal));
          case 'between':
            return Number(rawVal) >= Number(filter.value) && Number(rawVal) <= Number(filter.value2);
          default: return true;
        }
      });
    });
  }, [filters, isFilterEnabled]);

  return (
    <FilterContext.Provider value={{
      filters, isFilterEnabled,
      addFilter, updateFilter, removeFilter, clearFilters,
      setFilterEnabled, applyFilters,
    }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be used within FilterProvider');
  return ctx;
};
