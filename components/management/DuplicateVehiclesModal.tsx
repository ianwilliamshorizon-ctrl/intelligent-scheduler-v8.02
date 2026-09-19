import React, { useState, useMemo } from 'react';
import { 
    X, Copy, CheckCircle, Search, Trash2, GitMerge, Loader2, Car, User, FileText, 
    ClipboardList, AlertTriangle, ShieldCheck, Tag, ExternalLink 
} from 'lucide-react';
import { Vehicle, Customer, Job, Estimate, Invoice, Inquiry } from '../../types';
import { 
    findDuplicateVehicles, 
    mergeVehicleData, 
    getVehicleDependencyCounts,
    VehicleDuplicateGroup 
} from '../../core/utils/deduplicationUtils';
import { db } from '../../core/db';
import { writeBatch, doc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useData } from '../../core/state/DataContext';

interface DuplicateVehiclesModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicles: Vehicle[];
    customers?: Customer[];
    jobs?: Job[];
    estimates?: Estimate[];
    invoices?: Invoice[];
    inquiries?: Inquiry[];
    onViewVehicle?: (vehicleId: string) => void;
}

export const DuplicateVehiclesModal: React.FC<DuplicateVehiclesModalProps> = ({
    isOpen,
    onClose,
    vehicles = [],
    customers = [],
    jobs = [],
    estimates = [],
    invoices = [],
    inquiries = [],
    onViewVehicle
}) => {
    const [matchMode, setMatchMode] = useState<'vrm' | 'vin'>('vrm');
    const [searchQuery, setSearchQuery] = useState('');
    const [processingGroupId, setProcessingGroupId] = useState<string | null>(null);
    const [selectedMasterIds, setSelectedMasterIds] = useState<Record<string, string>>({});
    const [selectedForMerge, setSelectedForMerge] = useState<Record<string, Set<string>>>({});
    const { forceRefresh } = useData();

    // Map customers by ID for fast owner lookup
    const customerMap = useMemo(() => {
        const m = new Map<string, Customer>();
        customers.forEach(c => {
            if (c && c.id) m.set(c.id, c);
        });
        return m;
    }, [customers]);

    // Group duplicates
    const duplicateGroups = useMemo(() => {
        const rawGroups = findDuplicateVehicles(vehicles, matchMode);
        
        return rawGroups.filter(group => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                group.groupLabel.toLowerCase().includes(q) ||
                group.vehicles.some(v => {
                    const owner = v.customerId ? customerMap.get(v.customerId) : null;
                    const ownerName = owner ? `${owner.forename || ''} ${owner.surname || ''} ${owner.companyName || ''}`.toLowerCase() : '';
                    return (
                        (v.registration || '').toLowerCase().includes(q) ||
                        (v.make || '').toLowerCase().includes(q) ||
                        (v.model || '').toLowerCase().includes(q) ||
                        (v.vin || '').toLowerCase().includes(q) ||
                        (v.customerId || '').toLowerCase().includes(q) ||
                        ownerName.includes(q)
                    );
                })
            );
        });
    }, [vehicles, matchMode, searchQuery, customerMap]);

    // Initialize master selection and inclusion state when groups change
    React.useEffect(() => {
        const initialMasters: Record<string, string> = {};
        const initialSelected: Record<string, Set<string>> = {};

        duplicateGroups.forEach(g => {
            // Pick vehicle with most dependencies or most complete attributes as default master
            let bestVeh = g.vehicles[0];
            let bestScore = -1;

            g.vehicles.forEach(v => {
                const dep = getVehicleDependencyCounts(v.id, jobs, estimates, invoices, inquiries);
                const score = dep.total * 10 + (v.vin ? 5 : 0) + (v.engineNumber ? 2 : 0) + (v.images?.length || 0);
                if (score > bestScore) {
                    bestScore = score;
                    bestVeh = v;
                }
            });

            initialMasters[g.key] = bestVeh.id;
            initialSelected[g.key] = new Set(g.vehicles.map(v => v.id));
        });

        setSelectedMasterIds(initialMasters);
        setSelectedForMerge(initialSelected);
    }, [duplicateGroups, jobs, estimates, invoices, inquiries]);

    if (!isOpen) return null;

    const toggleVehicleInGroup = (groupKey: string, vehId: string) => {
        setSelectedForMerge(prev => {
            const current = new Set(prev[groupKey] || []);
            if (current.has(vehId)) {
                current.delete(vehId);
            } else {
                current.add(vehId);
            }
            return { ...prev, [groupKey]: current };
        });
    };

    const handleSelectMaster = (groupKey: string, masterId: string) => {
        setSelectedMasterIds(prev => ({ ...prev, [groupKey]: masterId }));
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
    const handleMergeGroup = async (group: VehicleDuplicateGroup) => {
        const masterId = selectedMasterIds[group.key];
        const groupSelected = selectedForMerge[group.key] || new Set();

        const master = group.vehicles.find(v => v.id === masterId);
        const secondaries = group.vehicles.filter(v => v.id !== masterId && groupSelected.has(v.id));

        if (!master) {
            toast.error("Please choose a master vehicle to keep.");
            return;
        }

        if (secondaries.length === 0) {
            toast.info("No secondary duplicates selected to merge.");
            return;
        }

        const confirmMsg = `Merge ${secondaries.length} duplicate vehicle(s) into Master record [${master.registration} (${master.make} ${master.model})]?\n\nAll linked jobs, invoices, estimates, and inquiries will be updated to point to ${master.registration}. This cannot be undone.`;
        if (!window.confirm(confirmMsg)) return;

        setProcessingGroupId(group.key);

        try {
            const batch = writeBatch(db);
            const secondaryIds = new Set(secondaries.map(s => s.id));

            // 1. Merge vehicle data
            const mergedMaster = mergeVehicleData(master, secondaries);
            const masterRef = doc(db, 'brooks_vehicles', master.id);
            batch.set(masterRef, { ...mergedMaster, updatedAt: new Date().toISOString() }, { merge: true });

            let reLinkedJobs = 0;
            let reLinkedInvoices = 0;
            let reLinkedEstimates = 0;
            let reLinkedInquiries = 0;

            // 2. Re-link jobs
            jobs.forEach(j => {
                if (secondaryIds.has(j.vehicleId)) {
                    batch.update(doc(db, 'brooks_jobs', j.id), { vehicleId: master.id, registration: master.registration });
                    reLinkedJobs++;
                }
            });

            // 3. Re-link estimates
            estimates.forEach(est => {
                if (secondaryIds.has(est.vehicleId)) {
                    batch.update(doc(db, 'brooks_estimates', est.id), { vehicleId: master.id, vehicleRegistration: master.registration });
                    reLinkedEstimates++;
                }
            });

            // 4. Re-link invoices
            invoices.forEach(inv => {
                if (secondaryIds.has(inv.vehicleId)) {
                    batch.update(doc(db, 'brooks_invoices', inv.id), { vehicleId: master.id, vehicleRegistration: master.registration });
                    reLinkedInvoices++;
                }
            });

            // 5. Re-link inquiries
            inquiries.forEach(inq => {
                if (secondaryIds.has(inq.linkedVehicleId)) {
                    batch.update(doc(db, 'brooks_inquiries', inq.id), { linkedVehicleId: master.id, vehicleRegistration: master.registration });
                    reLinkedInquiries++;
                }
            });

            // 6. Delete duplicate vehicle records
            secondaries.forEach(sec => {
                batch.delete(doc(db, 'brooks_vehicles', sec.id));
            });

            await batch.commit();

            // Refresh data context
            await Promise.all([
                forceRefresh('brooks_vehicles' as any),
                forceRefresh('brooks_jobs' as any),
                forceRefresh('brooks_invoices' as any),
                forceRefresh('brooks_estimates' as any),
                forceRefresh('brooks_inquiries' as any)
            ]);

            toast.success(
                `Merged into ${master.registration}! Re-linked: ${reLinkedJobs} jobs, ${reLinkedInvoices} invoices, ${reLinkedEstimates} estimates.`
            );
        } catch (err) {
            console.error("Error merging vehicles:", err);
            toast.error("Failed to merge vehicles.");
        } finally {
            setProcessingGroupId(null);
        }
    };

    /**
     * Deletes a single vehicle record
     */
    const handleDeleteSingle = async (v: Vehicle, groupKey: string) => {
        const dep = getVehicleDependencyCounts(v.id, jobs, estimates, invoices, inquiries);
        let confirmText = `Are you sure you want to delete vehicle [${v.registration} - ${v.make} ${v.model}]?`;
        if (dep.total > 0) {
            confirmText += `\n\n⚠️ WARNING: This vehicle has ${dep.jobs} jobs, ${dep.invoices} invoices linked to it! Deleting without merging will orphan those records.`;
        }

        if (!window.confirm(confirmText)) return;

        setProcessingGroupId(groupKey);
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'brooks_vehicles', v.id));
            await batch.commit();
            await forceRefresh('brooks_vehicles' as any);
            toast.success(`Deleted vehicle ${v.registration}`);
        } catch (err) {
            console.error("Error deleting vehicle:", err);
            toast.error("Failed to delete vehicle.");
        } finally {
            setProcessingGroupId(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 p-5 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Car size={24} className="text-emerald-300" />
                            Vehicle Deduplication & Merge Tool
                        </h2>
                        <p className="text-emerald-200 text-xs mt-1 opacity-90">
                            Identify duplicate vehicle profiles by Registration or VIN, consolidate technical history & specs, and re-link jobs and invoices to the master vehicle.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="bg-teal-50/80 px-6 py-3 border-b border-teal-100 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                    <div className="flex-1 max-w-md relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Filter duplicates by registration, make, model, VIN, owner..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-teal-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 rounded-lg shadow-xs"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-teal-900 uppercase tracking-wider whitespace-nowrap">Match Criteria:</span>
                        <div className="flex bg-white rounded-lg p-1 border border-teal-200 shadow-xs">
                            <button
                                onClick={() => setMatchMode('vrm')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${matchMode === 'vrm' ? 'bg-teal-700 text-white shadow-xs' : 'text-gray-600 hover:bg-teal-50'}`}
                            >
                                Registration (VRM)
                            </button>
                            <button
                                onClick={() => setMatchMode('vin')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors whitespace-nowrap ${matchMode === 'vin' ? 'bg-teal-700 text-white shadow-xs' : 'text-gray-600 hover:bg-teal-50'}`}
                            >
                                VIN Number
                            </button>
                        </div>
                    </div>
                </div>

                {/* Subheader info count */}
                <div className="bg-gray-50 px-6 py-2 border-b border-gray-200 text-xs font-medium text-gray-500 flex justify-between items-center shrink-0">
                    <span>
                        Found <strong className="text-gray-900">{duplicateGroups.length}</strong> group(s) of potential vehicle duplicates
                    </span>
                    <span className="text-[11px] text-gray-400">
                        Total {vehicles.length} vehicle records indexed
                    </span>
                </div>

                {/* Duplicates List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                    {duplicateGroups.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <CheckCircle size={48} className="text-emerald-500 mb-3" />
                            <h3 className="text-lg font-bold text-gray-900">No Duplicate Vehicles Found</h3>
                            <p className="text-gray-500 text-sm max-w-md mt-1">
                                All vehicle records appear unique under the <strong>{matchMode.toUpperCase()}</strong> matching rule.
                            </p>
                        </div>
                    ) : (
                        duplicateGroups.map((group) => {
                            const masterId = selectedMasterIds[group.key] || group.vehicles[0]?.id;
                            const groupSelected = selectedForMerge[group.key] || new Set();
                            const isProcessing = processingGroupId === group.key;

                            return (
                                <div key={group.key} className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
                                    {/* Group Header */}
                                    <div className="bg-slate-100/90 px-5 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                                            <span className="text-sm font-bold text-gray-900">{group.groupLabel}</span>
                                            <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full font-bold">
                                                {group.vehicles.length} Vehicles
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleMergeGroup(group)}
                                                disabled={isProcessing}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                                            >
                                                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
                                                Merge into Master
                                            </button>
                                        </div>
                                    </div>

                                    {/* Duplicate Cards Grid */}
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {group.vehicles.map((v) => {
                                            const isMaster = v.id === masterId;
                                            const isIncluded = groupSelected.has(v.id);
                                            const dep = getVehicleDependencyCounts(v.id, jobs, estimates, invoices, inquiries);
                                            const owner = v.customerId ? customerMap.get(v.customerId) : null;

                                            return (
                                                <div 
                                                    key={v.id} 
                                                    className={`rounded-xl border p-4 transition-all flex flex-col justify-between relative ${
                                                        isMaster 
                                                            ? 'border-teal-600 bg-teal-50/30 ring-2 ring-teal-600/20 shadow-sm' 
                                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div>
                                                        {/* Top row: VRM Badge & Master selector */}
                                                        <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-gray-100 mb-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isIncluded}
                                                                    disabled={isMaster}
                                                                    onChange={() => toggleVehicleInGroup(group.key, v.id)}
                                                                    className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                                                    title="Include in merge"
                                                                />
                                                                <span className="inline-block bg-yellow-400 text-black font-mono font-black text-xs px-2.5 py-0.5 rounded border border-yellow-500 shadow-2xs tracking-wider uppercase">
                                                                    {v.registration}
                                                                </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectMaster(group.key, v.id)}
                                                                className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition ${
                                                                    isMaster 
                                                                        ? 'bg-teal-700 text-white shadow-xs' 
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                {isMaster ? '★ Keep as Master' : 'Set as Master'}
                                                            </button>
                                                        </div>

                                                        {/* Make & Model */}
                                                        <div className="mb-2">
                                                            <div className="font-bold text-gray-900 text-base">
                                                                {v.make} {v.model}
                                                            </div>
                                                            {v.vin ? (
                                                                <div className="font-mono text-[11px] text-gray-500 truncate mt-0.5" title={v.vin}>
                                                                    VIN: {v.vin}
                                                                </div>
                                                            ) : (
                                                                <div className="text-[11px] text-gray-400 italic mt-0.5">No VIN recorded</div>
                                                            )}
                                                        </div>

                                                        {/* Vehicle Specs */}
                                                        <div className="text-xs text-gray-600 space-y-1 mb-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <User size={12} className="text-gray-400 shrink-0" />
                                                                <span className="font-medium text-gray-700 truncate">
                                                                    {owner 
                                                                        ? `${owner.forename || ''} ${owner.surname || ''} ${owner.companyName ? `(${owner.companyName})` : ''}`.trim() 
                                                                        : (v.customerId ? `Legacy ID: ${v.customerId}` : 'Unassigned Owner')}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 text-gray-500 text-[11px]">
                                                                {v.colour && <span>Color: <strong>{v.colour}</strong></span>}
                                                                {v.fuelType && <span>Fuel: <strong>{v.fuelType}</strong></span>}
                                                                {v.cc && <span>Engine: <strong>{v.cc}cc</strong></span>}
                                                            </div>
                                                        </div>

                                                        {/* Dependencies Badges */}
                                                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                                                <ClipboardList size={10} /> {dep.jobs} Jobs
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <FileText size={10} /> {dep.invoices} Inv
                                                            </span>
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                <Tag size={10} /> {dep.estimates} Est
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Card Bottom Actions */}
                                                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-100 text-xs">
                                                        <span className="font-mono text-[10px] text-gray-400">
                                                            ID: {v.id.substring(0, 10)}...
                                                        </span>
                                                        {!isMaster && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteSingle(v, group.key)}
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                                                                title="Delete this duplicate vehicle"
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
                        <span>Merging consolidates vehicle history, and updates all jobs, invoices, estimates, and inquiries to the master vehicle before removing duplicates.</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DuplicateVehiclesModal;
