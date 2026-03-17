import React, { useState, useEffect } from 'react';
import { X, Loader, ShieldCheck, Mail, User, Briefcase } from 'lucide-react';
import * as T from '../types';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: T.User) => Promise<void>;
    user: T.User | null;
    roles: T.Role[];
    businessEntities: T.BusinessEntity[];
}

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, user, roles, businessEntities }) => {
    const [formData, setFormData] = useState<Partial<T.User>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (user) {
                setFormData({ ...user });
            } else {
                setFormData({
                    name: '',
                    email: '',
                    role: roles.length > 0 ? (roles[0].name as any) : undefined,
                    preferredEntityId: businessEntities.length > 0 ? businessEntities[0].id : undefined
                });
            }
        }
    }, [isOpen, user?.id, roles, businessEntities]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        const firstName = formData.name?.split(' ')[0] || 'User';

        const finalUser = {
            ...formData,
            id: formData.id || `User_${firstName}_${Date.now()}`,
        } as T.User;

        try {
            await onSave(finalUser);
        } catch (error) {
            console.error("Save failed:", error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                    <div>
                        <h3 className="font-black text-slate-900 uppercase tracking-tighter text-lg">
                            {user ? 'Edit Staff Profile' : 'Authorize New Staff'}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            System Access Management
                        </p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors" 
                        disabled={isSaving}
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Name Field */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Full Name</label>
                        <div className="relative">
                            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input
                                type="text"
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Jack Brook"
                                disabled={isSaving}
                            />
                        </div>
                    </div>

                    {/* Email Field */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Email Address</label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input
                                type="email"
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                                value={formData.email || ''}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="jack@brookspeed.com"
                                disabled={isSaving}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         {/* Role Selection */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">System Role</label>
                            <div className="relative">
                                <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold appearance-none cursor-pointer"
                                    value={formData.role || ''}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                                    required
                                    disabled={isSaving}
                                >
                                    <option value="" disabled>Select Permissions</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.name}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Preferred Entity Selection */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Preferred Entity</label>
                            <div className="relative">
                                <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold appearance-none cursor-pointer"
                                    value={formData.preferredEntityId || ''}
                                    onChange={(e) => setFormData({ ...formData, preferredEntityId: e.target.value })}
                                    required
                                    disabled={isSaving}
                                >
                                    <option value="" disabled>Default Entity</option>
                                    {businessEntities.map(e => (
                                        <option key={e.id} value={e.id}>{e.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Info Note */}
                    {!user && (
                        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                            <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">
                                <strong>Note:</strong> Creating this profile authorizes the email address. The staff member must then use the <strong>"First Time Setup"</strong> option on the login screen to create their own password.
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-black uppercase tracking-widest transition-colors"
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center justify-center transition-all active:scale-[0.98]"
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <Loader className="animate-spin" size={18} />
                            ) : (
                                user ? 'Update Profile' : 'Authorize Staff'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserFormModal;