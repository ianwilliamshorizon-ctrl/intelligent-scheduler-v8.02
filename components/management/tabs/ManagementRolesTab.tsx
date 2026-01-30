import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db';
import { Shield, Edit, Trash2, Plus, Save, X, CheckSquare, Square } from 'lucide-react';

export const ManagementRolesTab = () => {
    const { roles = [] } = useData();
    const { updateItem, deleteItem } = useManagementTable(roles, 'brooks_roles');
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<any>(null);

    // Define the available system functions
    const availablePermissions = [
        { id: 'view_dashboard', label: 'Dashboard Access' },
        { id: 'manage_jobs', label: 'Job Scheduling' },
        { id: 'manage_invoices', label: 'Invoicing & Finance' },
        { id: 'manage_inventory', label: 'Parts & Inventory' },
        { id: 'manage_staff', label: 'Staff Management' },
        { id: 'view_reports', label: 'Financial Reporting' },
        { id: 'field_access', label: 'Mobile Field App' }
    ];

    const handleOpenModal = (role: any = null) => {
        setEditingRole(role || { name: '', description: '', permissions: [] });
        setIsModalOpen(true);
    };

    const togglePermission = (permId: string) => {
        const currentPerms = editingRole.permissions || [];
        const newPerms = currentPerms.includes(permId)
            ? currentPerms.filter((p: string) => p !== permId)
            : [...currentPerms, permId];
        setEditingRole({ ...editingRole, permissions: newPerms });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingRole.id) {
                await updateItem(editingRole);
            } else {
                const newId = editingRole.name.toLowerCase().replace(/\s+/g, '_');
                await saveDocument('brooks_roles', { ...editingRole, id: newId });
            }
            setIsModalOpen(false);
        } catch (err) {
            console.error("Save error:", err);
            alert("Failed to save role.");
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-bold text-gray-800">System Roles</h2>
                    <p className="text-sm text-gray-500">Define what each role is allowed to do.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-sm"
                >
                    <Plus size={16} /> Create New Role
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((role: any) => (
                    <div key={role.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                <Shield size={24} />
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal(role)} className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-md"><Edit size={16} /></button>
                                <button onClick={() => deleteItem(role.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-md"><Trash2 size={16} /></button>
                            </div>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">{role.name}</h3>
                        <p className="text-sm text-gray-500 mb-4 flex-grow">{role.description || 'No description.'}</p>
                        
                        <div className="pt-3 border-t">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Enabled Functions</span>
                            <div className="flex flex-wrap gap-1">
                                {role.permissions?.length > 0 ? (
                                    role.permissions.map((p: string) => (
                                        <span key={p} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold uppercase">
                                            {p.replace('_', ' ')}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-[10px] text-gray-400 italic">No permissions set</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <form onSubmit={handleSave} className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">{editingRole?.id ? 'Edit Role Permissions' : 'Create New Role'}</h3>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6 space-y-6 overflow-y-auto">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Role Name</label>
                                    <input 
                                        required 
                                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
                                        value={editingRole.name} 
                                        onChange={e => setEditingRole({...editingRole, name: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                    <input 
                                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
                                        value={editingRole.description} 
                                        onChange={e => setEditingRole({...editingRole, description: e.target.value})} 
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Functional Permissions</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {availablePermissions.map((perm) => {
                                        const isChecked = editingRole.permissions?.includes(perm.id);
                                        return (
                                            <button
                                                key={perm.id}
                                                type="button"
                                                onClick={() => togglePermission(perm.id)}
                                                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                                                    isChecked 
                                                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700' 
                                                    : 'border-gray-100 bg-white text-gray-600 hover:border-gray-300'
                                                }`}
                                            >
                                                {isChecked ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} className="text-gray-300" />}
                                                <span className="text-sm font-semibold">{perm.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                            <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-2">
                                <Save size={16}/> Save Permissions
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};