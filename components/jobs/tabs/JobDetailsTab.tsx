import React, { useState, useMemo } from 'react';
import * as T from '../../../types';
import { Car, User, KeyRound, Edit, Phone, Mail, MapPin, Building, Briefcase, Expand, ImageIcon, X, Gauge, Info, Wrench, DollarSign, Printer, CheckCircle } from 'lucide-react';
import { HoverInfo } from '../../shared/HoverInfo';
import SpeechToTextButton from '../../shared/SpeechToTextButton';
import LiveAssistant from '../../LiveAssistant';
import { usePrint } from '../../../core/hooks/usePrint';
import { formatCurrency } from '../../../core/utils/formatUtils';
import { formatDate } from '../../../core/utils/dateUtils';

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
    allJobs: T.Job[];
    onUpdateLinkedJob: (jobId: string, updates: Partial<T.Job>) => void;
}

const JobDetailsTab: React.FC<JobDetailsTabProps> = ({ 
    editableJob, vehicle, customer, isReadOnly, purchaseOrders, onOpenPurchaseOrder, onChange, onViewCustomer, onViewVehicle, allJobs, onUpdateLinkedJob 
}) => {
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [hasDeposit, setHasDeposit] = useState(!!editableJob.depositAmount);
    
    const printComponent = usePrint();

    const handlePrintReceipt = () => {
        const businessEntity = editableJob.entityId ? (allJobs as any)._businessEntities?.find((e: any) => e.id === editableJob.entityId) : null;
        // Wait, allJobs is T.Job[]. I need access to business entities.
        // I'll assume for now I can pass what I need or find it.
    };
    
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

    const linkedMotJob = useMemo(() => {
        if (!editableJob.associatedJobId) return null;
        return (allJobs || []).find(j => j.id === editableJob.associatedJobId);
    }, [allJobs, editableJob.associatedJobId]);


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

            <TabSection title="Financial Deposit" icon={DollarSign}>
                <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-gray-700">Record Deposit?</label>
                        <button 
                            type="button" 
                            onClick={() => {
                                const newVal = !hasDeposit;
                                setHasDeposit(newVal);
                                if (!newVal) {
                                    onChange({ target: { name: 'depositAmount', value: '0' } } as any);
                                }
                            }}
                            className={`w-10 h-5 rounded-full transition-colors relative ${hasDeposit ? 'bg-indigo-600' : 'bg-gray-300'}`}
                            disabled={isReadOnly}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${hasDeposit ? 'left-5' : 'left-0.5'}`} />
                        </button>
                    </div>

                    {hasDeposit && (
                        <div className="space-y-3 pt-2 border-t border-gray-100 animate-fade-in">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Amount (£)</label>
                                    <input 
                                        type="number" 
                                        name="depositAmount"
                                        value={editableJob.depositAmount || ''} 
                                        onChange={onChange}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-bold bg-white"
                                        placeholder="0.00"
                                        disabled={isReadOnly}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Method</label>
                                    <select 
                                        name="depositMethod"
                                        value={editableJob.depositMethod || 'BACS'} 
                                        onChange={onChange}
                                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs bg-white"
                                        disabled={isReadOnly}
                                    >
                                        <option value="BACS">BACS</option>
                                        <option value="Card">Card</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            
                            {editableJob.depositAmount > 0 && (
                                <button 
                                    type="button"
                                    onClick={() => {
                                        // We need to trigger printing. 
                                        // This requires passing the print handler or entity details down.
                                        // I will implement a custom event or callback.
                                        const event = new CustomEvent('print-deposit-receipt', { detail: editableJob });
                                        window.dispatchEvent(event);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-2 rounded-lg font-bold text-xs hover:bg-indigo-100 transition-all border border-indigo-200"
                                >
                                    <Printer size={14} /> PRINT RECEIPT
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </TabSection>

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

            {linkedMotJob && (
                <TabSection title="Linked MOT Booking" icon={Wrench}>
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">MOT Job Reference</label>
                            <div className="flex items-center justify-between p-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <span className="font-mono font-bold text-indigo-700">#{linkedMotJob.id}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${linkedMotJob.status === 'Complete' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                    {linkedMotJob.status}
                                </span>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="mot-date" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">MOT Test Date</label>
                            <input 
                                type="date" 
                                id="mot-date"
                                value={linkedMotJob.scheduledDate || ''} 
                                onChange={(e) => onUpdateLinkedJob(linkedMotJob.id, { scheduledDate: e.target.value })}
                                className="w-full p-2 border rounded-lg bg-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                                disabled={isReadOnly || linkedMotJob.status === 'Complete'}
                            />
                            <p className="text-[10px] text-gray-500 mt-1 italic">Note: Updates to this date will automatically shift the linked MOT slot.</p>
                        </div>
                    </div>
                </TabSection>
            )}

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
                <div className="p-3 relative">
                    <textarea 
                        name="notes" 
                        value={editableJob.notes || ''} 
                        onChange={onChange} 
                        rows={8} 
                        className="w-full p-2 pr-10 border rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none bg-indigo-50/20" 
                        placeholder="Add internal notes for the workshop staff..." 
                        disabled={isReadOnly} 
                    />
                    <div className="absolute top-5 right-5">
                        <SpeechToTextButton 
                            onTranscript={(text) => {
                                const current = editableJob.notes || '';
                                const space = current && !current.endsWith(' ') ? ' ' : '';
                                onChange({ target: { name: 'notes', value: current + space + text } } as any);
                            }}
                            disabled={isReadOnly}
                        />
                    </div>
                </div>
            </div>

            {isNotesModalOpen && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-[100] flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col scale-in">
                        <header className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-lg font-bold">Internal Workshop Notes</h2>
                            <button onClick={() => setIsNotesModalOpen(false)} className="hover:rotate-90 transition-transform"><X size={24} /></button>
                        </header>
                        <div className="flex-grow p-4 relative">
                            <textarea
                                value={editableJob.notes || ''}
                                onChange={onChange}
                                name="notes"
                                className="w-full h-full p-4 pr-12 border rounded-xl resize-none text-base focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50"
                                placeholder="Enter workshop notes..."
                                readOnly={isReadOnly}
                            />
                            <div className="absolute top-8 right-8">
                                <SpeechToTextButton 
                                    onTranscript={(text) => {
                                        const current = editableJob.notes || '';
                                        const space = current && !current.endsWith(' ') ? ' ' : '';
                                        onChange({ target: { name: 'notes', value: current + space + text } } as any);
                                    }}
                                    disabled={isReadOnly}
                                    className="scale-125"
                                />
                            </div>
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