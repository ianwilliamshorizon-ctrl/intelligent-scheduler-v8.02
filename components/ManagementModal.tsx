
import React, { useState } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { 
    Vehicle, Customer, User, Part, ServicePackage, Supplier, BusinessEntity, 
    BackupSchedule, Estimate, Role, InspectionDiagram, NominalCode, NominalCodeRule
} from '../types';
import { 
    X, Settings, Database, User as UserIcon, Car, Wrench, Package, Briefcase, 
    ShieldCheck, Users, Truck, AlertTriangle, RefreshCw, CarFront, List, Info, CheckCircle, Server, Save
} from 'lucide-react';

// Extracted Tab Views
import {
    ManagementCustomersTab, ManagementVehiclesTab, ManagementDiagramsTab,
    ManagementStaffTab, ManagementRolesTab, ManagementEntitiesTab,
    ManagementSuppliersTab, ManagementPartsTab, ManagementPackagesTab,
    ManagementNominalCodesTab
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

const ManagementModal: React.FC<ManagementModalProps> = ({ isOpen, onClose, initialView, backupSchedule, setBackupSchedule, onManualBackup }) => {
    const dataContext = useData();
    const { users } = useApp();

    const [activeTab, setActiveTab] = useState(initialView?.tab || 'customers');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Global Status Message
    const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'error', text: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const showStatus = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
        setStatusMessage({ type, text });
        if (type !== 'info') {
            setTimeout(() => setStatusMessage(null), 5000);
        }
    };

    if (!isOpen) return null;
    
    const handleForceSave = async () => {
        setIsSaving(true);
        showStatus('Forcing save of all data to storage...', 'info');
        try {
            await Promise.all([
                setItem('brooks_jobs', dataContext.jobs),
                setItem('brooks_vehicles', dataContext.vehicles),
                setItem('brooks_customers', dataContext.customers),
                setItem('brooks_estimates', dataContext.estimates),
                setItem('brooks_invoices', dataContext.invoices),
                setItem('brooks_purchaseOrders', dataContext.purchaseOrders),
                setItem('brooks_purchases', dataContext.purchases),
                setItem('brooks_parts', dataContext.parts),
                setItem('brooks_servicePackages', dataContext.servicePackages),
                setItem('brooks_suppliers', dataContext.suppliers),
                setItem('brooks_engineers', dataContext.engineers),
                setItem('brooks_lifts', dataContext.lifts),
                setItem('brooks_rentalVehicles', dataContext.rentalVehicles),
                setItem('brooks_rentalBookings', dataContext.rentalBookings),
                setItem('brooks_saleVehicles', dataContext.saleVehicles),
                setItem('brooks_saleOverheadPackages', dataContext.saleOverheadPackages),
                setItem('brooks_prospects', dataContext.prospects),
                setItem('brooks_storageBookings', dataContext.storageBookings),
                setItem('brooks_storageLocations', dataContext.storageLocations),
                setItem('brooks_batteryChargers', dataContext.batteryChargers),
                setItem('brooks_nominalCodes', dataContext.nominalCodes),
                setItem('brooks_nominalCodeRules', dataContext.nominalCodeRules),
                setItem('brooks_absenceRequests', dataContext.absenceRequests),
                setItem('brooks_inquiries', dataContext.inquiries),
                setItem('brooks_reminders', dataContext.reminders),
                setItem('brooks_auditLog', dataContext.auditLog),
                setItem('brooks_businessEntities', dataContext.businessEntities),
                setItem('brooks_taxRates', dataContext.taxRates),
                setItem('brooks_roles', dataContext.roles),
                setItem('brooks_inspectionDiagrams', dataContext.inspectionDiagrams),
                setItem('brooks_users', users),
            ]);
            showStatus('All data successfully forced to storage.', 'success');
        } catch (e) {
            console.error(e);
            showStatus('Failed to save some data. Check console for details.', 'error');
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
        { id: 'suppliers', label: 'Suppliers', icon: Truck, render: () => <ManagementSuppliersTab /> },
        { id: 'parts', label: 'Parts', icon: Settings, render: () => <ManagementPartsTab searchTerm={searchTerm} onShowStatus={showStatus} /> },
        { id: 'packages', label: 'Service Packages', icon: Package, render: () => <ManagementPackagesTab /> },
        { id: 'nominalCodes', label: 'Nominal Codes', icon: List, render: () => <ManagementNominalCodesTab /> },
        { id: 'backup', label: 'Backup & Restore', icon: Database, render: () => <ManagementBackupTab backupSchedule={backupSchedule} setBackupSchedule={setBackupSchedule} onManualBackup={onManualBackup} onShowStatus={showStatus} /> },
    ];

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b bg-gray-50 rounded-t-xl">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Settings className="text-gray-600"/> Data Management</h2>
                        <div className="flex items-center gap-2">
                            <div className="relative mr-4">
                            <input 
                                type="text" 
                                placeholder="Search active tab..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="pl-8 pr-4 py-1 border rounded-lg text-sm"
                            />
                            <div className="absolute left-2 top-1.5 text-gray-400"><Settings size={14}/></div>
                            </div>
                            <button 
                            onClick={handleForceSave} 
                            disabled={isSaving}
                            className="mr-2 flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 text-sm font-semibold disabled:opacity-50"
                        >
                            <Save size={16} className={isSaving ? "animate-spin" : ""} />
                            {isSaving ? 'Saving...' : 'Force Save'}
                        </button>
                        <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-gray-800" /></button>
                    </div>
                </header>
                
                {statusMessage && renderStatusBanner()}

                <div className="flex flex-grow overflow-hidden">
                    <nav className="w-64 bg-gray-100 border-r overflow-y-auto flex-shrink-0 p-2 space-y-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                    
                    <main className="flex-grow p-6 overflow-y-auto bg-white">
                        {tabs.find(t => t.id === activeTab)?.render()}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default ManagementModal;
