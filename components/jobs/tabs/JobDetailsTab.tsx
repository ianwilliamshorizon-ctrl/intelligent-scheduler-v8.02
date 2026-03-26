import React, { useState, useMemo } from 'react';
import * as T from '../../../types';
import { Car, User, KeyRound, Edit, Phone, Mail, MapPin, Building, Briefcase, Expand, ImageIcon, X, Gauge, Info, Wrench } from 'lucide-react';
import { HoverInfo } from '../../shared/HoverInfo';
import LiveAssistant from '../../LiveAssistant';

interface TabSectionProps {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    action?: React.ReactNode;
}

const TabSection: React.FC<TabSectionProps> = ({ title, icon: Icon, children, action }) => (
    <div className="border rounded-lg bg-white shadow-sm">
        <h3 className="text-md font-bold p-3 flex justify-between items-center bg-gray-50 rounded-t-lg">
            <span className="flex items-center gap-2"><Icon size={16}/> {title}</span>
            {action && <span>{action}</span>}
        </h3>
        <div className="p-3 text-sm space-y-2">{children}</div>
    </div>
);

interface JobDetailsTabProps {
    editableJob: T.Job;
    vehicle?: T.Vehicle;
    customer?: T.Customer;
    isReadOnly: boolean;
    purchaseOrders: T.PurchaseOrder[];
    onOpenPurchaseOrder: (po: T.PurchaseOrder) => void;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onViewCustomer: (customerId: string) => void;
    onViewVehicle: (vehicleId: string) => void;
}

