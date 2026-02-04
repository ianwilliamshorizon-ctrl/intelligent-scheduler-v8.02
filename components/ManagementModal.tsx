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
    ArrowUpCircle, BatteryCharging, ClipboardCheck, Search
} from 'lucide-react';

// Extracted Tab Views
import {
    ManagementCustomersTab, ManagementVehiclesTab, ManagementDiagramsTab,
    ManagementStaffTab, ManagementRolesTab, ManagementEntitiesTab,
    ManagementSuppliersTab, ManagementPartsTab, ManagementPackagesTab,
    ManagementNominalCodesTab, ManagementLiftsTab, ManagementBatteryChargersTab,
    ManagementInspectionTemplatesTab
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

    // Ensure the active tab defaults to 'customers' or the initialView tab
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
        showStatus('Forcing save of all data to Firestore...', 'info');
        try {
            // Using the setter from your db.ts which maps to 'brooks_settings' collection
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
                setItem('brooks_inspectionTemplates', dataContext.inspectionTemplates),
                setItem('brooks_users', users),
            ]);
            showStatus('All data successfully forced to Firestore.', 'success');
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
            <div className={`flex items-center gap-2 p-3 mb-4 mx-6 mt-4 rounded-lg border ${bgColors[statusMessage.type]} animate-fade-in`}>
                <Icon size={20} />
                <span className="font-semibold text-sm">{statusMessage.text}</span>
                <button onClick={() => setStatusMessage(null)} className="ml-auto"><X size={16}/></button>
            </div>
        );
    };

    // Shared props for tabs
    const sharedTabProps = { searchTerm, onShowStatus: showStatus };

    const tabs = [
        { id: 'customers', label: 'Customers', icon: UserIcon, render: () => <ManagementCustomersTab {...sharedTabProps} /> },
        { id: 'vehicles', label: 'Vehicles', icon: Car, render: () => <ManagementVehiclesTab {...sharedTabProps} /> },
        { id: 'diagrams', label: 'Vehicle Diagrams', icon: CarFront, render: () => <ManagementDiagramsTab {...sharedTabProps} /> },
        // FIXED ID: Changed from 'templates' to 'inspectionTemplates' to match context key
        { id: 'inspectionTemplates', label: 'Inspection Templates', icon: ClipboardCheck, render: () => <ManagementInspectionTemplatesTab {...sharedTabProps} /> },
        { id: 'staff', label: 'Staff (Users)', icon: Users, render: () => <ManagementStaffTab {...sharedTabProps} /> },
        { id: 'roles', label: 'Roles', icon: ShieldCheck, render: () => <ManagementRolesTab {...sharedTabProps} /> },
        { id: 'entities', label: 'Business Entities', icon: Briefcase, render: () => <ManagementEntitiesTab {...sharedTabProps} /> },
        { id: 'lifts', label: 'Lifts & Bays', icon: ArrowUpCircle, render: () => <ManagementLiftsTab {...sharedTabProps} /> },
        { id: 'batteryChargers', label: 'Battery Chargers', icon: BatteryCharging, render: () => <ManagementBatteryChargersTab {...sharedTabProps} /> },
        { id: 'suppliers', label: 'Suppliers', icon: Truck, render: () => <ManagementSuppliersTab {...sharedTabProps} /> },
        { id: 'parts', label: 'Parts', icon: Settings, render: () => <ManagementPartsTab {...sharedTabProps} /> },
        { id: 'packages', label: 'Service Packages', icon: Package, render: () => <ManagementPackagesTab {...sharedTabProps} /> },
        { id: 'nominalCodes', label: 'Nominal Codes', icon: List, render: () => <ManagementNominalCodesTab {...sharedTabProps} /> },
        { id: 'backup', label: 'Backup & Restore', icon: Database, render: () => <ManagementBackupTab backupSchedule={backupSchedule} setBackupSchedule={setBackupSchedule} onManualBackup={onManualBackup} onShowStatus={showStatus} /> },
    ];

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
                <header className="flex-shrink-0 flex justify-between items-center p-4 border-b bg-gray-50">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <Settings className="text-gray-600"/> Data Management
                        </h2>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Search active tab..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="pl-9 pr-4 py-1.5 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <Search className="absolute left-3 top-2 text-gray-400" size={16}/>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleForceSave} 
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
                        >
                            <Save size={18} className={isSaving ? "animate-spin" : ""} />
                            {isSaving ? 'Saving to Cloud...' : 'Force Sync to Cloud'}
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </header>
                
                {renderStatusBanner()}

                <div className="flex flex-grow overflow-hidden">
                    <nav className="w-64 bg-gray-50 border-r overflow-y-auto flex-shrink-0 p-3 space-y-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                <tab.icon size={20} />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                    
                    <main className="flex-grow overflow-y-auto bg-white relative">
                        {tabs.find(t => t.id === activeTab)?.render()}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default ManagementModal;