import React, { useState } from 'react';
import { DataProvider } from './lib/DataContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import DataSourceModal from './components/DataSourceModal';
import ChartBuilder from './components/ChartBuilder';
import AIChat from './components/AIChat';
import { Menu } from 'lucide-react';

export default function App() {
  const [showDataModal, setShowDataModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <DataProvider>
      <div className="flex h-screen w-full bg-white font-sans text-gray-900 overflow-hidden relative">
        <div className={`transition-all duration-300 ease-in-out shrink-0 flex flex-col ${isSidebarOpen ? 'w-64 border-r border-gray-200' : 'w-0'}`}>
          <div className="w-64 h-full overflow-hidden shrink-0">
            <Sidebar 
              onAddData={() => setShowDataModal(true)} 
              onAddChart={() => setShowChartModal(true)} 
            />
          </div>
        </div>
        
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
      </div>
    </DataProvider>
  );
}
