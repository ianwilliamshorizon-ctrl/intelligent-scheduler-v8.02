import React, { useState, useEffect } from 'react';
import { useApp } from '../../../core/state/AppContext';
import { useData } from '../../../core/state/DataContext';
import { User } from '../../../types';
import { PlusCircle } from 'lucide-react';
import UserFormModal from '../../UserFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

export const ManagementStaffTab = () => {
    const { users, setUsers } = useApp();
    const { roles, refreshActiveData } = useData();
    
    // 1. LOCAL STATE: This is what the table actually renders.
    // This ensures the UI updates the MILLISECOND you hit save.
    const [localUsers, setLocalUsers] = useState<User[]>(users);

    // Sync local state if global users change (e.g. on background refresh)
    useEffect(() => {
        setLocalUsers(users);
    }, [users]);

    const { deleteItem } = useManagementTable(users, 'brooks_users');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSave = async (updatedUser: User) => {
        try {
            // 2. SAVE TO DB
            await saveDocument('brooks_users', updatedUser);
            
            // 3. UPDATE LOCAL UI IMMEDIATELY (The "Magic" fix)
            setLocalUsers(prev => {
                const exists = prev.find(u => u.id === updatedUser.id);
                if (exists) {
                    return prev.map(u => u.id === updatedUser.id ? updatedUser : u);
                }
                return [...prev, updatedUser];
            });

            // 4. UPDATE GLOBAL CONTEXT (For the rest of the app)
            if (setUsers) {
                setUsers(prev => {
                    const exists = prev.find(u => u.id === updatedUser.id);
                    if (exists) return prev.map(u => u.id === updatedUser.id ? updatedUser : u);
                    return [...prev, updatedUser];
                });
            }

            // 5. TRIGGER BACKGROUND SYNC
            await refreshActiveData(true);
            
            setIsModalOpen(false);
            setSelectedUser(null);
        } catch (error: any) {
            console.error("Save failed:", error);
            alert(`Failed to save: ${error.message}`);
        }
    };

    return (
        <div className="p-2">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase">Staff & Users</h2>
                </div>
                <button 
                    onClick={() => { setSelectedUser(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2"
                >
                    <PlusCircle size={18}/> Add Staff Member
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Name</th>
                            <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Email / Login</th>
                            <th className="p-4 font-black text-gray-400 uppercase text-[10px]">Role</th>
                            <th className="p-4 font-black text-gray-400 uppercase text-[10px] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {/* We map OVER localUsers, NOT the global users */}
                        {localUsers.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50/50">
                                <td className="p-4 font-bold text-gray-900">{u.name}</td>
                                <td className="p-4 text-gray-600 font-medium">
                                    {/* This is the field you were editing */}
                                    {u.email}
                                </td>
                                <td className="p-4">
                                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[11px] font-black uppercase">
                                        {u.role}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button 
                                        onClick={() => { setSelectedUser(u); setIsModalOpen(true); }} 
                                        className="text-indigo-600 font-black mr-4 text-xs uppercase"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => deleteItem(u.id)} 
                                        className="text-gray-300 hover:text-red-600 font-black text-xs uppercase"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {isModalOpen && (
                <UserFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => { setIsModalOpen(false); setSelectedUser(null); }} 
                    onSave={handleSave} 
                    user={selectedUser} 
                    roles={roles} 
                />
            )}
        </div>
    );
};