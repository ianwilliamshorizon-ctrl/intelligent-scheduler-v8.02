import React, { useState, useMemo } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Part } from '../../../types';
import { PlusCircle, Upload, RefreshCw, Search } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import PartFormModal from '../../PartFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { saveDocument, db } from '../../../core/db';
import { writeBatch, doc, collection } from 'firebase/firestore';

/**
 * HELPER: Highlight matching text in yellow
 */
const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) return <>{text}</>;
    
    // Split highlight into words to match the smart search logic
    const words = highlight.split(' ').filter(w => w.trim().length > 0);
    if (words.length === 0) return <>{text}</>;

    // Create a regex pattern: (word1|word2|word3)
    const pattern = new RegExp(`(${words.join('|')})`, 'gi');
    const parts = text.split(pattern);

    return (
        <>
            {parts.map((part, i) => 
                pattern.test(part) ? (
                    <mark key={i} className="bg-yellow-200 text-black rounded-sm px-0.5">{part}</mark>
                ) : (
                    part
                )
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

    // Filter logic
    const filtered = useMemo(() => {
        const list = parts || [];
        if (!searchTerm) return list;
        
        const term = searchTerm.toLowerCase();
        const searchWords = term.split(' ').filter(word => word.length > 0);
        
        return list.filter(p => {
            const pNum = String(p.partNumber || '').toLowerCase();
            const pDesc = String(p.description || '').toLowerCase();
            return searchWords.every(word => pNum.includes(word) || pDesc.includes(word));
        });
    }, [parts, searchTerm]);

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

            if (uniqueNewParts.length === 0) {
                onShowStatus('No new parts found.', 'info');
                setIsImporting(false);
                return;
            }

            const batchSize = 400;
            let addedCount = 0;
            for (let i = 0; i < uniqueNewParts.length; i += batchSize) {
                const chunk = uniqueNewParts.slice(i, i + batchSize);
                const batch = writeBatch(db);
                chunk.forEach(part => {
                    const docRef = doc(collection(db, 'brooks_parts'), part.id);
                    batch.set(docRef, part);
                });
                await batch.commit();
                addedCount += chunk.length;
            }
            onShowStatus(`Imported ${addedCount} parts.`, 'success');
        } catch (err) {
            console.error(err);
            onShowStatus('Import failed.', 'error');
        } finally {
            setIsImporting(false);
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 font-medium italic">
                    {searchTerm ? `Found ${filtered.length} matches` : `Total Inventory: ${parts.length} items`}
                </div>
                <div className="flex gap-2">
                    <label className={`flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 cursor-pointer shadow-sm transition-all ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isImporting ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16}/>}
                        Mass Load
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportParts} />
                    </label>
                    <button onClick={() => { setSelectedPart(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2 font-semibold">
                        <PlusCircle size={16}/> Add Part
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-y-auto max-h-[72vh]">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                            <tr>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[10px] tracking-widest">Part Number</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[10px] tracking-widest">Description</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[10px] tracking-widest text-right">Stock</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[10px] tracking-widest text-right">Unit Price</th>
                                <th className="p-4 font-bold text-gray-600 uppercase text-[10px] tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <Search size={24} className="text-gray-300 mx-auto mb-2" />
                                        <div className="text-gray-400">No results for "{searchTerm}"</div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(p => (
                                    <tr key={p.id} className="hover:bg-indigo-50/40 transition-colors group">
                                        <td className="p-4 font-mono font-bold text-indigo-700">
                                            <HighlightText text={String(p.partNumber)} highlight={searchTerm} />
                                        </td>
                                        <td className="p-4 text-gray-700 font-medium">
                                            <HighlightText text={String(p.description)} highlight={searchTerm} />
                                        </td>
                                        <td className={`p-4 text-right font-bold ${p.stockQuantity <= 0 ? 'text-red-400' : 'text-emerald-600'}`}>
                                            {p.stockQuantity}
                                        </td>
                                        <td className="p-4 text-right font-semibold text-gray-900">
                                            {formatCurrency(p.salePrice)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => { setSelectedPart(p); setIsModalOpen(true); }} className="px-3 py-1 bg-white border border-gray-200 rounded text-indigo-600 hover:bg-indigo-600 hover:text-white font-bold text-xs shadow-sm">Edit</button>
                                                <button onClick={() => deleteItem(p.id)} className="px-3 py-1 bg-white border border-gray-200 rounded text-red-500 hover:bg-red-500 hover:text-white font-bold text-xs shadow-sm">Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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