import React, { useState } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { 
    Vehicle, Customer, User, Part, ServicePackage, Supplier, BusinessEntity, 
    BackupSchedule, Estimate, Role, InspectionDiagram, NominalCode, NominalCodeRule
} from '../types';
import { 
    X, Settings, Database, User as UserIcon, Car, Wrench, Package, Briefcase, 
    ShieldCheck, Users, Truck, AlertTriangle, RefreshCw, CarFront, List, Info, CheckCircle, Server, Save,
    ArrowUpCircle, BatteryCharging
} from 'lucide-react';

// Extracted Tab Views
import {
    ManagementCustomersTab, ManagementVehiclesTab, ManagementDiagramsTab,
    ManagementStaffTab, ManagementRolesTab, ManagementEntitiesTab,
    ManagementSuppliersTab, ManagementPartsTab, ManagementPackagesTab,
    ManagementNominalCodesTab, ManagementLiftsTab, ManagementBatteryChargersTab
} from './management/ManagementViews';
import { ManagementBackupTab } from './management/tabs/ManagementBackupTab';

// Utilities
import { setItem } from '../core/db';

interface ManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialView: { tab: string; id: string } | null;
    selectedEntityId: string;
    onViewJob: (jobId: string) => void;
    onViewEstimate: (estimate: Estimate) => void;
    backupSchedule: BackupSchedule;
    setBackupSchedule: (schedule: BackupSchedule) => void;
    onManualBackup: () => void;
}

