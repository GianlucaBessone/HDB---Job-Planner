'use client';

import { useState } from 'react';
import GastosDashboard from '@/app/administracion/gastos/components/GastosDashboard';
import GastosPlanilla from '@/app/administracion/gastos/components/GastosPlanilla';
import GastosAjustes from '@/app/administracion/gastos/components/GastosAjustes';
import { useRouter } from 'next/navigation';
import { Camera, LayoutDashboard, Settings, TableProperties, Plus, FileSpreadsheet } from 'lucide-react';
import ModuleHeader from '@/components/ModuleHeader';

export default function GastosPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planilla' | 'ajustes'>('dashboard');
  const router = useRouter();

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <ModuleHeader 
        title="Gastos y Facturas" 
        description="Administración de consumos y proveedores"
      />

      <div className="flex flex-col flex-1 p-4 md:p-6 overflow-hidden">
        
        {/* Actions & Tabs Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
          <div className="flex space-x-1 bg-card text-card-foreground p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'dashboard' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('planilla')}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'planilla' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <TableProperties className="w-4 h-4 mr-2" />
              Planilla
            </button>
            <button
              onClick={() => setActiveTab('ajustes')}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'ajustes' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Settings className="w-4 h-4 mr-2" />
              Ajustes
            </button>
          </div>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto">
            <button
              onClick={() => router.push('/administracion/gastos/importar')}
              className="flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors w-full sm:w-auto"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Importar Excel
            </button>
            <button
              onClick={() => router.push('/administracion/gastos/escanear')}
              className="flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-xl shadow-sm transition-colors w-full sm:w-auto"
            >
              <Camera className="w-4 h-4 mr-2" />
              Escanear Factura (IA)
            </button>
            <button
              onClick={() => router.push('/administracion/gastos/crear')}
              className="flex items-center justify-center px-4 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white text-sm font-medium rounded-xl shadow-sm transition-colors w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-card text-card-foreground shadow-sm relative">
          {activeTab === 'dashboard' && <GastosDashboard />}
          {activeTab === 'planilla' && <GastosPlanilla />}
          {activeTab === 'ajustes' && <GastosAjustes />}
        </div>
        
      </div>
    </div>
  );
}
