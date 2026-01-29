
import React, { useState, useEffect } from 'react';
import { User, Role, UserRole } from '../types';
import FormModal from './FormModal';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: User) => void;
    user: User | null;
    roles: Role[];
}

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, user, roles }) => {
    const [formData, setFormData] = useState<Partial<User>>({});

    useEffect(() => {
        if (isOpen) {
            setFormData(user || {
                name: '',
                password: '1234',
                role: (roles[0]?.name as UserRole) || 'Dispatcher',
                holidayEntitlement: 25
            });
        }
    }, [isOpen, user, roles]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        if (!formData.name || !formData.role) return;
        onSave({
            ...formData, // Preserve other fields like allowedViews if they exist
            id: formData.id || `user_${Date.now()}`,
            name: formData.name!,
            password: formData.password || '1234',
            role: formData.role!,
            holidayEntitlement: Number(formData.holidayEntitlement) || 0,
            holidayApproverId: formData.holidayApproverId || 'user_admin',
            engineerId: formData.role === 'Engineer' ? (formData.engineerId || `eng_${Date.now()}`) : undefined
        } as User);
    };

    return (
        <FormModal isOpen={isOpen} onClose={onClose} onSave={handleSave} title={user ? "Edit User" : "Add User"}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input name="name" value={formData.name || ''} onChange={handleChange} className="w-full p-2 border rounded" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input name="password" type="text" value={formData.password || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Set password" />
                    <p className="text-xs text-gray-500 mt-1">Default is 1234</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select name="role" value={formData.role || ''} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                        {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Holiday Entitlement (Days)</label>
                    <input name="holidayEntitlement" type="number" value={formData.holidayEntitlement || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                </div>
            </div>
        </FormModal>
    );
};
export default UserFormModal;