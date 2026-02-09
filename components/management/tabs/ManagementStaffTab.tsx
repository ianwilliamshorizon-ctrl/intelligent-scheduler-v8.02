import React, { useState, useEffect } from 'react';
import { useApp } from '../../../core/state/AppContext';
import { useData } from '../../../core/state/DataContext';
import { User as UserType } from '../../../types';
import { PlusCircle, User, Mail, ShieldCheck, Edit3, Trash2, Users } from 'lucide-react';
import UserFormModal from '../../UserFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

export const ManagementStaffTab = () => {
    const { users = [], setUsers } = useApp();
    const { roles = [], refreshActiveData } = useData();
    
    const [localUsers, setLocalUsers] = useState<UserType[]>(Array.isArray(users) ? users : []);

    useEffect(() => {
        if (Array.isArray(users)) {
            setLocalUsers(users);
        }
    }, [users]);

    const { deleteItem } = useManagementTable(localUsers, 'brooks_users');
    const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSave = async (updatedUser: UserType) => {
        const updateLogic = (prev: UserType[]) => {
            const current = Array.isArray(prev) ? prev : [];
            const exists = current.find(u => u.id === updatedUser.id);
            return exists
                ? current.map(u => (u.id === updatedUser.id ? updatedUser : u))
                : [...current, updatedUser];
        };

        if (setUsers) {
            setUsers(updateLogic);
        }

        setIsModalOpen(false);
        setSelectedUser(null);

        try {
            await saveDocument('brooks_users', updatedUser);
            if (refreshActiveData) {
                setTimeout(async () => {
                    await refreshActiveData(true);
                }, 800);
            }
        } catch (error) {
            console.error("Failed to save staff member:", error);
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Users className="text-indigo-600" size={24} />
                        Staff & Access
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Manage team members and system permissions</p>
                </div>
                <button 
                    onClick={() => { setSelectedUser(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                >
                    <PlusCircle size={18}/> Add Staff Member
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[70vh]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Team Member</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">System Access</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Role</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {localUsers.map(u => (
                                <tr key={u.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 border border-indigo-100">
                                                <User size={18} />
                                            </div>
                                            <div className="font-black text-slate-900 uppercase text-xs tracking-tight">{u.name}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                                            <Mail size={14} className="text-slate-300" />
                                            {u.email}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck size={14} className="text-emerald-500" />
                                            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                                {u.role}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button 
                                                onClick={() => { setSelectedUser(u); setIsModalOpen(true); }} 
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                            >
                                                <Edit3 size={18} />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if(window.confirm(`Remove ${u.name}?`)) deleteItem(u.id);
                                                }} 
                                                className="p-2 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {isModalOpen && (
                <UserFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => { setIsModalOpen(false); setSelectedUser(null); }} 
                    onSave={handleSave} 
                    user={selectedUser} 
                    roles={roles || []} 
                />
            )}
        </div>
    );
};