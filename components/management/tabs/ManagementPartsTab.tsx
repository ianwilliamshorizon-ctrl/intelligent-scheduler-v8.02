import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Part } from '../../../types';
import { PlusCircle, Upload, Trash2, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import PartFormModal from '../../PartFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { saveDocument, getAll } from '../../../core/db';

/**
 * Helper to clean currency strings or malformed numbers into pure floats.
 */
const cleanToNumber = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    // Remove everything except numbers, decimal points, and minus signs
    const cleaned = String(val).replace(/[^0-9.-]+/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

export const ManagementPartsTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { parts, suppliers, taxRates, setParts } = useData();
    const { updateItem, deleteItem } = useManagementTable(parts, 'brooks_parts');

    const [selectedPart, setSelectedPart] = useState<Part | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [overwrite, setOverwrite] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    // Filter logic for search bar
    const filtered = parts.filter(p => {
        const pNum = p.partNumber ? String(p.partNumber).toLowerCase() : '';
        const pDesc = p.description ? String(p.description).toLowerCase() : '';
        const sTerm = (searchTerm || '').toLowerCase();
        return pNum.includes(sTerm) || pDesc.includes(sTerm);
    });

    const handleImportParts = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
    
        setIsImporting(true);
        setImportProgress(0);
    
        try {
            const data = await parseCsv(file);
            if (!data || data.length === 0) throw new Error("No data found");
    
            // 1. CASE-INSENSITIVE HEADER SNIFFER
            const actualKeys = Object.keys(data[0]);
            console.log("Headers detected in file:", actualKeys);
    
            const findKeySafe = (target: string) => {
                return actualKeys.find(k => k.toLowerCase().replace(/\s/g, '') === target.toLowerCase());
            };
    
            const costKey = findKeySafe('costprice') || findKeySafe('cost') || "";
            const saleKey = findKeySafe('saleprice') || findKeySafe('sellprice') || findKeySafe('price') || "";
            const stockKey = findKeySafe('stockquantity') || findKeySafe('onstock') || findKeySafe('stock') || "";
            const partKey = findKeySafe('partnumber') || findKeySafe('part') || "";
            const descKey = findKeySafe('description') || findKeySafe('desc') || "";
    
            // 2. MAP DATA
            const newParts: Part[] = data.map((row: any, index: number) => {
                const cost = cleanToNumber(row[costKey]);
                const sale = cleanToNumber(row[saleKey]);
                
                if (index < 5) {
                    console.log(`Row ${index} | Using Key: "${saleKey}" | Value: ${row[saleKey]} | Parsed: ${sale}`);
                }
    
                return {
                    id: row.id || `PART_${Date.now()}_${index}`,
                    partNumber: String(row[partKey] || 'UNKNOWN').trim(),
                    description: String(row[descKey] || '').trim(),
                    costPrice: cost,
                    salePrice: sale,
                    stockQuantity: cleanToNumber(row[stockKey]),
                    isStockItem: true,
                    taxCodeId: row.taxCodeId || 'TAX-STD'
                };
            });
    
            // 3. BATCH SAVE TO brooks_parts
            let added = 0;
            let updated = 0;
            const chunkSize = 50;
            for (let i = 0; i < newParts.length; i += chunkSize) {
                const chunk = newParts.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (p) => {
                    const existing = parts.find(ex => ex.id === p.id || (p.partNumber !== 'UNKNOWN' && ex.partNumber === p.partNumber));
                    if (existing) {
                        if (overwrite) {
                            await saveDocument('brooks_parts', { ...existing, ...p });
                            updated++;
                        }
                    } else {
                        await saveDocument('brooks_parts', p);
                        added++;
                    }
                }));
                setImportProgress(Math.round(((i + chunk.length) / newParts.length) * 100));
                if (i % 500 === 0) await new Promise(r => setTimeout(r, 10));
            }
            
            const finalParts = await getAll('brooks_parts') as Part[];
            setParts(finalParts);
            onShowStatus(`Success: ${added} added, ${updated} updated.`, 'success');
    
        } catch (err) {
            console.error('Import Error:', err);
            onShowStatus('Import failed. Check console.', 'error');
        } finally {
            setIsImporting(false);
            if (e.target) e.target.value = ''; 
        }
    };

    return (
        <div className="p-4">
            {/* Header Actions */}
            <div className="flex justify-end items-center mb-6 gap-3">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
                    <input 
                        type="checkbox" 
                        id="overwrite" 
                        checked={overwrite} 
                        onChange={(e) => setOverwrite(e.target.checked)} 
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                    />
                    <label htmlFor="overwrite" className="text-xs font-bold text-gray-600 uppercase cursor-pointer">
                        Overwrite Duplicates
                    </label>
                </div>
                
                <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer shadow-sm transition-all text-sm font-medium ${isImporting ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                    {isImporting ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16}/>}
                    {isImporting ? `Processing ${importProgress}%` : 'Import CSV'}
                    <input 
                        type="file" 
                        accept=".csv" 
                        className="hidden" 
                        onChange={handleImportParts} 
                        disabled={isImporting} 
                    />
                </label>

                <button 
                    onClick={() => { setSelectedPart(null); setIsModalOpen(true); }} 
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2"
                >
                    <PlusCircle size={16}/> Add Part
                </button>
            </div>

            {/* Data Table */}
            <div className="overflow-hidden border border-gray-200 rounded-xl bg-white shadow-sm">
                <div className="overflow-y-auto max-h-[65vh]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b sticky top-0 z-10">
                            <tr>
                                <th className="p-4 font-semibold text-gray-700">Part No.</th>
                                <th className="p-4 font-semibold text-gray-700">Description</th>
                                <th className="p-4 font-semibold text-gray-700 text-right">Stock</th>
                                <th className="p-4 font-semibold text-gray-700 text-right">Cost</th>
                                <th className="p-4 font-semibold text-gray-700 text-right">Sell</th>
                                <th className="p-4 font-semibold text-gray-700 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.length > 0 ? (
                                filtered.map(p => (
                                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                                        <td className="p-4 font-mono font-medium text-blue-900">{p.partNumber}</td>
                                        <td className="p-4 text-gray-600">{p.description}</td>
                                        <td className="p-4 text-right tabular-nums">{p.stockQuantity}</td>
                                        <td className="p-4 text-right text-gray-500">{formatCurrency(p.costPrice)}</td>
                                        <td className="p-4 text-right font-bold text-green-700">{formatCurrency(p.salePrice)}</td>
                                        <td className="p-4 text-center">
                                            <button 
                                                onClick={() => { setSelectedPart(p); setIsModalOpen(true); }} 
                                                className="text-indigo-600 hover:text-indigo-900 font-semibold mr-4"
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => deleteItem(p.id)} 
                                                className="text-red-500 hover:text-red-700 font-semibold"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-gray-400">
                                        No parts found. Try importing a CSV.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Manual Entry / Editing */}
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