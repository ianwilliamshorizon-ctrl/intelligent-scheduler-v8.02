import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../core/state/DataContext';
import { useApp } from '../core/state/AppContext';
import { 
    Job, Vehicle, Customer, Estimate, EstimateLineItem, 
    Part, RentalBooking, PurchaseOrder, JobSegment
} from '../types';
import { 
    X, Save, Wrench, DollarSign, Loader2, 
    Trash2, Plus, Search, User, 
    AlertTriangle, History, ClipboardList,
    ArrowRight, Info, Layers
} from 'lucide-react';
import { formatDate } from '../core/utils/dateUtils';
import { generateEstimateNumber, generatePurchaseOrderId } from '../core/utils/numberGenerators';

// --- FIXED IMPORTS ---
import JobDetailsTab from './jobs/tabs/JobDetailsTab'; 
import { JobEstimateTab } from './jobs/tabs/JobEstimateTab';
import { JobInspectionTab } from './jobs/tabs/JobInspectionTab';

import { useDebouncedSave } from '../core/hooks/useDebouncedSave';
import { initialChecklistData, initialTyreCheckData } from '../core/data/initialChecklistData';
import { getWhere } from '../core/db';

const EditJobModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    selectedJobId: string;
    onOpenPurchaseOrder: (po: PurchaseOrder) => void;
    rentalBookings: RentalBooking[];
    onOpenRentalBooking: (booking: Partial<RentalBooking> | null) => void;
    onOpenConditionReport: (booking: RentalBooking, mode: 'checkOut' | 'checkIn') => void;
    onRaiseSupplementaryEstimate: (job: Job) => void;
    onViewEstimate: (estimate: Estimate) => void;
    onViewCustomer: (customerId: string) => void;
    onViewVehicle: (vehicleId: string) => void;
}> = ({ 
    isOpen, onClose, selectedJobId, onOpenPurchaseOrder, 
    onViewCustomer
}) => {
    // 1. STATE & CONTEXT
    const {
        jobs, setJobs, vehicles, customers, estimates, 
        setEstimates, purchaseOrders, setPurchaseOrders,
        taxRates
    } = useData();
    const { currentUser } = useApp();

    const sourceJob = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);
    
    const [editableJob, setEditableJob] = useState<Job | null>(null);
    const [editableEstimate, setEditableEstimate] = useState<Estimate | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'estimate' | 'inspection' | 'notes' | 'segments' | 'history'>('details');
    const [newObservation, setNewObservation] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const loadedJobIdRef = useRef<string | null>(null);

    // Search & Filter States
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);

    // Auto-Sync Hook
    const { isSaving } = useDebouncedSave('brooks_jobs', editableJob, 2000);

    // 2. INITIALIZATION EFFECT
    useEffect(() => {
        if (isOpen && sourceJob && loadedJobIdRef.current !== selectedJobId) {
            const jobCopy = JSON.parse(JSON.stringify(sourceJob)) as Job;
            
            if (!jobCopy.inspectionChecklist || jobCopy.inspectionChecklist.length === 0) {
                jobCopy.inspectionChecklist = JSON.parse(JSON.stringify(initialChecklistData));
            }
            if (!jobCopy.tyreCheck) {
                jobCopy.tyreCheck = JSON.parse(JSON.stringify(initialTyreCheckData));
            }
            if (!jobCopy.damagePoints) jobCopy.damagePoints = [];
            
            // FIX: Line 85 error - Object literal may only specify known properties
            if (!jobCopy.segments) {
                jobCopy.segments = [{ 
                    id: `seg_init`,
                    title: 'Initial Phase',
                    status: 'Unallocated', 
                    laborItems: [], 
                    partItems: [] 
                } as any];
            }

            setEditableJob(jobCopy);
            loadedJobIdRef.current = selectedJobId;

            if (jobCopy.estimateId) {
                const linkedEstimate = estimates.find(e => e.id === jobCopy.estimateId);
                if (linkedEstimate) {
                    setEditableEstimate(JSON.parse(JSON.stringify(linkedEstimate)));
                }
            } else {
                setEditableEstimate({
                    id: `${jobCopy.id}_temp_est`,
                    estimateNumber: 'DRAFT',
                    customerId: jobCopy.customerId,
                    vehicleId: jobCopy.vehicleId,
                    lineItems: [],
                    status: 'Draft',
                    totalAmount: 0,
                    taxAmount: 0
                } as any);
            }
        }
        
        if (!isOpen) {
            loadedJobIdRef.current = null;
            setEditableJob(null);
            setEditableEstimate(null);
            setActiveTab('details');
        }
    }, [isOpen, selectedJobId, sourceJob, estimates]);

    // 3. MEMOS & CALCULATIONS
    const allocationConflicts = useMemo(() => {
        if (!editableJob) return [];
        return jobs.filter(j => 
            j.vehicleId === editableJob.vehicleId && 
            j.id !== editableJob.id && 
            !['Closed', 'Cancelled', 'Invoiced'].includes(j.status)
        );
    }, [editableJob, jobs]);

    const customer = useMemo(() => editableJob ? customers.find(c => c.id === editableJob.customerId) : undefined, [editableJob, customers]);

    // 4. HANDLERS
    const handleSelectCustomer = (c: Customer) => {
        setEditableJob(prev => prev ? { ...prev, customerId: c.id } : null);
        setCustomerSearchTerm('');
        setFilteredCustomers([]);
    };

    useEffect(() => {
        if (!customerSearchTerm || customerSearchTerm.length < 2) {
            setFilteredCustomers([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const results = await getWhere<Customer>('brooks_customers', 'surname', '>=', customerSearchTerm);
                setFilteredCustomers(results.filter(c => 
                    c.surname.toLowerCase().includes(customerSearchTerm.toLowerCase()) || 
                    c.forename.toLowerCase().includes(customerSearchTerm.toLowerCase())
                ).slice(0, 10));
            } catch (err) { console.error(err); }
        }, 400);
        return () => clearTimeout(timer);
    }, [customerSearchTerm]);

    // FIX: Line 163 error - adding 'as any' to allow dynamic properties
    const handleAddSegment = () => {
        if (!editableJob) return;
        const newSegment = {
            id: `seg_${Date.now()}`,
            title: 'New Segment',
            status: 'Unallocated',
            laborItems: [],
            partItems: []
        } as any;
        
        setEditableJob({
            ...editableJob,
            segments: [...(editableJob.segments || []), newSegment]
        });
    };

    const handleUpdateSegment = (index: number, updates: any) => {
        if (!editableJob || !editableJob.segments) return;
        const newSegments = [...editableJob.segments];
        newSegments[index] = { ...newSegments[index], ...updates };
        setEditableJob({ ...editableJob, segments: newSegments });
    };

    const handleRemoveSegment = (index: number) => {
        if (!editableJob || !editableJob.segments || editableJob.segments.length === 1) return;
        setEditableJob({
            ...editableJob,
            segments: editableJob.segments.filter((_, i) => i !== index)
        });
    };

    const handleAddNote = () => {
        if (!newObservation.trim() || !editableJob) return;
        const note = {
            id: `note_${Date.now()}`,
            text: newObservation,
            timestamp: new Date().toISOString(),
            author: currentUser?.name || 'Unknown'
        };
        setEditableJob({ ...editableJob, notes: [...(editableJob.notes || []), note] });
        setNewObservation('');
    };

    const isReadOnly = !!editableJob?.invoiceId;

    const handleSave = async () => {
        if (!editableJob || isReadOnly) { onClose(); return; }
        setIsProcessing(true);
        try {
            let jobToSave = { ...editableJob };
            if (editableEstimate) {
                if (editableEstimate.id.includes('_temp_est')) {
                    if (editableEstimate.lineItems.length > 0) {
                        const finalEst: Estimate = {
                            ...editableEstimate,
                            id: `est_${Date.now()}`,
                            estimateNumber: generateEstimateNumber(estimates, 'BS')
                        };
                        setEstimates([...estimates, finalEst]);
                        jobToSave.estimateId = finalEst.id;
                    }
                } else {
                    setEstimates(estimates.map(e => e.id === editableEstimate.id ? editableEstimate : e));
                }
            }
            setJobs(jobs.map(j => (j.id === jobToSave.id ? jobToSave : j)));
            onClose();
        } catch (err) { console.error(err); } finally { setIsProcessing(false); }
    };

    if (!isOpen || !editableJob) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[98vw] h-[95vh] flex flex-col overflow-hidden border border-gray-200">
                
                <header className="flex-shrink-0 flex justify-between items-center px-6 py-4 border-b bg-white">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                            <Wrench size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-gray-900">Job #{editableJob.id}</h2>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                    editableJob.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                    editableJob.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                    {editableJob.status}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 font-medium">{editableJob.description || 'No description'}</p>
                        </div>
                        {allocationConflicts.length > 0 && (
                            <div className="ml-4 flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[10px] font-black uppercase animate-pulse">
                                <AlertTriangle size={14} /> Conflicts: {allocationConflicts.length}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {(isSaving || isProcessing) && (
                            <div className="flex items-center gap-2 text-xs font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
                                <Loader2 size={14} className="animate-spin" /> SYNCING
                            </div>
                        )}
                        <button 
                            onClick={handleSave} 
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-black transition-all shadow-lg shadow-gray-200"
                        >
                            <Save size={18} /> COMPLETE & CLOSE
                        </button>
                        <button onClick={onClose} className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors text-gray-400">
                            <X size={24} />
                        </button>
                    </div>
                </header>

                <nav className="flex-shrink-0 flex gap-1 px-6 py-2 bg-white border-b">
                    {[
                        { id: 'details', icon: Info, label: 'Core Details' },
                        { id: 'estimate', icon: DollarSign, label: 'Estimate & Billing' },
                        { id: 'inspection', icon: ClipboardList, label: 'Inspection' },
                        { id: 'segments', icon: Layers, label: 'Repair Segments' },
                        { id: 'history', icon: History, label: 'Notes & Logs' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                activeTab === tab.id 
                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            <tab.icon size={16} /> {tab.label}
                        </button>
                    ))}
                </nav>

                <main className="flex-grow overflow-hidden flex bg-gray-50/50">
                    <aside className="w-80 border-r bg-white overflow-y-auto p-5 space-y-6 flex-shrink-0">
                        <section className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                <User size={14}/> Customer
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                <input 
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                                    placeholder="Search..." 
                                    value={customerSearchTerm || ''} 
                                    onChange={e => setCustomerSearchTerm(e.target.value)}
                                    disabled={isReadOnly}
                                />
                                {filteredCustomers.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                        {filteredCustomers.map(c => (
                                            <button key={c.id} onClick={() => handleSelectCustomer(c)} className="w-full text-left p-3 hover:bg-indigo-50 border-b last:border-0 transition-colors">
                                                <div className="text-sm font-bold text-gray-900">{c.forename} {c.surname}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {customer && (
                                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                    <p className="text-sm font-black text-indigo-900">{customer.forename} {customer.surname}</p>
                                    <p className="text-xs text-indigo-600">{customer.email || 'No email'}</p>
                                    <button onClick={() => onViewCustomer(customer.id)} className="mt-2 text-[10px] font-black text-indigo-600 flex items-center gap-1 hover:underline">
                                        VIEW PROFILE <ArrowRight size={10} />
                                    </button>
                                </div>
                            )}
                        </section>
                    </aside>

                    <div className="flex-grow overflow-y-auto">
                        {activeTab === 'details' && <JobDetailsTab job={editableJob} />}
                        {activeTab === 'estimate' && <JobEstimateTab job={editableJob} estimate={editableEstimate} setEstimate={setEditableEstimate} />}
                        {activeTab === 'inspection' && <JobInspectionTab job={editableJob} setJob={setEditableJob} />}
                        {activeTab === 'segments' && (
                            <div className="p-6 space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-black text-gray-900">Job Segments</h3>
                                    <button onClick={handleAddSegment} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">
                                        <Plus size={18} /> Add Segment
                                    </button>
                                </div>
                                {editableJob.segments?.map((segment: any, index: number) => (
                                    <div key={segment.id || index} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-4">
                                        <div className="p-4 bg-gray-50 flex justify-between items-center">
                                            {/* FIX: Line 356 error - using 'title' from segment cast as any */}
                                            <input 
                                                className="bg-transparent font-bold text-gray-900 focus:outline-none flex-grow"
                                                value={segment.title || ''}
                                                onChange={(e) => handleUpdateSegment(index, { title: e.target.value })}
                                                placeholder="Segment Name"
                                            />
                                            <button onClick={() => handleRemoveSegment(index)} className="text-gray-400 hover:text-red-500 ml-4">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {activeTab === 'history' && (
                           <div className="h-full flex flex-col">
                               <div className="flex-grow p-6 space-y-4 overflow-y-auto">
                                   {editableJob.notes?.map(note => (
                                       <div key={note.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                           <div className="flex justify-between mb-2">
                                               <span className="text-xs font-black text-indigo-600 uppercase">{note.author}</span>
                                               <span className="text-[10px] font-bold text-gray-400">{formatDate(note.timestamp)}</span>
                                           </div>
                                           <p className="text-sm text-gray-700">{note.text}</p>
                                       </div>
                                   ))}
                               </div>
                               <div className="p-4 bg-white border-t flex gap-3">
                                   <textarea 
                                       className="flex-grow p-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                       rows={2}
                                       placeholder="Add note..."
                                       value={newObservation || ''}
                                       onChange={e => setNewObservation(e.target.value)}
                                   />
                                   <button onClick={handleAddNote} className="px-6 bg-indigo-600 text-white font-black rounded-xl text-xs">SAVE</button>
                               </div>
                           </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default EditJobModal;