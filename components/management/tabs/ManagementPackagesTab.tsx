import React, { useState, useMemo } from 'react';
import { useData } from '../../../core/state/DataContext';
import { ServicePackage, BusinessEntity } from '../../../types';
import { PlusCircle, Copy, Trash2, ArrowUpDown, Filter, X } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import ServicePackageFormModal from '../../ServicePackageFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { useApp } from '../../../core/state/AppContext';

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
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

                <button 
                    onClick={() => { setSelectedPackage(null); setIsModalOpen(true); }} 
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-md flex items-center gap-2 transition-all font-semibold active:transform active:scale-95"
                >
                    <PlusCircle size={18}/> Add Service Package
                </button>
            </div>

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
