import React, { useState, useEffect } from 'react';
import { Role, ViewType, UserRole } from '../types';
import FormModal from './FormModal';

interface RoleFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (role: Role) => void;
    role: Role | null;
}

const RoleFormModal: React.FC<RoleFormModalProps> = ({ isOpen, onClose, onSave, role }) => {
    const [formData, setFormData] = useState<Partial<Role>>({});
    
    // Available views from types.ts
    const allViews: ViewType[] = ['dashboard', 'dispatch', 'workflow', 'jobs', 'estimates', 'invoices', 'purchaseOrders', 'sales', 'storage', 'rentals', 'concierge', 'communications', 'absence', 'inquiries'];

    useEffect(() => {
        if (isOpen) {
            setFormData(role || { name: '', baseRole: 'Dispatcher', defaultAllowedViews: [] });
        }
    }, [isOpen, role]);

    const handleViewToggle = (view: ViewType) => {
        setFormData(prev => {
            const current = prev.defaultAllowedViews || [];
            return {
                ...prev,
                defaultAllowedViews: current.includes(view) 
                    ? current.filter(v => v !== view) 
                    : [...current, view]
            };
        });
    };

    const handleSave = () => {
        if (!formData.name) return;
        onSave({
            id: formData.id || `role_${Date.now()}`,
            name: formData.name!,
            baseRole: formData.baseRole || 'Dispatcher',
            defaultAllowedViews: formData.defaultAllowedViews || []
        } as Role);
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={role ? "Edit Role" : "Add Role"}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Role Name</label>
                    <input 
                        value={formData.name || ''} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        className="w-full p-2 border rounded" 
                        required
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Base Permission Level</label>
                    <select 
                        value={formData.baseRole || ''} 
                        onChange={e => setFormData({...formData, baseRole: e.target.value as UserRole})} 
                        className="w-full p-2 border rounded bg-white"
                    >
                        <option>Admin</option>
                        <option>Dispatcher</option>
                        <option>Engineer</option>
                        <option>Sales</option>
                        <option>Garage Concierge</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Views</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {allViews.map(view => (
                            <label key={view} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={(formData.defaultAllowedViews || []).includes(view)} 
                                    onChange={() => handleViewToggle(view)}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="capitalize text-sm">{view.replace(/([A-Z])/g, ' $1').trim()}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </FormModal>
    );
};
export default RoleFormModal;