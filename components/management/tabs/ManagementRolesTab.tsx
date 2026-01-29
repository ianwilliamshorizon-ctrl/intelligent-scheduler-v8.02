
import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Role } from '../../../types';
import { PlusCircle } from 'lucide-react';
import RoleFormModal from '../../RoleFormModal';
import { useManagementTable } from '../hooks/useManagementTable';

export const ManagementRolesTab = () => {
    const { roles } = useData();
    const { updateItem } = useManagementTable(roles, 'brooks_roles');

    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
         <div>
            <div className="flex justify-end mb-4">
                 <button onClick={() => { setSelectedRole(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow flex items-center gap-2">
                    <PlusCircle size={16}/> Add Role
                </button>
            </div>
             <div className="overflow-y-auto max-h-[70vh]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 sticky top-0"><tr><th className="p-2">Role Name</th><th className="p-2">Base Permissions</th><th className="p-2">Actions</th></tr></thead>
                    <tbody>
                        {roles.map(r => (
                            <tr key={r.id} className="border-b hover:bg-gray-50">
                                <td className="p-2 font-medium">{r.name}</td>
                                <td className="p-2">{r.baseRole}</td>
                                <td className="p-2">
                                    <button onClick={() => { setSelectedRole(r); setIsModalOpen(true); }} className="text-indigo-600 hover:underline mr-2">Edit</button>
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
                    onSave={(r) => { updateItem(r); setIsModalOpen(false); }} 
                    role={selectedRole} 
                />
            )}
        </div>
    );
};
