
import React, { useState } from 'react';
import { useData } from '../../../core/state/DataContext';
import { Part } from '../../../types';
import { PlusCircle, Upload } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatUtils';
import PartFormModal from '../../PartFormModal';
import { useManagementTable } from '../hooks/useManagementTable';
import { parseCsv } from '../../../utils/csvUtils';
import { saveDocument } from '../../../core/db';

export const ManagementPartsTab = ({ searchTerm, onShowStatus }: { searchTerm: string, onShowStatus: (text: string, type: 'info' | 'success' | 'error') => void }) => {
    const { parts, suppliers, taxRates } = useData();
    const { updateItem, deleteItem } = useManagementTable(parts, 'brooks_parts');

    const [selectedPart, setSelectedPart] = useState<Part | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filtered = parts.filter(p => p.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) || p.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleImportParts = async (e: React.ChangeEvent<HTMLInputElement>) => {
         const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await parseCsv(file);
            const newParts: Part[] = data.map((row: any) => ({
                id: row.id || `part_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                partNumber: row.partNumber || row.part_number || 'UNKNOWN',
                description: row.description || 'Imported Part',
                salePrice: Number(row.salePrice || row.price || 0),
                costPrice: Number(row.costPrice || row.cost || 0),
                stockQuantity: Number(row.stockQuantity || row.stock || 0),
                isStockItem: true,
                defaultSupplierId: row.defaultSupplierId || undefined,
                taxCodeId: row.taxCodeId || taxRates.find(t => t.code === 'T1')?.id
            }));
            
            let addedCount = 0;
            for (const p of newParts) {
                if (!parts.some(ex => ex.partNumber.toLowerCase() === p.partNumber.toLowerCase())) {
                     await saveDocument('brooks_parts', p);
                     addedCount++;
                }
            }

            if (addedCount > 0) {
                onShowStatus(`Imported ${addedCount} new parts successfully.`, 'success');
            } else {
                onShowStatus('No new parts imported. Duplicates skipped.', 'info');
            }
        } catch (err) {
            console.error(err);
            onShowStatus('Error importing parts. Please check file format.', 'error');
        }
        e.target.value = '';
    };

    return (
        <div>
            <div className="flex justify-end items-center mb-4 gap-2">
                <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 cursor-pointer shadow">
                    <Upload size={16}/> Import CSV
                    <input type="file" accept=".csv" className="hidden" onChange={handleImportParts} />
                </label>
                <button onClick={() => { setSelectedPart(null); setIsModalOpen(true); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 shadow flex items-center gap-2">
                    <PlusCircle size={16}/> Add Part
                </button>
            </div>
             <div className="overflow-y-auto max-h-[70vh]">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 sticky top-0"><tr><th className="p-2">Part No.</th><th className="p-2">Description</th><th className="p-2 text-right">Stock</th><th className="p-2 text-right">Price</th><th className="p-2">Actions</th></tr></thead>
                    <tbody>
                        {filtered.map(p => (
                            <tr key={p.id} className="border-b hover:bg-gray-50">
                                <td className="p-2 font-mono">{p.partNumber}</td>
                                <td className="p-2">{p.description}</td>
                                <td className="p-2 text-right">{p.stockQuantity}</td>
                                <td className="p-2 text-right">{formatCurrency(p.salePrice)}</td>
                                <td className="p-2">
                                    <button onClick={() => { setSelectedPart(p); setIsModalOpen(true); }} className="text-indigo-600 hover:underline mr-2">Edit</button>
                                    <button onClick={() => deleteItem(p.id)} className="text-red-600 hover:underline">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
