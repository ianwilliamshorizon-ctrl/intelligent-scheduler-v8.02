import React, { useState, useMemo } from 'react';
import { useData } from '../../../core/state/DataContext';
import { ServicePackage, BusinessEntity } from '../../../types';
import { PlusCircle, Copy, Trash2, ArrowUpDown, Filter, X } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import ServicePackageFormModal from '../../ServicePackageFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { useApp } from '../../../core/state/AppContext';
import { AlertCircle, Zap, Percent, PoundSterling, Check } from 'lucide-react';

interface ManagementPackagesTabProps {
    searchTerm: string;
    onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void;
}

type SortField = 'name' | 'totalPrice';
type SortOrder = 'asc' | 'desc';

export const ManagementPackagesTab: React.FC<ManagementPackagesTabProps> = ({ searchTerm, onShowStatus }) => {
    const { servicePackages, setServicePackages, taxRates, businessEntities, parts } = useData();
    const { selectedEntityId, setConfirmation } = useApp();
    const { updateItem, deleteItem } = useManagementTable<ServicePackage>(
        servicePackages,
        'brooks_servicePackages',
        setServicePackages
    );

    const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Sort and Filter States
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [entityFilter, setEntityFilter] = useState<string>('all');
    
    // Bulk Update State
    const [isBulkPanelOpen, setIsBulkPanelOpen] = useState(false);
    const [bulkKeyword, setBulkKeyword] = useState('');
    const [bulkAdjustment, setBulkAdjustment] = useState<number>(0);
    const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'fixed'>('percentage');
    const [isUpdating, setIsUpdating] = useState(false);

    const filteredAndSortedPackages = useMemo(() => {
        let results = (servicePackages || []).filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (entityFilter !== 'all') {
            results = results.filter(p => p.entityId === entityFilter);
        }

        return results.sort((a, b) => {
            let valA = a[sortField] || '';
            let valB = b[sortField] || '';

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [servicePackages, searchTerm, entityFilter, sortField, sortOrder]);

    const handleClone = (pkg: ServicePackage) => {
        const newPackage = JSON.parse(JSON.stringify(pkg));
        newPackage.id = `pkg_${Date.now()}`;
        newPackage.name = `${pkg.name} (Copy)`;
        if (newPackage.costItems && Array.isArray(newPackage.costItems)) {
            newPackage.costItems = newPackage.costItems.map(item => ({
                ...item,
                id: crypto.randomUUID()
            }));
        }
        updateItem(newPackage);
        onShowStatus(`Cloned "${pkg.name}" successfully.`, 'success');
    };
    
    const handleDelete = (pkg: ServicePackage) => {
        setConfirmation({
            isOpen: true,
            title: 'Confirm Deletion',
            message: `Are you sure you want to delete the package "${pkg.name}"? This action cannot be undone.`,
            type: 'warning',
            onConfirm: () => {
                deleteItem(pkg.id);
                onShowStatus(`Deleted "${pkg.name}" successfully.`, 'success');
                setConfirmation({ isOpen: false, title: '', message: '' });
            }
        });
    };

    const handleBulkUpdate = async () => {
        if (!bulkKeyword.trim()) {
            onShowStatus('Please enter a keyword to target.', 'error');
            return;
        }

        const matchingPackages = servicePackages.filter(p => 
            (p.name || '').toLowerCase().includes(bulkKeyword.toLowerCase()) || 
            (p.description || '').toLowerCase().includes(bulkKeyword.toLowerCase()) ||
            (p.costItems || []).some(item => (item.description || '').toLowerCase().includes(bulkKeyword.toLowerCase()))
        );

        if (matchingPackages.length === 0) {
            onShowStatus(`No packages found with keyword "${bulkKeyword}"`, 'info');
            return;
        }

        setConfirmation({
            isOpen: true,
            title: 'Confirm Bulk Price Adjustment',
            message: `You are about to adjust prices for ${matchingPackages.length} packages containing "${bulkKeyword}" by ${bulkAdjustment}${adjustmentType === 'percentage' ? '%' : ' (Fixed)'}. This will modify both Net and Total prices. Continue?`,
            type: 'warning',
            onConfirm: async () => {
                setIsUpdating(true);
                try {
                    for (const p of matchingPackages) {
                        const currentPrice = p.totalPrice || 0;
                        const currentPriceNet = p.totalPriceNet || 0;
                        let newPrice = currentPrice;
                        let newPriceNet = currentPriceNet;

                        if (adjustmentType === 'percentage') {
                            const factor = 1 + (bulkAdjustment / 100);
                            newPrice = currentPrice * factor;
                            newPriceNet = currentPriceNet * factor;
                        } else {
                            newPrice = currentPrice + bulkAdjustment;
                            newPriceNet = currentPriceNet + bulkAdjustment;
                        }

                        const updatedPkg = {
                            ...p,
                            totalPrice: Math.round(newPrice * 100) / 100,
                            totalPriceNet: Math.round(newPriceNet * 100) / 100
                        };
                        await updateItem(updatedPkg);
                    }
                    onShowStatus(`Successfully adjusted ${matchingPackages.length} packages.`, 'success');
                    setIsBulkPanelOpen(false);
                    setBulkKeyword('');
                    setBulkAdjustment(0);
                } finally {
                    setIsUpdating(false);
                    // Explicitly close first to ensure immediate feedback as requested by user
                    setConfirmation({ isOpen: false, title: '', message: '' });
                }
            }
        });
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    return (
        <div className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                        <Filter size={16} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">Entity:</span>
                        <select 
                            value={entityFilter} 
                            onChange={(e) => setEntityFilter(e.target.value)}
                            className="text-sm border-none bg-transparent focus:ring-0 outline-none pr-8 cursor-pointer"
                        >
                            <option value="all">All Entities</option>
                            {businessEntities.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                        <ArrowUpDown size={16} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">Sort by:</span>
                        <button 
                            onClick={() => toggleSort('name')}
                            className={`text-sm px-2 py-0.5 rounded transition-colors ${sortField === 'name' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-gray-100 text-gray-600'}`}
                        >
                            Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </button>
                        <button 
                            onClick={() => toggleSort('totalPrice')}
                            className={`text-sm px-2 py-0.5 rounded transition-colors ${sortField === 'totalPrice' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-gray-100 text-gray-600'}`}
                        >
                            Price {sortField === 'totalPrice' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </button>
                    </div>

                    {entityFilter !== 'all' && (
                        <button 
                            onClick={() => setEntityFilter('all')}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                        >
                            <X size={12} /> Clear Filter
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsBulkPanelOpen(!isBulkPanelOpen)}
                        className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${isBulkPanelOpen ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}
                    >
                        <Zap size={18}/> Bulk Price Adjust
                    </button>
                    <button 
                        onClick={() => { setSelectedPackage(null); setIsModalOpen(true); }} 
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-md flex items-center gap-2 transition-all font-semibold active:transform active:scale-95"
                    >
                        <PlusCircle size={18}/> Add Service Package
                    </button>
                </div>
            </div>

            {/* Bulk Update Panel */}
            {isBulkPanelOpen && (
                <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-5 shadow-inner animate-in slide-in-from-top duration-300">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-full mt-1">
                            <AlertCircle size={20} />
                        </div>
                        <div className="flex-grow">
                            <h3 className="text-amber-800 font-bold mb-1">Global Price Adjustment</h3>
                            <p className="text-amber-700/80 text-sm mb-4">Target multiple packages by name, description, or contents to increase or decrease prices instantly.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-amber-800 uppercase tracking-wider">1. Keyword Filter</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. 'Oil' or 'Service'"
                                        value={bulkKeyword}
                                        onChange={(e) => setBulkKeyword(e.target.value)}
                                        className="w-full bg-white border-amber-200 rounded-lg p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-amber-800 uppercase tracking-wider">2. Adjustment Value</label>
                                    <div className="flex bg-white rounded-lg border border-amber-200 overflow-hidden">
                                        <button 
                                            onClick={() => setAdjustmentType('percentage')}
                                            className={`p-2 flex-grow flex items-center justify-center transition-colors ${adjustmentType === 'percentage' ? 'bg-amber-500 text-white' : 'text-amber-400 hover:bg-amber-50'}`}
                                        >
                                            <Percent size={16} />
                                        </button>
                                        <button 
                                            onClick={() => setAdjustmentType('fixed')}
                                            className={`p-2 flex-grow flex items-center justify-center transition-colors ${adjustmentType === 'fixed' ? 'bg-amber-500 text-white' : 'text-amber-400 hover:bg-amber-50'}`}
                                        >
                                            <PoundSterling size={16} />
                                        </button>
                                        <input 
                                            type="number" 
                                            placeholder="0.00"
                                            value={bulkAdjustment === 0 ? '' : bulkAdjustment}
                                            onChange={(e) => setBulkAdjustment(parseFloat(e.target.value) || 0)}
                                            className="w-24 text-right border-none focus:ring-0 outline-none p-2 text-sm font-mono font-bold"
                                        />
                                    </div>
                                    <div className="text-[10px] text-amber-600 mt-1 italic italic">Use negative numbers to decrease prices.</div>
                                </div>
                                <div className="flex items-end">
                                    <button 
                                        onClick={handleBulkUpdate}
                                        disabled={isUpdating || !bulkKeyword}
                                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95"
                                    >
                                        {isUpdating ? 'Updating...' : <><Check size={18}/> Apply Adjustment</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-y-auto max-h-[60vh]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr className="border-b">
                                <th className="p-4 font-semibold text-gray-600 uppercase tracking-wider">Package Name</th>
                                <th className="p-4 font-semibold text-gray-600 uppercase tracking-wider">Entity</th>
                                <th className="p-4 font-semibold text-gray-600 uppercase tracking-wider text-right">Total Price</th>
                                <th className="p-4 font-semibold text-gray-600 uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredAndSortedPackages.length > 0 ? (
                                filteredAndSortedPackages.map(p => (
                                    <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="p-4 font-medium text-gray-900">{p.name}</td>
                                        <td className="p-4 text-gray-500 italic text-xs">
                                            {businessEntities.find(e => e.id === p.entityId)?.name || 'Multiple/All'}
                                        </td>
                                        <td className="p-4 text-right font-semibold text-gray-900">
                                            {formatCurrency(p.totalPrice)}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-3 opacity-80 group-hover:opacity-100">
                                                <button 
                                                    onClick={() => { setSelectedPackage(p); setIsModalOpen(true); }} 
                                                    className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                                    title="Edit Package"
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => handleClone(p)} 
                                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
                                                    title="Clone Package"
                                                >
                                                    <Copy size={16}/> Clone
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(p)} 
                                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1"
                                                    title="Delete Package"
                                                >
                                                    <Trash2 size={16}/> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-500">
                                        No service packages found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <ServicePackageFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(p) => { 
                        updateItem(p); 
                        setIsModalOpen(false); 
                        onShowStatus('Service package saved successfully', 'success'); 
                    }} 
                    servicePackage={selectedPackage} 
                    taxRates={taxRates} 
                    entityId={selectedEntityId} 
                    businessEntities={businessEntities} 
                    parts={parts} 
                />
            )}
        </div>
    );
};