export const ManagementModal: React.FC<ManagementModalProps> = ({ 
    isOpen, 
    onClose, 
    initialView, 
    backupSchedule, 
    setBackupSchedule, 
    onManualBackup 
}) => {
    // FIX: Using 'as any' here to bypass the Type mismatch while the DataContext interface propagates
    const dataContext = useData() as any;
    const appContext = useApp() || {}; 
    
    const [activeTab, setActiveTab] = useState(initialView?.tab || 'customers');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'error', text: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    // Loading Safety Check: If DataContext is still fetching, show a loader
    const isDataLoading = dataContext.loading;

    const showStatus = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
        setStatusMessage({ type, text });
        if (type !== 'info') {
            setTimeout(() => setStatusMessage(null), 5000);
        }
    };

    const handleForceSave = async () => {
        setIsSaving(true);
        showStatus('Forcing save of all data to storage...', 'info');
        try {
            const collections = [
                { key: 'brooks_jobs', data: dataContext.jobs || [] },
                { key: 'brooks_vehicles', data: dataContext.vehicles || [] },
                { key: 'brooks_customers', data: dataContext.customers || [] },
                { key: 'brooks_estimates', data: dataContext.estimates || [] },
                { key: 'brooks_invoices', data: dataContext.invoices || [] },
                { key: 'brooks_purchaseOrders', data: dataContext.purchaseOrders || [] },
                { key: 'brooks_parts', data: dataContext.parts || [] },
                { key: 'brooks_servicePackages', data: dataContext.servicePackages || [] },
                { key: 'brooks_suppliers', data: dataContext.suppliers || [] },
                { key: 'brooks_engineers', data: dataContext.engineers || [] },
                { key: 'brooks_lifts', data: dataContext.lifts || [] },
                { key: 'brooks_nominalCodes', data: dataContext.nominalCodes || [] },
                { key: 'brooks_nominalCodeRules', data: dataContext.nominalCodeRules || [] },
                { key: 'brooks_businessEntities', data: dataContext.businessEntities || [] },
                { key: 'brooks_inspectionDiagrams', data: dataContext.inspectionDiagrams || [] },
                // FIX: Pulling users from dataContext as we now sync this collection to isdevdb
                { key: 'brooks_users', data: dataContext.users || [] },
            ];

            await Promise.all(
                collections.map(c => setItem(c.key, c.data))
            );
            
            showStatus('All data successfully forced to storage.', 'success');
        } catch (e) {
            console.error(e);
            showStatus('Failed to save data. Check console.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const renderStatusBanner = () => {
        if (!statusMessage) return null;
        const bgColors = { info: 'bg-blue-100 text-blue-800 border-blue-200', success: 'bg-green-100 text-green-800 border-green-200', error: 'bg-red-100 text-red-800 border-red-200' };
        const icons = { info: Info, success: CheckCircle, error: AlertTriangle };
        const Icon = icons[statusMessage.type];
        return (
            <div className={`flex items-center gap-2 p-3 mb-4 rounded-lg border ${bgColors[statusMessage.type]} animate-fade-in`}>
                <Icon size={20} />
                <span className="font-semibold text-sm">{statusMessage.text}</span>
                <button onClick={() => setStatusMessage(null)} className="ml-auto"><X size={16}/></button>
            </div>
        );
    };

    const tabs = [
        { id: 'customers', label: 'Customers', icon: UserIcon, render: () => <ManagementCustomersTab searchTerm={searchTerm} onShowStatus={showStatus} /> },
        { id: 'vehicles', label: 'Vehicles', icon: Car, render: () => <ManagementVehiclesTab searchTerm={searchTerm} onShowStatus={showStatus} /> },
        { id: 'diagrams', label: 'Vehicle Diagrams', icon: CarFront, render: () => <ManagementDiagramsTab searchTerm={searchTerm} onShowStatus={showStatus} /> },
        { id: 'staff', label: 'Staff (Users)', icon: Users, render: () => <ManagementStaffTab /> },
        { id: 'roles', label: 'Roles', icon: ShieldCheck, render: () => <ManagementRolesTab /> },
        { id: 'entities', label: 'Business Entities', icon: Briefcase, render: () => <ManagementEntitiesTab onShowStatus={showStatus} /> },
        { id: 'lifts', label: 'Lifts & Bays', icon: ArrowUpCircle, render: () => <ManagementLiftsTab /> },
        { id: 'batteryChargers', label: 'Battery Chargers', icon: BatteryCharging, render: () => <ManagementBatteryChargersTab /> },
        { id: 'suppliers', label: 'Suppliers', icon: Truck, render: () => <ManagementSuppliersTab /> },
        { id: 'parts', label: 'Parts', icon: Settings, render: () => <ManagementPartsTab searchTerm={searchTerm} onShowStatus={showStatus} /> },
        { id: 'packages', label: 'Service Packages', icon: Package, render: () => <ManagementPackagesTab /> },
        { id: 'nominalCodes', label: 'Nominal Codes', icon: List, render: () => <ManagementNominalCodesTab /> },
        { id: 'backup', label: 'Backup & Restore', icon: Database, render: () => <ManagementBackupTab backupSchedule={backupSchedule} setBackupSchedule={setBackupSchedule} onManualBackup={onManualBackup} onShowStatus={showStatus} /> },
    ];

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden relative">
                
                {/* GLOBAL LOADING OVERLAY */}
                {isDataLoading && (
                    <div className="absolute inset-0 bg-white/80 z-[70] flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                        <p className="text-gray-600 font-medium tracking-wide uppercase text-xs">Synchronizing with Cloud Firestore...</p>
                    </div>
                )}

                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b bg-gray-50">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Settings className="text-gray-600"/> Data Management</h2>
                    <div className="flex items-center gap-2">
                        <div className="relative mr-4">
                            <input 
                                type="text" 
                                placeholder="Search active tab..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="pl-8 pr-4 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                            />
                            <div className="absolute left-2 top-2.5 text-gray-400"><Settings size={14}/></div>
                        </div>
                        <button 
                            onClick={handleForceSave} 
                            disabled={isSaving || isDataLoading}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-semibold disabled:opacity-50 transition-colors"
                        >
                            <Save size={16} className={isSaving ? "animate-spin" : ""} />
                            {isSaving ? 'Saving...' : 'Force Save'}
                        </button>
                        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                            <X size={24} className="text-gray-500" />
                        </button>
                    </div>
                </header>
                
                <div className="px-4 pt-4 bg-white">
                    {statusMessage && renderStatusBanner()}
                </div>

                <div className="flex flex-grow overflow-hidden">
                    <nav className="w-64 bg-gray-50 border-r overflow-y-auto flex-shrink-0 p-3 space-y-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${activeTab === tab.id ? 'bg-white text-indigo-700 shadow-md border border-indigo-100 translate-x-1' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                    
                    <main className="flex-grow p-6 overflow-y-auto bg-white">
                        {/* Only render the tab if data is not loading to prevent child crashes */}
                        {!isDataLoading && tabs.find(t => t.id === activeTab)?.render()}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default ManagementModal;