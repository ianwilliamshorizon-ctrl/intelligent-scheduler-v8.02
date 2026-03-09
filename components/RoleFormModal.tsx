import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Key } from 'lucide-react';
import { Role, UserRole, ViewType, ManagedDataPermissions } from '../types';

interface RoleFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (role: Role) => void;
    role: Role | null;
}

const ALL_VIEWS: ViewType[] = [
    'dashboard', 'dispatch', 'workflow', 'concierge', 'inquiries', 'communications', 
    'estimates', 'invoices', 'purchaseOrders', 'jobs', 'sales', 'storage', 
    'rentals', 'absence', 'management'
];

const ALL_USER_ROLES: UserRole[] = ['Admin', 'Dispatcher', 'Engineer', 'Garage Concierge', 'Sales'];

const ALL_MANAGED_DATA_PERMISSIONS = {
    canManageCustomers: 'Customers',
    canManageVehicles: 'Vehicles',
    canManageServicePackages: 'Service Packages',
    canManageDiscountCodes: 'Discount Codes',
    canManageParts: 'Parts',
    canManageSuppliers: 'Suppliers',
    canManageStaff: 'Staff',
    canManageRoles: 'Roles',
    canManageEntities: 'Entities',
    canManageLifts: 'Lifts',
    canManageBatteryChargers: 'Battery Chargers',
    canManageNominalCodes: 'Nominal Codes',
    canManageTaxCodes: 'Tax Codes',
    canManageInspectionDiagrams: 'Inspection Diagrams',
    canManageInspectionTemplates: 'Inspection Templates',
    canManageBackups: 'Backups'
};

const RoleFormModal: React.FC<RoleFormModalProps> = ({ isOpen, onClose, onSave, role }) => {
    
    const getInitialFormData = (): Role => {
        if (role) return role;
        const newId = `role_${Date.now()}`;
        return {
            id: newId,
            name: '',
            description: '',
            baseRole: 'Engineer', 
            defaultAllowedViews: [],
            managedDataPermissions: {
                isSuperAdmin: false,
                canManageCustomers: false,
                canManageVehicles: false,
                canManageServicePackages: false,
                canManageDiscountCodes: false,
                canManageParts: false,
                canManageSuppliers: false,
                canManageStaff: false,
                canManageRoles: false,
                canManageEntities: false,
                canManageLifts: false,
                canManageBatteryChargers: false,
                canManageNominalCodes: false,
                canManageTaxCodes: false,
                canManageInspectionDiagrams: false,
                canManageInspectionTemplates: false,
                canManageBackups: false
            }
        }
    }

    const [formData, setFormData] = useState<Role>(getInitialFormData());

    useEffect(() => {
        setFormData(getInitialFormData());
    }, [role, isOpen]);

    if (!isOpen) return null;

    const handleAllowedViewChange = (view: ViewType) => {
        const currentViews = formData.defaultAllowedViews || [];
        const updatedViews = currentViews.includes(view)
            ? currentViews.filter(v => v !== view)
            : [...currentViews, view];
        setFormData({ ...formData, defaultAllowedViews: updatedViews });
    };

    const handlePermissionChange = (permission: keyof ManagedDataPermissions) => {
        const currentPermissions = formData.managedDataPermissions || {} as ManagedDataPermissions;
        let updatedPermissions: ManagedDataPermissions;

        if (permission === 'isSuperAdmin') {
            const isSuperAdmin = !currentPermissions.isSuperAdmin;
            updatedPermissions = {
                ...currentPermissions,
                isSuperAdmin,
                ...Object.keys(ALL_MANAGED_DATA_PERMISSIONS).reduce((acc, key) => ({ ...acc, [key]: isSuperAdmin }), {})
            };
        } else {
            updatedPermissions = { ...currentPermissions, [permission]: !currentPermissions[permission] };
        }

        setFormData({ ...formData, managedDataPermissions: updatedPermissions });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            alert('Role Name is required.');
            return;
        }
        if (!formData.baseRole) {
            alert('Base Role is required for the system to assign the correct dashboard and core permissions.');
            return;
        }
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl transform transition-all opacity-100 scale-100 m-8">
                <form onSubmit={handleSubmit}>
                    <div className="px-8 py-6 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="text-xl font-black text-slate-700 uppercase tracking-wider flex items-center gap-3">
                            <Shield size={20} className="text-indigo-500" />
                            {role ? 'Configure Security Profile' : 'Create New Security Profile'}
                        </h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>
                    
                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Role Name</label>
                                <input 
                                    type="text" 
                                    value={formData.name || ''} 
                                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                    placeholder="e.g., Senior Technician"
                                />
                            </div>
                             <div className="space-y-2">
                                <label className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <Key size={12}/>
                                    Base Role (Internal)
                                </label>
                                <select
                                    value={formData.baseRole}
                                    onChange={e => setFormData({ ...formData, baseRole: e.target.value as UserRole })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition font-mono"
                                >
                                    {ALL_USER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Description</label>
                            <textarea 
                                value={formData.description || ''} 
                                onChange={e => setFormData({ ...formData, description: e.target.value })} 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                rows={3}
                                placeholder="A brief summary of what this role can do..."
                            />
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Module Access Permissions</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl">
                                {ALL_VIEWS.map(view => (
                                    <label key={view} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-indigo-50 transition cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.defaultAllowedViews?.includes(view)} 
                                            onChange={() => handleAllowedViewChange(view)} 
                                            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm font-medium text-slate-700 capitalize tracking-wide">
                                            {view.replace(/([A-Z])/g, ' $1')}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="font-bold text-xs text-slate-500 uppercase tracking-wider">Managed Data Permissions</label>
                            <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl">
                                <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-amber-50 transition cursor-pointer font-bold">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.managedDataPermissions?.isSuperAdmin} 
                                        onChange={() => handlePermissionChange('isSuperAdmin')} 
                                        className="h-5 w-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-sm font-bold text-amber-700 uppercase tracking-wide">Super Admin (Full Access)</span>
                                </label>
                                <hr className="my-3"/>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {Object.entries(ALL_MANAGED_DATA_PERMISSIONS).map(([key, label]) => (
                                        <label key={key} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-indigo-50 transition cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={formData.managedDataPermissions?.[key as keyof ManagedDataPermissions]} 
                                                onChange={() => handlePermissionChange(key as keyof ManagedDataPermissions)} 
                                                disabled={formData.managedDataPermissions?.isSuperAdmin}
                                                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                            />
                                            <span className="text-sm font-medium text-slate-700 capitalize tracking-wide">
                                                {label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-8 py-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-4 rounded-b-2xl">
                        <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-slate-600 bg-white border-2 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 transition-all active:scale-95">
                            Cancel
                        </button>
                        <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95">
                            <Save size={16} />
                            {role ? 'Save Changes' : 'Create Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RoleFormModal;