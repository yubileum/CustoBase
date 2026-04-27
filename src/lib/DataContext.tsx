import { createContext, useContext, useState, ReactNode } from 'react';

export type ChartType = 'Bar' | 'Line' | 'Pie' | 'Scatter' | 'Table' | 'Card';

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xAxisField?: string;
  yAxisField?: string;
  valueField?: string; // used for pie
  nameField?: string; // used for pie
  aggregation?: 'none' | 'sum' | 'count' | 'avg' | 'min' | 'max';
  colSpan?: 1 | 2 | 3;
}

interface DataContextType {
  data: any[];
  fields: string[];
  charts: ChartConfig[];
  setData: (data: any[]) => void;
  setFields: (fields: string[]) => void;
  addChart: (chart: ChartConfig) => void;
  updateChart: (id: string, chart: Partial<ChartConfig>) => void;
  removeChart: (id: string) => void;
  dataSourceName: string;
  setDataSourceName: (name: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<any[]>([]);
  const [fields, setFields] = useState<string[]>([]);
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [dataSourceName, setDataSourceName] = useState<string>('');

  const addChart = (chart: ChartConfig) => setCharts(prev => [...prev, chart]);
  const updateChart = (id: string, updated: Partial<ChartConfig>) => {
    setCharts(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
  };
  const removeChart = (id: string) => setCharts(prev => prev.filter(c => c.id !== id));

  return (
    <DataContext.Provider value={{ data, fields, charts, setData, setFields, addChart, updateChart, removeChart, dataSourceName, setDataSourceName }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
