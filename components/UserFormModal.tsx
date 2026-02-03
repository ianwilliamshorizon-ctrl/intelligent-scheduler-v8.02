import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import * as T from '../types';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: T.User) => void;
    user: T.User | null;
    roles: T.Role[];
}

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, user, roles }) => {
    const [formData, setFormData] = useState<Partial<T.User>>({
        name: '',
        email: '',
        password: '',
        role: undefined
    });

    // THE FIX: We only want to initialize the form when the modal OPENS 
    // or when the User ID changes. We ignore general "roles" or "user" object 
    // updates caused by background polling.
    useEffect(() => {
        if (isOpen) {
            if (user) {
                // Spread the user to ensure we have a fresh local copy
                setFormData({ ...user });
            } else {
                setFormData({
                    name: '',
                    email: '',
                    password: '',
                    role: roles.length > 0 ? (roles[0].name as T.UserRole) : undefined
                });
            }
        }
        // We strictly only trigger on 'isOpen' or 'user.id'
    }, [isOpen, user?.id]); 

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const firstName = formData.name?.split(' ')[0] || 'User';
        
        const finalUser = {
            ...formData,
            id: formData.id || `User_${firstName}_${Date.now()}`, // Added timestamp to prevent ID collisions
        } as T.User;

        onSave(finalUser);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-gray-800">
                        {user ? 'Edit Staff Member' : 'Add New Staff Member'}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            required
                            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Simon Brook"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={formData.email || ''}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="simon@brookspeed.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            required={!user}
                            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={formData.password || ''}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder={user ? "Leave blank to keep current" : "Enter password"}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">System Role</label>
                        <select
                            className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                            value={formData.role || ''}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as T.UserRole })}
                            required
                        >
                            <option value="" disabled>Select a role</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium shadow-sm"
                        >
                            {user ? 'Update Staff' : 'Create Staff'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserFormModal;