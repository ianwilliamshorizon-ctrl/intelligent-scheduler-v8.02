import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { useManagementTable } from '../hooks/useManagementTable';
import { saveDocument, deleteDocument } from '../../../core/db';
import { 
    User, ShieldCheck, Mail, Phone, Edit, Trash2, 
    UserPlus, Users as UsersIcon, Wrench, X, Lock, Save,
    MapPin, Building2
} from 'lucide-react';

export const ManagementStaffTab = () => {
    const { 
        users = [], 
        engineers = [], 
        roles = [], 
        businessEntities = [] 
    } = useData();
    
    const { updateItem, deleteItem } = useManagementTable(users, 'brooks_users');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<any>(null);

    const filteredStaff = users.filter(u => 
        (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const getIsEngineer = (userId: string) => engineers.some(e => e.userId === userId || e.id === userId);

    const handleOpenModal = (staff: any = null) => {
        const isEng = staff ? getIsEngineer(staff.id) : false;
        setEditingStaff(staff ? { ...staff, isEngineer: isEng } : { 
            name: '', 
            email: '', 
            role: roles[0]?.name || 'Staff', 
            entityId: businessEntities[0]?.id || '', // Link to first entity by default
            phone: '', 
            password: '',
            isEngineer: false 
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const userId = editingStaff.id || crypto.randomUUID();
            const staffData = { ...editingStaff, id: userId };
            const isEngToggle = editingStaff.isEngineer;
            
            // Clean UI-only state before saving to Firestore
            delete staffData.isEngineer;

            // 1. Save User Profile (includes entityId/Location)
            if (editingStaff.id) {
                await updateItem(staffData);
            } else {
                await saveDocument('brooks_users', staffData);
            }

            // 2. Sync Engineer Collection (for timeline visibility)
            if (isEngToggle) {
                const existingEng = engineers.find(e => e.userId === userId || e.id === userId);
                if (!existingEng) {
                    await saveDocument('brooks_engineers', {
                        id: userId,
                        userId: userId,
                        name: editingStaff.name,
                        entityId: editingStaff.entityId, // Pass location to engineer record
                        status: 'available'
                    });
                }
            } else {
                const existingEng = engineers.find(e => e.userId === userId || e.id === userId);
                if (existingEng) {
                    await deleteDocument('brooks_engineers', existingEng.id);
                }
            }

            setIsModalOpen(false);
        } catch (err) {
            console.error("Failed to save staff:", err);
            alert("Failed to save changes.");
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <div className="relative w-72">
                    <input
                        type="text"
                        placeholder="Search staff..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <User className="absolute left-3 top-2.5 text-gray-400" size={16} />
                </div>
                <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-sm">
                    <UserPlus size={16} /> Add Staff
                </button>
            </div>

            <div className="bg-gray-50 border border-b-0 border-gray-200 rounded-t-lg flex items-center px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div className="w-10"></div>
                <div className="flex-1">Name & Role</div>
                <div className="flex-1">Contact Information</div>
                <div className="w-40">Location</div> {/* Replaced Type with Location */}
                <div className="w-24 text-right">Actions</div>
            </div>

            <div className="border border-gray-200 rounded-b-lg divide-y divide-gray-100 bg-white overflow-hidden">
                {filteredStaff.map((member) => {
                    const entity = businessEntities.find(be => be.id === member.entityId);
                    return (
                        <div key={member.id} className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors group">
                            <div className="w-10">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold uppercase">
                                    {member.name?.charAt(0) || '?'}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{member.name}</div>
                                <div className="flex items-center gap-1 text-[11px] text-indigo-600 font-medium uppercase">
                                    <ShieldCheck size={10} /> {member.role || 'Staff'}
                                    {getIsEngineer(member.id) && <span className="ml-2 text-green-600 font-bold">• Engineer</span>}
                                </div>
                            </div>
                            <div className="flex-1 space-y-0.5 text-sm text-gray-600">
                                <div className="flex items-center gap-2 truncate"><Mail size={12} className="text-gray-400" />{member.email}</div>
                                {member.phone && <div className="flex items-center gap-2"><Phone size={12} className="text-gray-400" />{member.phone}</div>}
                            </div>
                            
                            {/* Location Column */}
                            <div className="w-40 flex flex-col">
                                <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                                    <MapPin size={12} className="text-indigo-500" />
                                    {entity?.name || 'Unassigned'}
                                </div>
                                <div className="text-[10px] text-gray-400 uppercase font-bold ml-4">
                                    {entity?.city || 'Default'}
                                </div>
                            </div>

                            <div className="w-24 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal(member)} className="p-1.5 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-md"><Edit size={16} /></button>
                                <button onClick={() => deleteItem(member.id)} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-md"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <form onSubmit={handleSave} className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden mx-4">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">{editingStaff?.id ? 'Edit Staff Details' : 'Add New Staff'}</h3>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                                <input required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingStaff.name} onChange={e => setEditingStaff({...editingStaff, name: e.target.value})} />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                    <input type="email" required className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingStaff.email} onChange={e => setEditingStaff({...editingStaff, email: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Primary Location</label>
                                    <select 
                                        className="w-full px-3 py-2 border rounded-lg outline-none bg-white" 
                                        value={editingStaff.entityId} 
                                        onChange={e => setEditingStaff({...editingStaff, entityId: e.target.value})}
                                    >
                                        {businessEntities.map((be: any) => (
                                            <option key={be.id} value={be.id}>{be.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">System Role</label>
                                <select className="w-full px-3 py-2 border rounded-lg outline-none bg-white" value={editingStaff.role} onChange={e => setEditingStaff({...editingStaff, role: e.target.value})}>
                                    {roles.map((r: any) => <option key={r.id} value={r.name}>{r.name}</option>)}
                                </select>
                            </div>

                            <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <Wrench size={16} className={editingStaff.isEngineer ? "text-indigo-600" : "text-gray-400"} />
                                        <span className="text-sm font-semibold text-gray-700">Deploy as Field Engineer?</span>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={editingStaff.isEngineer}
                                        onChange={e => setEditingStaff({...editingStaff, isEngineer: e.target.checked})}
                                    />
                                </label>
                            </div>

                            <div className="pt-2 border-t">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Lock size={12}/> Security Password</label>
                                <input type="password" placeholder="••••••••" className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingStaff.password || ''} onChange={e => setEditingStaff({...editingStaff, password: e.target.value})} />
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg">Cancel</button>
                            <button type="submit" className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-2">
                                <Save size={16}/> Save Staff Profile
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};