import React, { useState, useMemo, useEffect } from 'react';
import { ServicePackage, Vehicle, TaxRate } from '../types';
import { getScoredServicePackages, ScoredPackage } from '../utils/servicePackageScoring';
import { calculatePackagePrices } from '../core/utils/packageUtils';
import { formatCurrency } from '../utils/formatUtils';
import { 
    X, Package, CheckSquare, Square, Search, Filter, Sparkles, 
    CheckCircle2, AlertCircle, Car, ChevronDown, ChevronUp, ShieldCheck, Wrench, AlertTriangle 
} from 'lucide-react';

interface ServicePackageSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    servicePackages: ServicePackage[];
    vehicle?: Vehicle | null;
    narrative?: string;
    taxRates: TaxRate[];
    onSelectPackages: (selectedPackages: ServicePackage[]) => void;
    initialSelectedPackageIds?: string[];
}

export const ServicePackageSelectionModal: React.FC<ServicePackageSelectionModalProps> = ({
    isOpen,
    onClose,
    servicePackages,
    vehicle,
    narrative = '',
    taxRates,
    onSelectPackages,
    initialSelectedPackageIds = []
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedPackageIds));
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'compatible' | 'narrative'>('compatible');
    const [expandedPackageIds, setExpandedPackageIds] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<'likelihood' | 'name' | 'price_asc' | 'price_desc'>('likelihood');

    useEffect(() => {
        if (isOpen) {
            setSelectedIds(new Set(initialSelectedPackageIds));
            setSearchTerm('');
            setFilterMode(vehicle ? 'compatible' : 'all');
            setSortBy('likelihood');
        }
    }, [isOpen, initialSelectedPackageIds, vehicle]);

    // Score all packages against vehicle
    const scoredPackages = useMemo(() => {
        return getScoredServicePackages(servicePackages, vehicle);
    }, [servicePackages, vehicle]);

    // Check narrative keywords against packages
    const narrativeKeywords = useMemo(() => {
        const text = narrative.toLowerCase();
        const keywords = [
            'minor service', 'major service', 'interim service', 'full service', 
            'mot', 'brake fluid', 'winter check', 'air con', 'oil change', 'diagnostic',
            'coolant', 'cambelt', 'timing belt', 'clutch', 'suspension', 'inspection'
        ];
        return keywords.filter(kw => text.includes(kw));
    }, [narrative]);

    const isNarrativeMatch = (pkg: ServicePackage): boolean => {
        if (narrativeKeywords.length === 0 && !narrative.trim()) return false;
        const pName = (pkg.name || '').toLowerCase();
        const pDesc = (pkg.description || '').toLowerCase();
        
        // Match specific narrative keywords
        if (narrativeKeywords.some(kw => pName.includes(kw) || pDesc.includes(kw))) {
            return true;
        }
        // General text overlap if narrative is short
        const shortNarrative = narrative.toLowerCase().trim();
        if (shortNarrative.length >= 3 && (pName.includes(shortNarrative) || shortNarrative.includes(pName))) {
            return true;
        }
        return false;
    };

    // Filter and sort display items by LIKELIHOOD (Narrative match + Vehicle compatibility score)
    const filteredPackages = useMemo(() => {
        const filtered = scoredPackages.filter(item => {
            const matchesSearch = !searchTerm.trim() || 
                (item.pkg.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.pkg.description || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            if (!matchesSearch) return false;

            if (filterMode === 'compatible') {
                return item.score >= 1;
            } else if (filterMode === 'narrative') {
                return isNarrativeMatch(item.pkg);
            }
            return true;
        });

        return filtered.sort((a, b) => {
            if (sortBy === 'name') {
                return (a.pkg.name || '').localeCompare(b.pkg.name || '');
            }
            if (sortBy === 'price_asc') {
                const aPrice = calculatePackagePrices(a.pkg, taxRates).net;
                const bPrice = calculatePackagePrices(b.pkg, taxRates).net;
                return aPrice - bPrice;
            }
            if (sortBy === 'price_desc') {
                const aPrice = calculatePackagePrices(a.pkg, taxRates).net;
                const bPrice = calculatePackagePrices(b.pkg, taxRates).net;
                return bPrice - aPrice;
            }

            // Default 'likelihood':
            // 1. Narrative match AND vehicle match gets highest priority (+10 boost)
            // 2. Add vehicle compatibility score (Exact=5, Model=4, Make=3, Engine=3.5, Name=2, Generic=1, Other=0)
            const aNarr = isNarrativeMatch(a.pkg);
            const bNarr = isNarrativeMatch(b.pkg);

            const aLikelihood = (aNarr ? 10 : 0) + a.score;
            const bLikelihood = (bNarr ? 10 : 0) + b.score;

            if (bLikelihood !== aLikelihood) {
                return bLikelihood - aLikelihood;
            }

            if (b.score !== a.score) {
                return b.score - a.score;
            }

            return (a.pkg.name || '').localeCompare(b.pkg.name || '');
        });
    }, [scoredPackages, searchTerm, filterMode, narrativeKeywords, sortBy, taxRates]);

    // Recommend top matches based on vehicle compatibility and narrative
    const recommendedPackageIds = useMemo(() => {
        const recs = new Set<string>();
        scoredPackages.forEach(item => {
            if (item.score >= 1 && isNarrativeMatch(item.pkg)) {
                recs.add(item.pkg.id);
            }
        });
        return recs;
    }, [scoredPackages, narrativeKeywords]);

    const handleToggleSelect = (pkgId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(pkgId)) {
                next.delete(pkgId);
            } else {
                next.add(pkgId);
            }
            return next;
        });
    };

    const handleToggleExpand = (pkgId: string) => {
        setExpandedPackageIds(prev => {
            const next = new Set(prev);
            if (next.has(pkgId)) {
                next.delete(pkgId);
            } else {
                next.add(pkgId);
            }
            return next;
        });
    };

    const handleSelectRecommended = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            recommendedPackageIds.forEach(id => next.add(id));
            return next;
        });
    };

    const handleSubmit = () => {
        const selected = servicePackages.filter(p => selectedIds.has(p.id));
        onSelectPackages(selected);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[70] flex justify-center items-center p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100 overflow-hidden">
                {/* Header */}
                <header className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex justify-between items-start border-b border-indigo-900/40">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="p-1.5 bg-indigo-500/20 border border-indigo-400/30 rounded-lg text-indigo-300">
                                <Package size={20} />
                            </span>
                            <h2 className="text-xl font-bold tracking-tight text-white">Select Service Packages</h2>
                        </div>
                        <p className="text-xs text-indigo-200/80 max-w-xl">
                            Pick the appropriate service packages for this job. We automatically check vehicle compatibility and your customer narrative to prevent incorrect selections.
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </header>

                {/* Context Bar: Vehicle Details & Narrative Status */}
                <div className="flex-shrink-0 bg-slate-50 border-b border-gray-200 p-3 sm:px-6 sm:py-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-xl shadow-xs">
                            <Car size={16} className="text-indigo-600" />
                            <span className="text-xs font-semibold text-gray-700">
                                {vehicle ? (
                                    <>
                                        {vehicle.year ? `${vehicle.year} ` : ''}
                                        {vehicle.make} {vehicle.model}
                                        {vehicle.cc ? ` (${vehicle.cc}cc)` : ''}
                                        {vehicle.fuelType ? ` • ${vehicle.fuelType}` : ''}
                                        {vehicle.registration ? ` [${vehicle.registration.toUpperCase()}]` : ''}
                                    </>
                                ) : (
                                    <span className="text-amber-600 font-medium">No vehicle selected — showing all generic packages</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {narrativeKeywords.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 border border-purple-200 text-purple-800 rounded-xl text-xs font-medium">
                            <Sparkles size={14} className="text-purple-600" />
                            <span>Narrative detects: <strong>{narrativeKeywords.join(', ')}</strong></span>
                        </div>
                    )}
                </div>

                {/* Filter and Search Bar */}
                <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by package name or description..."
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')} 
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setFilterMode('compatible')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    filterMode === 'compatible'
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <ShieldCheck size={14} />
                                Compatible for Vehicle
                            </button>
                            {narrativeKeywords.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setFilterMode('narrative')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                        filterMode === 'narrative'
                                            ? 'bg-purple-600 text-white shadow-xs'
                                            : 'text-purple-700 hover:bg-purple-50'
                                    }`}
                                >
                                    <Sparkles size={14} />
                                    Narrative Matches ({recommendedPackageIds.size})
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setFilterMode('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                    filterMode === 'all'
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <Filter size={14} />
                                All ({servicePackages.length})
                            </button>
                        </div>

                        {/* Sort Dropdown */}
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-gray-500 font-medium">Sort by:</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="likelihood">★ Likelihood (Vehicle &amp; Narrative)</option>
                                <option value="name">Name (A - Z)</option>
                                <option value="price_asc">Price (Low to High)</option>
                                <option value="price_desc">Price (High to Low)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Likelihood / Sort Banner */}
                <div className="flex-shrink-0 bg-slate-50 border-b border-gray-100 px-6 py-1.5 flex items-center justify-between text-[11px] text-gray-500 font-medium">
                    <div className="flex items-center gap-1.5">
                        <span className="text-indigo-600 font-bold">
                            {sortBy === 'likelihood' ? '★ Sorted by Likelihood:' : 'Sorted:'}
                        </span>
                        <span>
                            {sortBy === 'likelihood' && 'Direct Make/Model match & Narrative keywords appear first'}
                            {sortBy === 'name' && 'Alphabetical by package name'}
                            {sortBy === 'price_asc' && 'Lowest price to highest price'}
                            {sortBy === 'price_desc' && 'Highest price to lowest price'}
                        </span>
                    </div>
                    <span>Showing {filteredPackages.length} package(s)</span>
                </div>

                {/* Recommended action banner if narrative matches are present */}
                {recommendedPackageIds.size > 0 && (
                    <div className="flex-shrink-0 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 px-6 py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-purple-900">
                            <Sparkles size={16} className="text-purple-600 flex-shrink-0" />
                            <span>
                                We found <strong>{recommendedPackageIds.size} package(s)</strong> that match both your customer narrative and vehicle specifications.
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleSelectRecommended}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-xs transition"
                        >
                            Select Recommended
                        </button>
                    </div>
                )}

                {/* Package List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-gray-50/50">
                    {filteredPackages.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 p-8">
                            <AlertCircle size={36} className="mx-auto text-gray-400 mb-3" />
                            <h3 className="text-base font-bold text-gray-700 mb-1">No service packages match your filters</h3>
                            <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
                                {filterMode === 'compatible'
                                    ? "There are no packages specifically matching this vehicle make/model. Try viewing 'All' to check general packages."
                                    : "Try adjusting your search query or switching the filter tab."}
                            </p>
                            {filterMode !== 'all' && (
                                <button
                                    type="button"
                                    onClick={() => setFilterMode('all')}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
                                >
                                    Show All Packages
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredPackages.map(({ pkg, score, matchType, status, color }) => {
                            const isSelected = selectedIds.has(pkg.id);
                            const isExpanded = expandedPackageIds.has(pkg.id);
                            const isNarrativeMatched = isNarrativeMatch(pkg);
                            const isIncompatible = score <= 0;
                            const pricing = calculatePackagePrices(pkg, taxRates);

                            const laborItems = pkg.costItems?.filter(i => i.isLabor) || [];
                            const partItems = pkg.costItems?.filter(i => !i.isLabor) || [];

                            return (
                                <div
                                    key={pkg.id}
                                    className={`border rounded-2xl transition-all duration-200 overflow-hidden bg-white shadow-xs ${
                                        isSelected 
                                            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10' 
                                            : isIncompatible
                                            ? 'border-gray-200 opacity-70 hover:opacity-100'
                                            : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                                    }`}
                                >
                                    {/* Card Header Row */}
                                    <div
                                        onClick={() => handleToggleSelect(pkg.id)}
                                        className="p-4 sm:p-5 flex items-start gap-4 cursor-pointer select-none"
                                    >
                                        <div className="pt-0.5 flex-shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleSelect(pkg.id);
                                                }}
                                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                                    isSelected
                                                        ? 'bg-indigo-600 text-white shadow-xs'
                                                        : 'border-2 border-gray-300 text-transparent hover:border-indigo-400'
                                                }`}
                                            >
                                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                            </button>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h4 className="font-bold text-gray-900 text-base">
                                                    {pkg.name}
                                                </h4>
                                                
                                                {/* Compatibility Badge */}
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color || 'bg-gray-100 text-gray-600'}`}>
                                                    {matchType}
                                                </span>

                                                {/* Narrative Badge */}
                                                {isNarrativeMatched && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                                                        <Sparkles size={11} className="text-purple-600" />
                                                        Narrative Match
                                                    </span>
                                                )}

                                                {/* Top Likelihood Badge */}
                                                {isNarrativeMatched && score >= 3 && (
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-xs flex items-center gap-1">
                                                        ★ Top Likelihood
                                                    </span>
                                                )}

                                                {/* Incompatible Warning */}
                                                {isIncompatible && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                                                        <AlertTriangle size={11} />
                                                        Make Mismatch
                                                    </span>
                                                )}
                                            </div>

                                            {pkg.description && (
                                                <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                                                    {pkg.description}
                                                </p>
                                            )}

                                            {/* Vehicle applicability info if present */}
                                            {(pkg.applicableMake || pkg.applicableModel) && (
                                                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                                                    <Car size={13} className="text-gray-400" />
                                                    <span>
                                                        Target: {pkg.applicableMake || 'Any'} {pkg.applicableModel || ''}
                                                        {pkg.applicableEngineSize ? ` (${pkg.applicableEngineSize}cc)` : ''}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right flex-shrink-0 flex flex-col items-end justify-between self-stretch">
                                            <div>
                                                <div className="text-lg font-black text-gray-900">
                                                    {formatCurrency(pricing.net)}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-medium">
                                                    + VAT ({formatCurrency(pricing.vat)})
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleExpand(pkg.id);
                                                }}
                                                className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 p-1 hover:bg-indigo-50 rounded-lg transition"
                                            >
                                                <span>{laborItems.length + partItems.length} items</span>
                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Item Breakdown */}
                                    {isExpanded && (
                                        <div className="bg-slate-50 border-t border-gray-100 p-4 px-6 space-y-3 text-xs">
                                            {laborItems.length > 0 && (
                                                <div>
                                                    <h5 className="font-bold text-gray-500 uppercase text-[10px] tracking-wider mb-1.5 flex items-center gap-1">
                                                        <Wrench size={12} /> Included Labor
                                                    </h5>
                                                    <ul className="space-y-1">
                                                        {laborItems.map((lab, i) => (
                                                            <li key={i} className="flex justify-between text-gray-700">
                                                                <span>• {lab.description}</span>
                                                                <span className="font-semibold">{lab.quantity || 1} hrs</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {partItems.length > 0 && (
                                                <div>
                                                    <h5 className="font-bold text-gray-500 uppercase text-[10px] tracking-wider mb-1.5 flex items-center gap-1">
                                                        <Package size={12} /> Included Parts
                                                    </h5>
                                                    <ul className="space-y-1">
                                                        {partItems.map((part, i) => (
                                                            <li key={i} className="flex justify-between text-gray-700">
                                                                <span>• {part.description || 'Part Item'} (x{part.quantity || 1})</span>
                                                                <span className="text-gray-500">{formatCurrency(part.unitPrice || 0)} ea</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {laborItems.length === 0 && partItems.length === 0 && (
                                                <p className="text-gray-400 italic">No detailed items configured in this package template.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Bar */}
                <footer className="flex-shrink-0 bg-white border-t border-gray-200 p-4 sm:px-6 flex items-center justify-between gap-4">
                    <div className="text-xs font-semibold text-gray-600">
                        {selectedIds.size === 0 ? (
                            <span>No packages selected</span>
                        ) : (
                            <span className="text-indigo-600 font-bold">
                                {selectedIds.size} package{selectedIds.size > 1 ? 's' : ''} selected
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl font-bold text-xs transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={selectedIds.size === 0}
                            onClick={handleSubmit}
                            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2"
                        >
                            <CheckCircle2 size={16} />
                            <span>Add Selected Package{selectedIds.size !== 1 ? 's' : ''} ({selectedIds.size})</span>
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};
