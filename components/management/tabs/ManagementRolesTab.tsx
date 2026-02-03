import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Role } from '../../../types';
import { PlusCircle, Shield } from 'lucide-react';
import RoleFormModal from '../../RoleFormModal';
import { saveDocument } from '../../../core/db/index';

export const ManagementRolesTab = () => {
    const { roles, setRoles, refreshActiveData } = useData();
    
    // Local state for instant UI updates
    const [localRoles, setLocalRoles] = useState<Role[]>(roles);

    useEffect(() => {
        setLocalRoles(roles);
    }, [roles]);

    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSave = async (updatedRole: Role) => {
        try {
            // 1. Save to DB
            await saveDocument('brooks_roles', updatedRole);
            
            // 2. Update Local State (Instant)
            const updateFn = (prev: Role[]) => {
                const exists = prev.find(r => r.id === updatedRole.id);
                if (exists) return prev.map(r => r.id === updatedRole.id ? updatedRole : r);
                return [...prev, updatedRole];
            };
            setLocalRoles(updateFn);

            // 3. Update Global Context
            if (setRoles) setRoles(updateFn);

            // 4. Background Sync
            await refreshActiveData(true);
            
            setIsModalOpen(false);
            setSelectedRole(null);
        } catch (error: any) {
            console.error("Role save failed:", error);
            alert(`Error: ${error.message}`);
        }
    };

    return (
        <div className="p-2">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase">System Roles</h2>
                    <p className="text-sm text-gray-500">Define access levels and permissions</p>
                </div>
                <button 
                    onClick={() => { setSelectedRole(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2"
                >
                    <PlusCircle size={18}/> Add Role
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Role Name</th>
                            <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Description</th>
                            <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {localRoles.map(role => (
                            <tr key={role.id} className="hover:bg-gray-50/50">
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <Shield size={14} className="text-indigo-500" />
                                        <span className="font-bold text-gray-900">{role.name}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-gray-600 font-medium">{role.description}</td>
                                <td className="p-4 text-right">
                                    <button 
                                        onClick={() => { setSelectedRole(role); setIsModalOpen(true); }} 
                                        className="text-indigo-600 font-black text-xs uppercase hover:underline"
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {isModalOpen && (
                <RoleFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave} 
                    role={selectedRole} 
                />
            )}
        </div>
    );
};