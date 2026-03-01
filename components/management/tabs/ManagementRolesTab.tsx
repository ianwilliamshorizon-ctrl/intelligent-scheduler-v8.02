import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Role } from '../../../types';
import { PlusCircle, Shield, ShieldCheck, Edit3, Fingerprint, Lock } from 'lucide-react';
import RoleFormModal from '../../RoleFormModal';
import { saveDocument } from '../../../core/db/index';

interface ManagementRolesTabProps {
    searchTerm: string;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

export const ManagementRolesTab: React.FC<ManagementRolesTabProps> = ({ searchTerm = '', onShowStatus }) => {
    const { roles = [], setRoles } = useData();
    
    const [localRoles, setLocalRoles] = useState<Role[]>(Array.isArray(roles) ? roles : []);

    useEffect(() => {
        setLocalRoles(Array.isArray(roles) ? roles : []);
    }, [roles]);

    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filteredRoles = localRoles.filter(r => 
        (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (r.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSave = async (updatedRole: Role) => {
        try {
            await saveDocument('brooks_roles', updatedRole);
            
            const updateFn = (prev: Role[]) => {
                const current = Array.isArray(prev) ? prev : [];
                const exists = current.find(r => r.id === updatedRole.id);
                return exists 
                    ? current.map(r => r.id === updatedRole.id ? updatedRole : r) 
                    : [...current, updatedRole];
            };
            
            setLocalRoles(updateFn);
            if (setRoles) setRoles(updateFn);

            setIsModalOpen(false);
            setSelectedRole(null);

            onShowStatus('System permissions updated.', 'success');
        } catch (error: any) {
            onShowStatus(error.message || 'Failed to save role', 'error');
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Lock className="text-indigo-600" size={24} />
                        Access Control
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Define global authorization levels and module restrictions</p>
                </div>
                <button 
                    onClick={() => { setSelectedRole(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                >
                    <PlusCircle size={18}/> Create Role
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Security Profile</th>
                            <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Scope of Authority</th>
                            <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-right">Settings</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredRoles.length > 0 ? (
                            filteredRoles.map(role => (
                                <tr key={role.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl ${
                                                role.name.toLowerCase().includes('admin') 
                                                ? 'bg-rose-50 text-rose-600' 
                                                : 'bg-indigo-50 text-indigo-600'
                                            }`}>
                                                <ShieldCheck size={20} />
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900 uppercase tracking-tight text-sm">
                                                    {role.name}
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                                    <Fingerprint size={10} />
                                                    ID: {role.id?.slice(0, 8) || 'SYSTEM'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <p className="text-slate-600 font-medium leading-relaxed max-w-md italic">
                                            "{role.description || 'No description provided for this profile.'}"
                                        </p>
                                    </td>
                                    <td className="px-6 py-6 text-right">
                                        <button 
                                            onClick={() => { setSelectedRole(role); setIsModalOpen(true); }} 
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all group-hover:shadow-md"
                                        >
                                            <Edit3 size={14} />
                                            Configure
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="py-24 text-center">
                                    <div className="flex flex-col items-center gap-3 opacity-20">
                                        <Shield size={64} strokeWidth={1} />
                                        <span className="font-black uppercase tracking-[0.3em] text-xs">No Profiles Found</span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {isModalOpen && (
                <RoleFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedRole(null);
                    }} 
                    onSave={handleSave} 
                    role={selectedRole} 
                />
            )}
        </div>
    );
};