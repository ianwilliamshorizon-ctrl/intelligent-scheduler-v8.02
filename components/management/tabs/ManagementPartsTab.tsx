import React, { useState, useEffect } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Part } from '../../../types';
import { PlusCircle, Upload, Loader2, Hash, Package, TrendingUp, AlertCircle, Search } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import PartFormModal from '../../PartFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { saveDocument, getAll, subscribeToCollection } from '../../../core/db';

const cleanToNumber = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = String(val).replace(/[^0-9.-]+/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

export const ManagementPartsTab = ({ searchTerm = '', onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { 
        suppliers = [], 
        taxRates = [], 
        setParts, 
        refreshActiveData 
    } = useData();
    
    // 1. DATABASE CONTROLLED STATE
    const [localParts, setLocalParts] = useState<Part[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    // 2. LIVE SYNC EFFECT: Connect directly to the Cloud DB
    useEffect(() => {
        setIsLoading(true);
        console.log("[Inventory] Establishing Live Stream to brooks_parts...");
        
        const unsubscribe = subscribeToCollection<Part>('brooks_parts', (data) => {
            setLocalParts(data);
            if (setParts) setParts(data);
            setIsLoading(false);
            console.log(`[Inventory] Sync Complete. ${data.length} parts loaded.`);
        });

        return () => unsubscribe();
    }, [setParts]);

    const { deleteItem } = useManagementTable(localParts || [], 'brooks_parts');

    const [selectedPart, setSelectedPart] = useState<Part | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [overwrite, setOverwrite] = useState(false);

    // 3. PERFORMANCE FILTERING (Handles 21k parts without crashing the browser)
    const filtered = React.useMemo(() => {
        if (!searchTerm) return localParts.slice(0, 100); // Limit view for speed
        const s = searchTerm.toLowerCase();
        return localParts
            .filter(p => 
                (p.partNumber || '').toLowerCase().includes(s) || 
                (p.description || '').toLowerCase().includes(s)
            )
            .slice(0, 100); 
    }, [localParts, searchTerm]);

    const handleSave = async (updatedPart: Part) => {
        try {
            await saveDocument('brooks_parts', updatedPart);
            setIsModalOpen(false);
            setSelectedPart(null);
            onShowStatus('Part saved to Cloud successfully.', 'success');
        } catch (error) {
            onShowStatus('Cloud save failed.', 'error');
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
    
            // CHUNKED UPLOAD to prevent Firestore timeouts
            for (let i = 0; i < newParts.length; i += 25) {
                const chunk = newParts.slice(i, i + 25);
                await Promise.all(chunk.map(async (p) => {
                    const existing = localParts.find(ex => ex.partNumber === p.partNumber);
                    if (existing && overwrite) {
                        await saveDocument('brooks_parts', { ...existing, ...p });
                    } else if (!existing) {
                        await saveDocument('brooks_parts', p);
                    }
                }));
                setImportProgress(Math.round(((i + chunk.length) / newParts.length) * 100));
            }
            
            onShowStatus('Cloud Import Complete.', 'success');
        } catch (err) {
            onShowStatus('Import failed.', 'error');
        } finally {
            setIsImporting(false);
            e.target.value = ''; 
        }
    };

    return (
        <div className="p-1">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <Package className="text-indigo-600" size={24} />
                        Inventory Control
                        {isLoading && <Loader2 className="animate-spin text-slate-300" size={20} />}
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">
                        {isLoading ? 'Fetching live registry...' : `Total Registry: ${localParts.length} Parts`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2 px-3 py-1.5">
                            <input type="checkbox" id="overwrite" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                            <label htmlFor="overwrite" className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer tracking-widest leading-none">Overwrite</label>
                        </div>
                        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer font-bold text-xs transition-all ${isImporting ? 'bg-slate-200 text-slate-400' : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50'}`}>
                            {isImporting ? <Loader2 className="animate-spin" size={14}/> : <Upload size={14}/>}
                            {isImporting ? `${importProgress}%` : 'IMPORT CSV'}
                            <input type="file" accept=".csv" className="hidden" onChange={handleImportParts} disabled={isImporting} />
                        </label>
                    </div>

                    <button onClick={() => { setSelectedPart(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95">
                        <PlusCircle size={18}/> Add New Part
                    </button>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="overflow-y-auto max-h-[65vh]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 sticky top-0 z-10">
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em]">Part Details</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-center">In Stock</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-right">Wholesale (Cost)</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-right">Retail (Sale)</th>
                                <th className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-[0.15em] text-center">Operations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32} />
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Cloud Inventory...</span>
                                    </td>
                                </tr>
                            ) : filtered.length > 0 ? (
                                filtered.map(p => (
                                    <tr key={p.id} className="group hover:bg-slate-50/80 transition-all">
                                        <td className="px-6 py-5">
                                            <div className="flex items-start gap-4">
                                                <div className="mt-1 p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                                    <Hash size={16}/>
                                                </div>
                                                <div>
                                                    <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 font-black text-[9px] uppercase tracking-wider mb-1">
                                                        {p.partNumber || 'NO-SKU'}
                                                    </span>
                                                    <div className="text-slate-900 font-bold text-sm leading-tight uppercase tracking-tight">
                                                        {p.description}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-xs ${p.stockQuantity <= 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {p.stockQuantity <= 0 && <AlertCircle size={12} />}
                                                {p.stockQuantity}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="font-mono text-slate-400 font-bold text-sm">
                                                {formatCurrency(p.costPrice)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-mono text-indigo-600 font-black text-base">
                                                    {formatCurrency(p.salePrice)}
                                                </span>
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500">
                                                    <TrendingUp size={10} />
                                                    {p.costPrice > 0 ? Math.round(((p.salePrice - p.costPrice) / p.costPrice) * 100) : 0}% MARGIN
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex justify-center items-center gap-2">
                                                <button onClick={() => { setSelectedPart(p); setIsModalOpen(true); }} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-black text-[10px] uppercase tracking-widest text-slate-600 hover:border-indigo-600 hover:text-indigo-600 shadow-sm transition-all">
                                                    Edit
                                                </button>
                                                <button onClick={() => { if(window.confirm('Delete part from Cloud?')) deleteItem(p.id); }} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-black text-[10px] uppercase tracking-widest text-slate-300 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all">
                                                    Del
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <Package size={48} />
                                            <span className="font-black uppercase tracking-[0.2em] text-xs">Zero results found in Cloud</span>
                                        </div>
                                    </td>
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
                    suppliers={suppliers || []} 
                    taxRates={taxRates || []} 
                />
            )}
        </div>
    );
};