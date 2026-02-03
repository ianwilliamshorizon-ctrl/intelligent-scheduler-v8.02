import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Part } from '../../../types';
import { PlusCircle, Upload, Trash2, Loader2, Package, Hash, DollarSign, Search } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import PartFormModal from '../../PartFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { saveDocument, getAll } from '../../../core/db';

const cleanToNumber = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = String(val).replace(/[^0-9.-]+/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

export const ManagementPartsTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { parts, suppliers, taxRates, setParts, refreshActiveData } = useData();
    
    // 1. Local State for Instant UI Feedback
    const [localParts, setLocalParts] = useState<Part[]>(parts || []);

    // 2. Sync with Global Data Context
    useEffect(() => {
        if (parts) setLocalParts(parts);
    }, [parts]);

    const { deleteItem } = useManagementTable(parts, 'brooks_parts');

    const [selectedPart, setSelectedPart] = useState<Part | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [overwrite, setOverwrite] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    const filtered = localParts.filter(p => {
        const pNum = p.partNumber ? String(p.partNumber).toLowerCase() : '';
        const pDesc = p.description ? String(p.description).toLowerCase() : '';
        const sTerm = (searchTerm || '').toLowerCase();
        return pNum.includes(sTerm) || pDesc.includes(sTerm);
    });

    const handleSave = async (updatedPart: Part) => {
        try {
            await saveDocument('brooks_parts', updatedPart);
            
            const updateFn = (prev: Part[]) => {
                const exists = prev.find(p => p.id === updatedPart.id);
                return exists ? prev.map(p => p.id === updatedPart.id ? updatedPart : p) : [...prev, updatedPart];
            };

            setLocalParts(updateFn);
            if (setParts) setParts(updateFn);
            
            setIsModalOpen(false);
            setSelectedPart(null);
            await refreshActiveData(true);
            onShowStatus('Part saved successfully.', 'success');
        } catch (error) {
            onShowStatus('Failed to save part.', 'error');
        }
    };

    const handleImportParts = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        setImportProgress(0);
    
        try {
            const data = await parseCsv(file);
            if (!data || data.length === 0) throw new Error("No data found");
    
            const actualKeys = Object.keys(data[0]);
            const findKeySafe = (target: string) => actualKeys.find(k => k.toLowerCase().replace(/\s/g, '') === target.toLowerCase());
    
            const costKey = findKeySafe('costprice') || findKeySafe('cost') || "";
            const saleKey = findKeySafe('saleprice') || findKeySafe('sellprice') || findKeySafe('price') || "";
            const stockKey = findKeySafe('stockquantity') || findKeySafe('onstock') || findKeySafe('stock') || "";
            const partKey = findKeySafe('partnumber') || findKeySafe('part') || "";
            const descKey = findKeySafe('description') || findKeySafe('desc') || "";
    
            const newParts: Part[] = data.map((row: any, index: number) => ({
                id: row.id || `PART_${Date.now()}_${index}`,
                partNumber: String(row[partKey] || 'UNKNOWN').trim(),
                description: String(row[descKey] || '').trim(),
                costPrice: cleanToNumber(row[costKey]),
                salePrice: cleanToNumber(row[saleKey]),
                stockQuantity: cleanToNumber(row[stockKey]),
                isStockItem: true,
                taxCodeId: row.taxCodeId || 'TAX-STD'
            }));
    
            let addedCount = 0;
            let updatedCount = 0;
            const chunkSize = 50;

            for (let i = 0; i < newParts.length; i += chunkSize) {
                const chunk = newParts.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (p) => {
                    const existing = localParts.find(ex => ex.id === p.id || (p.partNumber !== 'UNKNOWN' && ex.partNumber === p.partNumber));
                    if (existing) {
                        if (overwrite) {
                            await saveDocument('brooks_parts', { ...existing, ...p });
                            updatedCount++;
                        }
                    } else {
                        await saveDocument('brooks_parts', p);
                        addedCount++;
                    }
                }));
                setImportProgress(Math.round(((i + chunk.length) / newParts.length) * 100));
            }
            
            const finalParts = await getAll('brooks_parts') as Part[];
            setLocalParts(finalParts);
            if (setParts) setParts(finalParts);
            onShowStatus(`Imported: ${addedCount} added, ${updatedCount} updated.`, 'success');
            await refreshActiveData(true);
        } catch (err) {
            onShowStatus('Import failed.', 'error');
        } finally {
            setIsImporting(false);
            e.target.value = ''; 
        }
    };

    return (
        <div className="p-1">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Parts Inventory</h2>
                    <p className="text-sm text-gray-500 font-medium">Manage stock levels and wholesale pricing</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm">
                        <input type="checkbox" id="overwrite" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                        <label htmlFor="overwrite" className="text-[10px] font-black text-gray-400 uppercase cursor-pointer tracking-widest">Overwrite Duplicates</label>
                    </div>
                    
                    <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer shadow-sm border-2 font-bold text-sm transition-all active:scale-95 ${isImporting ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white border-indigo-600 text-indigo-600 hover:bg-indigo-50'}`}>
                        {isImporting ? <Loader2 className="animate-spin" size={18}/> : <Upload size={18}/>}
                        {isImporting ? `${importProgress}%` : 'Import CSV'}
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportParts} disabled={isImporting} />
                    </label>

                    <button onClick={() => { setSelectedPart(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95">
                        <PlusCircle size={18}/> Add Part
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-y-auto max-h-[65vh]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest">Part Identification</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Stock</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Wholesale Cost</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-right">Retail Price</th>
                                <th className="p-4 font-black text-gray-400 uppercase text-[10px] tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length > 0 ? (
                                filtered.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gray-50 rounded-lg text-gray-400"><Hash size={14}/></div>
                                                <div>
                                                    <div className="font-black text-indigo-600 text-xs tracking-tight">{p.partNumber}</div>
                                                    <div className="text-gray-900 font-bold">{p.description}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className={`inline-block px-2 py-1 rounded-lg font-black text-xs ${p.stockQuantity <= 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                {p.stockQuantity}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-gray-400 font-bold">{formatCurrency(p.costPrice)}</td>
                                        <td className="p-4 text-right font-mono text-gray-900 font-black">{formatCurrency(p.salePrice)}</td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => { setSelectedPart(p); setIsModalOpen(true); }} className="font-black text-[10px] uppercase tracking-widest text-indigo-600 hover:text-indigo-800 p-2 hover:bg-indigo-50 rounded-lg transition-all">Edit</button>
                                            <button onClick={() => { if(confirm('Delete part?')) deleteItem(p.id); }} className="font-black text-[10px] uppercase tracking-widest text-gray-300 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-all">Delete</button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No parts matching search criteria</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <PartFormModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    onSave={handleSave} 
                    part={selectedPart} 
                    suppliers={suppliers} 
                    taxRates={taxRates} 
                />
            )}
        </div>
    );
};