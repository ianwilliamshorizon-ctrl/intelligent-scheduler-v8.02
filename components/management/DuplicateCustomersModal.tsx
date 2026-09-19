import React, { useState, useMemo } from 'react';
import { 
    X, Copy, CheckCircle, Search, Trash2, GitMerge, Loader2, User, Phone, Mail, MapPin, 
    Car, ClipboardList, FileText, AlertTriangle, Building, ArrowRight, ShieldAlert 
} from 'lucide-react';
import { Customer, Vehicle, Job, Estimate, Invoice, Inquiry } from '../../types';
import { 
    findDuplicateCustomers, 
    mergeCustomerData, 
    getCustomerDependencyCounts,
    CustomerDuplicateGroup 
} from '../../core/utils/deduplicationUtils';
import { db } from '../../core/db';
import { writeBatch, doc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useData } from '../../core/state/DataContext';

interface DuplicateCustomersModalProps {
    isOpen: boolean;
    onClose: () => void;
    customers: Customer[];
    vehicles?: Vehicle[];
    jobs?: Job[];
    estimates?: Estimate[];
    invoices?: Invoice[];
    inquiries?: Inquiry[];
    onViewCustomer?: (customerId: string) => void;
}

export const DuplicateCustomersModal: React.FC<DuplicateCustomersModalProps> = ({
    isOpen,
    onClose,
    customers = [],
    vehicles = [],
    jobs = [],
    estimates = [],
    invoices = [],
    inquiries = [],
    onViewCustomer
}) => {
    const [matchMode, setMatchMode] = useState<'email' | 'phone' | 'name' | 'postcode_name'>('email');
    const [searchQuery, setSearchQuery] = useState('');
    const [processingGroupId, setProcessingGroupId] = useState<string | null>(null);
    const [selectedMasterIds, setSelectedMasterIds] = useState<Record<string, string>>({});
    const [selectedForMerge, setSelectedForMerge] = useState<Record<string, Set<string>>>({});
    const { forceRefresh } = useData();

    // Group duplicates
    const duplicateGroups = useMemo(() => {
        const rawGroups = findDuplicateCustomers(customers, matchMode);
        
        return rawGroups.filter(group => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                group.groupLabel.toLowerCase().includes(q) ||
                group.customers.some(c => 
                    c.id.toLowerCase().includes(q) ||
                    `${c.forename || ''} ${c.surname || ''}`.toLowerCase().includes(q) ||
                    (c.companyName || '').toLowerCase().includes(q) ||
                    (c.email || '').toLowerCase().includes(q) ||
                    (c.mobile || '').includes(q) ||
                    (c.phone || '').includes(q) ||
                    (c.postcode || '').toLowerCase().includes(q)
                )
            );
        });
    }, [customers, matchMode, searchQuery]);

    // Initialize master selection and inclusion state when groups change
    React.useEffect(() => {
        const initialMasters: Record<string, string> = {};
        const initialSelected: Record<string, Set<string>> = {};

        duplicateGroups.forEach(g => {
            // Pick customer with most dependencies or oldest as default master
            let bestCust = g.customers[0];
            let bestScore = -1;

            g.customers.forEach(c => {
                const dep = getCustomerDependencyCounts(c.id, vehicles, jobs, estimates, invoices, inquiries);
                const score = dep.total * 10 + (c.addressLine1 ? 5 : 0) + (c.email ? 2 : 0);
                if (score > bestScore) {
                    bestScore = score;
                    bestCust = c;
                }
            });

            initialMasters[g.key] = bestCust.id;
            initialSelected[g.key] = new Set(g.customers.map(c => c.id));
        });

        setSelectedMasterIds(initialMasters);
        setSelectedForMerge(initialSelected);
    }, [duplicateGroups, vehicles, jobs, estimates, invoices, inquiries]);

    if (!isOpen) return null;

    const toggleCustomerInGroup = (groupKey: string, custId: string) => {
        setSelectedForMerge(prev => {
            const current = new Set(prev[groupKey] || []);
            if (current.has(custId)) {
                current.delete(custId);
            } else {
                current.add(custId);
            }
            return { ...prev, [groupKey]: current };
        });
    };

    const handleSelectMaster = (groupKey: string, masterId: string) => {
        setSelectedMasterIds(prev => ({ ...prev, [groupKey]: masterId }));
        // Ensure master is included in selection
        setSelectedForMerge(prev => {
            const current = new Set(prev[groupKey] || []);
            current.add(masterId);
            return { ...prev, [groupKey]: current };
        });
    };

    /**
     * Executes merge: consolidates attributes into master, updates all dependent records in Firestore,
     * deletes duplicates, and refreshes the data context.
     */
    const handleMergeGroup = async (group: CustomerDuplicateGroup) => {
        const masterId = selectedMasterIds[group.key];
        const groupSelected = selectedForMerge[group.key] || new Set();

        const master = group.customers.find(c => c.id === masterId);
        const secondaries = group.customers.filter(c => c.id !== masterId && groupSelected.has(c.id));

        if (!master) {
            toast.error("Please choose a master customer to keep.");
            return;
        }

        if (secondaries.length === 0) {
            toast.info("No secondary duplicates selected to merge.");
            return;
        }

        const confirmMsg = `Merge ${secondaries.length} duplicate customer(s) into Master record [${master.id} - ${master.forename} ${master.surname}]?\n\nAll linked vehicles, jobs, invoices, estimates, and inquiries will be re-assigned to ${master.id}. This cannot be undone.`;
        if (!window.confirm(confirmMsg)) return;

        setProcessingGroupId(group.key);

        try {
            const batch = writeBatch(db);
            const secondaryIds = new Set(secondaries.map(s => s.id));

            // 1. Merge customer fields
            const mergedMaster = mergeCustomerData(master, secondaries);
            const masterRef = doc(db, 'brooks_customers', master.id);
            batch.set(masterRef, { ...mergedMaster, updatedAt: new Date().toISOString() }, { merge: true });

            let reLinkedVehicles = 0;
            let reLinkedJobs = 0;
            let reLinkedInvoices = 0;
            let reLinkedEstimates = 0;
            let reLinkedInquiries = 0;

            // 2. Re-link vehicles
            vehicles.forEach(v => {
                if (secondaryIds.has(v.customerId || (v as any).customerid)) {
                    batch.update(doc(db, 'brooks_vehicles', v.id), { customerId: master.id });
                    reLinkedVehicles++;
                }
            });

            // 3. Re-link jobs
            jobs.forEach(j => {
                if (secondaryIds.has(j.customerId)) {
                    batch.update(doc(db, 'brooks_jobs', j.id), { customerId: master.id });
                    reLinkedJobs++;
                }
            });

            // 4. Re-link invoices
            invoices.forEach(inv => {
                if (secondaryIds.has(inv.customerId)) {
                    batch.update(doc(db, 'brooks_invoices', inv.id), { customerId: master.id });
                    reLinkedInvoices++;
                }
            });

            // 5. Re-link estimates
            estimates.forEach(est => {
                if (secondaryIds.has(est.customerId)) {
                    batch.update(doc(db, 'brooks_estimates', est.id), { customerId: master.id });
                    reLinkedEstimates++;
                }
            });

            // 6. Re-link inquiries
            inquiries.forEach(inq => {
                if (secondaryIds.has(inq.linkedCustomerId)) {
                    batch.update(doc(db, 'brooks_inquiries', inq.id), { linkedCustomerId: master.id });
                    reLinkedInquiries++;
                }
            });

            // 7. Delete duplicates from brooks_customers
            secondaries.forEach(sec => {
                batch.delete(doc(db, 'brooks_customers', sec.id));
            });

            await batch.commit();

            // Refresh data context
            await Promise.all([
                forceRefresh('brooks_customers' as any),
                forceRefresh('brooks_vehicles' as any),
                forceRefresh('brooks_jobs' as any),
                forceRefresh('brooks_invoices' as any),
                forceRefresh('brooks_estimates' as any)
            ]);

            toast.success(
                `Merged into ${master.id}! Re-linked: ${reLinkedVehicles} vehicles, ${reLinkedJobs} jobs, ${reLinkedInvoices} invoices, ${reLinkedEstimates} estimates.`
            );
        } catch (err) {
            console.error("Error merging customers:", err);
            toast.error("Failed to merge customers.");
        } finally {
            setProcessingGroupId(null);
        }
    };

    /**
     * Safely deletes a single duplicate record
     */
    const handleDeleteSingle = async (c: Customer, groupKey: string) => {
        const dep = getCustomerDependencyCounts(c.id, vehicles, jobs, estimates, invoices, inquiries);
        let confirmText = `Are you sure you want to permanently delete customer [${c.id} - ${c.forename} ${c.surname}]?`;
        if (dep.total > 0) {
            confirmText += `\n\n⚠️ WARNING: This customer has ${dep.vehicles} vehicles, ${dep.jobs} jobs, ${dep.invoices} invoices linked to them! Deleting without merging will orphan those records.`;
        }

        if (!window.confirm(confirmText)) return;

        setProcessingGroupId(groupKey);
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'brooks_customers', c.id));
            await batch.commit();
            await forceRefresh('brooks_customers' as any);
            toast.success(`Deleted customer ${c.id}`);
        } catch (err) {
            console.error("Error deleting customer:", err);
            toast.error("Failed to delete customer.");
        } finally {
            setProcessingGroupId(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 p-5 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Copy size={24} className="text-indigo-300" />
                            Customer Deduplication & Merge Tool
                        </h2>
                        <p className="text-indigo-200 text-xs mt-1 opacity-90">
                            Detect multiple customer profiles, consolidate contact & address details, and re-link all vehicles, jobs, and invoices to the master record.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="bg-indigo-50/80 px-6 py-3 border-b border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                    <div className="flex-1 max-w-md relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Filter duplicates by name, company, email, phone, postcode..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-indigo-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg shadow-xs"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider whitespace-nowrap">Match Criteria:</span>
                        <div className="flex bg-white rounded-lg p-1 border border-indigo-200 shadow-xs">
                            <button
                                onClick={() => setMatchMode('email')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${matchMode === 'email' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:bg-indigo-50'}`}
                            >
                                Email Address
                            </button>
                            <button
                                onClick={() => setMatchMode('phone')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${matchMode === 'phone' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:bg-indigo-50'}`}
                            >
                                Phone / Mobile
                            </button>
                            <button
                                onClick={() => setMatchMode('name')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${matchMode === 'name' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:bg-indigo-50'}`}
                            >
                                Full Name
                            </button>
                            <button
                                onClick={() => setMatchMode('postcode_name')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${matchMode === 'postcode_name' ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:bg-indigo-50'}`}
                            >
                                Name & Postcode
                            </button>
                        </div>
                    </div>
                </div>

                {/* Subheader info count */}
                <div className="bg-gray-50 px-6 py-2 border-b border-gray-200 text-xs font-medium text-gray-500 flex justify-between items-center shrink-0">
                    <span>
                        Found <strong className="text-gray-900">{duplicateGroups.length}</strong> group(s) of potential customer duplicates
                    </span>
                    <span className="text-[11px] text-gray-400">
                        Total {customers.length} customer records indexed
                    </span>
                </div>

                {/* Duplicates List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                    {duplicateGroups.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <CheckCircle size={48} className="text-emerald-500 mb-3" />
                            <h3 className="text-lg font-bold text-gray-900">No Duplicate Customers Found</h3>
                            <p className="text-gray-500 text-sm max-w-md mt-1">
                                All customer records appear unique under the <strong>{matchMode}</strong> matching rule. Try switching match criteria or search query.
                            </p>
                        </div>
                    ) : (
                        duplicateGroups.map((group) => {
                            const masterId = selectedMasterIds[group.key] || group.customers[0]?.id;
                            const groupSelected = selectedForMerge[group.key] || new Set();
                            const isProcessing = processingGroupId === group.key;

                            return (
                                <div key={group.key} className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
                                    {/* Group Header */}
                                    <div className="bg-slate-100/90 px-5 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                                            <span className="text-sm font-bold text-gray-900">{group.groupLabel}</span>
                                            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                                                {group.customers.length} Profiles
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleMergeGroup(group)}
                                                disabled={isProcessing}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                                            >
                                                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
                                                Merge into Master
                                            </button>
                                        </div>
                                    </div>

                                    {/* Duplicate Cards Grid */}
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {group.customers.map((c) => {
                                            const isMaster = c.id === masterId;
                                            const isIncluded = groupSelected.has(c.id);
                                            const dep = getCustomerDependencyCounts(c.id, vehicles, jobs, estimates, invoices, inquiries);
                                            const hasAddress = !!(c.addressLine1 || (c as any).addressline1 || c.city || c.postcode);

                                            return (
                                                <div 
                                                    key={c.id} 
                                                    className={`rounded-xl border p-4 transition-all flex flex-col justify-between relative ${
                                                        isMaster 
                                                            ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-sm' 
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    }`}
                                                >
                                                    {/* Top row: Checkbox & Master selector badge */}
                                                    <div>
                                                        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-gray-100 mb-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isIncluded}
                                                                    disabled={isMaster}
                                                                    onChange={() => toggleCustomerInGroup(group.key, c.id)}
                                                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                                    title="Include in merge"
                                                                />
                                                                <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                                    {c.id}
                                                                </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectMaster(group.key, c.id)}
                                                                className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition ${
                                                                    isMaster 
                                                                        ? 'bg-indigo-600 text-white shadow-xs' 
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                {isMaster ? '★ Keep as Master' : 'Set as Master'}
                                                            </button>
                                                        </div>

                                                        {/* Name & Company */}
                                                        <div className="mb-2">
                                                            <div className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                                                                <User size={14} className="text-gray-400 shrink-0" />
                                                                <span>{c.forename || ''} {c.surname || ''}</span>
                                                            </div>
                                                            {c.companyName && (
                                                                <div className="text-xs text-indigo-700 font-semibold flex items-center gap-1 mt-0.5 pl-5">
                                                                    <Building size={12} className="shrink-0" />
                                                                    <span className="truncate">{c.companyName}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Contact Info */}
                                                        <div className="text-xs space-y-1 text-gray-600 pl-5 mb-3">
                                                            {(c.mobile || c.phone) ? (
                                                                <div className="flex items-center gap-1.5">
                                                                    <Phone size={12} className="text-gray-400 shrink-0" />
                                                                    <span>{c.mobile || c.phone}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-gray-400 italic">No phone</div>
                                                            )}
                                                            {c.email ? (
                                                                <div className="flex items-center gap-1.5 truncate">
                                                                    <Mail size={12} className="text-gray-400 shrink-0" />
                                                                    <span className="truncate">{c.email}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="text-gray-400 italic">No email</div>
                                                            )}
                                                            <div className="flex items-start gap-1.5 pt-0.5">
                                                                <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" />
                                                                <span className={hasAddress ? "text-gray-700 font-medium" : "text-gray-400 italic"}>
                                                                    {hasAddress 
                                                                        ? [c.addressLine1 || (c as any).addressline1, c.city, c.postcode].filter(Boolean).join(', ') 
                                                                        : 'No street address recorded'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Dependencies Badges */}
                                                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                <Car size={10} /> {dep.vehicles} Veh
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                                                <ClipboardList size={10} /> {dep.jobs} Jobs
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <FileText size={10} /> {dep.invoices} Inv
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Card Bottom Actions */}
                                                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-100 text-xs">
                                                        <span className="text-[10px] text-gray-400">
                                                            Created: {c.createdDate ? c.createdDate.substring(0, 10) : 'Unknown'}
                                                        </span>
                                                        {!isMaster && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteSingle(c, group.key)}
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition flex items-center gap-1 text-[11px] font-semibold"
                                                                title="Delete this duplicate directly"
                                                            >
                                                                <Trash2 size={12} /> Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center text-xs text-gray-500 shrink-0">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500" />
                        <span>Merging permanently updates all dependent vehicles, jobs, invoices, estimates, and inquiries before deleting the secondary record.</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DuplicateCustomersModal;
