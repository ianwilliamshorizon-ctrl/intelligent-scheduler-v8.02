import React, { useState, useEffect } from 'react';
import { useApp } from '../../../core/state/AppContext';
import { useData } from '../../../core/state/DataContext';
import { User as UserType } from '../../../types';
import { PlusCircle, User, Mail, ShieldCheck, Edit3, Trash2, Users, ShieldAlert } from 'lucide-react';
import UserFormModal from '../../UserFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument } from '../../../core/db/index';

interface ManagementStaffTabProps {
    searchTerm: string;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementStaffTab: React.FC<ManagementStaffTabProps> = ({ searchTerm, onShowStatus }) => {
    const { users = [], setUsers, adminResetPassword } = useApp();
    const { roles = [], businessEntities = [], engineers = [], setEngineers } = useData();
    
    const [localUsers, setLocalUsers] = useState<UserType[]>(Array.isArray(users) ? users : []);

    useEffect(() => {
        if (Array.isArray(users)) {
            setLocalUsers(users);
        }
    }, [users]);

    const syncUsers = (updater: any) => {
        setLocalUsers(updater);
        if (setUsers) setUsers(updater);
    };

    const { deleteItem } = useManagementTable(localUsers, 'brooks_users', syncUsers);
    const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filteredUsers = localUsers.filter(user =>
        (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.role || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSave = async (updatedUser: UserType) => {
        const isNewUser = !localUsers.find(u => u.id === updatedUser.id);

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

        const prevUser = selectedUser;
        setIsModalOpen(false);
        setSelectedUser(null);

        try {
            await saveDocument('brooks_users', {
                ...updatedUser,
                status: isNewUser ? 'pending' : (updatedUser.status || 'active'),
                updatedAt: new Date().toISOString()
            });

            // Synchronize engineer profile in brooks_engineers if user is an engineer or linked to one
            if (setEngineers) {
                const targetEngId = updatedUser.engineerId || prevUser?.engineerId;
                const prevName = prevUser?.name?.trim().toLowerCase();
                
                const engMatch = (engineers || []).find(e => 
                    (targetEngId && e.id === targetEngId) || 
                    (e.id === updatedUser.id) ||
                    (prevName && e.name && e.name.trim().toLowerCase() === prevName) ||
                    (e.name && updatedUser.name && e.name.trim().toLowerCase() === updatedUser.name.trim().toLowerCase())
                );

                if (engMatch) {
                    const updatedEng = {
                        ...engMatch,
                        name: updatedUser.name || engMatch.name,
                        hourlyRate: updatedUser.hourlyRate !== undefined ? updatedUser.hourlyRate : engMatch.hourlyRate,
                        entityId: updatedUser.preferredEntityId || engMatch.entityId
                    };
                    setEngineers(prev => (prev || []).map(e => e.id === engMatch.id ? updatedEng : e));
                    await saveDocument('brooks_engineers', updatedEng);

                    // Ensure user document has engineerId persisted if missing
                    if (updatedUser.engineerId !== updatedEng.id) {
                        updatedUser.engineerId = updatedEng.id;
                        await saveDocument('brooks_users', {
                            ...updatedUser,
                            engineerId: updatedEng.id
                        });
                    }
                } else if (updatedUser.role === 'Engineer') {
                    // Create new engineer if staff role is Engineer
                    const newEngId = updatedUser.engineerId || `eng_${updatedUser.id}`;
                    const newEng = {
                        id: newEngId,
                        name: updatedUser.name,
                        hourlyRate: updatedUser.hourlyRate || 35,
                        entityId: updatedUser.preferredEntityId || ''
                    };
                    setEngineers(prev => [...(prev || []).filter(e => e.id !== newEngId), newEng]);
                    await saveDocument('brooks_engineers', newEng);

                    if (updatedUser.engineerId !== newEngId) {
                        updatedUser.engineerId = newEngId;
                        await saveDocument('brooks_users', {
                            ...updatedUser,
                            engineerId: newEngId
                        });
                    }
                }
            }

            if (isNewUser) {
                onShowStatus(`✅ ${updatedUser.email} authorized. Staff can now use "First Time Setup".`, 'success');
            }
        } catch (error) {
            onShowStatus("Failed to save staff member.", 'error');
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Users className="text-indigo-600" size={24} />
                        Staff Management & RBAC
                    </h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                        Active Database Personnel Directory
                    </p>
                </div>
                <button
                    onClick={() => { setSelectedUser(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-100 active:scale-95"
                >
                    <PlusCircle size={16} />
                    Authorize New Staff
                </button>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Team Member</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">System Access</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Role</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Default Entity</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Holiday Entitlement</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Hourly Rate</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map(u => {
                                const entity = businessEntities.find(e => e.id === u.preferredEntityId);
                                return (
                                    <tr key={u.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 border border-indigo-100">
                                                    <User size={18} />
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 leading-tight">
                                                        {u.name || 'Unnamed Personnel'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                        {u.id}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-slate-500 font-medium">
                                                    <Mail size={14} className="text-slate-300" />
                                                    {u.email}
                                                </div>
                                                {u.backupEmail && (
                                                    <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 ml-0.5">
                                                        <span className="px-1.5 py-0.2 bg-slate-100 border border-slate-200 text-slate-500 rounded text-[9px] uppercase font-black tracking-wider">Backup</span>
                                                        {u.backupEmail}
                                                    </div>
                                                )}
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
                                        <td className="px-6 py-5">
                                            <span className="text-slate-500 font-medium text-xs">
                                                {entity ? entity.name : 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">
                                                {u.holidayEntitlement !== undefined ? `${u.holidayEntitlement} days` : 'Not Set'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold ${
                                                u.hourlyRate 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                    : 'text-slate-400'
                                            }`}>
                                                {u.hourlyRate ? `£${u.hourlyRate.toFixed(2)}/hr` : '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button 
                                                onClick={() => {
                                                    onShowStatus(`Sending password reset link to ${u.email}...`, 'info');
                                                    adminResetPassword(u.email).then(() => onShowStatus("Password reset email sent", 'success')).catch(() => onShowStatus("Failed to send reset email", 'error'));
                                                }} 
                                                    className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                                                    title="Reset Password"
                                                >
                                                    <ShieldAlert size={18} />
                                                </button>

                                                <button 
                                                    onClick={() => { setSelectedUser(u); setIsModalOpen(true); }} 
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                                    title="Edit Profile"
                                                >
                                                    <Edit3 size={18} />
                                                </button>
                                                
                                                <button 
                                                    onClick={() => {
                                                        if(window.confirm(`Remove ${u.name}? This will revoke their database access.`)) deleteItem(u.id);
                                                    }} 
                                                    className="p-2 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="Remove Access"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
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
                    businessEntities={businessEntities || []} 
                    users={localUsers}
                />
            )}
        </div>
    );
};