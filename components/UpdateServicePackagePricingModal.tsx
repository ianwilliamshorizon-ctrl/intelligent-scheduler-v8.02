import React, { useState, useMemo } from 'react';
import { X, Check, CheckSquare, Square, RefreshCw, AlertCircle, ArrowRight, Layers, Sparkles } from 'lucide-react';
import { PurchaseOrder, ServicePackage } from '../types';
import { ServicePackagePriceMatch, applyServicePackageUpdates } from '../utils/servicePackagePriceSync';
import { formatCurrency } from '../utils/formatUtils';
import useToaster from '../hooks/useToaster';

interface UpdateServicePackagePricingModalProps {
    isOpen: boolean;
    onClose: () => void;
    purchaseOrder: Partial<PurchaseOrder>;
    matches: ServicePackagePriceMatch[];
    allServicePackages: ServicePackage[];
    setServicePackages: React.Dispatch<React.SetStateAction<ServicePackage[]>>;
    onSuccess?: (updatedPackagesCount: number) => void;
}

export const UpdateServicePackagePricingModal: React.FC<UpdateServicePackagePricingModalProps> = ({
    isOpen,
    onClose,
    purchaseOrder,
    matches,
    allServicePackages,
    setServicePackages,
    onSuccess
}) => {
    const { showSuccess, showError } = useToaster();
    const [selectedMatchKeys, setSelectedMatchKeys] = useState<Set<string>>(() => {
        // Default all matches selected
        return new Set(matches.map(m => `${m.packageId}__${m.costItemId}`));
    });
    const [isSaving, setIsSaving] = useState(false);

    // Group matches by PO Part item for clean, organized reading
    const groupedByPoItem = useMemo(() => {
        const map = new Map<string, {
            poLineItemId: string;
            poPartNumber: string;
            poDescription: string;
            newUnitCost: number;
            packageMatches: ServicePackagePriceMatch[];
        }>();

        matches.forEach(m => {
            const key = m.poLineItemId || `${m.poPartNumber}_${m.poDescription}`;
            if (!map.has(key)) {
                map.set(key, {
                    poLineItemId: m.poLineItemId,
                    poPartNumber: m.poPartNumber,
                    poDescription: m.poDescription,
                    newUnitCost: m.newUnitCost,
                    packageMatches: []
                });
            }
            map.get(key)!.packageMatches.push(m);
        });

        return Array.from(map.values());
    }, [matches]);

    if (!isOpen) return null;

    const toggleMatch = (key: string) => {
        setSelectedMatchKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedMatchKeys.size === matches.length) {
            setSelectedMatchKeys(new Set());
        } else {
            setSelectedMatchKeys(new Set(matches.map(m => `${m.packageId}__${m.costItemId}`)));
        }
    };

    const handleApplyUpdates = async () => {
        const selectedList = matches.filter(m => selectedMatchKeys.has(`${m.packageId}__${m.costItemId}`));
        if (selectedList.length === 0) {
            showError('Please select at least one package update to apply.');
            return;
        }

        setIsSaving(true);
        try {
            const { updatedCount } = await applyServicePackageUpdates(
                allServicePackages,
                selectedList,
                setServicePackages
            );

            showSuccess(`Successfully updated ${updatedCount} service package(s) with latest PO buy prices & part numbers.`);
            if (onSuccess) onSuccess(updatedCount);
            onClose();
        } catch (err: any) {
            console.error('Failed to apply package price updates:', err);
            showError(`Failed to update service packages: ${err?.message || 'Unknown error'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Calculate unique packages currently selected
    const selectedPackageCount = new Set(
        matches
            .filter(m => selectedMatchKeys.has(`${m.packageId}__${m.costItemId}`))
            .map(m => m.packageId)
    ).size;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col border border-slate-200 overflow-hidden">
                
                {/* MODAL HEADER */}
                <header className="p-6 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-indigo-50 via-purple-50 to-white">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md">
                            <RefreshCw size={24} className={isSaving ? 'animate-spin' : ''} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-slate-900 text-xl tracking-tight">
                                    Update Service Packages with Latest Buy Prices
                                </h3>
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-md">
                                    PO #{purchaseOrder.id || 'Current'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                                Supplier buy prices and part numbers often change. The parts received on this Purchase Order match components inside your service package database. Review and apply the latest pricing to keep your workshop costs and margins accurate.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                    >
                        <X size={20} />
                    </button>
                </header>

                {/* SUMMARY STATS STRIP */}
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-600">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                            <strong className="text-slate-900 font-bold">{groupedByPoItem.length}</strong> Part(s) on PO
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1.5">
                            <strong className="text-indigo-600 font-bold">{matches.length}</strong> Package Line Component(s)
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1.5">
                            <strong className="text-emerald-700 font-bold">{selectedPackageCount}</strong> Package(s) Selected for Update
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={toggleAll}
                        className="text-indigo-600 hover:text-indigo-950 font-bold flex items-center gap-1.5"
                    >
                        {selectedMatchKeys.size === matches.length ? <CheckSquare size={14} /> : <Square size={14} />}
                        <span>{selectedMatchKeys.size === matches.length ? 'Deselect All' : 'Select All'}</span>
                    </button>
                </div>

                {/* BODY CONTENT: LIST OF MATCHES GROUPED BY PO ITEM */}
                <main className="flex-1 overflow-y-auto p-6 space-y-6">
                    {groupedByPoItem.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 space-y-2">
                            <AlertCircle size={36} className="mx-auto text-slate-300" />
                            <p className="font-bold text-sm text-slate-600">No matching service package components found.</p>
                            <p className="text-xs">The parts on this PO do not currently match any line items in your service packages.</p>
                        </div>
                    ) : (
                        groupedByPoItem.map(group => (
                            <div key={group.poLineItemId} className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                                
                                {/* Group Header: The Received PO Part */}
                                <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <span className="font-mono font-bold text-xs bg-white px-2.5 py-1 rounded-lg border border-slate-300 text-slate-800 shadow-3xs">
                                            {group.poPartNumber || 'NO-PART-NO'}
                                        </span>
                                        <span className="font-bold text-sm text-slate-900">
                                            {group.poDescription}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">Delivered Buy Price:</span>
                                        <span className="font-mono font-black text-sm text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                                            {formatCurrency(group.newUnitCost)}
                                        </span>
                                    </div>
                                </div>

                                {/* Matching Packages List */}
                                <div className="divide-y divide-slate-100">
                                    {group.packageMatches.map(m => {
                                        const key = `${m.packageId}__${m.costItemId}`;
                                        const isSelected = selectedMatchKeys.has(key);
                                        const isCostIncrease = m.unitCostDifference > 0;
                                        const isCostDecrease = m.unitCostDifference < 0;

                                        return (
                                            <div
                                                key={key}
                                                onClick={() => toggleMatch(key)}
                                                className={`p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer transition select-none ${
                                                    isSelected ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'bg-white hover:bg-slate-50 opacity-60'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleMatch(key)}
                                                        className="mt-1 w-4 h-4 text-indigo-600 rounded cursor-pointer"
                                                    />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h5 className="font-bold text-sm text-slate-900">
                                                                {m.packageName}
                                                            </h5>
                                                            {m.vehicleModel && (
                                                                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold border border-slate-200">
                                                                    {m.vehicleMake} {m.vehicleModel}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                                                            <span>Item in Package: <strong>{m.costItemDescription}</strong></span>
                                                            {m.quantityInPackage > 1 && (
                                                                <span className="text-slate-400">({m.quantityInPackage}x per service)</span>
                                                            )}
                                                            {m.partNumberChanged && (
                                                                <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                                                                    Part #: {m.currentPartNumber || 'None'} → {m.newPartNumber}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Price & Cost Diff */}
                                                <div className="flex items-center gap-3 self-end sm:self-center font-mono text-xs">
                                                    <div className="text-right">
                                                        <span className="text-slate-400 line-through mr-1.5">{formatCurrency(m.currentUnitCost)}</span>
                                                        <ArrowRight size={12} className="inline text-slate-400 mr-1.5" />
                                                        <strong className="text-slate-900 text-sm">{formatCurrency(m.newUnitCost)}</strong>
                                                    </div>

                                                    <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                                        isCostIncrease 
                                                            ? 'bg-red-100 text-red-800' 
                                                            : isCostDecrease 
                                                                ? 'bg-emerald-100 text-emerald-800' 
                                                                : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {isCostIncrease ? `+${formatCurrency(m.unitCostDifference)}` : formatCurrency(m.unitCostDifference)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </main>

                {/* MODAL FOOTER */}
                <footer className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition"
                    >
                        Skip / Keep Existing Costs
                    </button>

                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">
                            {selectedMatchKeys.size} line component(s) across {selectedPackageCount} package(s)
                        </span>
                        <button
                            type="button"
                            onClick={handleApplyUpdates}
                            disabled={isSaving || selectedMatchKeys.size === 0}
                            className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                            <span>Update {selectedPackageCount} Service Package(s)</span>
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default UpdateServicePackagePricingModal;