const JobDetailsTab: React.FC<JobDetailsTabProps> = ({ 
    editableJob, vehicle, customer, isReadOnly, purchaseOrders, onOpenPurchaseOrder, onChange, onViewCustomer, onViewVehicle 
}) => {
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    
    const handleNotesSave = (newNotes: string) => {
        onChange({ target: { name: 'notes', value: newNotes } } as React.ChangeEvent<HTMLTextAreaElement>);
        setIsNotesModalOpen(false);
    };

    const handleAddNoteFromAssistant = (note: string) => {
        const newNotes = `${editableJob.notes || ''}\n\n--- Assistant Note ---\n${note}`;
        onChange({ target: { name: 'notes', value: newNotes } } as React.ChangeEvent<HTMLTextAreaElement>);
    };

    const jobPOs = useMemo(() => {
        const poIds = editableJob.purchaseOrderIds || [];
        return purchaseOrders.filter(po => poIds.includes(po.id) || po.jobId === editableJob.id);
    }, [editableJob.purchaseOrderIds, editableJob.id, purchaseOrders]);
    
    const customerInfoData = customer ? {
        phone: customer.phone || customer.mobile || 'N/A',
        email: customer.email || 'N/A',
        address: `${customer.addressLine1 || ''}, ${customer.postcode || ''}`.replace(/^,|,$/g, '').trim() || 'N/A',
        company: customer.companyName || 'N/A',
    } : {};

    const vehicleInfoData = vehicle ? {
        type: `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'N/A',
        colour: vehicle.colour || 'N/A',
        'Year of Manufacture': vehicle.manufactureDate || 'N/A',
        vin: vehicle.vin || 'N/A',
        motDue: vehicle.nextMotDate || 'N/A',
    } : {};


    return (
        <div className="space-y-4 pb-10">
             <TabSection title="Key Details" icon={KeyRound}>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex items-center gap-2"><KeyRound size={14} className="text-gray-500"/><strong>Key #:</strong> 
                        {isReadOnly ? (
                            <span className="font-semibold">{editableJob.keyNumber || 'N/A'}</span>
                        ) : (
                            <input type="text" name="keyNumber" value={editableJob.keyNumber || ''} onChange={onChange} className="p-1 border rounded bg-white text-sm w-full" />
                        )}
                    </div>
                     <div className="flex items-center gap-2"><Gauge size={14} className="text-gray-500"/><strong>Mileage:</strong> 
                        {isReadOnly ? (
                            <span className="font-semibold">
                                {editableJob.mileage ? `${Number(editableJob.mileage).toLocaleString()} mi` : 'N/A'}
                            </span>
                        ) : (
                            <input type="text" name="mileage" value={editableJob.mileage || ''} onChange={onChange} className="p-1 border rounded bg-white text-sm w-full" />
                        )}
                    </div>
                </div>
            </TabSection>

            {customer && (
                <TabSection 
                    title="Customer" 
                    icon={User}
                    action={
                        <HoverInfo title="Customer Info" data={customerInfoData}>
                             <Info size={14} className="text-gray-400 cursor-pointer" />
                        </HoverInfo>
                    }
                >
                     <div className="flex items-center justify-between">
                        <p className="font-bold text-base">{customer.forename} {customer.surname}</p>
                        <button type="button" onClick={() => onViewCustomer(customer.id)} className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100 font-semibold shadow-sm">View Profile</button>
                    </div>
                </TabSection>
            )}
            
            {vehicle && (
                <TabSection 
                    title="Vehicle" 
                    icon={Car}
                    action={
                        <HoverInfo title="Vehicle Info" data={vehicleInfoData}>
                             <Info size={14} className="text-gray-400 cursor-pointer" />
                        </HoverInfo>
                    }
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-base flex items-center gap-2">
                                {vehicle.registration}
                                <span className="bg-yellow-400 text-black px-1 rounded text-[10px] font-black border border-black/10">UK</span>
                            </p>
                            <p className="text-gray-600 text-xs font-semibold">{vehicle.make} {vehicle.model}</p>
                        </div>
                        <button type="button" onClick={() => onViewVehicle(vehicle.id)} className="text-xs bg-white border border-gray-300 px-2 py-1 rounded hover:bg-gray-100 font-semibold shadow-sm">View Specs</button>
                    </div>
                </TabSection>
            )}

            <TabSection title="Purchase Orders" icon={Briefcase}>
                <div className="space-y-2">
                    {jobPOs.length > 0 ? (
                        <div className="space-y-1">
                            {jobPOs.map(po => (
                                <div key={po.id} onClick={() => onOpenPurchaseOrder(po)} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200 hover:border-indigo-400 cursor-pointer group transition-all">
                                    <div className="flex flex-col">
                                        <span className="font-mono font-bold text-indigo-700 text-xs flex items-center gap-1 group-hover:text-indigo-800">
                                            #{po.id}
                                            <Wrench size={10} className="hidden group-hover:block" />
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-medium">Supplier {po.supplierId || 'N/A'}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        po.status === 'Received' ? 'bg-green-100 text-green-700' :
                                        po.status === 'Ordered' ? 'bg-blue-100 text-blue-700' :
                                        po.status === 'Draft' ? 'bg-gray-100 text-gray-700' :
                                        'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {po.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-4 text-gray-400 italic text-xs border-2 border-dashed border-gray-100 rounded-lg">
                            No orders raised yet
                        </div>
                    )}
                </div>
            </TabSection>

            <TabSection title="Job Status" icon={Briefcase}>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <label htmlFor="status" className="font-semibold text-xs text-gray-500 uppercase">Current Stage</label>
                        <select id="status" name="status" value={editableJob.status} onChange={onChange} className="p-1.5 border rounded-lg bg-white text-sm w-full font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 transition-all" disabled={isReadOnly}>
                            <option value="Booked In">Booked In</option>
                            <option value="Allocated">Allocated</option>
                            <option value="Unallocated">Unallocated</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Awaiting Parts">Awaiting Parts</option>
                            <option value="Awaiting Customer">Awaiting Customer</option>
                            <option value="Awaiting Collection">Awaiting Collection</option>
                            <option value="Ready for Invoicing">Ready for Invoicing</option>
                            <option value="Invoiced">Invoiced</option>
                            <option value="Complete">Complete</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>
                </div>
            </TabSection>

            <TabSection title="AI Assistant" icon={Wrench}>
                <button
                    type="button"
                    onClick={() => setIsAssistantOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-900 text-white rounded-xl font-bold text-sm shadow-md hover:bg-black transition-all active:scale-95"
                >
                    <Wrench size={14} /> Open Live Assistant
                </button>
            </TabSection>

             <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
                <h3 className="text-md font-bold p-3 flex justify-between items-center bg-gray-50 border-b">
                    <span className="flex items-center gap-2"><ImageIcon size={16}/> Internal Notes</span>
                    <button type="button" onClick={() => setIsNotesModalOpen(true)} className="text-[10px] uppercase font-black tracking-widest bg-white border border-gray-200 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-50 transition-all"><Expand size={12}/> Fullscreen</button>
                </h3>
                <div className="p-3">
                    <textarea 
                        name="notes" 
                        value={editableJob.notes || ''} 
                        onChange={onChange} 
                        rows={8} 
                        className="w-full p-2 border rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none bg-indigo-50/20" 
                        placeholder="Add internal notes for the workshop staff..." 
                        disabled={isReadOnly} 
                    />
                </div>
            </div>

            {isNotesModalOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[100] flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col scale-in">
                        <header className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-lg font-bold">Internal Workshop Notes</h2>
                            <button onClick={() => setIsNotesModalOpen(false)} className="hover:rotate-90 transition-transform"><X size={24} /></button>
                        </header>
                        <div className="flex-grow p-4">
                            <textarea
                                value={editableJob.notes || ''}
                                onChange={onChange}
                                name="notes"
                                className="w-full h-full p-4 border rounded-xl resize-none text-base focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50"
                                placeholder="Enter workshop notes..."
                                readOnly={isReadOnly}
                            />
                        </div>
                        <footer className="p-4 border-t flex justify-end gap-2">
                            <button onClick={() => setIsNotesModalOpen(false)} className="px-6 py-2 bg-gray-200 rounded-xl font-bold hover:bg-gray-300 transition-all">Close</button>
                            {!isReadOnly && <button onClick={() => handleNotesSave(editableJob.notes || '')} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">Save Changes</button>}
                        </footer>
                    </div>
                </div>
            )}

            <LiveAssistant 
                isOpen={isAssistantOpen} 
                onClose={() => setIsAssistantOpen(false)} 
                jobId={editableJob.id} 
                onAddNote={handleAddNoteFromAssistant} 
            />
        </div>
    );
};

export default JobDetailsTab;