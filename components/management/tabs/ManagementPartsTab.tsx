import React, { useState, useMemo, useEffect, memo } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Part } from '../../../types';
import { PlusCircle, Upload, RefreshCw, Search } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import PartFormModal from '../../PartFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { db } from '../../../core/db';
import { writeBatch, doc, collection } from 'firebase/firestore';

/**
 * ROW COMPONENT
 */
const PartRow = memo(({ 
    p, 
    searchTerm, 
    onEdit, 
    onDelete 
}: { 
    p: Part, 
    searchTerm: string, 
    onEdit: (p: Part) => void, 
    onDelete: (id: string) => void 
}) => (
    <div className="border-b border-gray-100 flex items-center hover:bg-gray-50 transition-colors text-sm bg-white shrink-0 h-[56px]">
        <div className="px-4 w-[20%] font-mono font-bold text-indigo-700 truncate">
            <HighlightText text={String(p.partNumber)} highlight={searchTerm} />
        </div>
        <div className="px-4 w-[40%] text-gray-700 font-medium truncate">
            <HighlightText text={String(p.description)} highlight={searchTerm} />
        </div>
        <div className={`px-4 w-[10%] text-right font-bold ${p.stockQuantity <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {p.stockQuantity}
        </div>
        <div className="px-4 w-[15%] text-right font-semibold text-gray-900">
            {formatCurrency(p.salePrice)}
        </div>
        <div className="px-4 w-[15%] flex justify-center gap-2">
            <button 
                onClick={() => onEdit(p)} 
                className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 text-xs font-bold transition-colors"
            >
                Edit
            </button>
            <button 
                onClick={() => onDelete(p.id)} 
                className="px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs font-bold transition-colors"
            >
                Del
            </button>
        </div>
    </div>
));

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) return <>{text}</>;
    const words = highlight.split(' ').filter(w => w.trim().length > 0);
    const pattern = new RegExp(`(${words.join('|')})`, 'gi');
    const parts = text.split(pattern);
    return (
        <>
            {parts.map((part, i) => 
                pattern.test(part) ? (
                    <mark key={i} className="bg-yellow-200 text-black rounded-sm px-0.5">{part}</mark>
                ) : (part)
            )}
        </>
    );
};

export const ManagementPartsTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { parts, suppliers, taxRates } = useData();
    const { updateItem, deleteItem } = useManagementTable(parts, 'brooks_parts');

    const [selectedPart, setSelectedPart] = useState<Part | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(searchTerm), 200);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const filtered = useMemo(() => {
        const list = parts || [];
        if (!debouncedSearch) return list;
        const searchWords = debouncedSearch.toLowerCase().split(' ').filter(word => word.length > 0);
        return list.filter(p => {
            const pNum = String(p.partNumber || '').toLowerCase();
            const pDesc = String(p.description || '').toLowerCase();
            return searchWords.every(word => pNum.includes(word) || pDesc.includes(word));
        });
    }, [parts, debouncedSearch]);

    const handleImportParts = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        onShowStatus("Processing CSV...", "info");
        try {
            const data = await parseCsv(file);
            const sanitizedParts: Part[] = data.map((row: any) => ({
                id: row.id || `part_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                partNumber: String(row.partNumber || row.part_number || 'UNKNOWN').trim(),
                description: String(row.description || 'Imported Part').trim(),
                salePrice: Number(row.salePrice || row.price || 0),
                costPrice: Number(row.costPrice || row.cost || 0),
                stockQuantity: Number(row.stockQuantity || row.stock || 0),
                isStockItem: true,
                defaultSupplierId: row.defaultSupplierId || undefined,
                taxCodeId: row.taxCodeId || taxRates.find(t => t.code === 'T1')?.id || 'T1'
            }));
            
            const existingPartNumbers = new Set(parts.map(p => String(p.partNumber).toLowerCase()));
            const uniqueNewParts = sanitizedParts.filter(p => !existingPartNumbers.has(p.partNumber.toLowerCase()));

            if (uniqueNewParts.length > 0) {
                const batchSize = 400;
                for (let i = 0; i < uniqueNewParts.length; i += batchSize) {
                    const chunk = uniqueNewParts.slice(i, i + batchSize);
                    const batch = writeBatch(db);
                    chunk.forEach(part => batch.set(doc(collection(db, 'brooks_parts'), part.id), part));
                    await batch.commit();
                }
                onShowStatus(`Imported ${uniqueNewParts.length} parts.`, 'success');
            }
        } catch (err) {
            onShowStatus('Import failed.', 'error');
        } finally {
            setIsImporting(false);
            if (e.target) e.target.value = '';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 font-medium italic">
                    {debouncedSearch ? `Found ${filtered.length} matches` : `Total Inventory: ${parts.length} items`}
                </div>
                <div className="flex gap-2">
                    <label className={`flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer shadow-sm text-sm font-semibold ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isImporting ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16}/>}
                        Mass Load
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportParts} />
                    </label>
                    <button onClick={() => { setSelectedPart(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2 text-sm font-semibold">
                        <PlusCircle size={16}/> Add Part
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[70vh] overflow-hidden">
                {/* Header Section */}
                <div className="bg-gray-50 border-b border-gray-200 flex text-[10px] font-bold text-gray-600 uppercase tracking-widest shrink-0">
                    <div className="p-4 w-[20%]">Part Number</div>
                    <div className="p-4 w-[40%]">Description</div>
                    <div className="p-4 w-[10%] text-right">Stock</div>
                    <div className="p-4 w-[15%] text-right">Unit Price</div>
                    <div className="p-4 w-[15%] text-center">Actions</div>
                </div>

                {/* Standard Scrollable List */}
                <div className="flex-1 overflow-y-auto bg-white min-h-0">
                    {filtered.length === 0 ? (
                        <div className="p-12 text-center h-full flex flex-col items-center justify-center">
                            <Search size={24} className="text-gray-300 mb-2" />
                            <div className="text-gray-400">No results for "{debouncedSearch}"</div>
                        </div>
                    ) : (
                        <div className="flex flex-col min-w-full">
                            {filtered.map((p) => (
                                <PartRow 
                                    key={p.id} 
                                    p={p} 
                                    searchTerm={debouncedSearch} 
                                    onEdit={(part) => { setSelectedPart(part); setIsModalOpen(true); }}
                                    onDelete={deleteItem}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <PartFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={(p) => { updateItem(p); setIsModalOpen(false); }} 
                    part={selectedPart} 
                    suppliers={suppliers} 
                    taxRates={taxRates} 
                />
            )}
        </div>
    );
};